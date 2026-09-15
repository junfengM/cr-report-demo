<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="报送机构" prop="orgId">
        <el-select v-model="formData.orgId" placeholder="请选择报送机构" filterable class="w-full">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表范围" prop="reportId">
        <el-select
          v-model="formData.reportId"
          placeholder="请选择报表范围"
          filterable
          class="w-full"
          @change="handleReportChange"
        >
          <el-option label="全部报表（机构级默认指派）" :value="0" />
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="formData.reportId" label="数据频度" prop="freq">
        <el-input :model-value="freqLabel" disabled />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="填报人" prop="fillerId">
            <el-select
              v-model="formData.fillerId"
              placeholder="请选择填报人"
              filterable
              class="w-full"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="user.nickname"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="复核人" prop="reviewerId">
            <el-select
              v-model="formData.reviewerId"
              placeholder="请选择复核人"
              filterable
              clearable
              class="w-full"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="user.nickname"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="生效日期" prop="effectiveDate">
            <el-date-picker
              v-model="formData.effectiveDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择生效日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="失效日期" prop="expireDate">
            <el-date-picker
              v-model="formData.expireDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择失效日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
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
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 代填原因 / 临时支援说明"
        />
      </el-form-item>
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
import * as FillerApi from '@/api/cr/message/filler'
import {
  getOrgOptions,
  getReportOptions,
  type MessageOrgOptionVO,
  type MessageReportOptionVO
} from '@/api/cr/message/common'
import { getSimpleUserList, type UserVO } from '@/api/system/user'

defineOptions({ name: 'CrMessageFillerAssignForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const orgOptions = ref<MessageOrgOptionVO[]>([])
const reportOptions = ref<MessageReportOptionVO[]>([])
const users = ref<UserVO[]>([])

const defaultForm = (): FillerApi.FillerAssignVO => ({
  id: undefined,
  orgId: undefined,
  orgName: '',
  reportId: 0,
  reportCode: '',
  reportName: '',
  freq: 0,
  fillerId: undefined,
  fillerName: '',
  reviewerId: undefined,
  reviewerName: '',
  effectiveDate: '',
  expireDate: '',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<FillerApi.FillerAssignVO>(defaultForm())

const formRules = reactive({
  orgId: [{ required: true, message: '报送机构不能为空', trigger: 'change' }],
  fillerId: [{ required: true, message: '填报人不能为空', trigger: 'change' }],
  effectiveDate: [{ required: true, message: '生效日期不能为空', trigger: 'change' }]
})

const formRef = ref()

const freqLabel = computed(() => {
  const dict = getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ).find(
    (item) => Number(item.value) === Number(formData.value.freq)
  )
  return dict?.label || '-'
})

/** 报表变化：回填报表信息与频度（选「全部报表」时频度置为不限） */
const handleReportChange = (reportId: number) => {
  const report = reportOptions.value.find((item) => item.id === reportId)
  if (!report) {
    formData.value.reportCode = ''
    formData.value.reportName = ''
    formData.value.freq = 0
    return
  }
  formData.value.reportCode = report.reportCode
  formData.value.reportName = report.reportName
  formData.value.freq = report.freq
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增填报人指派' : '修改填报人指派'
  formType.value = type
  resetForm()
  if (!orgOptions.value.length) {
    orgOptions.value = (await getOrgOptions()) || []
  }
  if (!reportOptions.value.length) {
    reportOptions.value = (await getReportOptions()) || []
  }
  if (!users.value.length) {
    users.value = (await getSimpleUserList()) || []
  }
  if (id) {
    formLoading.value = true
    try {
      formData.value = await FillerApi.getFillerAssign(id)
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (formData.value.fillerId && formData.value.fillerId === formData.value.reviewerId) {
    message.warning('填报人与复核人不能为同一人')
    return
  }
  const payload = { ...formData.value, reportId: formData.value.reportId || 0 }
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await FillerApi.createFillerAssign(payload)
      message.success(t('common.createSuccess'))
    } else {
      await FillerApi.updateFillerAssign(payload)
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
  formData.value = defaultForm()
  formRef.value?.resetFields()
}
</script>
