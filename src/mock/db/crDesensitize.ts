/**
 * 本地数据表 — 数据脱敏域（P1）
 *
 * 三张表：
 * - cr.desensRule    脱敏规则（掩码 / 哈希 / 替换 / 截断，含参数与示例）
 * - cr.desensField   脱敏字段配置（机构 × 报表 × 数据项 → 规则，机构级优先于全局兜底）
 * - cr.desensTask    脱敏执行批次日志（含每个字段的处理明细，日志页抽屉直接用）
 *
 * 与既有数据的关系（本模块「不是演效果」的关键）：
 * - 执行时**真实改写** cr.fillData —— 就是「数据填报」页读的那张明细表，执行完切过去能立刻看到值变了；
 * - 同时把「脱敏前 → 脱敏后」写进 cr.desensitize（「脱敏结果查询」页读的那张表），批次号写在 batchNo 上；
 * - 脱敏算法从 crAudit.ts 导出复用（掩码 / 邮箱掩码 / 截断 / 哈希），历史种子数据与本轮执行口径完全一致。
 */
import { defineTable } from '../store'
import { formatDate, formatDateTime, nextId } from '../util'
import { crFillDataTable } from './crData'
import {
  crDesensitizeTable,
  hashValue,
  maskEmail,
  maskKeep,
  truncate,
  type DesensitizeRuleType
} from './crAudit'
import { ensureFillRecordFor } from './crCollect'
import { reportOptions, reportOrgs } from './crCommon'

export type DesensRuleType = DesensitizeRuleType

/* ==================================================================
 * 可脱敏的填报字段（报表数据项 ↔ 填报明细字段）
 * ================================================================== */
export interface MaskableColumn {
  /** cr.fillData 上的字段名（执行时真正改的就是它） */
  fieldKey: string
  /** 报表数据项编码（与「列管理」里的字段对应） */
  columnCode: string
  columnName: string
  /** 敏感数据类型：姓名 / 证件号 / 业务标识 */
  sensitive: string
}

export const MASKABLE_COLUMNS: MaskableColumn[] = [
  { fieldKey: 'holderName', columnCode: 'DE102', columnName: '投保人名称', sensitive: '姓名' },
  { fieldKey: 'certNo', columnCode: 'DE105', columnName: '证件号码', sensitive: '证件号' },
  { fieldKey: 'policyNo', columnCode: 'DE001', columnName: '保单号', sensitive: '业务标识' }
]

/** 字段名 → 可脱敏列（找不到时兜底第一列，避免页面拿到 undefined） */
export const maskableColumnOf = (fieldKey: string) =>
  MASKABLE_COLUMNS.find((item) => item.fieldKey === fieldKey) || MASKABLE_COLUMNS[0]

/** 数据项编码 → 字段名（还原时用） */
export const fieldKeyOfColumn = (columnCode: string) =>
  (MASKABLE_COLUMNS.find((item) => item.columnCode === columnCode) || MASKABLE_COLUMNS[0]).fieldKey

/* ==================================================================
 * 一、脱敏规则
 * ================================================================== */
export interface DesensRuleRow {
  id: number
  ruleCode: string
  ruleName: string
  /** 见字典 cr_desensitize_type（与结果查询页的 ruleType 同一套码值） */
  ruleType: DesensRuleType
  /** 规则参数：掩码「前3后4」/ 哈希「salt=HX2026」/ 替换「已脱敏」/ 截断「保留前6位」 */
  ruleParam: string
  /** 适用数据类型：姓名 / 证件号 / 手机号 / 邮箱 / 地址 / 业务标识 */
  scope: string
  /** 示例原文 / 示例结果（示例结果由算法现算，永远与参数一致） */
  sampleFrom: string
  sampleTo: string
  /** 内置规则不允许删除（页面删除按钮置灰） */
  builtin: boolean
  /** 1 启用 / 0 停用，见字典 cr_enable_status */
  status: number
  updateUser: string
  updateTime: string
  remark: string
}

/** 规则参数解析：前后保留位数 */
const parseKeep = (param: string): { p: number; s: number } => {
  const both = /前(\d+)后(\d+)/.exec(param || '')
  if (both) return { p: Number(both[1]), s: Number(both[2]) }
  const only = /前(\d+)/.exec(param || '')
  if (only) return { p: Number(only[1]), s: 0 }
  return { p: 1, s: 0 }
}

/**
 * 执行一条脱敏规则（纯函数：同样输入永远同样输出）
 * @param fieldKey 字段名（邮箱字段走「保留域名」的专用掩码）
 */
export const applyDesensRule = (
  ruleType: DesensRuleType,
  ruleParam: string,
  value: string,
  fieldKey?: string
): string => {
  const text = String(value === undefined || value === null ? '' : value)
  if (!text) return text
  if (ruleType === 'MASK') {
    if (fieldKey === 'email' || /保留域名/.test(ruleParam || '') || text.indexOf('@') > 0)
      return maskEmail(text)
    const keep = parseKeep(ruleParam)
    return maskKeep(text, keep.p, keep.s)
  }
  if (ruleType === 'HASH')
    return hashValue(text, (ruleParam || '').replace(/^salt=/i, '') || 'HX2026')
  if (ruleType === 'REPLACE') return ruleParam && ruleParam !== '—' ? ruleParam : '***'
  const keep = Number((/(\d+)/.exec(ruleParam || '') || [])[1])
  return truncate(text, Number.isFinite(keep) && keep > 0 ? keep : 6)
}

/**
 * 值是否已经被脱敏过：掩码/截断含 * 或 …、哈希是 64 位十六进制、
 * 替换型规则的产物是一段固定文本（没有标记），只能跟该字段的规则参数比对。
 */
export const isMaskedValue = (
  value: string,
  rule?: { ruleType?: string; ruleParam?: string }
): boolean => {
  const text = String(value || '')
  if (!text) return false
  if (text.indexOf('*') >= 0 || text.indexOf('…') >= 0) return true
  if (/^[0-9a-f]{64}$/.test(text)) return true
  if (rule && rule.ruleType === 'REPLACE' && rule.ruleParam && text === rule.ruleParam) return true
  return false
}

interface RuleSeed {
  ruleCode: string
  ruleName: string
  ruleType: DesensRuleType
  ruleParam: string
  scope: string
  sampleFrom: string
  remark: string
}

const RULE_SEEDS: RuleSeed[] = [
  {
    ruleCode: 'DR001',
    ruleName: '姓名掩码',
    ruleType: 'MASK',
    ruleParam: '前1后1',
    scope: '姓名',
    sampleFrom: '王芳',
    remark: '保留姓与最后一个字，中间打星'
  },
  {
    ruleCode: 'DR002',
    ruleName: '证件号掩码',
    ruleType: 'MASK',
    ruleParam: '前3后4',
    scope: '证件号',
    sampleFrom: '110101199001011234',
    remark: '保留前 3 位与后 4 位，中间全星'
  },
  {
    ruleCode: 'DR003',
    ruleName: '手机号掩码',
    ruleType: 'MASK',
    ruleParam: '前3后4',
    scope: '手机号',
    sampleFrom: '13800138000',
    remark: '标准手机号掩码'
  },
  {
    ruleCode: 'DR004',
    ruleName: '邮箱掩码',
    ruleType: 'MASK',
    ruleParam: '首字符（保留域名）',
    scope: '邮箱',
    sampleFrom: 'zhangwei@example.com',
    remark: '只盖住 @ 前的本地部分'
  },
  {
    ruleCode: 'DR005',
    ruleName: '地址截断',
    ruleType: 'TRUNCATE',
    ruleParam: '保留前6位',
    scope: '地址',
    sampleFrom: '北京市朝阳区建国路88号',
    remark: '保留到区县，后面用省略号'
  },
  {
    ruleCode: 'DR006',
    ruleName: '证件号哈希',
    ruleType: 'HASH',
    ruleParam: 'salt=HX2026',
    scope: '证件号',
    sampleFrom: '110101199001011234',
    remark: '不可逆，用于跨表关联比对'
  },
  {
    ruleCode: 'DR007',
    ruleName: '姓名替换',
    ruleType: 'REPLACE',
    ruleParam: '已脱敏',
    scope: '姓名',
    sampleFrom: '王芳',
    remark: '整值替换为固定文本'
  },
  {
    ruleCode: 'DR008',
    ruleName: '保单号截断',
    ruleType: 'TRUNCATE',
    ruleParam: '保留前8位',
    scope: '业务标识',
    sampleFrom: 'P2026080001',
    remark: '保留期次位数，便于核对归属'
  }
]

/** 种子时间统一用固定值，避免每次重建都变 */
const SEED_TIME = '2026-09-11 09:30:00'

/** 规则示例结果由算法现算：参数改了示例跟着变，不会出现「示例与实现不一致」 */
export const crDesensRuleTable = defineTable<DesensRuleRow>('cr.desensRule', () =>
  RULE_SEEDS.map((seed, index) => ({
    id: index + 1,
    ruleCode: seed.ruleCode,
    ruleName: seed.ruleName,
    ruleType: seed.ruleType,
    ruleParam: seed.ruleParam,
    scope: seed.scope,
    sampleFrom: seed.sampleFrom,
    sampleTo: applyDesensRule(
      seed.ruleType,
      seed.ruleParam,
      seed.sampleFrom,
      seed.scope === '邮箱' ? 'email' : ''
    ),
    builtin: true,
    status: 1,
    updateUser: '系统管理员',
    updateTime: SEED_TIME,
    remark: seed.remark
  }))
)

const ruleOfCode = (ruleCode: string) =>
  crDesensRuleTable.all().find((row) => row.ruleCode === ruleCode)

/* ==================================================================
 * 生效期与命中条件（这一轮深化的重点：这两个配置项以前只落库，现在真正参与执行判定）
 * ================================================================== */

/** 判断生效期用的"今天"（YYYY-MM-DD）。留参数是为了让测试与演示能固定某一天 */
export const desensToday = (date: Date | number = new Date()): string => formatDate(date)

export type DesensWindowState = 'active' | 'notStarted' | 'expired'

/** 配置相对某一天的生效状态：未开始 / 生效中 / 已过期 */
export const desensFieldWindowState = (
  row: { effectiveFrom?: string; effectiveTo?: string },
  today: string = desensToday()
): DesensWindowState => {
  const from = String(row.effectiveFrom || '')
  const to = String(row.effectiveTo || '')
  if (from && today < from) return 'notStarted'
  if (to && today > to) return 'expired'
  return 'active'
}

export const DESENS_WINDOW_LABEL: Record<DesensWindowState, string> = {
  active: '生效中',
  notStarted: '未生效',
  expired: '已过期'
}

/** 生效期的展示文本（配置列表的「生效期」列） */
export const desensWindowText = (row: { effectiveFrom?: string; effectiveTo?: string }): string => {
  const from = String(row.effectiveFrom || '')
  const to = String(row.effectiveTo || '')
  if (!from && !to) return '长期有效'
  return (from || '不限') + ' ~ ' + (to || '不限')
}

/* ---------------- 命中条件：解析与求值 ---------------- */

export interface DesensConditionItem {
  /** 用户写的字段名（中文或填报字段名） */
  field: string
  /** 解析后的 cr.fillData 字段名 */
  fieldKey: string
  op: string
  value: string
  text: string
}

export interface DesensConditionParseResult {
  ok: boolean
  error: string
  /** 外层是「或」，内层是「且」；空数组 = 没有条件（全量） */
  groups: DesensConditionItem[][]
}

/** 条件里能引用的字段：填报字段名 + 常用中文别名 */
const CONDITION_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'policyNo', label: '保单号' },
  { key: 'holderName', label: '投保人' },
  { key: 'certNo', label: '证件号码' },
  { key: 'productName', label: '险种名称' },
  { key: 'premiumAmount', label: '保费金额' },
  { key: 'rate', label: '费率' },
  { key: 'sumAssured', label: '保险金额' },
  { key: 'effectDate', label: '保单生效日期' },
  { key: 'channel', label: '销售渠道' },
  { key: 'dataStatus', label: '数据状态' },
  { key: 'orgName', label: '报送机构' },
  { key: 'reportName', label: '报表' },
  { key: 'period', label: '期次' },
  { key: 'rowNo', label: '行号' },
  { key: 'remark', label: '备注' }
]

/** 字段中文别名 → 填报字段名（页面上提示的写法） */
const CONDITION_ALIAS: Record<string, string> = {
  投保人名称: 'holderName',
  证件号: 'certNo',
  产品名称: 'productName',
  保费: 'premiumAmount',
  生效日期: 'effectDate',
  渠道: 'channel',
  机构: 'orgName',
  数据项状态: 'dataStatus'
}

/** 条件字段下拉与帮助文案（页面直接用，避免两边写两套字段名） */
export const desensConditionFieldOptions = () =>
  CONDITION_FIELDS.map((item) => ({ field: item.key, label: item.label }))

export const DESENS_CONDITION_HELP =
  '写法：字段 运算符 值，多条件用 &&（且）/ ||（或）连接。例：销售渠道 = 银保；保费金额 > 5000；数据状态 != 已作废；' +
  '可用运算符：= != > >= < <= 包含 不包含 为空 不为空；字段可用中文名（销售渠道）或字段名（channel）。留空表示全量脱敏。'

const resolveConditionField = (name: string): string => {
  const text = String(name || '').trim()
  if (!text) return ''
  const direct = CONDITION_FIELDS.find((item) => item.key === text)
  if (direct) return direct.key
  const byLabel = CONDITION_FIELDS.find((item) => item.label === text)
  if (byLabel) return byLabel.key
  if (CONDITION_ALIAS[text]) return CONDITION_ALIAS[text]
  const column = MASKABLE_COLUMNS.find((item) => item.columnName === text)
  if (column) return column.fieldKey
  return ''
}

/**
 * 解析命中条件。**不抛异常**：预检要把错误显示给用户，执行时再按结果决定是否拦下。
 * 支持的写法：`销售渠道 = 银保`、`保费金额 >= 5000 && 数据状态 != 已作废`、`渠道 = 银保 || 渠道 = 个险`
 */
export const parseDesensCondition = (text: string): DesensConditionParseResult => {
  const source = String(text || '').trim()
  if (!source) return { ok: true, error: '', groups: [] }
  const groups: DesensConditionItem[][] = []
  const orParts = source.split('||')
  for (const orPart of orParts) {
    const andParts = orPart.split('&&')
    const group: DesensConditionItem[] = []
    for (const raw of andParts) {
      const piece = raw.trim()
      if (!piece) continue
      const matched = /^(.+?)\s*(不包含|包含|不为空|为空|>=|<=|!=|=|>|<)\s*(.*)$/.exec(piece)
      if (!matched) {
        return {
          ok: false,
          error: '「' + piece + '」不是合法的条件，正确写法如：销售渠道 = 银保',
          groups: []
        }
      }
      const fieldKey = resolveConditionField(matched[1])
      if (!fieldKey) {
        return {
          ok: false,
          error:
            '条件里的字段「' +
            matched[1].trim() +
            '」无法识别，可用字段：' +
            CONDITION_FIELDS.map((item) => item.label).join(' / '),
          groups: []
        }
      }
      const op = matched[2]
      const value = matched[3].trim().replace(/^["'“”]|["'“”]$/g, '')
      if (op !== '为空' && op !== '不为空' && !value) {
        return { ok: false, error: '「' + piece + '」缺少比较值', groups: [] }
      }
      if ((op === '为空' || op === '不为空') && value) {
        return { ok: false, error: '「' + op + '」后面不需要写值：' + piece, groups: [] }
      }
      group.push({ field: matched[1].trim(), fieldKey, op, value, text: piece })
    }
    if (group.length) groups.push(group)
  }
  if (!groups.length) return { ok: false, error: '命中条件为空或无法解析', groups: [] }
  return { ok: true, error: '', groups }
}

const compareCondition = (actual: any, op: string, expected: string): boolean => {
  const a = actual === undefined || actual === null ? '' : String(actual)
  if (op === '为空') return a === ''
  if (op === '不为空') return a !== ''
  if (op === '包含') return a.indexOf(expected) >= 0
  if (op === '不包含') return a.indexOf(expected) < 0
  const an = Number(a)
  const en = Number(expected)
  const bothNumber = a !== '' && expected !== '' && !Number.isNaN(an) && !Number.isNaN(en)
  // 日期（YYYY-MM-DD）按字符串比大小即可正确排序，所以数值比不了时退化成字符串比较
  const bothDate = /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(expected)
  const orderable = bothNumber || bothDate
  if (op === '=') return bothNumber ? an === en : a === expected
  if (op === '!=') return bothNumber ? an !== en : a !== expected
  if (!orderable) return false
  const left = bothNumber ? an : a
  const right = bothNumber ? en : expected
  if (op === '>') return left > right
  if (op === '<') return left < right
  if (op === '>=') return left >= right
  return left <= right
}

/** 明细行是否命中条件（条件留空 = 命中所有行）；可传解析结果，避免逐行重复解析 */
export const matchDesensCondition = (
  row: Record<string, any>,
  condition: string | DesensConditionParseResult
): boolean => {
  const parsed = typeof condition === 'string' ? parseDesensCondition(condition) : condition
  if (!parsed.ok) return false
  if (!parsed.groups.length) return true
  return parsed.groups.some((group) =>
    group.every((item) => compareCondition(row[item.fieldKey], item.op, item.value))
  )
}

/**
 * 每条字段配置"当前到底生不生效"的判定结果（配置列表上直接标出来）。
 *
 * 为什么需要它：同一个「机构 × 报表 × 数据项」配多条时只有一条生效（优先级小的、再按 id 早的），
 * 页面上如果什么都不说，用户新增一条配置后会以为"配了就该生效"，实际被老配置盖住 ——
 * 这类"以为脱了其实没脱"的误会必须由系统主动讲清楚。
 */
export interface DesensFieldDecision {
  id: number
  /** active 生效中 / shadowed 被同范围其它配置覆盖 / window 不在生效期 / disabled 配置或规则已停用 */
  state: 'active' | 'shadowed' | 'window' | 'disabled'
  reason: string
  /** 生效中的那条（被覆盖时给出） */
  winnerId: number
  winnerRule: string
  winnerPriority: number
}

export const desensFieldDecisions = (today: string = desensToday()): DesensFieldDecision[] => {
  const rules = new Map(crDesensRuleTable.all().map((row) => [row.id, row]))
  return crDesensFieldTable.all().map((row) => {
    const base = { id: row.id, winnerId: 0, winnerRule: '', winnerPriority: 0 }
    if (Number(row.status) !== 1) {
      return { ...base, state: 'disabled' as const, reason: '配置已停用' }
    }
    const windowState = desensFieldWindowState(row, today)
    if (windowState !== 'active') {
      return {
        ...base,
        state: 'window' as const,
        reason:
          (windowState === 'expired' ? '已过期' : '未到生效日') +
          '（' +
          desensWindowText(row) +
          '）'
      }
    }
    const rule = rules.get(row.ruleId)
    if (!rule || rule.status !== 1) {
      return { ...base, state: 'disabled' as const, reason: '引用的规则已停用' }
    }
    // 在它自己的范围内算一遍：赢的是不是它自己
    const winners = effectiveDesensFields(Number(row.orgId), Number(row.reportId), today)
    const self = winners.find((item) => item.id === row.id)
    if (self) {
      const periods = row.periods || []
      // 配置列表没有"这次跑哪一期"的上下文，所以这里只说明它的适用范围，不判它在某一期生不生效
      return {
        ...base,
        state: 'active' as const,
        reason: periods.length ? '生效中（仅 ' + periods.join('、') + ' 期次适用）' : '生效中'
      }
    }
    const winner = winners.find((item) => item.fieldKey === row.fieldKey)
    return {
      ...base,
      state: 'shadowed' as const,
      reason: winner
        ? '被同范围的「' + winner.ruleCode + '」（优先级 ' + winner.priority + '）盖住，本条不生效'
        : '同范围没有生效的配置',
      winnerId: winner ? winner.id : 0,
      winnerRule: winner ? winner.ruleCode : '',
      winnerPriority: winner ? winner.priority : 0
    }
  })
}

/* ==================================================================
 * 二、脱敏字段配置
 * ================================================================== */
export interface DesensFieldRow {
  id: number
  /** 0 = 全部机构（兜底配置） */
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  columnCode: string
  columnName: string
  /** cr.fillData 上的字段名 */
  fieldKey: string
  ruleId: number
  ruleCode: string
  ruleName: string
  ruleType: DesensRuleType
  ruleParam: string
  /** 同一个数据项配了多条时，数字小的先生效（生效结果只有一个） */
  priority: number
  /**
   * 命中条件：只有满足条件的明细行才会被这条配置脱敏。
   * 语法见 `parseDesensCondition()`：`字段 运算符 值`，多条件用 && （且）/ || （或）连接；
   * 留空表示该字段全量脱敏。**解析不了的配置不会静默跳过，执行时直接报错**（合规功能不能"以为脱了其实没脱"）。
   */
  condition: string
  /** 生效期（YYYY-MM-DD，留空表示该端不限）；不在有效期内的配置不参与执行 */
  effectiveFrom: string
  effectiveTo: string
  /**
   * 适用期次（空数组 = 全部期次）。
   * 与生效期是两个维度：生效期按「今天」判断，期次按「这次跑哪一期」判断
   * （如"只给 202607 的补报数据用这条口径"）。
   */
  periods?: string[]
  /** 1 启用 / 0 停用 */
  status: number
  updateUser: string
  updateTime: string
  remark: string
}

const orgIdOf = (orgName: string): number => {
  const hit = reportOrgs().find((org) => org.orgName === orgName)
  return hit ? hit.id : 0
}

const reportOfId = (reportId: number) => reportOptions().find((report) => report.id === reportId)

interface FieldSeed {
  orgName: string
  reportId: number
  fieldKey: string
  ruleCode: string
  priority: number
  /** 命中条件（留空 = 全量脱敏） */
  condition?: string
  /** 生效期（留空 = 该端不限） */
  from?: string
  to?: string
  /** 适用期次（留空 = 全部期次） */
  periods?: string[]
  remark?: string
}

/**
 * 字段配置种子：覆盖「数据填报」里真实有明细的 8 个「机构 × 报表」组合，
 * 另加两条 orgId = 0 的全局兜底，用来演示「机构没配就走默认」。
 */
const FIELD_SEEDS: FieldSeed[] = [
  { orgName: '北京分公司', reportId: 11, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  { orgName: '北京分公司', reportId: 11, fieldKey: 'certNo', ruleCode: 'DR002', priority: 10 },
  { orgName: '上海分公司', reportId: 11, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  { orgName: '上海分公司', reportId: 11, fieldKey: 'certNo', ruleCode: 'DR006', priority: 10 },
  { orgName: '江苏分公司', reportId: 11, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  { orgName: '江苏分公司', reportId: 11, fieldKey: 'certNo', ruleCode: 'DR002', priority: 10 },
  { orgName: '广东分公司', reportId: 11, fieldKey: 'holderName', ruleCode: 'DR007', priority: 10 },
  { orgName: '广东分公司', reportId: 11, fieldKey: 'certNo', ruleCode: 'DR002', priority: 10 },
  { orgName: '北京分公司', reportId: 1, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  // 命中条件演示：只脱敏银保渠道的证件号，其余渠道保持原文（同一张表里能看到两种结果）
  {
    orgName: '北京分公司',
    reportId: 1,
    fieldKey: 'certNo',
    ruleCode: 'DR002',
    priority: 10,
    condition: '销售渠道 = 银保',
    remark: '监管口径：只脱敏银保渠道'
  },
  { orgName: '北京分公司', reportId: 1, fieldKey: 'policyNo', ruleCode: 'DR008', priority: 20 },
  // 「被覆盖」示例：与上面 priority 10 的姓名掩码配了同一个数据项，本条不会生效，
  // 配置列表的「生效判断」列会标出"被 DR001（优先级 10）盖住"
  {
    orgName: '北京分公司',
    reportId: 1,
    fieldKey: 'holderName',
    ruleCode: 'DR007',
    priority: 20,
    remark: '重复配置示例：被优先级 10 的姓名掩码盖住，不生效'
  },
  { orgName: '上海分公司', reportId: 12, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  { orgName: '江苏分公司', reportId: 2, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  { orgName: '江苏分公司', reportId: 2, fieldKey: 'certNo', ruleCode: 'DR002', priority: 10 },
  { orgName: '广东分公司', reportId: 12, fieldKey: 'holderName', ruleCode: 'DR001', priority: 10 },
  { orgName: '', reportId: 11, fieldKey: 'holderName', ruleCode: 'DR001', priority: 90 },
  { orgName: '', reportId: 11, fieldKey: 'certNo', ruleCode: 'DR002', priority: 90 },
  // 生效期演示一：这条 2026-09-10 已到期 → 不再参与执行，证件号回落到下面 priority 10 的掩码配置
  {
    orgName: '江苏分公司',
    reportId: 2,
    fieldKey: 'certNo',
    ruleCode: 'DR006',
    priority: 5,
    to: '2026-09-10',
    remark: '临时哈希配置，2026-09-10 到期'
  },
  // 生效期演示二：这条 2026-10-01 才生效 → 现在不参与执行，所以「上海分公司 × BX012」的证件号暂时没有生效配置
  {
    orgName: '上海分公司',
    reportId: 12,
    fieldKey: 'certNo',
    ruleCode: 'DR002',
    priority: 10,
    from: '2026-10-01',
    remark: '新口径 2026-10-01 起生效'
  },
  // 生效期演示三：只适用 202607 期次 → 跑 202608 的预检时会出现在「本次不参与的配置」里，
  // 理由写成「仅适用 202607 期次（本次 202608）」
  // 选 policyNo 而不是 certNo：certNo 在江苏 × BX011 已有生效配置，再叠一条期次配置会让「生效判断」列
  // 在没有期次上下文时说不清谁盖住谁（配置列表页不针对某一期判断）
  {
    orgName: '江苏分公司',
    reportId: 11,
    fieldKey: 'policyNo',
    ruleCode: 'DR008',
    priority: 5,
    periods: ['202607'],
    remark: '仅 202607 期次适用（补报口径）'
  }
]

export const crDesensFieldTable = defineTable<DesensFieldRow>('cr.desensField', () =>
  FIELD_SEEDS.map((seed, index) => {
    const column = maskableColumnOf(seed.fieldKey)
    const rule = ruleOfCode(seed.ruleCode)
    const report = reportOfId(seed.reportId)
    return {
      id: index + 1,
      orgId: seed.orgName ? orgIdOf(seed.orgName) : 0,
      orgName: seed.orgName || '全部机构',
      reportId: seed.reportId,
      reportCode: report ? report.reportCode : '',
      reportName: report ? report.reportName : '',
      columnCode: column.columnCode,
      columnName: column.columnName,
      fieldKey: seed.fieldKey,
      ruleId: rule ? rule.id : 0,
      ruleCode: rule ? rule.ruleCode : '',
      ruleName: rule ? rule.ruleName : '',
      ruleType: rule ? rule.ruleType : 'MASK',
      ruleParam: rule ? rule.ruleParam : '',
      priority: seed.priority,
      condition: seed.condition || '',
      effectiveFrom: seed.from || '',
      effectiveTo: seed.to || '',
      periods: seed.periods ? seed.periods.slice() : [],
      status: 1,
      updateUser: '系统管理员',
      updateTime: SEED_TIME,
      remark: seed.remark || (seed.orgName ? '机构级配置' : '全局兜底配置')
    }
  })
)

/* ==================================================================
 * 三、脱敏执行批次（脱敏日志页读的就是这张表）
 * ================================================================== */
/** 单个字段的处理明细：日志详情抽屉里一行一个字段 */
export interface DesensTaskDetail {
  columnCode: string
  columnName: string
  ruleCode: string
  ruleName: string
  ruleType: DesensRuleType
  ruleParam: string
  /** 该字段处理（改写）了多少行 */
  rows: number
  /** 因为不满足命中条件而跳过的行数（0 = 没有配条件或全部命中） */
  conditionSkipped: number
  /** 该字段的命中条件（空 = 全量脱敏） */
  condition: string
  /** 样例：第一条被处理的原文 → 结果 */
  sampleFrom: string
  sampleTo: string
}

/** 一次动作留痕：谁、什么时候、做了什么、说了什么 */
export interface DesensTrailItem {
  action: 'submit' | 'approve' | 'reject' | 'withdraw' | 'execute' | 'restore'
  /** 动作中文名（页面直接显示，不在页面里再写一套映射） */
  actionLabel: string
  user: string
  time: string
  remark: string
}

export const DESENS_TRAIL_LABEL: Record<DesensTrailItem['action'], string> = {
  submit: '提交执行申请',
  approve: '审核通过',
  reject: '审核驳回',
  withdraw: '撤回申请',
  execute: '执行脱敏',
  restore: '还原本批次'
}

/** 追加一条留痕（内部用）：每次都返回新的数组，避免改到旧引用 */
const appendTrail = (
  task: DesensTaskRow,
  action: DesensTrailItem['action'],
  user: string,
  remark = '',
  time = formatDateTime()
): DesensTrailItem[] =>
  (task.auditTrail || []).concat([
    { action, actionLabel: DESENS_TRAIL_LABEL[action], user, time, remark }
  ])

export interface DesensTaskRow {
  id: number
  /** 批次号 DS + 期次 + 4 位序号 */
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 执行范围（展示用）：机构 / 报表 / 期次 */
  scopeName: string
  /** 命中的字段数 / 规则数 */
  fieldCount: number
  ruleCount: number
  /** 涉及明细行数 */
  totalRows: number
  /** 实际改写的字段值个数（行 × 字段） */
  maskedRows: number
  /** 跳过个数（值为空或已脱敏） */
  skipRows: number
  /** 因不满足命中条件而跳过的行数（同类字段取最大值，展示用） */
  conditionSkipped: number
  /** 申请时的原文指纹（参与改写的列 × 行序），放行前复算用；历史批次与种子没有这一项 */
  sourceDigest?: string
  /** 1 执行中 / 2 执行成功 / 3 部分失败 / 4 执行失败 / 5 已还原 / 6 待审核 / 7 已驳回，见字典 cr_desens_status */
  status: number
  startTime: string
  endTime: string
  /** 耗时（毫秒） */
  cost: number
  /** 申请人（提交执行申请的人） */
  operator: string
  /** 审批流：申请人 / 申请时间 / 审核人 / 审核时间 / 审核意见 */
  applyUser: string
  applyTime: string
  /** 审批与执行留痕（提交 / 通过 / 驳回 / 撤回 / 执行 / 还原 逐条追加，越靠后越新） */
  auditTrail?: DesensTrailItem[]
  auditUser: string
  auditTime: string
  auditRemark: string
  details: DesensTaskDetail[]
  message: string
  remark: string
}

export const DESENS_TASK_STATUS = {
  RUNNING: 1,
  SUCCESS: 2,
  PARTIAL: 3,
  FAILED: 4,
  RESTORED: 5,
  /** 已提交执行申请，等审核岗放行（这一阶段还没有改任何数据） */
  PENDING_REVIEW: 6,
  /** 审核驳回，不会执行 */
  REJECTED: 7
} as const

export const DESENS_TASK_STATUS_LABEL: Record<number, string> = {
  1: '执行中',
  2: '执行成功',
  3: '部分失败',
  4: '执行失败',
  5: '已还原',
  6: '待审核',
  7: '已驳回'
}

/** 只有「待审核」的申请能被审核；执行过 / 已驳回的批次不允许再次审核 */
export const isPendingReview = (row: { status: number }) =>
  Number(row.status) === DESENS_TASK_STATUS.PENDING_REVIEW

/**
 * 生效的字段配置（执行与预检都走它）
 * 优先级：机构级精确配置 > 全部机构兜底；同字段多条按 priority 小的先生效；
 * 停用配置、停用规则、**不在生效期内的配置**都跳过。
 * @param today 生效期判断的"今天"，默认取系统当前日期
 */
/**
 * 「有多少行被命中条件挡在门外」的唯一口径：一行只要不满足任意一个字段的条件，就算被跳过（并集）。
 * 预检、申请单、批次记录、种子都调它，避免三处各写一遍 Math.max 导致数字打架。
 */
export const countRowsSkippedByCondition = (
  rows: any[],
  items: Array<{ condition?: string }>
): number => {
  const parsed = items
    .map((item) => String(item.condition || '').trim())
    .filter((condition) => !!condition)
    .map((condition) => parseDesensCondition(condition))
  if (!parsed.length) return 0
  // 解析不了的条件 = 这一列一行都处理不了（逐字段表里也是这么显示的），
  // 不能像以前那样把它过滤掉：那会让头部写"跳过 0 行"、逐字段列写"跳过 38 行"，两处自己打架
  if (parsed.some((result) => !result.ok)) return rows.length
  return rows.filter((row) => parsed.some((result) => !matchDesensCondition(row, result))).length
}

/** 适用期次文案：全部期次 / 仅 202607、202609 */
export const desensPeriodsText = (row: DesensFieldRow): string => {
  const periods = row.periods || []
  return periods.length ? '仅 ' + periods.join('、') + ' 期次' : '全部期次'
}

/** 期次是否适用：配置没写期次 = 全部期次都适用；没传期次（如配置列表、生效判断）时不按期次过滤 */
export const desensFieldPeriodMatched = (row: DesensFieldRow, period?: string): boolean => {
  const periods = row.periods || []
  if (!periods.length || !period) return true
  return periods.indexOf(String(period)) >= 0
}

export const effectiveDesensFields = (
  orgId: number,
  reportId: number,
  today: string = desensToday(),
  /** 本次执行的期次：配置上写了适用期次时，只有命中的期次才参与（不传 = 不按期次过滤） */
  period?: string
): DesensFieldRow[] => {
  const rules = new Map(crDesensRuleTable.all().map((row) => [row.id, row]))
  const picked = new Map<string, DesensFieldRow>()
  crDesensFieldTable
    .all()
    .filter((row) => row.status === 1 && Number(row.reportId) === Number(reportId))
    .filter((row) => Number(row.orgId) === Number(orgId) || Number(row.orgId) === 0)
    .filter((row) => desensFieldWindowState(row, today) === 'active')
    .filter((row) => desensFieldPeriodMatched(row, period))
    .filter((row) => {
      const rule = rules.get(row.ruleId)
      return !!rule && rule.status === 1
    })
    .sort(
      (a, b) =>
        (Number(a.orgId) === 0 ? 1 : 0) - (Number(b.orgId) === 0 ? 1 : 0) ||
        a.priority - b.priority ||
        a.id - b.id
    )
    .forEach((row) => {
      if (!picked.has(row.fieldKey)) picked.set(row.fieldKey, row)
    })
  // 顺序固定成「可脱敏字段的声明顺序」，否则预检计划会随配置的插入顺序漂移
  const order = MASKABLE_COLUMNS.map((item) => item.fieldKey)
  return [...picked.values()].sort((a, b) => order.indexOf(a.fieldKey) - order.indexOf(b.fieldKey))
}

export interface ExcludedDesensField {
  columnCode: string
  columnName: string
  ruleCode: string
  ruleName: string
  /** 未生效 / 已过期 / 规则已停用 */
  reason: string
  window: string
  /** 该字段是否还有别的生效配置兜住（true=只是这条不生效，false=这个字段本次完全不会处理） */
  covered: boolean
}

/**
 * 本该覆盖这个「机构 × 报表」、但因为**不在生效期**或规则已停用而被跳过的配置。
 * 预检会把这些列出来 —— 否则用户只看到"怎么没脱敏"，却不知道是配置过期了；
 * 也会看到"为什么这条配置没生效，生效的是哪一条"。
 */
export const excludedDesensFields = (
  orgId: number,
  reportId: number,
  today: string = desensToday(),
  period?: string
): ExcludedDesensField[] => {
  const rules = new Map(crDesensRuleTable.all().map((row) => [row.id, row]))
  const effectiveKeys = new Set(
    effectiveDesensFields(orgId, reportId, today, period).map((row) => row.fieldKey)
  )
  return crDesensFieldTable
    .all()
    .filter((row) => row.status === 1 && Number(row.reportId) === Number(reportId))
    .filter((row) => Number(row.orgId) === Number(orgId) || Number(row.orgId) === 0)
    .map((row) => {
      const state = desensFieldWindowState(row, today)
      const rule = rules.get(row.ruleId)
      const periodHit = desensFieldPeriodMatched(row, period)
      const reason =
        state !== 'active'
          ? DESENS_WINDOW_LABEL[state]
          : !periodHit
            ? '仅适用 ' + (row.periods || []).join('、') + ' 期次（本次 ' + period + '）'
            : rule && rule.status === 1
              ? ''
              : '规则已停用'
      return {
        columnCode: row.columnCode,
        columnName: row.columnName,
        ruleCode: row.ruleCode,
        ruleName: row.ruleName,
        reason,
        window: desensWindowText(row),
        covered: effectiveKeys.has(row.fieldKey),
        priority: row.priority,
        orgId: row.orgId
      }
    })
    .filter((item) => !!item.reason)
    .filter((item) => !(item.covered && item.reason === '规则已停用'))
    .filter(
      (item, index, list) =>
        list.findIndex(
          (other) => other.columnCode === item.columnCode && other.reason === item.reason
        ) === index
    )
}

/** 某「机构 × 报表 × 期次」的填报明细行 */
export const fillRowsOfKey = (orgId: number, reportId: number, period: string) =>
  crFillDataTable
    .all()
    .filter(
      (row) =>
        Number(row.orgId) === Number(orgId) &&
        Number(row.reportId) === Number(reportId) &&
        row.period === period
    )

/** 批次号：DS + 期次 + 该期次已用过的最大序号 + 1（按序号取最大，删除批次也不会撞号） */
export const nextDesensBatchNo = (period: string): string => {
  const prefix = 'DS' + period
  const used = crDesensTaskTable
    .all()
    .filter((row) => row.period === period)
    .map((row) => {
      const text = String(row.batchNo || '')
      if (text.indexOf(prefix) !== 0) return 0
      const seq = Number(text.slice(prefix.length))
      return Number.isFinite(seq) ? seq : 0
    })
  const seq = (used.length ? Math.max(...used) : 0) + 1
  return prefix + String(seq).padStart(4, '0')
}

export interface DesensPlanItem {
  columnCode: string
  columnName: string
  fieldKey: string
  ruleCode: string
  ruleName: string
  ruleType: DesensRuleType
  ruleParam: string
  /** 该字段可处理的非空行数（已排除不命中条件的行） */
  rows: number
  /** 其中已经有脱敏痕迹（重复执行时会被跳过）的行数 */
  alreadyMasked: number
  /** 值为空的行数 */
  empty: number
  /** 配置的命中条件（空 = 全量） */
  condition: string
  /** 条件解析失败时的原因（非空表示这条配置会被拦下） */
  conditionError: string
  /** 命中条件的行数 */
  matched: number
  /** 因为不满足命中条件而跳过的行数 */
  conditionSkipped: number
}

/**
 * 执行前预检：不写任何数据，只算「将要动哪些字段、影响多少行、有什么风险」。
 * 页面上点「预检」调的就是它，执行前必须让用户看到这份清单。
 */
export const precheckDesens = (orgId: number, reportId: number, period: string) => {
  const org = reportOrgs().find((item) => item.id === Number(orgId))
  const report = reportOfId(Number(reportId))
  const today = desensToday()
  const fields = effectiveDesensFields(orgId, reportId, today, period)
  const excluded = excludedDesensFields(orgId, reportId, today, period)
  const rows = fillRowsOfKey(orgId, reportId, period)
  const plan: DesensPlanItem[] = fields.map((field) => {
    const parsed = parseDesensCondition(field.condition)
    let alreadyMasked = 0
    let empty = 0
    let matched = 0
    let conditionSkipped = 0
    rows.forEach((row) => {
      if (!parsed.ok || !matchDesensCondition(row, parsed)) {
        conditionSkipped += 1
        return
      }
      matched += 1
      const value = String((row as any)[field.fieldKey] || '')
      if (!value) empty += 1
      else if (isMaskedValue(value, field)) alreadyMasked += 1
    })
    return {
      columnCode: field.columnCode,
      columnName: field.columnName,
      fieldKey: field.fieldKey,
      ruleCode: field.ruleCode,
      ruleName: field.ruleName,
      ruleType: field.ruleType,
      ruleParam: field.ruleParam,
      rows: matched - empty - alreadyMasked,
      alreadyMasked,
      empty,
      condition: field.condition,
      conditionError: parsed.ok ? '' : parsed.error,
      matched,
      conditionSkipped
    }
  })
  const warnings: string[] = []
  if (!rows.length) warnings.push('该「机构 × 报表 × 期次」下还没有填报数据，请先导入或补录')
  if (!fields.length) warnings.push('该报表没有生效的脱敏字段配置，请先到「脱敏字段配置」里配置')
  // 生效期 / 停用规则：被跳过的配置要说清楚，否则用户只看到"没脱敏"却不知道为什么
  excluded.forEach((item) => {
    warnings.push(
      item.covered
        ? '「' +
            item.columnName +
            '」有一条配置' +
            item.reason +
            '（规则 ' +
            item.ruleCode +
            '，生效期 ' +
            item.window +
            '），本次按其他生效配置处理'
        : '「' +
            item.columnName +
            '」的配置' +
            item.reason +
            '（规则 ' +
            item.ruleCode +
            '，生效期 ' +
            item.window +
            '），该字段本次完全不会处理'
    )
  })
  plan
    .filter((item) => !!item.conditionError)
    .forEach((item) => {
      warnings.push(
        '「' +
          item.columnName +
          '」的命中条件无法解析：' +
          item.conditionError +
          '（执行会被拦下，请先修正）'
      )
    })
  const totalWillMask = plan.reduce((sum, item) => sum + item.rows, 0)
  if (rows.length && !totalWillMask)
    warnings.push('所有字段的值都已脱敏或为空，重复执行不会产生变更')
  const alreadyMasked = plan.reduce((sum, item) => sum + item.alreadyMasked, 0)
  if (alreadyMasked)
    warnings.push('有 ' + alreadyMasked + ' 个字段值已经是脱敏结果，本次会自动跳过')
  // 并集口径：一行只要不满足**任意一个**字段的命中条件，它就不会被该字段处理。
  // 取各字段最大值会低估（两个字段各跳 33 行、实际有 42 行被跳过），页面上那句话就会骗人。
  const conditionSkipped = countRowsSkippedByCondition(rows, plan)
  if (conditionSkipped) {
    warnings.push(
      '有 ' +
        conditionSkipped +
        ' 行至少不满足一个字段的命中条件（按行跳过，条件见下表）：这些行在对应字段上保持原文不动，属于预期行为'
    )
  }
  return {
    orgId: Number(orgId),
    orgName: org ? org.orgName : '',
    reportId: Number(reportId),
    reportCode: report ? report.reportCode : '',
    reportName: report ? report.reportName : '',
    period,
    today,
    totalRows: rows.length,
    willMask: totalWillMask,
    fieldCount: fields.length,
    ruleCount: new Set(fields.map((item) => item.ruleCode)).size,
    excluded,
    conditionSkipped,
    plan,
    warnings
  }
}

/**
 * 执行脱敏：真实改写 cr.fillData，并把对照写进 cr.desensitize、批次写进 cr.desensTask。
 * 批次先以「执行中」落库，处理完再回写成「执行成功 / 部分失败」，日志里能看到真实耗时。
 */
export const runDesensitize = (params: {
  orgId: number
  reportId: number
  period: string
  operator: string
  /** 审批流：把执行结果写到这条既有的「待审核」申请单上（不新建批次） */
  task?: DesensTaskRow
}) => {
  const { orgId, reportId, period, operator } = params
  const fields = effectiveDesensFields(orgId, reportId, desensToday(), period)
  if (!fields.length) throw new Error('该报表没有生效的脱敏字段配置，请先在「脱敏字段配置」里配置')
  // 命中条件写错时必须拦下：静默跳过等于"以为脱敏了其实没脱"
  fields.forEach((field) => {
    const parsed = parseDesensCondition(field.condition)
    if (!parsed.ok) {
      throw new Error(
        '「' +
          field.columnName +
          '」的命中条件无法解析：' +
          parsed.error +
          '，请先修正「脱敏字段配置」再执行'
      )
    }
  })
  const rows = fillRowsOfKey(orgId, reportId, period)
  if (!rows.length) throw new Error('该「机构 × 报表 × 期次」下没有可脱敏的填报数据')
  const org = reportOrgs().find((item) => item.id === Number(orgId))
  const report = reportOfId(Number(reportId))
  const orgName = org ? org.orgName : ''
  const reportCode = report ? report.reportCode : ''
  const reportName = report ? report.reportName : ''
  const startedAt = Date.now()
  const now = formatDateTime()
  const batchNo =
    params.task && params.task.batchNo ? params.task.batchNo : nextDesensBatchNo(period)
  // 审批流：审核通过时在申请单上执行，保留申请人与审批痕迹；直接执行（历史能力）则新建批次
  const task = params.task
    ? (crDesensTaskTable.update({
        id: params.task.id,
        batchNo,
        orgId: Number(orgId),
        orgName,
        reportId: Number(reportId),
        reportCode,
        reportName,
        period,
        scopeName: orgName + ' / ' + reportName + ' / ' + period,
        fieldCount: fields.length,
        ruleCount: new Set(fields.map((item) => item.ruleCode)).size,
        totalRows: rows.length,
        maskedRows: 0,
        skipRows: 0,
        conditionSkipped: 0,
        status: DESENS_TASK_STATUS.RUNNING,
        startTime: now,
        endTime: '',
        cost: 0,
        details: [],
        message: '执行中'
      } as any) as DesensTaskRow)
    : crDesensTaskTable.insert({
        id: nextId(crDesensTaskTable.all()),
        batchNo,
        orgId: Number(orgId),
        orgName,
        reportId: Number(reportId),
        reportCode,
        reportName,
        period,
        scopeName: orgName + ' / ' + reportName + ' / ' + period,
        fieldCount: fields.length,
        ruleCount: new Set(fields.map((item) => item.ruleCode)).size,
        totalRows: rows.length,
        maskedRows: 0,
        skipRows: 0,
        conditionSkipped: 0,
        status: DESENS_TASK_STATUS.RUNNING,
        startTime: now,
        endTime: '',
        cost: 0,
        operator,
        details: [],
        message: '执行中',
        remark: ''
      })
  let maskedRows = 0
  let skipRows = 0
  let conditionSkippedTotal = 0
  const details: DesensTaskDetail[] = []
  fields.forEach((field) => {
    const parsed = parseDesensCondition(field.condition)
    let fieldRows = 0
    let fieldConditionSkipped = 0
    let sampleFrom = ''
    let sampleTo = ''
    rows.forEach((row) => {
      // 命中条件：不满足的行保持原文（这是配置的预期行为，不是漏脱敏）
      if (!matchDesensCondition(row, parsed)) {
        fieldConditionSkipped += 1
        return
      }
      const original = String((row as any)[field.fieldKey] || '')
      if (!original || isMaskedValue(original, field)) {
        skipRows += 1
        return
      }
      const masked = applyDesensRule(field.ruleType, field.ruleParam, original, field.fieldKey)
      const patch: Record<string, any> = { id: row.id, updateTime: now }
      patch[field.fieldKey] = masked
      crFillDataTable.update(patch as any)
      crDesensitizeTable.insert({
        dataKey: row.policyNo,
        policyNo: row.policyNo,
        rowNo: row.rowNo,
        orgId: Number(orgId),
        orgName,
        reportId: Number(reportId),
        reportCode,
        reportName,
        period,
        columnCode: field.columnCode,
        columnName: field.columnName,
        originalValue: original,
        maskedValue: masked,
        ruleType: field.ruleType,
        ruleParam: field.ruleParam,
        processTime: now,
        batchNo,
        taskId: task.id,
        source: 'execute'
      } as any)
      if (!sampleFrom) {
        sampleFrom = original
        sampleTo = masked
      }
      fieldRows += 1
      maskedRows += 1
    })
    details.push({
      columnCode: field.columnCode,
      columnName: field.columnName,
      ruleCode: field.ruleCode,
      ruleName: field.ruleName,
      ruleType: field.ruleType,
      ruleParam: field.ruleParam,
      rows: fieldRows,
      conditionSkipped: fieldConditionSkipped,
      condition: field.condition,
      sampleFrom,
      sampleTo
    })
  })
  // 与预检/申请单同一口径（并集），三处数字必须一样
  conditionSkippedTotal = countRowsSkippedByCondition(
    rows,
    fields.map((field) => ({ condition: field.condition }))
  )
  const emptyFields = details.filter((item) => item.rows === 0).length
  const cost = Date.now() - startedAt
  const status =
    maskedRows === 0
      ? DESENS_TASK_STATUS.FAILED
      : emptyFields
        ? DESENS_TASK_STATUS.PARTIAL
        : DESENS_TASK_STATUS.SUCCESS
  const conditionTip = conditionSkippedTotal
    ? '，另有 ' + conditionSkippedTotal + ' 行不满足命中条件（已按条件跳过）'
    : ''
  const auditTip = task.auditUser ? '（经 ' + task.auditUser + ' 审核通过后执行）' : ''
  const message =
    maskedRows === 0
      ? conditionSkippedTotal
        ? '没有任何行满足命中条件，未产生变更'
        : '所有字段的值都已脱敏或为空，未产生变更'
      : emptyFields
        ? '执行完成，但有 ' +
          emptyFields +
          ' 个字段没有可处理的值（已跳过）' +
          conditionTip +
          auditTip
        : '执行成功，' + fields.length + ' 个字段全部处理完成' + conditionTip + auditTip
  const updated = crDesensTaskTable.update({
    id: task.id,
    maskedRows,
    skipRows,
    conditionSkipped: conditionSkippedTotal,
    status,
    endTime: formatDateTime(),
    cost,
    details,
    message,
    auditTrail: appendTrail(
      task,
      'execute',
      operator,
      task.auditUser
        ? '审核通过后执行，改写 ' + maskedRows + ' 个字段值'
        : '直接执行（页面入口已改为提交申请），改写 ' + maskedRows + ' 个字段值'
    )
  })
  ensureFillRecordFor(
    { orgId: Number(orgId), reportId: Number(reportId), period },
    {
      rowCount: rows.length,
      fillStatus: 1,
      lastModifier: operator,
      lastModifyTime: formatDateTime(),
      remark: '脱敏执行 ' + batchNo
    }
  )
  return {
    ...(updated || task),
    batchNo,
    maskedRows,
    skipRows,
    conditionSkipped: conditionSkippedTotal,
    fieldCount: fields.length,
    details
  }
}

/* ==================================================================
 * 脱敏审批流：执行前先提交申请，审核岗放行后才真正改写数据
 * ================================================================== */

/** 一个范围的申请单摘要（审批页与执行页都要看的那几项） */
const applyPlanOf = (params: { orgId: number; reportId: number; period: string }) => {
  const { orgId, reportId, period } = params
  const fields = effectiveDesensFields(orgId, reportId, desensToday(), period)
  fields.forEach((field) => {
    const parsed = parseDesensCondition(field.condition)
    if (!parsed.ok) {
      throw new Error(
        '「' +
          field.columnName +
          '」的命中条件无法解析：' +
          parsed.error +
          '，请先修正「脱敏字段配置」再提交申请'
      )
    }
  })
  const rows = fillRowsOfKey(orgId, reportId, period)
  const details: DesensTaskDetail[] = fields.map((field) => {
    const parsed = parseDesensCondition(field.condition)
    const hitRows = rows.filter((row) => matchDesensCondition(row, parsed))
    // 预计脱敏数按"真正会变"的口径算：命中条件 + 值非空 + 还没脱敏过，与预检页的数字一致
    const willRows = hitRows.filter((row) => {
      const value = String((row as any)[field.fieldKey] || '')
      return !!value && !isMaskedValue(value, field)
    })
    const sample = willRows[0]
    const original = sample ? String((sample as any)[field.fieldKey] || '') : ''
    return {
      columnCode: field.columnCode,
      columnName: field.columnName,
      ruleCode: field.ruleCode,
      ruleName: field.ruleName,
      ruleType: field.ruleType,
      ruleParam: field.ruleParam,
      rows: willRows.length,
      conditionSkipped: rows.length - hitRows.length,
      condition: field.condition,
      sampleFrom: original,
      sampleTo: original
        ? applyDesensRule(field.ruleType, field.ruleParam, original, field.fieldKey)
        : ''
    }
  })
  const org = reportOrgs().find((item) => item.id === Number(orgId))
  const report = reportOfId(Number(reportId))
  return {
    fields,
    rows,
    details,
    orgName: org ? org.orgName : '',
    reportCode: report ? report.reportCode : '',
    reportName: report ? report.reportName : '',
    conditionSkipped: countRowsSkippedByCondition(
      rows,
      details.map((item) => ({ condition: item.condition }))
    )
  }
}

/**
 * 参与改写的原文指纹：行数、规则、条件都没变，但**行内容变了**（补录、导入、两行值互换…）时，
 * 只看数量是发现不了的。这里把"会参与改写的那些列 × 行序"拼成一个短指纹，申请时存一份，放行前再算一次。
 */
const desensSourceDigest = (rows: any[], fieldKeys: string[]): string => {
  const keys = [...new Set(fieldKeys)].sort()
  const lines = rows.map((row: any) => {
    // 行标识用保单号（填报数据的业务主键）；没有就退回行号，两者都没有时只比值
    const id = String((row && (row.policyNo || row.rowNo)) || '')
    const values = keys.map((key) => String((row && row[key]) ?? '')).join('\u0001')
    return id ? id + '\u0003' + values : values
  })
  // 先排序再拼：填报数据保存 / 导入后底层行序可能变，但"哪一行是什么值"没变就不该算变化；
  // 反过来，两行值互换会让这里每一行都变（有行标识时），这正是要抓的
  lines.sort()
  const text = lines.join('\u0002')
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(16) + '-' + text.length
}

/**
 * 提交执行申请：**只落一条「待审核」的申请单，不改任何填报数据**。
 * 审核岗在「脱敏审批」页通过之后才真正执行（approveDesensTask）。
 */
export const submitDesensApply = (params: {
  orgId: number
  reportId: number
  period: string
  operator: string
  remark?: string
}) => {
  const { orgId, reportId, period, operator } = params
  const plan = applyPlanOf({ orgId, reportId, period })
  if (!plan.fields.length)
    throw new Error('该报表没有生效的脱敏字段配置，请先在「脱敏字段配置」里配置')
  if (!plan.rows.length) throw new Error('该「机构 × 报表 × 期次」下没有可脱敏的填报数据')
  // 预计脱敏 0 个字段值的申请不该进审批队列：否则审核岗放行后只会落一条「执行失败」，白审一趟
  if (!plan.details.reduce((sum, item) => sum + item.rows, 0)) {
    throw new Error('所有字段的值都已脱敏或为空，本次申请不会产生变更，已跳过')
  }
  // 同一范围不允许堆多条待审核申请，否则审核岗不知道该放行哪一条
  const dup = crDesensTaskTable
    .all()
    .find(
      (row) =>
        Number(row.status) === DESENS_TASK_STATUS.PENDING_REVIEW &&
        Number(row.orgId) === Number(orgId) &&
        Number(row.reportId) === Number(reportId) &&
        row.period === period
    )
  if (dup)
    throw new Error(
      '该范围已有一条待审核的申请（批次号 ' + dup.batchNo + '），请等审核结果或先撤回'
    )
  const now = formatDateTime()
  const batchNo = nextDesensBatchNo(period)
  return crDesensTaskTable.insert({
    id: nextId(crDesensTaskTable.all()),
    batchNo,
    orgId: Number(orgId),
    orgName: plan.orgName,
    reportId: Number(reportId),
    reportCode: plan.reportCode,
    reportName: plan.reportName,
    period,
    scopeName: plan.orgName + ' / ' + plan.reportName + ' / ' + period,
    fieldCount: plan.fields.length,
    ruleCount: new Set(plan.fields.map((item) => item.ruleCode)).size,
    totalRows: plan.rows.length,
    maskedRows: 0,
    skipRows: 0,
    conditionSkipped: plan.conditionSkipped,
    status: DESENS_TASK_STATUS.PENDING_REVIEW,
    startTime: now,
    endTime: '',
    cost: 0,
    operator,
    applyUser: operator,
    applyTime: now,
    auditUser: '',
    auditTime: '',
    auditRemark: '',
    auditTrail: [
      {
        action: 'submit',
        actionLabel: DESENS_TRAIL_LABEL.submit,
        user: operator,
        time: now,
        remark: params.remark || ''
      }
    ],
    details: plan.details,
    // 原文指纹：放行前拿它比一次"要改的那些值有没有被动过"（老数据没有这一项，复算时跳过）
    sourceDigest: desensSourceDigest(
      plan.rows,
      plan.fields.map((item) => item.fieldKey)
    ),
    message:
      '待审核：预计脱敏 ' +
      plan.details.reduce((sum, item) => sum + item.rows, 0) +
      ' 个字段值，尚未改写任何数据',
    remark: params.remark || ''
  } as any)
}

/**
 * 放行前复算：申请单上的"预计脱敏 N 个字段值"是提交那一刻的快照，
 * 之后只要有人补录/导入/还原，实际会改写的数量就变了。审核岗需要看到这个差异再决定放行。
 */
export const recheckDesensApply = (taskId: number) => {
  const task = crDesensTaskTable.get(Number(taskId))
  if (!task) throw new Error('脱敏申请不存在：id=' + taskId)
  // 复算回答的是"这条待审核申请现在放行会改多少"：历史批次（已执行 / 已还原 / 无变更）没有"放行"这一步，
  // 拿现在的配置去比它的空明细，会给出"本次新增参与"这种语义不对的结论，所以直接说清楚
  if (!isPendingReview(task)) {
    throw new Error(
      '该申请当前是「' +
        (DESENS_TASK_STATUS_LABEL[Number(task.status)] || task.status) +
        '」，只有待审核的申请需要放行前复算'
    )
  }
  const storedExpected = (task.details || []).reduce((sum, item) => sum + Number(item.rows || 0), 0)
  /** 一条明细的"身份"：数据项 + 生效规则（含参数）+ 命中条件。行数不变但规则/条件换了，也必须算变了 */
  const signatureOf = (key: string, item: any) =>
    [
      key,
      String(item.ruleCode || ''),
      String(item.ruleType || ''),
      String(item.ruleParam || ''),
      String(item.condition || '').trim()
    ].join('|')
  try {
    const plan = applyPlanOf({ orgId: task.orgId, reportId: task.reportId, period: task.period })
    const currentExpected = plan.details.reduce((sum, item) => sum + item.rows, 0)
    // 逐字段比对：不只比总数，还比"哪个数据项、用哪条规则、什么条件"——只看数量会漏掉"换成另一套规则但行数刚好一样"
    const diff: string[] = []
    const stored = task.details || []
    const storedKeys = stored.map((item) => String(item.columnCode || item.columnName || ''))
    const currentKeys = plan.details.map((item) => String(item.columnCode || item.columnName || ''))
    storedKeys.forEach((key, index) => {
      const before = stored[index]
      const after = currentKeys.indexOf(key) >= 0 ? plan.details[currentKeys.indexOf(key)] : null
      if (!after) {
        diff.push(
          '「' + (before.columnName || key) + '」本次不再参与（配置被停用/删除/不在生效期）'
        )
        return
      }
      if (signatureOf(key, before) !== signatureOf(key, after)) {
        diff.push(
          '「' +
            (before.columnName || key) +
            '」生效口径变了：' +
            (before.ruleCode || '-') +
            (before.condition ? '（' + before.condition + '）' : '') +
            ' → ' +
            (after.ruleCode || '-') +
            (after.condition ? '（' + after.condition + '）' : '')
        )
      }
    })
    currentKeys
      .filter((key) => storedKeys.indexOf(key) < 0)
      .forEach((key) => {
        const item: any = plan.details[currentKeys.indexOf(key)]
        diff.push('「' + (item.columnName || key) + '」本次新增参与（新增配置或刚生效）')
      })
    // 原文指纹：按"行标识 + 本次会参与改写的值"比（排序后再哈希）；老申请单（种子里没有这项）不参与比对，避免误报
    const storedDigest = String((task as any).sourceDigest || '')
    const currentDigest = desensSourceDigest(
      plan.rows,
      plan.fields.map((item) => item.fieldKey)
    )
    if (storedDigest && storedDigest !== currentDigest) {
      diff.push(
        '本次会参与改写的原文内容有变动（脱敏字段、规则、行数都没变）——建议核对填报数据后再放行'
      )
    }
    const countChanged =
      currentExpected !== storedExpected || plan.rows.length !== Number(task.totalRows || 0)
    const scopeDiff = diff.filter((item) => item.indexOf('原文内容有变动') < 0)
    return {
      id: task.id,
      batchNo: task.batchNo,
      storedExpected,
      currentExpected,
      storedTotalRows: Number(task.totalRows || 0),
      currentTotalRows: plan.rows.length,
      changed: countChanged || diff.length > 0,
      // 三条轴分开给：页面标题据此换说法，别让"只有原文变了"写成"生效规则有变化"
      countChanged,
      scopeChanged: scopeDiff.length > 0,
      contentChanged: diff.length > scopeDiff.length,
      diff,
      error: ''
    }
  } catch (error: any) {
    // 复算失败（配置被删、数据被清空等）也算"有变化"，把原因原样给审核岗看
    return {
      id: task.id,
      batchNo: task.batchNo,
      storedExpected,
      currentExpected: 0,
      storedTotalRows: Number(task.totalRows || 0),
      currentTotalRows: 0,
      changed: true,
      countChanged: true,
      scopeChanged: false,
      contentChanged: false,
      diff: [],
      error: String((error && error.message) || error || '复算失败')
    }
  }
}

/** 审核通过：真正执行脱敏，执行结果写回这张申请单 */
export const approveDesensTask = (taskId: number, auditor: string, remark = '') => {
  const task = crDesensTaskTable.get(Number(taskId))
  if (!task) throw new Error('脱敏申请不存在：id=' + taskId)
  if (!isPendingReview(task)) {
    throw new Error(
      '该申请当前是「' +
        (DESENS_TASK_STATUS_LABEL[Number(task.status)] || task.status) +
        '」，只有待审核的申请可以审核'
    )
  }
  const auditTime = formatDateTime()
  // 申请到审核之间填报数据可能被改过（补录、导入、还原…）：复算一次，差多少如实写进留痕，不能默默改一个数
  const storedExpected = (task.details || []).reduce((sum, item) => sum + Number(item.rows || 0), 0)
  const recheck = recheckDesensApply(task.id)
  const diffNote = recheck.diff && recheck.diff.length ? '；' + recheck.diff.join('；') : ''
  const auditRemark =
    (remark || '同意执行') +
    (recheck.changed
      ? '（放行时复算：申请时预计 ' +
        storedExpected +
        ' 个，当前预计 ' +
        recheck.currentExpected +
        ' 个' +
        diffNote +
        '）'
      : '')
  const audited = crDesensTaskTable.update({
    id: task.id,
    auditUser: auditor,
    auditTime,
    auditRemark,
    auditTrail: appendTrail(task, 'approve', auditor, auditRemark, auditTime)
  })
  return runDesensitize({
    orgId: task.orgId,
    reportId: task.reportId,
    period: task.period,
    operator: auditor,
    task: (audited || task) as DesensTaskRow
  })
}

/** 审核驳回：不执行，留下原因 */
export const rejectDesensTask = (taskId: number, auditor: string, remark: string) => {
  const task = crDesensTaskTable.get(Number(taskId))
  if (!task) throw new Error('脱敏申请不存在：id=' + taskId)
  if (!isPendingReview(task)) {
    throw new Error(
      '该申请当前是「' +
        (DESENS_TASK_STATUS_LABEL[Number(task.status)] || task.status) +
        '」，只有待审核的申请可以审核'
    )
  }
  const reason = String(remark || '').trim()
  if (!reason) throw new Error('驳回必须填写原因')
  const now = formatDateTime()
  return crDesensTaskTable.update({
    id: task.id,
    status: DESENS_TASK_STATUS.REJECTED,
    auditUser: auditor,
    auditTime: now,
    auditRemark: reason,
    auditTrail: appendTrail(task, 'reject', auditor, reason, now),
    endTime: now,
    cost: 0,
    message: '审核驳回：' + reason
  })
}

/**
 * 撤回申请：直接把「待审核」的申请单删掉（它还没动过任何数据，删掉不会留债务）。
 * 已执行 / 已驳回的批次不能撤回 —— 那些要走「还原」。
 */
export const withdrawDesensApply = (taskId: number, operator: string) => {
  const task = crDesensTaskTable.get(Number(taskId))
  if (!task) throw new Error('脱敏申请不存在：id=' + taskId)
  if (!isPendingReview(task)) {
    throw new Error(
      '该申请当前是「' +
        (DESENS_TASK_STATUS_LABEL[Number(task.status)] || task.status) +
        '」，只有待审核的申请可以撤回'
    )
  }
  // 申请单会被删掉（它没动过数据），所以撤回留痕只回给页面做提示，不留库
  const trail = appendTrail(task, 'withdraw', operator, '申请单已作废')
  crDesensTaskTable.remove(Number(taskId))
  return {
    ...task,
    auditTrail: trail,
    message: '已由 ' + operator + ' 撤回（申请单已作废）',
    remark: '已撤回'
  }
}

/**
 * 还原：把这一批次的对照（cr.desensitize 里有 batchNo 的那些）倒回 cr.fillData。
 * 真实系统不会保留原文（只留哈希），演示环境为了让「执行 → 结果查询 → 还原」可以反复走，
 * 才把脱敏前原文留在对照表里；还原后本批次的对照行会被清掉，避免结果查询页出现「已还原的假数据」。
 */
export const restoreDesensTask = (taskId: number, operator: string) => {
  const task = crDesensTaskTable.get(Number(taskId))
  if (!task) throw new Error('脱敏批次不存在：id=' + taskId)
  if (task.status === DESENS_TASK_STATUS.RESTORED) throw new Error('该批次已经还原过了')
  if (task.status === DESENS_TASK_STATUS.RUNNING) throw new Error('该批次还在执行中，不能还原')
  const contrasts = crDesensitizeTable.all().filter((row) => Number(row.taskId) === Number(taskId))
  if (!contrasts.length) throw new Error('该批次没有可还原的对照数据')
  const now = formatDateTime()
  let restored = 0
  contrasts.forEach((item) => {
    const fill = crFillDataTable
      .all()
      .find(
        (row) =>
          Number(row.orgId) === Number(item.orgId) &&
          Number(row.reportId) === Number(item.reportId) &&
          row.period === item.period &&
          Number(row.rowNo) === Number(item.rowNo)
      )
    if (!fill) return
    const fieldKey = fieldKeyOfColumn(item.columnCode)
    const patch: Record<string, any> = { id: fill.id, updateTime: now }
    patch[fieldKey] = item.originalValue
    crFillDataTable.update(patch as any)
    restored += 1
  })
  crDesensitizeTable.removeBatch(contrasts.map((row) => row.id))
  const updated = crDesensTaskTable.update({
    id: task.id,
    status: DESENS_TASK_STATUS.RESTORED,
    endTime: now,
    message: task.message + '；已由 ' + operator + ' 还原 ' + restored + ' 个字段值',
    auditTrail: appendTrail(
      task,
      'restore',
      operator,
      '还原 ' + restored + ' 个字段值，本批次对照已清除',
      now
    ),
    remark: '已还原'
  })
  ensureFillRecordFor(
    { orgId: Number(task.orgId), reportId: Number(task.reportId), period: task.period },
    {
      rowCount: fillRowsOfKey(task.orgId, task.reportId, task.period).length,
      fillStatus: 1,
      lastModifier: operator,
      lastModifyTime: now,
      remark: '脱敏批次 ' + task.batchNo + ' 已还原'
    }
  )
  return { ...(updated || task), restored, batchNo: task.batchNo }
}

/* ==================================================================
 * 四、执行批次种子（历史记录，只用于日志页展示）
 * ================================================================== */
interface TaskSeed {
  orgName: string
  reportId: number
  period: string
  status: number
  time: string
  cost: number
  operator: string
  message: string
  /** 只保留前 N 个字段的明细（演示「部分字段」的情况） */
  fieldLimit?: number
  /** 审批流：申请说明 / 审核人 / 审核意见 */
  applyRemark?: string
  auditUser?: string
  auditRemark?: string
}

const TASK_SEEDS: TaskSeed[] = [
  // 审批流演示：待审核（审核岗在这个页面上放行后才真正改写数据）
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    status: 6,
    time: '2026-09-12 09:12:30',
    cost: 0,
    operator: '系统管理员',
    message: '待审核：预计脱敏 76 个字段值，尚未改写任何数据',
    applyRemark: '本期新增保户，按新口径脱敏后报送'
  },
  {
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    status: 6,
    time: '2026-09-12 09:20:05',
    cost: 0,
    operator: '系统管理员',
    message: '待审核：预计脱敏 33 个字段值，尚未改写任何数据',
    applyRemark: ''
  },
  {
    orgName: '广东分公司',
    reportId: 11,
    period: '202607',
    status: 7,
    time: '2026-09-11 17:40:12',
    cost: 0,
    operator: '系统管理员',
    message: '审核驳回：上期数据已报送，不再重跑脱敏',
    auditUser: '报送审核岗',
    auditRemark: '上期数据已报送，不再重跑脱敏'
  },
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    time: '2026-09-11 09:30:12',
    cost: 418,
    operator: '系统管理员',
    message: '执行成功，2 个字段全部处理完成'
  },
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    time: '2026-09-11 09:28:40',
    cost: 366,
    operator: '系统管理员',
    message: '执行成功，2 个字段全部处理完成'
  },
  {
    orgName: '江苏分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    time: '2026-09-11 09:26:05',
    cost: 302,
    operator: '系统管理员',
    message: '执行成功，2 个字段全部处理完成'
  },
  {
    orgName: '广东分公司',
    reportId: 11,
    period: '202608',
    status: 3,
    time: '2026-09-11 09:24:31',
    cost: 287,
    operator: '系统管理员',
    message: '执行完成，但有 1 个字段没有可处理的值（已跳过）',
    fieldLimit: 2
  },
  {
    orgName: '北京分公司',
    reportId: 1,
    period: '202608',
    status: 2,
    time: '2026-09-10 16:42:18',
    cost: 331,
    operator: '报送审核岗',
    message: '执行成功，3 个字段全部处理完成'
  },
  {
    orgName: '上海分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    time: '2026-09-10 16:39:52',
    cost: 264,
    operator: '报送审核岗',
    message: '执行成功，1 个字段全部处理完成'
  },
  {
    orgName: '江苏分公司',
    reportId: 2,
    period: '202608',
    status: 2,
    time: '2026-09-10 16:36:20',
    cost: 249,
    operator: '报送审核岗',
    message: '执行成功，2 个字段全部处理完成'
  },
  {
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    status: 4,
    time: '2026-09-10 16:30:07',
    cost: 12,
    operator: '系统管理员',
    message: '所有字段的值都已脱敏或为空，未产生变更',
    fieldLimit: 0
  },
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202607',
    status: 5,
    time: '2026-09-09 11:05:33',
    cost: 356,
    operator: '系统管理员',
    message: '执行成功，2 个字段全部处理完成；已由 系统管理员 还原 56 个字段值'
  },
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202607',
    status: 2,
    time: '2026-09-09 11:02:11',
    cost: 318,
    operator: '系统管理员',
    message: '执行成功，2 个字段全部处理完成'
  },
  {
    orgName: '江苏分公司',
    reportId: 11,
    period: '202607',
    status: 2,
    time: '2026-09-09 10:58:47',
    cost: 296,
    operator: '系统管理员',
    message: '执行成功，2 个字段全部处理完成'
  }
]

/** 历史的种子批次只是「记录」，不会回放进填报数据；只有页面上的执行才真正改写 cr.fillData */
function buildDesensTasks(): DesensTaskRow[] {
  // 批次号按「期次」独立递增（DS2026080001 / DS2026070001 …），与执行时的 nextDesensBatchNo 同一口径
  const seqOfPeriod = new Map<string, number>()
  return TASK_SEEDS.map((seed, index) => {
    const seq = (seqOfPeriod.get(seed.period) || 0) + 1
    seqOfPeriod.set(seed.period, seq)
    const orgId = orgIdOf(seed.orgName)
    const report = reportOfId(seed.reportId)
    const reportCode = report ? report.reportCode : ''
    const reportName = report ? report.reportName : ''
    const rows = fillRowsOfKey(orgId, seed.reportId, seed.period)
    /**
     * 种子批次的明细必须和"现在真跑一次"同一个口径（含生效期 / 适用期次 / 空值 / 已脱敏值），
     * 否则"放行前复算"会在一打开种子申请时就报红条 —— 那是自己数据不一致，不是审核发现的问题。
     * 早期版本只按"命中条件的行数"算（rows.length - skipped），少扣了空值与已脱敏值，实测差 1 个值。
     */
    let planned: ReturnType<typeof applyPlanOf> | null = null
    if (seed.status !== 4) {
      try {
        planned = applyPlanOf({ orgId, reportId: seed.reportId, period: seed.period })
      } catch (error) {
        // 该范围没有填报数据 / 没有生效配置：种子仍然保留这条历史记录，明细退回粗算
        planned = null
      }
    }
    const plannedDetails = planned ? planned.details : []
    const fields = effectiveDesensFields(orgId, seed.reportId, desensToday(), seed.period).slice(
      0,
      seed.fieldLimit === undefined ? 99 : seed.fieldLimit
    )
    const sample = rows[0]
    const details: DesensTaskDetail[] = fields.map((field) => {
      const original = sample ? String((sample as any)[field.fieldKey] || '') : ''
      // 优先用引擎算出来的明细（同一口径）；引擎没覆盖到的字段（被 fieldLimit 截断等）再退回按条件粗算
      const hit = plannedDetails.find((item) => item.columnCode === field.columnCode)
      const skipped =
        seed.status === 4 || !sample
          ? 0
          : rows.filter((row) => !matchDesensCondition(row, field.condition)).length
      const hitRows = seed.status === 4 ? 0 : hit ? hit.rows : rows.length - skipped
      return {
        columnCode: field.columnCode,
        columnName: field.columnName,
        ruleCode: field.ruleCode,
        ruleName: field.ruleName,
        ruleType: field.ruleType,
        ruleParam: field.ruleParam,
        rows: hitRows,
        conditionSkipped: hit && seed.status !== 4 ? hit.conditionSkipped : skipped,
        condition: field.condition,
        sampleFrom: (hit && hit.sampleFrom) || original,
        sampleTo:
          (hit && hit.sampleTo) ||
          applyDesensRule(field.ruleType, field.ruleParam, original, field.fieldKey)
      }
    })
    // 待审核（6）与已驳回（7）都还没执行，脱敏字段值必须是 0，否则页面上会出现"没执行却已脱敏"的假数据
    const notExecuted = seed.status === 4 || seed.status === 6 || seed.status === 7
    // 审批与执行留痕：种子里也要看得出"谁提交、谁审核、谁执行、谁还原"，否则日志详情只有最后状态
    const trail: DesensTrailItem[] = []
    if (seed.status === 6 || seed.status === 7) {
      trail.push({
        action: 'submit',
        actionLabel: DESENS_TRAIL_LABEL.submit,
        user: seed.operator,
        time: seed.time,
        remark: seed.applyRemark || ''
      })
      if (seed.status === 7) {
        trail.push({
          action: 'reject',
          actionLabel: DESENS_TRAIL_LABEL.reject,
          user: seed.auditUser || '报送审核岗',
          time: seed.time,
          remark: seed.auditRemark || ''
        })
      }
    } else {
      if (seed.operator === '报送审核岗') {
        // 历史批次由审核岗直接执行（那时还没有审批流），如实记录成"直接执行"
        trail.push({
          action: 'execute',
          actionLabel: DESENS_TRAIL_LABEL.execute,
          user: seed.operator,
          time: seed.time,
          remark:
            seed.status === 4
              ? '没有可处理的值，未产生变更'
              : '直接执行，改写 ' + details.reduce((sum, item) => sum + item.rows, 0) + ' 个字段值'
        })
      } else {
        trail.push({
          action: 'execute',
          actionLabel: DESENS_TRAIL_LABEL.execute,
          user: seed.operator,
          time: seed.time,
          remark:
            seed.status === 4
              ? '没有可处理的值，未产生变更'
              : '改写 ' + details.reduce((sum, item) => sum + item.rows, 0) + ' 个字段值'
        })
      }
      if (seed.status === 5) {
        trail.push({
          action: 'restore',
          actionLabel: DESENS_TRAIL_LABEL.restore,
          user: seed.operator,
          time: seed.time,
          remark:
            '还原 ' +
            details.reduce((sum, item) => sum + item.rows, 0) +
            ' 个字段值，本批次对照已清除'
        })
      }
    }
    const maskedRows = notExecuted ? 0 : details.reduce((sum, item) => sum + item.rows, 0)
    const skipRows = seed.status === 5 || notExecuted ? 0 : details.length ? details.length + 4 : 8
    const conditionSkipped = countRowsSkippedByCondition(
      rows,
      details.map((item) => ({ condition: item.condition }))
    )
    return {
      id: index + 1,
      batchNo: 'DS' + seed.period + String(seq).padStart(4, '0'),
      orgId,
      orgName: seed.orgName,
      reportId: seed.reportId,
      reportCode,
      reportName,
      period: seed.period,
      scopeName: seed.orgName + ' / ' + reportName + ' / ' + seed.period,
      fieldCount: details.length,
      ruleCount: new Set(details.map((item) => item.ruleCode)).size,
      totalRows: rows.length,
      maskedRows,
      skipRows,
      conditionSkipped,
      status: seed.status,
      startTime: seed.time,
      endTime: seed.time,
      cost: seed.cost,
      operator: seed.operator,
      details,
      // 待审核的种子申请单也带原文指纹（口径与当前引擎一致，种子刚播完不会报红条），
      // 这样"申请后被改过数据"的演示在种子上就能演；已执行/已还原的历史批次不复算，就不存指纹了
      sourceDigest:
        seed.status === 6 && planned
          ? desensSourceDigest(
              planned.rows,
              planned.fields.map((item) => item.fieldKey)
            )
          : '',
      message:
        seed.status === 6
          ? '待审核：预计脱敏 ' +
            details.reduce((sum, item) => sum + item.rows, 0) +
            ' 个字段值，尚未改写任何数据'
          : seed.message,
      applyUser: seed.status === 6 || seed.status === 7 ? seed.operator : '',
      applyTime: seed.status === 6 || seed.status === 7 ? seed.time : '',
      auditUser: seed.auditUser || '',
      auditTime: seed.auditUser ? seed.time : '',
      auditRemark: seed.auditRemark || '',
      auditTrail: trail,
      remark:
        seed.status === 5
          ? '已还原'
          : seed.status === 6
            ? seed.applyRemark || '待审核申请'
            : seed.status === 7
              ? '审核驳回，未执行'
              : '历史批次（种子数据）'
    }
  })
}

export const crDesensTaskTable = defineTable<DesensTaskRow>('cr.desensTask', buildDesensTasks)
