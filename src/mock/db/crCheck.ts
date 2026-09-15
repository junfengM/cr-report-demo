/**
 * Mock 种子数据 — 数据检核域
 *
 * 三张表：
 * - cr.checkRule   校验规则（非空 / 长度 / 值域 / 逻辑 / 表间 / 枚举）
 * - cr.checkStatus 按「机构 × 报表 × 期次」的校验任务状态
 * - cr.checkResult 校验不通过明细（错误级别：错误会阻断报送，警告不阻断）
 *
 * 规则里的勾稽关系参照监管报送常见口径（保单满期晚于生效、赔付不得大于保额、
 * 表间保费合计一致、证件类型取自监管码值表等），便于演示时讲得通。
 */
import { defineTable } from '../store'
import {
  AUDIT_USERS,
  BRANCH_NAMES,
  ERROR_LEVEL,
  PERIOD,
  REVIEW_USERS,
  RULE_TYPE,
  reportOptions,
  reportOrgs
} from './crCommon'

/* ==================================================================
 * 校验规则
 * ================================================================== */
export interface CheckRuleRow {
  id: number
  /** 规则编码，如 JC2026001 */
  ruleCode: string
  ruleName: string
  /** 规则类型：见字典 cr_rule_type */
  ruleType: number
  /** 错误级别：见字典 cr_error_level（1 警告 / 2 错误） */
  errorLevel: number
  /** 适用报表 id 列表 */
  reportIds: number[]
  /** 适用报表名称（冗余，便于列表展示） */
  reportNames: string[]
  /** 左表达式（校验字段 / 统计项） */
  leftExpression: string
  /** 比较符：= != > >= < <=（非空、枚举校验可为空） */
  operator: string
  /** 右表达式（阈值 / 字段 / 码值表） */
  rightExpression: string
  /** 错误提示语 */
  errorMessage: string
  status: number
  remark: string
  createTime: string
}

interface RuleSpec {
  ruleName: string
  ruleType: number
  errorLevel: number
  reportIds: number[]
  leftExpression: string
  operator: string
  rightExpression: string
  errorMessage: string
  /** 0 启用 / 1 停用，缺省 0 */
  status?: number
  remark?: string
}

const ruleSpecs: RuleSpec[] = [
  // ---- 非空校验 ----
  {
    ruleName: '保单号不能为空',
    ruleType: RULE_TYPE.NOT_NULL,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [1, 2, 3, 4],
    leftExpression: '保单号(policy_no)',
    operator: '',
    rightExpression: '',
    errorMessage: '保单号不可为空，请核对人身险保单基本信息表数据'
  },
  {
    ruleName: '投保人名称不能为空',
    ruleType: RULE_TYPE.NOT_NULL,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [5, 6],
    leftExpression: '投保人名称(holder_name)',
    operator: '',
    rightExpression: '',
    errorMessage: '投保人名称不可为空，请补录后再报送'
  },
  {
    ruleName: '赔案号不能为空',
    ruleType: RULE_TYPE.NOT_NULL,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [13, 14],
    leftExpression: '赔案号(claim_no)',
    operator: '',
    rightExpression: '',
    errorMessage: '赔案号不可为空，赔案信息表存在缺失主键'
  },
  {
    ruleName: '从业人员编号不能为空',
    ruleType: RULE_TYPE.NOT_NULL,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [18],
    leftExpression: '从业人员编号(employee_no)',
    operator: '',
    rightExpression: '',
    errorMessage: '从业人员编号为空，将影响人员归属统计'
  },
  {
    ruleName: '被保险人编号不能为空',
    ruleType: RULE_TYPE.NOT_NULL,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [7, 8],
    leftExpression: '被保险人编号(insured_no)',
    operator: '',
    rightExpression: '',
    errorMessage: '被保险人编号不可为空，无法与被保人信息表关联'
  },

  // ---- 长度校验 ----
  {
    ruleName: '证件号码长度必须为 18 位',
    ruleType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [5, 7, 18],
    leftExpression: '证件号码(cert_no)',
    operator: '=',
    rightExpression: '18',
    errorMessage: '证件号码长度不等于 18 位，不符合监管数据元要求'
  },
  {
    ruleName: '保单号长度不得超过 32 位',
    ruleType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [1, 2, 3, 4],
    leftExpression: '保单号(policy_no)',
    operator: '<=',
    rightExpression: '32',
    errorMessage: '保单号长度超过 32 位，可能被监管接口截断'
  },
  {
    ruleName: '手机号码长度必须为 11 位',
    ruleType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [6, 18],
    leftExpression: '手机号码(mobile)',
    operator: '=',
    rightExpression: '11',
    errorMessage: '手机号码长度不等于 11 位，请联系方式补录不完整'
  },
  {
    ruleName: '职业编码长度必须为 6 位',
    ruleType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [8],
    leftExpression: '职业编码(occupation_code)',
    operator: '=',
    rightExpression: '6',
    errorMessage: '职业编码长度不等于 6 位，请对照职业分类码表补录'
  },
  {
    ruleName: '赔案号长度不得超过 32 位',
    ruleType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [13, 14],
    leftExpression: '赔案号(claim_no)',
    operator: '<=',
    rightExpression: '32',
    errorMessage: '赔案号长度超过 32 位，不符合赔案编号规则'
  },

  // ---- 值域校验 ----
  {
    ruleName: '保险金额必须大于 0',
    ruleType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [1, 13],
    leftExpression: '保险金额(sum_assured)',
    operator: '>',
    rightExpression: '0',
    errorMessage: '保险金额必须大于 0，存在零保额或负保额保单'
  },
  {
    ruleName: '保费金额必须大于 0',
    ruleType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [11, 12],
    leftExpression: '保费金额(premium_amount)',
    operator: '>',
    rightExpression: '0',
    errorMessage: '保费金额必须大于 0，存在冲正未配对数据'
  },
  {
    ruleName: '保单生效日期不得早于 2020-01-01',
    ruleType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [1, 3, 4],
    leftExpression: '保单生效日期(policy_effect_date)',
    operator: '>=',
    rightExpression: '2020-01-01',
    errorMessage: '保单生效日期早于 2020-01-01，超出本期报送范围'
  },
  {
    ruleName: '赔付金额不得为负值',
    ruleType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [13, 14],
    leftExpression: '赔付金额(claim_amount)',
    operator: '>=',
    rightExpression: '0',
    errorMessage: '赔付金额为负值，存在退票或红冲数据未处理'
  },

  // ---- 逻辑校验（同表字段间比较）----
  {
    ruleName: '保单满期日期必须晚于生效日期',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [1, 3, 4],
    leftExpression: '保单满期日期(policy_maturity_date)',
    operator: '>',
    rightExpression: '保单生效日期(policy_effect_date)',
    errorMessage: '保单满期日期必须晚于生效日期，请检查保单期间录入'
  },
  {
    ruleName: '赔付金额不得大于保险金额',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [13, 14],
    leftExpression: '赔付金额(claim_amount)',
    operator: '<=',
    rightExpression: '保险金额(sum_assured)',
    errorMessage: '赔付金额大于保险金额，超出保单责任限额'
  },
  {
    ruleName: '出险日期不得早于保单生效日期',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [13, 14],
    leftExpression: '出险日期(accident_date)',
    operator: '>=',
    rightExpression: '保单生效日期(policy_effect_date)',
    errorMessage: '出险日期早于保单生效日期，赔案时间逻辑不成立'
  },
  {
    ruleName: '退保金额不得大于已交保费',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [4],
    leftExpression: '退保金额(surrender_amount)',
    operator: '<=',
    rightExpression: '已交保费合计(paid_premium)',
    errorMessage: '退保金额大于已交保费合计，请复核退保金计算',
    status: 1,
    remark: '业务口径调整中，暂不启用'
  },
  {
    ruleName: '投保人出生日期必须早于保单生效日期',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [5],
    leftExpression: '出生日期(birth_date)',
    operator: '<',
    rightExpression: '保单生效日期(policy_effect_date)',
    errorMessage: '投保人出生日期晚于保单生效日期，客户信息存在错位'
  },
  {
    ruleName: '手机号码格式必须符合监管要求',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [6, 18],
    leftExpression: '手机号码(mobile)',
    operator: '=',
    rightExpression: 'regex(^1[3-9]\\d{9}$)',
    errorMessage: '手机号码不符合监管格式要求，请检查是否含非数字字符'
  },
  {
    ruleName: '被保险人年龄必须与出生日期一致',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [7, 8],
    leftExpression: '被保险人年龄(age)',
    operator: '=',
    rightExpression: '期次年份 - 出生日期年份',
    errorMessage: '被保险人年龄与出生日期推算结果不一致'
  },
  {
    ruleName: '受益比例合计必须等于 100%',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [9],
    leftExpression: 'sum(受益比例(benefit_ratio))',
    operator: '=',
    rightExpression: '100',
    errorMessage: '同一保单受益比例合计不等于 100%，受益人信息不完整'
  },
  {
    ruleName: '保费收入合计必须大于等于期缴保费',
    ruleType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [11],
    leftExpression: '保费收入合计',
    operator: '>=',
    rightExpression: '期缴保费合计(installment_premium)',
    errorMessage: '保费收入合计小于期缴保费合计，请检查保费拆分口径'
  },

  // ---- 表间校验（跨表勾稽）----
  {
    ruleName: '保费收入合计必须等于保费信息表金额汇总',
    ruleType: RULE_TYPE.INTER_TABLE,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [11, 12],
    leftExpression: '保费收入统计表.保费收入合计',
    operator: '=',
    rightExpression: 'sum(保费信息表.premium_amount)',
    errorMessage: '保费收入合计与保费信息表金额汇总不一致，存在跨表勾稽差异'
  },
  {
    ruleName: '赔付支出合计必须等于赔付信息表金额汇总',
    ruleType: RULE_TYPE.INTER_TABLE,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [14],
    leftExpression: '赔付支出统计表.赔付支出合计',
    operator: '=',
    rightExpression: 'sum(赔付信息表.claim_amount)',
    errorMessage: '赔付支出合计与赔付信息表金额汇总不一致，请核对赔案台账'
  },
  {
    ruleName: '保单状态记录数必须与保单状态变更表一致',
    ruleType: RULE_TYPE.INTER_TABLE,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [2],
    leftExpression: '保单状态统计表.保单件数',
    operator: '=',
    rightExpression: 'count(保单状态变更表.policy_no)',
    errorMessage: '保单状态统计件数与状态变更表记录数不一致，存在状态未同步数据',
    status: 1,
    remark: '状态变更表尚未接入，暂不启用'
  },

  // ---- 枚举校验（监管码值表）----
  {
    ruleName: '证件类型必须为监管码值表允许值',
    ruleType: RULE_TYPE.ENUM,
    errorLevel: ERROR_LEVEL.ERROR,
    reportIds: [5, 7, 18],
    leftExpression: '证件类型(cert_type)',
    operator: '',
    rightExpression: '监管码值表 DM_CERT_TYPE',
    errorMessage: '证件类型不在监管码值表允许范围内，请按码值表转换'
  },
  {
    ruleName: '保单状态必须为监管码值表允许值',
    ruleType: RULE_TYPE.ENUM,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [1, 2],
    leftExpression: '保单状态(policy_status)',
    operator: '',
    rightExpression: '监管码值表 DM_POLICY_STATUS',
    errorMessage: '保单状态取值不在监管码值表范围内，存在自定义状态码'
  },
  {
    ruleName: '保费类型必须为监管码值表允许值',
    ruleType: RULE_TYPE.ENUM,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [11, 12],
    leftExpression: '保费类型(premium_type)',
    operator: '',
    rightExpression: '监管码值表 DM_PREMIUM_TYPE',
    errorMessage: '保费类型取值不在监管码值表范围内，请核对新单/续期标识'
  },
  {
    ruleName: '受益顺序必须为监管码值表允许值',
    ruleType: RULE_TYPE.ENUM,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [9],
    leftExpression: '受益顺序(benefit_order)',
    operator: '',
    rightExpression: '监管码值表 DM_BENEFIT_ORDER',
    errorMessage: '受益顺序取值不在监管码值表范围内'
  },
  {
    ruleName: '赔案状态必须为监管码值表允许值',
    ruleType: RULE_TYPE.ENUM,
    errorLevel: ERROR_LEVEL.WARN,
    reportIds: [13, 14],
    leftExpression: '赔案状态(claim_status)',
    operator: '',
    rightExpression: '监管码值表 DM_CLAIM_STATUS',
    errorMessage: '赔案状态取值不在监管码值表范围内，请核对理赔流程状态'
  }
]

/** 规则编码按种子顺序生成：JC2026001 起编 */
export const crCheckRuleTable = defineTable<CheckRuleRow>('cr.checkRule', () => {
  const reports = reportOptions()
  return ruleSpecs.map((spec, index) => ({
    id: index + 1,
    ruleCode: `JC2026${String(index + 1).padStart(3, '0')}`,
    ruleName: spec.ruleName,
    ruleType: spec.ruleType,
    errorLevel: spec.errorLevel,
    reportIds: spec.reportIds,
    reportNames: spec.reportIds.map(
      (reportId) => reports.find((report) => report.id === reportId)?.reportName || ''
    ),
    leftExpression: spec.leftExpression,
    operator: spec.operator,
    rightExpression: spec.rightExpression,
    errorMessage: spec.errorMessage,
    status: spec.status ?? 0,
    remark: spec.remark || '',
    createTime: `2026-09-0${(index % 8) + 1} ${String(9 + (index % 8)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00`
  }))
})

/* ==================================================================
 * 校验状态（机构 × 报表 × 期次）
 * ================================================================== */
export interface CheckStatusRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 校验状态：见字典 cr_check_status（0 未校验 / 1 校验中 / 2 校验通过 / 3 校验不通过） */
  checkStatus: number
  /** 校验时间 */
  checkTime: string
  /** 耗时（秒） */
  costTime: number
  passCount: number
  warnCount: number
  errorCount: number
  taskNo: string
  remark: string
}

/** 参与种子数据的报表（与任务模板的下发口径保持一致） */
const SEED_REPORT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13]

/** 每个报表位次上的状态分布：2 通过 / 3 不通过 / 0 待校验 / 1 校验中 */
const STATUS_PATTERN = [2, 2, 3, 0, 1, 2, 3, 2, 0, 3, 2, 1]

/** 不通过时的错误 / 警告条数（按期次位次轮转，保证分布有差异） */
const ERROR_CYCLE = [3, 3, 2, 3]
const WARN_CYCLE = [3, 4, 5, 3]

/** 某机构某报表在某期次下的校验条数（确定性计算，便于演示讲数） */
export const comboCounts = (orgIndex: number, reportIndex: number, checkStatus: number) => {
  const seed = (reportIndex + orgIndex) % 4
  const passCount = 180 + ((reportIndex * 37 + orgIndex * 53) % 620)
  if (checkStatus === 3) {
    return { passCount, errorCount: ERROR_CYCLE[seed], warnCount: WARN_CYCLE[seed] }
  }
  return { passCount: checkStatus === 2 ? passCount : 0, errorCount: 0, warnCount: 0 }
}

export const crCheckStatusTable = defineTable<CheckStatusRow>('cr.checkStatus', () => {
  const orgs = reportOrgs().filter((org) => BRANCH_NAMES.includes(org.orgName))
  const reports = reportOptions().filter((report) => SEED_REPORT_IDS.includes(report.id))
  const rows: CheckStatusRow[] = []
  let id = 0
  orgs.forEach((org, orgIndex) => {
    reports.forEach((report, reportIndex) => {
      const reportSeedIndex = SEED_REPORT_IDS.indexOf(report.id)
      const checkStatus = STATUS_PATTERN[(reportSeedIndex + orgIndex) % STATUS_PATTERN.length]
      const counts = comboCounts(orgIndex, reportSeedIndex, checkStatus)
      const seq = String(++id).padStart(3, '0')
      const minute = String((reportIndex * 5 + orgIndex * 3) % 60).padStart(2, '0')
      const checked = checkStatus === 2 || checkStatus === 3
      rows.push({
        id,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: PERIOD,
        checkStatus,
        checkTime:
          checkStatus === 0
            ? ''
            : `2026-09-12 ${checkStatus === 1 ? '14' : '03'}:${minute}:${String(10 + reportIndex).padStart(2, '0')}`,
        costTime: checked
          ? Number((6 + ((reportIndex * 13 + orgIndex * 7) % 32) + reportIndex / 10).toFixed(1))
          : 0,
        passCount: counts.passCount,
        warnCount: counts.warnCount,
        errorCount: counts.errorCount,
        taskNo: checkStatus === 0 ? '' : `XJ20260912${seq}`,
        remark: checkStatus === 1 ? '校验任务执行中' : ''
      })
    })
  })
  return rows
})

/* ==================================================================
 * 校验结果（仅不通过明细）
 * ================================================================== */
export interface CheckResultRow {
  id: number
  taskNo: string
  period: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  ruleId: number
  ruleCode: string
  ruleName: string
  ruleType: number
  errorLevel: number
  leftExpression: string
  operator: string
  rightExpression: string
  errorMessage: string
  /** 错误数据定位，如「第 128 行 / 保单号 P2026080012」 */
  location: string
  /** 实际值 */
  actualValue: string
  /** 期望值 */
  expectValue: string
  handled: boolean
  handler: string
  handleTime: string
  /** 处理说明 */
  handleRemark: string
  createTime: string
}

/** 校验执行日志（供数据校验页逐条播放） */
export interface CheckLog {
  /** HH:mm:ss */
  time: string
  text: string
  /** info / success / warning / error */
  level: string
}

/** 各报表用于定位错误数据的业务主键 */
const LOCATORS: Record<number, { label: string; prefix: string }> = {
  1: { label: '保单号', prefix: 'P202608' },
  2: { label: '保单号', prefix: 'P202608' },
  3: { label: '保单号', prefix: 'P202608' },
  4: { label: '保单号', prefix: 'P202608' },
  5: { label: '投保人编号', prefix: 'TB202608' },
  6: { label: '投保人编号', prefix: 'TB202608' },
  7: { label: '被保险人编号', prefix: 'BB202608' },
  8: { label: '被保险人编号', prefix: 'BB202608' },
  9: { label: '受益人编号', prefix: 'SY202608' },
  11: { label: '保费流水号', prefix: 'BF202608' },
  12: { label: '缴费流水号', prefix: 'JF202608' },
  13: { label: '赔案号', prefix: 'PA202608' },
  14: { label: '赔案号', prefix: 'PA202608' },
  17: { label: '中介机构编码', prefix: 'ZJ202608' },
  18: { label: '从业人员编号', prefix: 'YG202608' }
}

/** 按规则类型给出「实际值 / 期望值」，供详情抽屉展示 */
const actualExpect = (rule: CheckRuleRow, index: number) => {
  switch (rule.ruleType) {
    case RULE_TYPE.NOT_NULL:
      return { actualValue: '(空值)', expectValue: '不可为空' }
    case RULE_TYPE.LENGTH: {
      const length = Number(rule.rightExpression) || 18
      // 上限类规则要给出"超限"的实际值，等值类规则给出"不足"的实际值
      const overflow = rule.operator === '<=' || rule.operator === '<'
      const actual = overflow ? length + 1 + (index % 3) : Math.max(1, length - 1 - (index % 3))
      return {
        actualValue: `${actual} 位`,
        expectValue: `长度 ${rule.operator} ${length} 位`
      }
    }
    case RULE_TYPE.RANGE: {
      const actual = /^\d{4}-/.test(rule.rightExpression) ? '2019-11-06' : `-${(index % 3) + 1}.00`
      return { actualValue: actual, expectValue: `需满足 ${rule.operator} ${rule.rightExpression}` }
    }
    case RULE_TYPE.LOGIC: {
      // 日期类字段给日期型实际值，金额 / 比例类给数值型
      const isDate = /日期/.test(rule.leftExpression)
      const actual = isDate ? '2024-03-15' : index % 2 === 0 ? '1,250,000.00' : '0.00'
      return {
        actualValue: actual,
        expectValue: `需满足 ${rule.leftExpression} ${rule.operator} ${rule.rightExpression}`
      }
    }
    case RULE_TYPE.INTER_TABLE:
      return {
        actualValue: '1,286,400.00',
        expectValue: '1,301,950.00（按勾稽关系计算的应报值）'
      }
    case RULE_TYPE.ENUM:
      return {
        actualValue: index % 2 === 0 ? '99' : 'XX',
        expectValue: `${rule.rightExpression} 允许值范围内`
      }
    default:
      return { actualValue: '', expectValue: '' }
  }
}

export interface CheckResultDraft {
  taskNo: string
  period: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  checkTime: string
  warnCount: number
  errorCount: number
  /** 起始 id */
  startId: number
  /** 前 N 条标记为已处理 */
  handledCount?: number
}

/**
 * 生成某「机构 × 报表 × 期次」的不通过明细。
 * 错误明细取「错误」级规则、警告明细取「警告」级规则，保证级别与规则口径一致。
 */
export const buildCheckResults = (draft: CheckResultDraft): CheckResultRow[] => {
  const rules = crCheckRuleTable
    .all()
    .filter((rule) => rule.status === 0 && rule.reportIds.includes(draft.reportId))
  if (!rules.length) return []
  const errorRules = rules.filter((rule) => rule.errorLevel === ERROR_LEVEL.ERROR)
  const warnRules = rules.filter((rule) => rule.errorLevel === ERROR_LEVEL.WARN)
  const locator = LOCATORS[draft.reportId] || { label: '业务主键', prefix: 'YW202608' }
  const handlers = [...REVIEW_USERS, ...AUDIT_USERS]
  const rows: CheckResultRow[] = []
  const total = draft.errorCount + draft.warnCount
  for (let index = 0; index < total; index++) {
    const isError = index < draft.errorCount
    const pool = isError
      ? errorRules.length
        ? errorRules
        : rules
      : warnRules.length
        ? warnRules
        : rules
    const rule = pool[index % pool.length]
    const { actualValue, expectValue } = actualExpect(rule, index)
    const rowNo = 100 + ((draft.reportId * 13 + draft.orgId * 7 + index * 17) % 800)
    const seq = String(1000 + ((index * 37 + draft.reportId * 11) % 8999))
    const handled = index < (draft.handledCount || 0)
    rows.push({
      id: draft.startId + index,
      taskNo: draft.taskNo,
      period: draft.period,
      orgId: draft.orgId,
      orgName: draft.orgName,
      reportId: draft.reportId,
      reportCode: draft.reportCode,
      reportName: draft.reportName,
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      errorLevel: isError ? ERROR_LEVEL.ERROR : ERROR_LEVEL.WARN,
      leftExpression: rule.leftExpression,
      operator: rule.operator,
      rightExpression: rule.rightExpression,
      errorMessage: rule.errorMessage,
      location: `第 ${rowNo} 行 / ${locator.label} ${locator.prefix}${seq}`,
      actualValue,
      expectValue,
      handled,
      handler: handled ? handlers[index % handlers.length].name : '',
      handleTime: handled ? draft.checkTime.replace(/ \d\d:/, ' 17:') : '',
      handleRemark: handled
        ? isError
          ? '已修正报送数据并重新抽取'
          : '已确认，属业务合理差异'
        : '',
      createTime: draft.checkTime
    })
  }
  return rows
}

/** 种子结果：由「校验不通过」的状态行逐条展开，保证状态与明细互相印证 */
export const crCheckResultTable = defineTable<CheckResultRow>('cr.checkResult', () => {
  const statuses = crCheckStatusTable
    .all()
    .filter((row) => row.period === PERIOD && row.checkStatus === 3)
  const rows: CheckResultRow[] = []
  statuses.forEach((status, comboIndex) => {
    rows.push(
      ...buildCheckResults({
        taskNo: status.taskNo,
        period: status.period,
        orgId: status.orgId,
        orgName: status.orgName,
        reportId: status.reportId,
        reportCode: status.reportCode,
        reportName: status.reportName,
        checkTime: status.checkTime,
        warnCount: status.warnCount,
        errorCount: status.errorCount,
        startId: rows.length + 1,
        handledCount: comboIndex % 2 === 0 ? 2 : 0
      })
    )
  })
  return rows
})
