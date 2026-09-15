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
          <el-form-item label="规则编码" prop="ruleCode">
            <el-input v-model="formData.ruleCode" placeholder="如 JC2026032" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="规则类型" prop="ruleType">
            <el-select
              v-model="formData.ruleType"
              placeholder="请选择规则类型"
              class="w-full"
              @change="handleRuleTypeChange"
            >
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_RULE_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="formData.ruleName" placeholder="如 保单满期日期必须晚于生效日期" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="错误级别" prop="errorLevel">
            <el-select v-model="formData.errorLevel" class="w-full">
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_ERROR_LEVEL)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否启用" prop="status">
            <el-select v-model="formData.status" class="w-full">
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.COMMON_STATUS)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="适用报表" prop="reportIds">
        <el-select
          v-model="formData.reportIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择适用报表（可多选）"
          class="w-full"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="`${report.code} ${report.name}`"
            :value="report.id"
          />
        </el-select>
      </el-form-item>

      <el-alert
        v-if="ruleTypeHint"
        class="mb-10px"
        type="info"
        :closable="false"
        show-icon
        :title="ruleTypeHint"
      />

      <el-row :gutter="16">
        <el-col :span="showCompare ? 12 : 24">
          <el-form-item :label="leftLabel" prop="leftExpression">
            <el-input v-model="formData.leftExpression" :placeholder="leftPlaceholder" />
          </el-form-item>
        </el-col>
        <el-col v-if="showCompare" :span="12">
          <el-form-item label="比较符" prop="operator">
            <el-select v-model="formData.operator" placeholder="请选择比较符" class="w-full">
              <el-option
                v-for="item in CheckRuleApi.CHECK_OPERATORS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="showRight" :label="rightLabel" prop="rightExpression">
        <el-input v-model="formData.rightExpression" :placeholder="rightPlaceholder" />
      </el-form-item>
      <el-form-item v-if="expressionPreview" label="表达式预览">
        <el-tag type="info">{{ expressionPreview }}</el-tag>
      </el-form-item>
      <el-form-item label="错误提示语" prop="errorMessage">
        <el-input
          v-model="formData.errorMessage"
          type="textarea"
          :rows="2"
          placeholder="校验不通过时展示给填报人员的提示，如「保单满期日期必须晚于生效日期」"
        />
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
import * as CheckRuleApi from '@/api/cr/check/rule'

defineOptions({ name: 'CrCheckRuleForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()
const reportOptions = ref<CheckRuleApi.CheckReportOptionVO[]>([])

const formData = ref<CheckRuleApi.CheckRuleVO>({
  id: undefined,
  ruleCode: '',
  ruleName: '',
  ruleType: CheckRuleApi.CheckRuleType.NOT_NULL,
  errorLevel: CheckRuleApi.CheckErrorLevel.ERROR,
  reportIds: [],
  leftExpression: '',
  operator: '',
  rightExpression: '',
  errorMessage: '',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

/** 规则类型说明 */
const typeHints: Record<number, string> = {
  1: '非空校验：只需选择校验字段，字段为空即命中规则，不需要比较符与右表达式。',
  2: '长度校验：字段长度与右表达式的长度值比较，如「证件号码长度 = 18」。',
  3: '值域校验：字段取值需落在允许区间，如「保险金额 > 0」「生效日期 >= 2020-01-01」。',
  4: '逻辑校验：同一张表内两个字段比较，如「保单满期日期 > 保单生效日期」。',
  5: '表间校验：跨表勾稽关系，右表达式写聚合口径，如「sum(保费信息表.premium_amount)」。',
  6: '枚举校验：取值必须落在监管码值表范围内，右表达式填写码值表名称。'
}
const leftLabels: Record<number, string> = {
  1: '校验字段',
  2: '校验字段',
  3: '校验字段',
  4: '左字段表达式',
  5: '左统计表达式',
  6: '校验字段'
}
const leftPlaceholders: Record<number, string> = {
  1: '如 保单号(policy_no)',
  2: '如 证件号码(cert_no)',
  3: '如 保险金额(sum_assured)',
  4: '如 保单满期日期(policy_maturity_date)',
  5: '如 保费收入统计表.保费收入合计',
  6: '如 证件类型(cert_type)'
}
const rightLabels: Record<number, string> = {
  2: '长度值',
  3: '阈值 / 区间边界',
  4: '右字段表达式',
  5: '右统计表达式',
  6: '监管码值表'
}
const rightPlaceholders: Record<number, string> = {
  2: '如 18',
  3: '如 0 或 2020-01-01',
  4: '如 保单生效日期(policy_effect_date)',
  5: '如 sum(保费信息表.premium_amount)',
  6: '如 监管码值表 DM_CERT_TYPE'
}

/** 非空与枚举校验不需要比较符 */
const showCompare = computed(() => {
  return (
    formData.value.ruleType !== CheckRuleApi.CheckRuleType.NOT_NULL &&
    formData.value.ruleType !== CheckRuleApi.CheckRuleType.ENUM
  )
})
/** 非空校验只需要选字段 */
const showRight = computed(() => formData.value.ruleType !== CheckRuleApi.CheckRuleType.NOT_NULL)

const ruleTypeHint = computed(() => typeHints[formData.value.ruleType] || '')
const leftLabel = computed(() => leftLabels[formData.value.ruleType] || '左表达式')
const leftPlaceholder = computed(
  () => leftPlaceholders[formData.value.ruleType] || '请输入左表达式'
)
const rightLabel = computed(() => rightLabels[formData.value.ruleType] || '右表达式')
const rightPlaceholder = computed(
  () => rightPlaceholders[formData.value.ruleType] || '请输入右表达式'
)

const expressionPreview = computed(() => {
  const { leftExpression, operator, rightExpression } = formData.value
  if (!leftExpression) return ''
  if (formData.value.ruleType === CheckRuleApi.CheckRuleType.NOT_NULL) {
    return `${leftExpression} 不能为空`
  }
  if (formData.value.ruleType === CheckRuleApi.CheckRuleType.ENUM) {
    return rightExpression ? `${leftExpression} ∈ ${rightExpression}` : ''
  }
  if (!operator || !rightExpression) return ''
  return `${leftExpression} ${operator} ${rightExpression}`
})

const formRules = computed(() => {
  const rules: Record<string, any> = {
    ruleCode: [{ required: true, message: '规则编码不能为空', trigger: 'blur' }],
    ruleName: [{ required: true, message: '规则名称不能为空', trigger: 'blur' }],
    ruleType: [{ required: true, message: '规则类型不能为空', trigger: 'change' }],
    errorLevel: [{ required: true, message: '错误级别不能为空', trigger: 'change' }],
    reportIds: [
      { required: true, type: 'array', message: '请至少选择一张适用报表', trigger: 'change' }
    ],
    leftExpression: [{ required: true, message: '校验字段不能为空', trigger: 'blur' }],
    errorMessage: [{ required: true, message: '错误提示语不能为空', trigger: 'blur' }]
  }
  if (showCompare.value) {
    rules.operator = [{ required: true, message: '比较符不能为空', trigger: 'change' }]
  }
  if (showRight.value) {
    rules.rightExpression = [{ required: true, message: '右表达式不能为空', trigger: 'blur' }]
  }
  return rules
})

/** 切换规则类型时清理不再需要的表达式，避免脏数据 */
const handleRuleTypeChange = () => {
  if (!showCompare.value) {
    formData.value.operator = ''
  } else if (!formData.value.operator) {
    formData.value.operator = '='
  }
  if (!showRight.value) {
    formData.value.rightExpression = ''
  }
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增校验规则' : '修改校验规则'
  formType.value = type
  resetForm()
  if (!reportOptions.value.length) {
    reportOptions.value = await CheckRuleApi.getCheckRuleReportOptions()
  }
  if (id) {
    formLoading.value = true
    try {
      formData.value = await CheckRuleApi.getCheckRule(id)
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
      await CheckRuleApi.createCheckRule(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await CheckRuleApi.updateCheckRule(formData.value)
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
  formData.value = {
    id: undefined,
    ruleCode: '',
    ruleName: '',
    ruleType: CheckRuleApi.CheckRuleType.NOT_NULL,
    errorLevel: CheckRuleApi.CheckErrorLevel.ERROR,
    reportIds: [],
    leftExpression: '',
    operator: '',
    rightExpression: '',
    errorMessage: '',
    status: CommonStatusEnum.ENABLE,
    remark: ''
  }
  formRef.value?.resetFields()
}
</script>
