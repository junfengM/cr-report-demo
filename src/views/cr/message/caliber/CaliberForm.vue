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
          <el-form-item label="口径编码" prop="caliberCode">
            <el-input v-model="formData.caliberCode" placeholder="如 KJ001" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="口径类型" prop="caliberType">
            <el-select v-model="formData.caliberType" placeholder="请选择口径类型" class="w-full">
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_CALIBER_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="口径名称" prop="caliberName">
        <el-input v-model="formData.caliberName" placeholder="如 新单保费收入口径" />
      </el-form-item>
      <el-form-item label="所属报表" prop="reportId">
        <el-select
          v-model="formData.reportId"
          placeholder="请选择报表"
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
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="指标编码" prop="targetCode">
            <el-input v-model="formData.targetCode" placeholder="如 ZB001" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="指标名称" prop="targetName">
            <el-input v-model="formData.targetName" placeholder="如 本期新单保费收入" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="来源表" prop="sourceTable">
            <el-input v-model="formData.sourceTable" placeholder="如 保费信息表" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="来源字段" prop="sourceField">
            <el-input v-model="formData.sourceField" placeholder="如 premium_amount" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="取数规则" prop="formula">
        <el-input
          v-model="formData.formula"
          type="textarea"
          :rows="3"
          placeholder="如 SUM(premium_amount) WHERE premium_type = 'NB'"
        />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="责任部门" prop="owner">
            <el-input v-model="formData.owner" placeholder="如 财务部" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="版本" prop="version">
            <el-input v-model="formData.version" placeholder="如 V1.0" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
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
          placeholder="如 口径与监管说明书的差异点"
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
import * as CaliberApi from '@/api/cr/message/caliber'
import { getReportOptions, type MessageReportOptionVO } from '@/api/cr/message/common'

defineOptions({ name: 'CrMessageCaliberForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const reportOptions = ref<MessageReportOptionVO[]>([])

const defaultForm = (): CaliberApi.CaliberVO => ({
  id: undefined,
  caliberCode: '',
  caliberName: '',
  caliberType: 1,
  reportId: undefined,
  reportCode: '',
  reportName: '',
  targetCode: '',
  targetName: '',
  sourceTable: '',
  sourceField: '',
  formula: '',
  owner: '',
  version: 'V1.0',
  effectDate: '',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<CaliberApi.CaliberVO>(defaultForm())

const formRules = reactive({
  caliberCode: [{ required: true, message: '口径编码不能为空', trigger: 'blur' }],
  caliberName: [{ required: true, message: '口径名称不能为空', trigger: 'blur' }],
  caliberType: [{ required: true, message: '口径类型不能为空', trigger: 'change' }],
  reportId: [{ required: true, message: '所属报表不能为空', trigger: 'change' }],
  targetName: [{ required: true, message: '指标名称不能为空', trigger: 'blur' }],
  formula: [{ required: true, message: '取数规则不能为空', trigger: 'blur' }],
  owner: [{ required: true, message: '责任部门不能为空', trigger: 'blur' }]
})

const formRef = ref()

const handleReportChange = (reportId: number) => {
  const report = reportOptions.value.find((item) => item.id === reportId)
  if (!report) return
  formData.value.reportCode = report.reportCode
  formData.value.reportName = report.reportName
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增口径信息' : '修改口径信息'
  formType.value = type
  resetForm()
  if (!reportOptions.value.length) {
    reportOptions.value = (await getReportOptions()) || []
  }
  if (id) {
    formLoading.value = true
    try {
      formData.value = await CaliberApi.getCaliber(id)
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
  if (!formData.value.reportName) {
    message.warning('请选择有效的报表')
    return
  }
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await CaliberApi.createCaliber(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await CaliberApi.updateCaliber(formData.value)
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
