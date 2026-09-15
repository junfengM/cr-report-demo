<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="机构" prop="orgId">
            <el-select v-model="formData.orgId" placeholder="请选择机构" filterable class="w-full">
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.orgName"
                :value="org.id"
              />
            </el-select>
            <div class="mt-5px text-12px text-[#909399]">
              「全部机构」= 全局兜底，机构级配置优先于它
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="报表" prop="reportId">
            <el-select
              v-model="formData.reportId"
              placeholder="请选择报表"
              filterable
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
        </el-col>
      </el-row>
      <el-form-item label="数据项" prop="fieldKey">
        <el-select
          v-model="formData.fieldKey"
          placeholder="请选择数据项（报表数据项 ↔ 填报字段）"
          filterable
          class="w-full"
        >
          <el-option
            v-for="column in columnOptions"
            :key="column.fieldKey"
            :label="columnLabel(column)"
            :value="column.fieldKey"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="脱敏规则" prop="ruleId">
        <el-select
          v-model="formData.ruleId"
          placeholder="请选择脱敏规则（仅启用中的规则）"
          filterable
          class="w-full"
        >
          <el-option
            v-for="rule in ruleOptions"
            :key="rule.id"
            :label="ruleLabel(rule)"
            :value="rule.id"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="优先级" prop="priority">
            <div class="flex w-full items-center">
              <el-input-number
                v-model="formData.priority"
                :min="1"
                :max="999"
                controls-position="right"
                class="!w-140px"
              />
              <span class="ml-8px text-12px text-[#909399]">数字小的先生效</span>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="适用期次" prop="periods">
            <div class="w-full">
              <el-select
                v-model="formData.periods"
                multiple
                clearable
                placeholder="留空 = 全部期次"
                class="w-full"
              >
                <el-option
                  v-for="period in periodOptions"
                  :key="period"
                  :label="period"
                  :value="period"
                />
              </el-select>
              <div class="mt-5px text-12px text-[#909399]">
                留空表示全部期次适用；选了期次就只在该期次的脱敏执行中生效（补报、专项口径常用）
              </div>
            </div>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
                :key="dict.value"
                :value="dict.value"
              >
                {{ dict.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="命中条件" prop="condition">
        <div class="w-full">
          <el-input
            ref="conditionInputRef"
            v-model="formData.condition"
            placeholder="留空表示全量脱敏，例：销售渠道 = 银保"
            maxlength="200"
            clearable
            @input="checkResult = null"
          />
          <!-- 写法与可用字段都由服务端给（/condition-fields），页面不写第二套字段名 -->
          <div v-if="conditionHelp" class="mt-5px text-12px text-[#909399]">
            {{ conditionHelp }}
          </div>
          <div
            v-if="conditionFields.length"
            class="mt-5px flex flex-wrap items-center gap-4px text-12px"
          >
            <span class="text-[#909399]">可用字段（点击插入）：</span>
            <el-tag
              v-for="field in conditionFields"
              :key="field.field"
              size="small"
              effect="plain"
              class="cursor-pointer"
              :title="field.field"
              @click="insertConditionField(field.label)"
            >
              {{ field.label }}
            </el-tag>
          </div>
          <div class="mt-8px flex flex-wrap items-center">
            <el-button size="small" :loading="checkLoading" @click="handleCheckCondition">
              <Icon icon="ep:check" class="mr-4px" />校验条件
            </el-button>
            <el-select
              v-model="checkPeriod"
              size="small"
              clearable
              placeholder="试算期次"
              class="!w-130px ml-8px"
            >
              <el-option
                v-for="period in periodOptions"
                :key="period"
                :label="period"
                :value="period"
              />
            </el-select>
            <span class="ml-8px text-12px text-[#909399]">只用于试算行数，不随配置保存</span>
          </div>
          <div v-if="checkResult" class="mt-6px text-12px leading-20px">
            <template v-if="checkResult.ok">
              <div class="text-[#67c23a]">{{ checkSummary }}</div>
              <div v-if="checkSummaryHint" class="text-[#909399]">{{ checkSummaryHint }}</div>
              <div
                v-if="checkResult.items && checkResult.items.length"
                class="mt-4px flex flex-wrap items-center gap-4px"
              >
                <span class="text-[#909399]">解析结果：</span>
                <el-tag
                  v-for="(item, index) in checkResult.items"
                  :key="index"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  {{ item.text }}
                </el-tag>
              </div>
            </template>
            <div v-else class="text-[#f56c6c]">{{ checkResult.error || '条件无法解析' }}</div>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="生效期">
        <div class="w-full">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="~"
            start-placeholder="生效开始"
            end-placeholder="生效结束"
            unlink-panels
            class="w-full"
          />
          <div class="mt-5px text-12px text-[#909399]">
            留空表示长期有效；不在生效期内的配置不参与脱敏执行
          </div>
          <div v-if="openEndedText" class="mt-2px text-12px text-[#e6a23c]">
            {{ openEndedText }}
          </div>
        </div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          maxlength="120"
          show-word-limit
          placeholder="如 该机构的证件号必须哈希后再报送"
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
import type { InputInstance } from 'element-plus'
import * as FieldApi from '@/api/cr/desensitize/field'
import {
  getDesensOrgOptions,
  getDesensReportOptions,
  getDesensColumnOptions,
  getDesensRuleOptions,
  getDesensConditionMeta,
  getDesensPeriodOptions,
  type DesensOrgOptionVO,
  type DesensReportOptionVO,
  type DesensColumnOptionVO,
  type DesensRuleOptionVO,
  type DesensConditionFieldVO
} from '@/api/cr/desensitize/common'

defineOptions({ name: 'DesensFieldForm' })

const message = useMessage()
const { t } = useI18n()

/** 表单只维护提交需要的字段：机构名 / 报表名 / 数据项编码 / 规则快照由后端补齐 */
interface DesensFieldFormModel {
  id?: number
  orgId: number
  reportId?: number
  fieldKey: string
  ruleId?: number
  priority: number
  condition: string
  effectiveFrom: string
  effectiveTo: string
  /** 适用期次（空数组 = 全部期次） */
  periods: string[]
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formType = ref('create')
const formLoading = ref(false)
const formRef = ref()

const orgOptions = ref<DesensOrgOptionVO[]>([])
const reportOptions = ref<DesensReportOptionVO[]>([])
const columnOptions = ref<DesensColumnOptionVO[]>([])
const ruleOptions = ref<DesensRuleOptionVO[]>([])

/** 命中条件的写法说明与可用字段：全部来自服务端 /condition-fields，页面不再手写一份 */
const conditionHelp = ref('')
const conditionFields = ref<DesensConditionFieldVO[]>([])
/** 点字段名要按光标插入，所以留一个 el-input 实例（只用它的原生 input） */
const conditionInputRef = ref<InputInstance>()

/** 生效期：daterange 需要一个本地数组，提交前再写回 formData 两端 */
const dateRange = ref<string[]>([])
/** 回填时写进日期框的值（只填一端时会镜像）；提交时和它比较就知道用户有没有动过日期 */
const mirroredRange = ref<string[]>([])

/** 条件校验（试算）相关：期次只影响试算行数，不随配置保存 */
const periodOptions = ref<string[]>([])
const checkPeriod = ref('')
const checkLoading = ref(false)
const checkResult = ref<FieldApi.DesensConditionCheckVO | null>(null)

const defaultForm = (): DesensFieldFormModel => ({
  id: undefined,
  // 0 = 全部机构：新增默认配全局兜底，机构级配置再单独加
  orgId: 0,
  reportId: undefined,
  fieldKey: '',
  ruleId: undefined,
  priority: 10,
  condition: '',
  effectiveFrom: '',
  effectiveTo: '',
  periods: [],
  status: 1,
  remark: ''
})
const formData = ref<DesensFieldFormModel>(defaultForm())

const formRules = reactive({
  orgId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  reportId: [{ required: true, message: '请选择报表', trigger: 'change' }],
  fieldKey: [{ required: true, message: '请选择数据项', trigger: 'change' }],
  ruleId: [{ required: true, message: '请选择脱敏规则', trigger: 'change' }]
})

/** 数据项选项：投保人名称（DE102）· 姓名 */
const columnLabel = (column: DesensColumnOptionVO) =>
  column.columnName + '（' + column.columnCode + '）· ' + column.sensitive

/** 规则选项：DR001 姓名掩码 · 掩码 · 前1后1（类型取字典中文，不写死） */
const ruleLabel = (rule: DesensRuleOptionVO) => {
  const typeLabel =
    getStrDictOptions(DICT_TYPE.CR_DESENSITIZE_TYPE).find((dict) => dict.value === rule.ruleType)
      ?.label || rule.ruleType
  return rule.ruleCode + ' ' + rule.ruleName + ' · ' + typeLabel + ' · ' + rule.ruleParam
}

/** 校验结果的绿色文案：给了「报表 + 期次」才有行数，否则只报语法 */
const checkSummary = computed(() => {
  const result = checkResult.value
  if (!result || !result.ok) return ''
  if (result.totalRows === undefined) return '条件语法正确'
  return (
    '命中 ' +
    (result.matched === undefined ? 0 : result.matched) +
    ' 行 / 跳过 ' +
    (result.skipped === undefined ? 0 : result.skipped) +
    ' 行（共 ' +
    result.totalRows +
    ' 行）'
  )
})

/** 试算出 0 行时补一句原因，避免用户以为条件写错了 */
const checkSummaryHint = computed(() => {
  const result = checkResult.value
  if (!result || !result.ok || result.totalRows === undefined || result.totalRows > 0) return ''
  const hint = '「全部机构」是兜底配置，选具体机构后才能试算行数'
  if (Number(formData.value.orgId || 0) === 0) return hint
  return '该机构 × 报表 × 期次下没有填报数据，可换个期次再试'
})

/** 两个日期数组是否一样（都为空 / 都为同一区间 = 用户没改过日期） */
const rangeEquals = (a?: string[] | null, b?: string[] | null) => {
  const left = a || []
  const right = b || []
  return left.length === right.length && left.every((item, index) => item === right[index])
}

/** 生效期只填了一端时的提醒：daterange 两端都要有值才显示，所以框里把缺的一端镜像成同一个日期 */
const openEndedText = computed(() => {
  const from = formData.value.effectiveFrom
  const to = formData.value.effectiveTo
  if (!!from === !!to) return ''
  // 用户已经自己选过日期了，保存的就是他选的完整区间，不用再提醒
  if (!rangeEquals(dateRange.value, mirroredRange.value)) return ''
  return (
    '当前配置：' +
    (from || '不限') +
    ' ~ ' +
    (to || '不限') +
    '（只填了一端，日期框按两端显示；不改动日期则保存时保持原样）'
  )
})

/** 回填：列表传入的行只带出提交需要的字段，其余快照字段提交时不传 */
const fillForm = (row: FieldApi.DesensFieldVO) => {
  formData.value = {
    id: row.id,
    orgId: row.orgId === undefined || row.orgId === null ? 0 : Number(row.orgId),
    reportId:
      row.reportId === undefined || row.reportId === null ? undefined : Number(row.reportId),
    fieldKey: row.fieldKey || '',
    ruleId: row.ruleId === undefined || row.ruleId === null ? undefined : Number(row.ruleId),
    priority: row.priority === undefined || row.priority === null ? 10 : Number(row.priority),
    condition: row.condition || '',
    effectiveFrom: row.effectiveFrom || '',
    effectiveTo: row.effectiveTo || '',
    periods: (row.periods || []).slice(),
    status: row.status === undefined || row.status === null ? 1 : Number(row.status),
    remark: row.remark || ''
  }
  syncDateRange()
}

/** 生效期回填：两端都空 = 长期有效（空数组）；只填一端时镜像显示，原值仍留在 formData 里 */
const syncDateRange = () => {
  const from = formData.value.effectiveFrom
  const to = formData.value.effectiveTo
  const mirrored = from || to ? [from || to, to || from] : []
  mirroredRange.value = mirrored
  dateRange.value = mirrored.slice()
}

/** 提交前把日期框写回生效期：没动过日期就保持原样（只填一端的配置不会被悄悄补成两端） */
const applyDateRange = () => {
  if (rangeEquals(dateRange.value, mirroredRange.value)) return
  const range = dateRange.value || []
  formData.value.effectiveFrom = range[0] || ''
  formData.value.effectiveTo = range[1] || ''
}

const resetForm = () => {
  formData.value = defaultForm()
  formRef.value?.resetFields()
  syncDateRange()
  checkResult.value = null
  checkPeriod.value = periodOptions.value[0] || ''
}

/** 点可用字段：插到输入框光标处（拿不到光标就追加到末尾） */
const insertConditionField = (label: string) => {
  const current = formData.value.condition || ''
  const input = conditionInputRef.value?.input
  const start = input && input.selectionStart !== null ? input.selectionStart : current.length
  const end = input && input.selectionEnd !== null ? input.selectionEnd : current.length
  formData.value.condition = current.slice(0, start) + label + current.slice(end)
  nextTick(() => {
    input?.focus()
    const pos = start + label.length
    input?.setSelectionRange(pos, pos)
  })
}

/** 校验条件：空条件只是「全量脱敏」，不算错误；语法与试算都以后端结果为准，页面不自己判 */
const handleCheckCondition = async () => {
  const condition = (formData.value.condition || '').trim()
  if (!condition) {
    checkResult.value = null
    message.info('条件为空，表示该字段全量脱敏')
    return
  }
  checkLoading.value = true
  try {
    checkResult.value = await FieldApi.checkFieldCondition({
      condition,
      orgId: Number(formData.value.orgId || 0),
      reportId:
        formData.value.reportId === undefined || formData.value.reportId === null
          ? undefined
          : Number(formData.value.reportId),
      period: checkPeriod.value || undefined
    })
  } finally {
    checkLoading.value = false
  }
}

/** 打开弹窗：create 新增 / update 修改（第二个参数可以是行数据，也可以是 id） */
const open = async (type: string, rowOrId?: FieldApi.DesensFieldVO | number) => {
  dialogVisible.value = true
  formType.value = type
  dialogTitle.value = type === 'create' ? '新增脱敏字段配置' : '修改脱敏字段配置'
  resetForm()
  // 四个下拉一次取全，弹窗内切换选项不再请求
  if (!orgOptions.value.length) orgOptions.value = (await getDesensOrgOptions()) || []
  if (!reportOptions.value.length) reportOptions.value = (await getDesensReportOptions()) || []
  if (!columnOptions.value.length) columnOptions.value = (await getDesensColumnOptions()) || []
  if (!ruleOptions.value.length) ruleOptions.value = (await getDesensRuleOptions()) || []
  // 条件帮助文案与可用字段取服务端的一份；期次用于试算命中行数（默认最近一期）
  if (!conditionHelp.value) {
    const meta = await getDesensConditionMeta()
    conditionHelp.value = meta?.help || ''
    conditionFields.value = meta?.fields || []
  }
  if (!periodOptions.value.length) {
    periodOptions.value = (await getDesensPeriodOptions()) || []
  }
  if (!checkPeriod.value) checkPeriod.value = periodOptions.value[0] || ''
  if (type !== 'update') return
  if (rowOrId && typeof rowOrId === 'object') {
    fillForm(rowOrId)
    return
  }
  if (!rowOrId) return
  formLoading.value = true
  try {
    fillForm(await FieldApi.getField(Number(rowOrId)))
  } finally {
    formLoading.value = false
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
  // 命中条件与生效期的语法/区间校验都在后端做（写错会返回中文错误并自动提示），页面不重复一套规则
  applyDateRange()
  formLoading.value = true
  try {
    const payload: FieldApi.DesensFieldVO = {
      orgId: Number(formData.value.orgId || 0),
      reportId: Number(formData.value.reportId),
      fieldKey: formData.value.fieldKey,
      ruleId: Number(formData.value.ruleId),
      priority: Number(formData.value.priority),
      condition: formData.value.condition,
      effectiveFrom: formData.value.effectiveFrom,
      effectiveTo: formData.value.effectiveTo,
      periods: formData.value.periods,
      status: Number(formData.value.status),
      remark: formData.value.remark
    }
    if (formType.value === 'create') {
      await FieldApi.createField(payload)
      message.success(t('common.createSuccess'))
    } else {
      await FieldApi.updateField({ ...payload, id: formData.value.id })
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
