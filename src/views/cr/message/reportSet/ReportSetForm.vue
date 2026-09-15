<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="报文集编码" prop="setCode">
            <el-input v-model="formData.setCode" placeholder="如 BWJ20260801" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="适用期次" prop="period">
            <el-input v-model="formData.period" placeholder="如 202608" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="报文集名称" prop="setName">
        <el-input v-model="formData.setName" placeholder="如 2026年8月人身险月报报文集" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="数据频度" prop="freq">
            <el-select
              v-model="formData.freq"
              placeholder="请选择频度"
              class="w-full"
              @change="handleFreqChange"
            >
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="关联报文" prop="messageId">
            <el-select
              v-model="formData.messageId"
              placeholder="请选择报文信息"
              clearable
              class="w-full"
            >
              <el-option
                v-for="item in messageOptions"
                :key="item.id"
                :label="item.messageCode + ' ' + item.messageName"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="报送机构" prop="orgScopeType">
        <el-radio-group v-model="formData.orgScopeType">
          <el-radio value="ALL">全部报送机构</el-radio>
          <el-radio value="SPECIFIC">指定机构</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="formData.orgScopeType === 'SPECIFIC'" label="选择机构" prop="orgIds">
        <el-select
          v-model="formData.orgIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择报送机构"
          class="w-full"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="包含报表" prop="reportIds">
        <el-select
          v-model="formData.reportIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择报表（频度须与报文集一致）"
          class="w-full"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="压缩上报" prop="compress">
            <el-switch v-model="formData.compress" active-text="压缩" inactive-text="不压缩" />
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
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 先行试点机构 / 报送顺序说明"
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
import * as ReportSetApi from '@/api/cr/message/reportSet'
import {
  getMessageOptions,
  getOrgOptions,
  getReportOptions,
  type MessageOptionVO,
  type MessageOrgOptionVO,
  type MessageReportOptionVO
} from '@/api/cr/message/common'

defineOptions({ name: 'CrMessageReportSetForm' })

const { t } = useI18n()
const message = useMessage()

interface ReportSetFormData extends ReportSetApi.ReportSetVO {
  orgScopeType: 'ALL' | 'SPECIFIC'
  orgIds: number[]
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const reportOptions = ref<MessageReportOptionVO[]>([])
const orgOptions = ref<MessageOrgOptionVO[]>([])
const messageOptions = ref<MessageOptionVO[]>([])

const defaultForm = (): ReportSetFormData => ({
  id: undefined,
  setCode: '',
  setName: '',
  freq: 3,
  period: '202608',
  orgScope: 'ALL',
  orgNames: '',
  messageId: undefined,
  messageCode: '',
  reportIds: [],
  reportCount: 0,
  compress: false,
  status: CommonStatusEnum.ENABLE,
  remark: '',
  orgScopeType: 'ALL',
  orgIds: []
})

const formData = ref<ReportSetFormData>(defaultForm())

const formRules = reactive({
  setCode: [{ required: true, message: '报文集编码不能为空', trigger: 'blur' }],
  setName: [{ required: true, message: '报文集名称不能为空', trigger: 'blur' }],
  freq: [{ required: true, message: '数据频度不能为空', trigger: 'change' }],
  period: [{ required: true, message: '适用期次不能为空', trigger: 'blur' }],
  reportIds: [{ required: true, message: '至少选择一张报表', trigger: 'change' }]
})

const formRef = ref()

/** 频度变化：刷新可选的报表与报文（频度一致性） */
const handleFreqChange = async () => {
  reportOptions.value = (await getReportOptions(formData.value.freq)) || []
  messageOptions.value = (await getMessageOptions(formData.value.freq)) || []
  const allowed = new Set(reportOptions.value.map((report) => report.id))
  formData.value.reportIds = formData.value.reportIds.filter((id) => allowed.has(id))
  const allowedMessage = new Set(messageOptions.value.map((item) => item.id))
  if (formData.value.messageId && !allowedMessage.has(formData.value.messageId)) {
    formData.value.messageId = undefined
    formData.value.messageCode = ''
  }
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增报文集' : '修改报文集'
  formType.value = type
  resetForm()
  if (!orgOptions.value.length) {
    orgOptions.value = (await getOrgOptions()) || []
  }
  if (id) {
    formLoading.value = true
    try {
      const data = await ReportSetApi.getReportSet(id)
      formData.value = {
        ...data,
        orgScopeType: data.orgScope === 'ALL' ? 'ALL' : 'SPECIFIC',
        orgIds:
          data.orgScope === 'ALL'
            ? []
            : data.orgScope
                .split(',')
                .map((item) => Number(item.trim()))
                .filter((item) => !Number.isNaN(item))
      }
      reportOptions.value = (await getReportOptions(data.freq)) || []
      messageOptions.value = (await getMessageOptions(data.freq)) || []
    } finally {
      formLoading.value = false
    }
  } else {
    reportOptions.value = (await getReportOptions(formData.value.freq)) || []
    messageOptions.value = (await getMessageOptions(formData.value.freq)) || []
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
  if (formData.value.orgScopeType === 'SPECIFIC' && !formData.value.orgIds.length) {
    message.warning('请至少选择一个报送机构')
    return
  }
  const picked = reportOptions.value.filter((report) =>
    formData.value.reportIds.includes(report.id)
  )
  const mismatch = picked.filter((report) => Number(report.freq) !== Number(formData.value.freq))
  if (mismatch.length) {
    message.warning('以下报表频度与报文集不一致：' + mismatch.map((r) => r.reportName).join('、'))
    return
  }
  // 只提交后端认识的字段，orgScopeType / orgIds 是表单内部的编辑态
  const payload: ReportSetApi.ReportSetVO = {
    id: formData.value.id,
    setCode: formData.value.setCode,
    setName: formData.value.setName,
    freq: formData.value.freq,
    period: formData.value.period,
    orgScope: formData.value.orgScopeType === 'ALL' ? 'ALL' : formData.value.orgIds.join(','),
    orgNames: formData.value.orgNames,
    messageId: formData.value.messageId,
    messageCode: formData.value.messageCode,
    reportIds: formData.value.reportIds,
    reportCount: formData.value.reportIds.length,
    compress: formData.value.compress,
    status: formData.value.status,
    remark: formData.value.remark
  }
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await ReportSetApi.createReportSet(payload)
      message.success(t('common.createSuccess'))
    } else {
      await ReportSetApi.updateReportSet(payload)
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
