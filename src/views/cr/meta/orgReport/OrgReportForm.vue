<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="报送机构" prop="orgId">
            <el-select
              v-model="formData.orgId"
              placeholder="请选择报送机构"
              filterable
              class="w-full"
              @change="handleOrgChange"
            >
              <el-option
                v-for="item in orgOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="上报方式" prop="reportType">
            <el-select v-model="formData.reportType" class="w-full" placeholder="请选择上报方式">
              <el-option
                v-for="dict in getStrDictOptions(DICT_TYPE.CR_REPORT_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="监管局" prop="regulator">
        <el-input v-model="formData.regulator" placeholder="如 北京监管局" />
      </el-form-item>
      <el-form-item label="上报路径" prop="uploadPath">
        <el-input v-model="formData.uploadPath" placeholder="如 /bj/report/upload" />
      </el-form-item>
      <el-form-item label="下载路径" prop="downloadPath">
        <el-input v-model="formData.downloadPath" placeholder="如 /bj/report/feedback" />
      </el-form-item>
      <el-form-item label="文件命名规则" prop="fileRule">
        <el-input v-model="formData.fileRule" placeholder="如 HX_BJ_{table}_{date}.txt" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="是否压缩" prop="compress">
            <el-switch v-model="formData.compress" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio
                v-for="dict in getIntDictOptions(DICT_TYPE.COMMON_STATUS)"
                :key="dict.value"
                :value="dict.value"
              >
                {{ dict.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions, getStrDictOptions } from '@/utils/dict'
import { CommonStatusEnum } from '@/utils/constants'
import * as OrgReportApi from '@/api/cr/meta/orgReport'
import * as OrgApi from '@/api/cr/meta/org'

defineOptions({ name: 'CrMetaOrgReportForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()
const orgOptions = ref<OrgApi.OrgOptionVO[]>([])

const defaultFormData = (): OrgReportApi.OrgReportVO => ({
  id: undefined,
  orgId: undefined as unknown as number,
  orgName: '',
  reportType: 'SFTP',
  regulator: '',
  uploadPath: '',
  downloadPath: '',
  fileRule: '',
  compress: true,
  status: CommonStatusEnum.ENABLE
})

const formData = ref<OrgReportApi.OrgReportVO>(defaultFormData())

const formRules = reactive({
  orgId: [{ required: true, message: '报送机构不能为空', trigger: 'change' }],
  reportType: [{ required: true, message: '上报方式不能为空', trigger: 'change' }],
  regulator: [{ required: true, message: '监管局不能为空', trigger: 'blur' }],
  uploadPath: [{ required: true, message: '上报路径不能为空', trigger: 'blur' }]
})

/** 选择机构时同步机构名称 */
const handleOrgChange = (orgId: number) => {
  formData.value.orgName = orgOptions.value.find((item) => item.id === orgId)?.name || ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增机构上报配置' : '修改机构上报配置'
  formType.value = type
  resetForm()
  orgOptions.value = await OrgApi.getOrganizationSimpleList()
  if (id) {
    formLoading.value = true
    try {
      const data = await OrgReportApi.getOrgReport(id)
      formData.value = { ...defaultFormData(), ...data }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await OrgReportApi.createOrgReport(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await OrgReportApi.updateOrgReport(formData.value)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置 */
const resetForm = () => {
  formData.value = defaultFormData()
  formRef.value?.resetFields()
}
</script>
