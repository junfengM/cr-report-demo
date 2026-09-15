<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="680">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="定制编码" prop="customCode">
            <el-input v-model="formData.customCode" placeholder="如 DZ20260801" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="版本" prop="version">
            <el-input v-model="formData.version" placeholder="如 V1.0" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="定制名称" prop="customName">
        <el-input v-model="formData.customName" placeholder="如 保费收入月度取数定制" />
      </el-form-item>
      <el-form-item label="监管报表" prop="reportId">
        <el-select
          v-model="formData.reportId"
          placeholder="请选择报表（决定取数数据表）"
          filterable
          class="w-full"
          @change="handleReportChange"
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
        v-if="currentTable"
        type="info"
        :closable="false"
        show-icon
        class="mb-15px"
        :title="
          '取数数据表：' +
          currentTable.tableCode +
          ' ' +
          currentTable.tableName +
          '，可定制字段 ' +
          currentTable.columnCount +
          ' 个'
        "
      />
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="数据频度" prop="freq">
            <el-input :model-value="freqLabel" disabled />
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
      <el-form-item label="取数范围" prop="dataScope">
        <el-input v-model="formData.dataScope" placeholder="如 全部报送机构 / 北京、上海分公司" />
      </el-form-item>
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
        <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
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
import * as ReportCustomApi from '@/api/cr/message/reportCustom'
import { getReportOptions, type MessageReportOptionVO } from '@/api/cr/message/common'

defineOptions({ name: 'CrMessageReportCustomForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const reportOptions = ref<MessageReportOptionVO[]>([])

const defaultForm = (): ReportCustomApi.ReportCustomVO => ({
  id: undefined,
  customCode: '',
  customName: '',
  reportId: undefined,
  reportCode: '',
  reportName: '',
  freq: 3,
  dataTableId: undefined,
  dataTableCode: '',
  dataTableName: '',
  columnCount: 0,
  dataScope: '全部报送机构',
  version: 'V1.0',
  effectDate: '',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<ReportCustomApi.ReportCustomVO>(defaultForm())

const formRules = reactive({
  customCode: [{ required: true, message: '定制编码不能为空', trigger: 'blur' }],
  customName: [{ required: true, message: '定制名称不能为空', trigger: 'blur' }],
  reportId: [{ required: true, message: '监管报表不能为空', trigger: 'change' }],
  effectDate: [{ required: true, message: '生效日期不能为空', trigger: 'change' }],
  version: [{ required: true, message: '版本不能为空', trigger: 'blur' }]
})

const formRef = ref()

/** 所选报表 → 取数数据表提示（新增时尚未保存，改用选项里的表信息） */
const currentTable = computed(() => {
  if (!formData.value.reportId) return undefined
  return reportOptions.value.find((report) => report.id === formData.value.reportId)
})

const freqLabel = computed(() => {
  const dict = getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ).find(
    (item) => Number(item.value) === Number(formData.value.freq)
  )
  return dict?.label || '-'
})

const handleReportChange = (reportId: number) => {
  const report = reportOptions.value.find((item) => item.id === reportId)
  if (!report) return
  formData.value.reportCode = report.reportCode
  formData.value.reportName = report.reportName
  formData.value.freq = report.freq
  formData.value.dataTableId = report.tableId
  formData.value.dataTableCode = report.tableCode
  formData.value.dataTableName = report.tableName
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增报表定制' : '修改报表定制'
  formType.value = type
  resetForm()
  if (!reportOptions.value.length) {
    reportOptions.value = (await getReportOptions()) || []
  }
  if (id) {
    formLoading.value = true
    try {
      formData.value = await ReportCustomApi.getReportCustom(id)
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
  if (!currentTable.value) {
    message.warning('请选择有效的监管报表')
    return
  }
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await ReportCustomApi.createReportCustom(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await ReportCustomApi.updateReportCustom(formData.value)
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
