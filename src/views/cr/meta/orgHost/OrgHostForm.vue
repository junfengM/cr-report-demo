<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="120px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="机构 / 监管局" prop="orgName">
            <el-select
              v-model="formData.orgName"
              placeholder="请选择或输入机构 / 监管局名称"
              filterable
              allow-create
              default-first-option
              class="w-full"
            >
              <el-option v-for="name in orgNameOptions" :key="name" :label="name" :value="name" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="协议" prop="protocol">
            <el-select v-model="formData.protocol" class="w-full" placeholder="请选择协议">
              <el-option v-for="item in PROTOCOL_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="主机地址" prop="remoteHost">
            <el-input v-model="formData.remoteHost" placeholder="如 10.10.21.11" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="端口" prop="port">
            <el-input-number
              v-model="formData.port"
              :min="1"
              :max="65535"
              controls-position="right"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="上报规则" prop="reportRule">
        <el-input v-model="formData.reportRule" placeholder="如 按日增量上报 / 按月全量上报" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="上传路径" prop="uploadPath">
            <el-input v-model="formData.uploadPath" placeholder="如 /bj/upload" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="下载路径" prop="downloadPath">
            <el-input v-model="formData.downloadPath" placeholder="如 /bj/download" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="formData.username" placeholder="FTP / SFTP 登录用户名" />
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
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { CommonStatusEnum } from '@/utils/constants'
import * as OrgHostApi from '@/api/cr/meta/orgHost'
import * as OrgApi from '@/api/cr/meta/org'

defineOptions({ name: 'CrMetaOrgHostForm' })

const { t } = useI18n()
const message = useMessage()

/** 上报协议（无字典，页面内维护） */
const PROTOCOL_OPTIONS = ['FTP', 'SFTP']

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()
const orgOptions = ref<OrgApi.OrgOptionVO[]>([])

const defaultFormData = (): OrgHostApi.OrgHostVO => ({
  id: undefined,
  orgName: '',
  remoteHost: '',
  port: 22,
  protocol: 'SFTP',
  reportRule: '按月全量上报',
  uploadPath: '',
  downloadPath: '',
  username: '',
  status: CommonStatusEnum.ENABLE
})

const formData = ref<OrgHostApi.OrgHostVO>(defaultFormData())

/** 机构下拉：报送机构树 + 当前值（历史数据的监管局名称），保证编辑时可正常回显 */
const orgNameOptions = computed(() => {
  const names = orgOptions.value.map((item) => item.name)
  if (formData.value.orgName && !names.includes(formData.value.orgName)) {
    names.unshift(formData.value.orgName)
  }
  return names
})

const formRules = reactive({
  orgName: [{ required: true, message: '机构 / 监管局不能为空', trigger: 'change' }],
  remoteHost: [{ required: true, message: '主机地址不能为空', trigger: 'blur' }],
  port: [{ required: true, message: '端口不能为空', trigger: 'blur' }],
  protocol: [{ required: true, message: '协议不能为空', trigger: 'change' }]
})

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增机构主机配置' : '修改机构主机配置'
  formType.value = type
  resetForm()
  orgOptions.value = await OrgApi.getOrganizationSimpleList()
  if (id) {
    formLoading.value = true
    try {
      const data = await OrgHostApi.getOrgHost(id)
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
      await OrgHostApi.createOrgHost(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await OrgHostApi.updateOrgHost(formData.value)
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
