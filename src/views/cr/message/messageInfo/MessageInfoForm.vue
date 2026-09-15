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
          <el-form-item label="报文编码" prop="messageCode">
            <el-input v-model="formData.messageCode" placeholder="如 MB20260801" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="报文类型" prop="messageType">
            <el-select v-model="formData.messageType" placeholder="请选择报文类型" class="w-full">
              <el-option
                v-for="dict in getStrDictOptions(DICT_TYPE.CR_MESSAGE_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="报文名称" prop="messageName">
        <el-input v-model="formData.messageName" placeholder="如 人身险业务月报报文" />
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
          <el-form-item label="适用期次" prop="period">
            <el-input v-model="formData.period" placeholder="如 202608 / 2026Q3" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="关联报表" prop="reportIds">
        <el-select
          v-model="formData.reportIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择报文包含的报表（频度须一致）"
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
      <el-alert
        v-if="formData.reportIds.length"
        type="info"
        :closable="false"
        show-icon
        class="mb-15px"
        :title="summaryHint"
      />
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="报文版本" prop="version">
            <el-input v-model="formData.version" placeholder="如 V1.0" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="生效日期" prop="effectDate">
            <el-date-picker
              v-model="formData.effectDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择生效日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="监管文号" prop="regulatoryRef">
        <el-input v-model="formData.regulatoryRef" placeholder="如 金融监管总局统信〔2026〕12号" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="表头行数" prop="headerRows">
            <el-input-number v-model="formData.headerRows" :min="0" :max="5" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否含报尾" prop="tailFlag">
            <el-switch v-model="formData.tailFlag" active-text="含报尾" inactive-text="无报尾" />
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
          placeholder="如 编码格式 / 报尾校验位要求"
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
import { DICT_TYPE, getIntDictOptions, getStrDictOptions } from '@/utils/dict'
import { CommonStatusEnum } from '@/utils/constants'
import * as MessageInfoApi from '@/api/cr/message/messageInfo'
import { getReportOptions, type MessageReportOptionVO } from '@/api/cr/message/common'

defineOptions({ name: 'CrMessageInfoForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const reportOptions = ref<MessageReportOptionVO[]>([])

const defaultForm = (): MessageInfoApi.MessageInfoVO => ({
  id: undefined,
  messageCode: '',
  messageName: '',
  messageType: 'TXT',
  freq: 3,
  period: '202608',
  reportIds: [],
  reportCount: 0,
  tableCount: 0,
  columnCount: 0,
  version: 'V1.0',
  regulatoryRef: '',
  headerRows: 1,
  tailFlag: true,
  effectDate: '',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<MessageInfoApi.MessageInfoVO>(defaultForm())

const formRules = reactive({
  messageCode: [{ required: true, message: '报文编码不能为空', trigger: 'blur' }],
  messageName: [{ required: true, message: '报文名称不能为空', trigger: 'blur' }],
  messageType: [{ required: true, message: '报文类型不能为空', trigger: 'change' }],
  freq: [{ required: true, message: '数据频度不能为空', trigger: 'change' }],
  period: [{ required: true, message: '适用期次不能为空', trigger: 'blur' }],
  reportIds: [{ required: true, message: '至少选择一张报表', trigger: 'change' }],
  effectDate: [{ required: true, message: '生效日期不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 选中报表 → 数据表 / 字段统计提示 */
const summaryHint = computed(() => {
  const picked = reportOptions.value.filter((report) =>
    formData.value.reportIds.includes(report.id)
  )
  const tables = new Set(picked.map((report) => report.tableId))
  const columns = picked.reduce((total, report) => total + report.columnCount, 0)
  return (
    '本报文包含 ' +
    picked.length +
    ' 张报表、' +
    tables.size +
    ' 张数据表、' +
    columns +
    ' 个字段（保存后由服务端复核口径）'
  )
})

/** 频度变化：过滤报表下拉，并清掉频度不一致的已选报表 */
const handleFreqChange = async () => {
  const freq = formData.value.freq
  reportOptions.value = (await getReportOptions(freq)) || []
  const allowed = new Set(reportOptions.value.map((report) => report.id))
  formData.value.reportIds = formData.value.reportIds.filter((id) => allowed.has(id))
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增报文信息' : '修改报文信息'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      formData.value = await MessageInfoApi.getMessageInfo(id)
    } finally {
      formLoading.value = false
    }
    reportOptions.value = (await getReportOptions()) || []
  } else {
    reportOptions.value = (await getReportOptions(formData.value.freq)) || []
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
  const picked = reportOptions.value.filter((report) =>
    formData.value.reportIds.includes(report.id)
  )
  const mismatch = picked.filter((report) => Number(report.freq) !== Number(formData.value.freq))
  if (mismatch.length) {
    message.warning('以下报表频度与报文频度不一致：' + mismatch.map((r) => r.reportName).join('、'))
    return
  }
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await MessageInfoApi.createMessageInfo(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await MessageInfoApi.updateMessageInfo(formData.value)
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
