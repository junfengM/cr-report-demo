/**
 * Mock 种子数据 — 数据审核域
 *
 * 五张表（注意：defineTable 在模块加载时就会执行种子函数，因此被依赖的表必须定义在前）：
 * - cr.auditApprove       按「机构 × 报表 × 期次」的待审核批次（数据行数 / 警告数 / 错误数 / 报送状态）
 * - cr.auditApproveDetail 审核批次的数据明细（**脱敏后**的值，审核人看到的就是这一份）
 * - cr.auditReason        错误原因填报任务（审核人标记为存疑 / 不通过的数据项，由填报人补充原因）
 * - cr.auditResult        历史审核结论（多轮审核留痕，关联问题清单）
 * - cr.desensitize        脱敏前后对照（MASK 掩码 / HASH 哈希 / REPLACE 替换 / TRUNCATE 截断）
 *
 * 口径说明：
 * - 机构取 crCommon 的 4 家分公司，期次统一 PERIOD(202608)，报表从 reportOptions() 取；
 * - 敏感字段（证件号 / 手机号 / 姓名 / 地址 / 邮箱）的脱敏结果由本文件里的
 *   maskKeep / maskEmail / truncate / hashValue 真实计算得出，原文与结果一一对应；
 * - 保单号形如 P2026080012，投保人编号形如 H2026080012，便于跨页面定位同一批数据。
 */
import { defineTable } from '../store'
import {
  AUDIT_USERS,
  BRANCH_NAMES,
  ERROR_LEVEL,
  FILL_USERS,
  PERIOD,
  RULE_TYPE,
  reportOptions,
  reportOrgs
} from './crCommon'

/* ==================================================================
 * 通用工具 / 口径
 * ================================================================== */

/** 固定时间戳（种子数据必须确定性，不能用当前时间） */
const TS = (day: number, hour = 9, minute = 30, second = 0): string =>
  `2026-09-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`

/** 错误原因填报的处理状态 */
export const AUDIT_REASON_STATUS = { PENDING: 0, FILLED: 1, CONFIRMED: 2 } as const

/** 审核结论，见字典 cr_audit_status */
export const AUDIT_STATUS = { PENDING: 0, PASS: 1, REJECT: 2 } as const

/** 报送状态，见字典 cr_fill_status */
export const SUBMIT_STATUS = { UNSENT: 0, SENDING: 1, SUBMITTED: 2 } as const

/** 脱敏规则码值，见字典 cr_desensitize_type（执行页也用这套码值，算法从本文件导出复用） */
export type DesensitizeRuleType = 'MASK' | 'HASH' | 'REPLACE' | 'TRUNCATE'

/** 字典中文名（导出用，避免导出文件里只有码值） */
export const AUDIT_REASON_STATUS_LABEL: Record<number, string> = {
  0: '待填报',
  1: '已填报',
  2: '已确认'
}
export const AUDIT_STATUS_LABEL: Record<number, string> = {
  0: '待审核',
  1: '审核通过',
  2: '审核不通过'
}
export const SUBMIT_STATUS_LABEL: Record<number, string> = {
  0: '未填报',
  1: '填报中',
  2: '已提交'
}
export const DESENSITIZE_LABEL: Record<string, string> = {
  MASK: '掩码',
  HASH: '哈希',
  REPLACE: '替换',
  TRUNCATE: '截断'
}

/** 4 家分公司（按 BRANCH_NAMES 顺序） */
const branches = (): Array<{ id: number; orgName: string; orgCode: string }> =>
  BRANCH_NAMES.map((name) => {
    const org = reportOrgs().find((item) => item.orgName === name)
    return org ? { id: org.id, orgName: org.orgName, orgCode: org.orgCode } : undefined
  }).filter((org): org is { id: number; orgName: string; orgCode: string } => !!org)

type ReportOption = ReturnType<typeof reportOptions>[number]

/** 按报表名取报表（报表清单来自 crCommon.reportOptions） */
const reportOf = (name: string): ReportOption | undefined =>
  reportOptions().find((report) => report.reportName === name)

/** 保单号 / 投保人编号：P2026080012 / H2026080012 */
export const policyNoOf = (seq: number): string => `P${PERIOD}${String(seq).padStart(4, '0')}`
export const holderNoOf = (seq: number): string => `H${PERIOD}${String(seq).padStart(4, '0')}`

/* ==================================================================
 * 脱敏算法（演示口径，结果与原文严格对应）
 * ================================================================== */

/** 掩码：保留前 p 位、后 s 位，中间用 * 覆盖（至少盖住 1 位） */
export const maskKeep = (value: string, p: number, s: number): string => {
  const len = value.length
  if (!len) return ''
  if (len <= p) return '*'.repeat(len)
  const masked = Math.max(1, len - p - s)
  const tail = Math.max(0, Math.min(s, len - p - masked))
  return value.slice(0, p) + '*'.repeat(masked) + (tail ? value.slice(len - tail) : '')
}

/** 掩码（邮箱专属）：只盖住 @ 前的本地部分，保留域名 */
export const maskEmail = (value: string): string => {
  const at = value.indexOf('@')
  if (at <= 0) return maskKeep(value, 1, 0)
  return maskKeep(value.slice(0, at), 1, 0) + value.slice(at)
}

/** 截断：只保留前 keep 位，其余用 … 代替 */
export const truncate = (value: string, keep: number): string =>
  value.length <= keep ? value : `${value.slice(0, keep)}…`

/** 哈希：输出与 SHA-256 等长的 64 位十六进制（Demo 无后端，不引入加密依赖） */
export const hashValue = (value: string, salt = 'HX2026'): string => {
  const input = `${salt}:${value}`
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  let out = ''
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i) + round * 131
      h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0
      h2 = (Math.imul(h2, 0x85ebca6b) ^ code) >>> 0
    }
    out += (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
  }
  return out.slice(0, 64)
}

/* ==================================================================
 * 敏感信息样本（同一条数据在不同报表上的多个字段）
 * ================================================================== */
interface PersonRecord {
  /** 投保人编号：同一条数据在多个字段上的脱敏情况按它归集 */
  dataKey: string
  policyNo: string
  rowNo: number
  holderName: string
  insuredName: string
  employeeName: string
  certNo: string
  mobile: string
  email: string
  address: string
}

const SURNAMES = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙']
const GIVEN = ['伟', '娜', '强', '洋', '静', '磊', '敏', '军', '丽', '杰', '涛', '燕']
const AREA_CODES = ['110101', '310104', '320105', '440103']
const ADDRESSES = [
  '北京市朝阳区建国路 88 号',
  '上海市浦东新区世纪大道 100 号',
  '南京市鼓楼区中山北路 12 号',
  '广州市天河区天河路 256 号'
]
const EMAIL_LOCALS = ['zhangwei', 'lina', 'wangqiang', 'liuyang', 'chenjing', 'yangming']

const nameOf = (index: number): string =>
  `${SURNAMES[index % SURNAMES.length]}${GIVEN[index % GIVEN.length]}${
    index % 3 === 0 ? GIVEN[(index + 5) % GIVEN.length] : ''
  }`

const certNoOf = (index: number): string => {
  if (index === 0) return '110101199001011234'
  const area = AREA_CODES[index % AREA_CODES.length]
  const year = 1972 + (index % 28)
  const month = String((index % 12) + 1).padStart(2, '0')
  const day = String((index % 27) + 1).padStart(2, '0')
  const seq = String(1000 + ((index * 37) % 8999)).padStart(4, '0')
  return `${area}${year}${month}${day}${seq}`
}

const mobileOf = (index: number): string => {
  if (index === 0) return '13800001111'
  const prefix = ['138', '139', '137', '136'][index % 4]
  return `${prefix}${String(10000000 + ((index * 137) % 89999999)).padStart(8, '0')}`
}

const buildPerson = (index: number, seq: number): PersonRecord => ({
  dataKey: holderNoOf(seq),
  policyNo: policyNoOf(seq),
  rowNo: 12 + ((index * 37) % 480),
  holderName: index === 0 ? '张三' : nameOf(index),
  insuredName: nameOf(index + 4),
  employeeName: nameOf(index + 7),
  certNo: certNoOf(index),
  mobile: mobileOf(index),
  email: `${EMAIL_LOCALS[index % EMAIL_LOCALS.length]}${index === 0 ? '' : index}@huaxin-life.com`,
  address: ADDRESSES[index % ADDRESSES.length]
})

/** 脱敏对照的业务数据条数：20 条 × 5 个字段 = 100 条记录 */
const PERSON_COUNT = 20

/* ==================================================================
 * 一、待审核批次（机构 × 报表 × 期次）
 * ================================================================== */
export interface CrAuditApproveRow {
  id: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 数据行数 */
  rowCount: number
  /** 校验通过 / 警告 / 错误行数 */
  passCount: number
  warnCount: number
  errorCount: number
  /** 报送状态，见字典 cr_fill_status */
  submitStatus: number
  submitTime: string
  submitUser: string
  /** 审核结论，见字典 cr_audit_status */
  auditStatus: number
  auditor: string
  auditTime: string
  auditOpinion: string
  remark: string
  createTime: string
}

/** 待审核批次用的报表（含个人敏感信息，便于演示脱敏） */
const APPROVE_REPORTS = [
  '投保人基本信息表',
  '投保人联系方式表',
  '被保险人基本信息表',
  '人身险保单状态统计表',
  '保费收入统计表',
  '赔案信息表',
  '从业人员信息表'
]

const buildApproveRows = (): CrAuditApproveRow[] => {
  const orgs = branches()
  const reports = APPROVE_REPORTS.map((name) => reportOf(name)).filter(
    (report): report is ReportOption => !!report
  )
  const rows: CrAuditApproveRow[] = []
  let id = 1
  orgs.forEach((org) => {
    reports.forEach((report) => {
      const index = id - 1
      const errorCount = 1 + (index % 3)
      const warnCount = 1 + ((index + 1) % 3)
      const rowCount = 800 + ((index * 137) % 2400)
      // 部分批次已完成审核，便于演示"审核结果"与批次状态的联动（其余留在待审核队列里）
      const auditStatus =
        index % 3 === 0
          ? AUDIT_STATUS.PASS
          : index % 6 === 2
            ? AUDIT_STATUS.REJECT
            : AUDIT_STATUS.PENDING
      const auditor = AUDIT_USERS[index % AUDIT_USERS.length].name
      const audited = auditStatus !== AUDIT_STATUS.PENDING
      rows.push({
        id,
        batchNo: `SH${PERIOD}${String(id).padStart(4, '0')}`,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: PERIOD,
        rowCount,
        passCount: rowCount - warnCount - errorCount,
        warnCount,
        errorCount,
        submitStatus: index % 9 === 5 ? SUBMIT_STATUS.SENDING : SUBMIT_STATUS.SUBMITTED,
        submitTime: TS(4 + (index % 6), 9 + (index % 8), 15 + (index % 40), 30),
        submitUser: FILL_USERS.find((user) => user.orgName === org.orgName)?.name || '李思远',
        auditStatus,
        auditor: audited ? auditor : '',
        auditTime: audited ? TS(8 + (index % 6), 10 + (index % 6), 20 + (index % 30), 18) : '',
        auditOpinion: audited
          ? auditStatus === AUDIT_STATUS.PASS
            ? '数据完整，校验问题已核实并说明，同意通过并进入上报环节。'
            : '存在错误级校验问题未整改到位，退回填报机构重新核实后报送。'
          : '',
        remark: '',
        createTime: TS(4 + (index % 6), 9, 15 + (index % 40), 12)
      })
      id++
    })
  })
  return rows
}

export const crAuditApproveTable = defineTable<CrAuditApproveRow>(
  'cr.auditApprove',
  buildApproveRows
)

/* ==================================================================
 * 二、审核明细（脱敏后的值 + 问题行标记）
 * ================================================================== */
export interface CrAuditApproveDetailRow {
  id: number
  batchId: number
  rowNo: number
  /** 保单号（非敏感字段，原样展示） */
  policyNo: string
  /** 投保人名称（脱敏后） */
  holderName: string
  /** 证件号码（脱敏后） */
  certNo: string
  /** 手机号码（脱敏后） */
  mobile: string
  /** 保险金额（元） */
  sumAssured: number
  /** 保费金额（元） */
  premium: number
  /** 生效日期 */
  effectDate: string
  /** 校验问题级别：0 无问题 / 1 警告 / 2 错误 */
  issueLevel: number
  issueMessage: string
}

interface DetailIssueSpec {
  field: 'mobile' | 'certNo' | 'holderName' | 'sumAssured' | 'premium' | 'effectDate'
  level: number
  message: string
}

const DETAIL_ISSUES: DetailIssueSpec[] = [
  {
    field: 'certNo',
    level: ERROR_LEVEL.ERROR,
    message: '证件号码校验位不正确，与公安一致性校验结果不符'
  },
  {
    field: 'mobile',
    level: ERROR_LEVEL.ERROR,
    message: '手机号码不足 11 位，与投保人联系方式表登记号码不一致'
  },
  {
    field: 'holderName',
    level: ERROR_LEVEL.WARN,
    message: '投保人名称疑似截断，与核心业务系统客户姓名不一致'
  },
  {
    field: 'sumAssured',
    level: ERROR_LEVEL.ERROR,
    message: '保险金额为 0，与同保单保费收入勾稽不符'
  },
  {
    field: 'premium',
    level: ERROR_LEVEL.ERROR,
    message: '保费金额为负数，监管报表不接受负值'
  },
  {
    field: 'effectDate',
    level: ERROR_LEVEL.ERROR,
    message: '保单生效日期不是合法日期'
  },
  {
    field: 'effectDate',
    level: ERROR_LEVEL.WARN,
    message: '出险日期早于保单生效日期，请核对'
  },
  {
    field: 'mobile',
    level: ERROR_LEVEL.WARN,
    message: '该手机号被多名客户重复使用，请核实'
  }
]

/** 按批次归纳明细问题：问题行数与该批次的错误 / 警告数严格一致 */
const issuesOfBatch = (index: number, warnCount: number, errorCount: number) => {
  const picks: DetailIssueSpec[] = []
  const errors = DETAIL_ISSUES.filter((item) => item.level === ERROR_LEVEL.ERROR)
  const warns = DETAIL_ISSUES.filter((item) => item.level === ERROR_LEVEL.WARN)
  for (let i = 0; i < errorCount; i++) picks.push(errors[(index + i) % errors.length])
  for (let i = 0; i < warnCount; i++) picks.push(warns[(index + i) % warns.length])
  return picks
}

const buildApproveDetailRows = (): CrAuditApproveDetailRow[] => {
  const rows: CrAuditApproveDetailRow[] = []
  let id = 1
  crAuditApproveTable.all().forEach((batch, batchIndex) => {
    const issues = issuesOfBatch(batchIndex, batch.warnCount, batch.errorCount)
    // 明细 = 全部问题行 + 2 行正常抽样（正常行不重复展示整批数据）
    const detailCount = issues.length + 2
    for (let i = 0; i < detailCount; i++) {
      const seq = 11 + batch.id * 7 + i
      const person = buildPerson(batch.id * 5 + i, seq)
      const issue = i < issues.length ? issues[i] : undefined
      rows.push({
        id: id++,
        batchId: batch.id,
        rowNo: 40 + i * 17 + (batch.id % 9),
        policyNo: person.policyNo,
        // 审核人看到的是脱敏后的值
        holderName: maskKeep(person.holderName, 1, 1),
        certNo: maskKeep(person.certNo, 3, 4),
        mobile: maskKeep(person.mobile, 3, 4),
        sumAssured: issue?.field === 'sumAssured' ? 0 : 100000 + ((seq * 3700) % 900000),
        premium: issue?.field === 'premium' ? -1200 : 1200 + ((seq * 137) % 58000),
        effectDate:
          issue?.field === 'effectDate'
            ? issue.level === ERROR_LEVEL.ERROR
              ? '2026-02-30'
              : '2026-01-05'
            : `2026-0${(i % 8) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
        issueLevel: issue?.level ?? 0,
        issueMessage: issue?.message ?? ''
      })
    }
  })
  return rows
}

export const crAuditApproveDetailTable = defineTable<CrAuditApproveDetailRow>(
  'cr.auditApproveDetail',
  buildApproveDetailRows
)

/* ==================================================================
 * 三、错误原因填报
 * ================================================================== */
export interface CrAuditReasonRow {
  id: number
  /** 关联审核批次 */
  batchId: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  rowNo: number
  policyNo: string
  /** 数据定位，如「第 128 行 / 保单号 P2026080012」 */
  location: string
  columnCode: string
  columnName: string
  /** 原值（填报人自己报上去的值） */
  originalValue: string
  /** 问题类型，见字典 cr_rule_type */
  issueType: number
  /** 错误级别，见字典 cr_error_level */
  errorLevel: number
  /** 审核意见 */
  auditOpinion: string
  auditUser: string
  auditTime: string
  /** 要求回复期限 */
  deadline: string
  /** 处理状态：0 待填报 / 1 已填报 / 2 已确认 */
  status: number
  /** 错误原因说明（填报人填写，至少 10 个字） */
  reason: string
  fillUser: string
  fillTime: string
  confirmUser: string
  confirmTime: string
  createTime: string
}

interface ReasonSpec {
  reportName: string
  columnCode: string
  columnName: string
  /** 原值（与审核意见对应） */
  value: string
  issueType: number
  errorLevel: number
  auditOpinion: string
}

const REASON_SPECS: ReasonSpec[] = [
  {
    reportName: '投保人基本信息表',
    columnCode: 'DE105',
    columnName: '证件号码',
    value: '110101199001011233',
    issueType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '证件号码校验位不正确，与公安一致性校验结果不符，请核实后重新报送。'
  },
  {
    reportName: '投保人联系方式表',
    columnCode: 'DE122',
    columnName: '手机号码',
    value: '1380000111',
    issueType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '手机号码不足 11 位，与投保人联系方式表登记号码不一致。'
  },
  {
    reportName: '投保人基本信息表',
    columnCode: 'DE102',
    columnName: '投保人名称',
    value: '张',
    issueType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.WARN,
    auditOpinion: '投保人名称疑似截断，与核心业务系统客户姓名不一致，请确认。'
  },
  {
    reportName: '投保人联系方式表',
    columnCode: 'DE124',
    columnName: '联系地址',
    value: '北京市朝阳区',
    issueType: RULE_TYPE.LENGTH,
    errorLevel: ERROR_LEVEL.WARN,
    auditOpinion: '联系地址仅到区县，缺少详细门牌信息，监管要求完整地址。'
  },
  {
    reportName: '人身险保单状态统计表',
    columnCode: 'DE008',
    columnName: '保险金额',
    value: '0.00',
    issueType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '保险金额为 0，与同保单保费收入勾稽不符，请说明原因。'
  },
  {
    reportName: '保费收入统计表',
    columnCode: 'DE203',
    columnName: '保费金额',
    value: '-1200.00',
    issueType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '保费金额为负数，监管报表不接受负值（退保应计入退保业务统计表）。'
  },
  {
    reportName: '人身险保单状态统计表',
    columnCode: 'DE005',
    columnName: '保单生效日期',
    value: '2026-02-30',
    issueType: RULE_TYPE.ENUM,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '生效日期 2026-02-30 不是合法日期，请修正后重新报送。'
  },
  {
    reportName: '被保险人基本信息表',
    columnCode: 'DE143',
    columnName: '证件号码',
    value: '310104198805121234',
    issueType: RULE_TYPE.INTER_TABLE,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '证件号码与投保人基本信息表同一客户记录不一致，存在串号风险。'
  },
  {
    reportName: '被保险人基本信息表',
    columnCode: 'DE142',
    columnName: '被保险人名称',
    value: '李',
    issueType: RULE_TYPE.NOT_NULL,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '被保险人名称疑似缺失（仅 1 个字符），无法与承保清单核对。'
  },
  {
    reportName: '赔案信息表',
    columnCode: 'DE233',
    columnName: '出险日期',
    value: '2026-01-05',
    issueType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    auditOpinion: '出险日期早于保单生效日期，请核对是否为期前出险或填错日期。'
  },
  {
    reportName: '赔案信息表',
    columnCode: 'DE234',
    columnName: '赔付金额',
    value: '1280000.00',
    issueType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.WARN,
    auditOpinion: '赔付金额超过报告期保费收入 30%，波动异常，请补充说明。'
  },
  {
    reportName: '从业人员信息表',
    columnCode: 'DE274',
    columnName: '手机号码',
    value: '13800002222',
    issueType: RULE_TYPE.INTER_TABLE,
    errorLevel: ERROR_LEVEL.WARN,
    auditOpinion: '该手机号被 3 名从业人员重复使用，请核实是否为机构统一联系号码。'
  },
  {
    reportName: '缴费信息表',
    columnCode: 'DE205',
    columnName: '收费日期',
    value: '2026-09-01',
    issueType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '收费日期晚于报送期次截止日，超出本月报表统计区间。'
  },
  {
    reportName: '人身险公司商保年金业务统计表',
    columnCode: 'DE009',
    columnName: '保险期间',
    value: '0',
    issueType: RULE_TYPE.RANGE,
    errorLevel: ERROR_LEVEL.ERROR,
    auditOpinion: '保险期间为 0 年，与险种定义表的最短保障期间不符。'
  },
  {
    reportName: '责任准备金余额表',
    columnCode: 'DE008',
    columnName: '保险金额',
    value: '999999999.99',
    issueType: RULE_TYPE.LOGIC,
    errorLevel: ERROR_LEVEL.WARN,
    auditOpinion: '责任准备金余额较上期增长 168%，请提供精算说明材料。'
  }
]

const buildReasonRows = (): CrAuditReasonRow[] => {
  const orgs = branches()
  const batches = crAuditApproveTable.all()
  const rows: CrAuditReasonRow[] = []
  for (let i = 0; i < 30; i++) {
    const spec = REASON_SPECS[i % REASON_SPECS.length]
    const org = orgs[i % orgs.length]
    const report = reportOf(spec.reportName)
    const seq = 11 + i * 3
    // 前 12 条待填报 / 中间 12 条已填报 / 最后 6 条已确认
    const status =
      i < 12
        ? AUDIT_REASON_STATUS.PENDING
        : i < 24
          ? AUDIT_REASON_STATUS.FILLED
          : AUDIT_REASON_STATUS.CONFIRMED
    const fillUser = FILL_USERS.find((user) => user.orgName === org.orgName)?.name || '李思远'
    const auditUser = AUDIT_USERS[i % AUDIT_USERS.length].name
    const batch = batches.find(
      (item) => item.orgId === org.id && item.reportId === (report?.id ?? 0)
    )
    const rowNo = 46 + ((i * 53) % 420)
    const policyNo = policyNoOf(seq)
    const filled = status !== AUDIT_REASON_STATUS.PENDING
    rows.push({
      id: i + 1,
      batchId: batch?.id ?? 0,
      orgId: org.id,
      orgName: org.orgName,
      reportId: report?.id ?? 0,
      reportCode: report?.reportCode ?? '',
      reportName: report?.reportName ?? spec.reportName,
      period: PERIOD,
      rowNo,
      policyNo,
      location: `第 ${rowNo} 行 / 保单号 ${policyNo}`,
      columnCode: spec.columnCode,
      columnName: spec.columnName,
      originalValue: spec.value,
      issueType: spec.issueType,
      errorLevel: spec.errorLevel,
      auditOpinion: spec.auditOpinion,
      auditUser,
      auditTime: TS(3 + (i % 5), 10, 12 + (i % 40), 8),
      deadline: `2026-09-${String(16 + (i % 6)).padStart(2, '0')}`,
      status,
      reason: filled
        ? `经核对核心业务系统与承保清单，该字段为系统迁移时${
            i % 2 === 0 ? '取值口径不一致' : '批量导入截断'
          }导致，已按原始凭证修正，随下期报表一并重报，特此说明。`
        : '',
      fillUser: filled ? fillUser : '',
      fillTime: filled ? TS(6 + (i % 5), 14, 20 + (i % 30), 26) : '',
      confirmUser: status === AUDIT_REASON_STATUS.CONFIRMED ? auditUser : '',
      confirmTime: status === AUDIT_REASON_STATUS.CONFIRMED ? TS(12 + (i % 4), 9, 45, 12) : '',
      createTime: TS(3 + (i % 5), 10, 12 + (i % 40), 5)
    })
  }
  return rows
}

export const crAuditReasonTable = defineTable<CrAuditReasonRow>('cr.auditReason', buildReasonRows)

/* ==================================================================
 * 四、审核结果（历史审核结论）
 * ================================================================== */
export interface CrAuditResultRow {
  id: number
  batchId: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 审核结论，见字典 cr_audit_status */
  auditStatus: number
  auditor: string
  auditTime: string
  auditOpinion: string
  /** 问题数量（错误 + 警告） */
  issueCount: number
  warnCount: number
  errorCount: number
  rowCount: number
  /** 审核轮次（退回整改后重报为第 2 轮） */
  auditRound: number
  submitTime: string
  createTime: string
}

const PASS_OPINIONS = [
  '数据完整、勾稽关系核对无误，校验告警已由填报机构说明，同意通过。',
  '经与上期数据比对，波动在合理区间，问题数据已整改，同意通过并上报。'
]
const REJECT_OPINIONS = [
  '证件号码与投保人基本信息表不一致，退回填报机构核实后重新报送。',
  '存在错误级校验问题未整改（保费金额为负值），退回填报机构修正后重报。',
  '数据定位存在缺失字段，无法与承保清单核对，退回补充说明后再报。'
]
const REJECT_OPINIONS_ROUND2 = [
  '第二轮核对仍未提供精算说明材料，退回补充材料后再次报送。',
  '整改后仍有 1 条错误级问题未修复，退回填报机构继续整改。'
]

const buildResultRows = (): CrAuditResultRow[] => {
  const rows: CrAuditResultRow[] = []
  let id = 1
  const push = (
    batch: CrAuditApproveRow,
    round: number,
    auditStatus: number,
    auditor: string,
    auditTime: string,
    auditOpinion: string
  ) => {
    rows.push({
      id: id++,
      batchId: batch.id,
      batchNo: batch.batchNo,
      orgId: batch.orgId,
      orgName: batch.orgName,
      reportId: batch.reportId,
      reportCode: batch.reportCode,
      reportName: batch.reportName,
      period: batch.period,
      auditStatus,
      auditor,
      auditTime,
      auditOpinion,
      issueCount: batch.warnCount + batch.errorCount,
      warnCount: batch.warnCount,
      errorCount: batch.errorCount,
      rowCount: batch.rowCount,
      auditRound: round,
      submitTime: batch.submitTime,
      createTime: batch.createTime
    })
  }

  crAuditApproveTable.all().forEach((batch, index) => {
    const auditor = AUDIT_USERS[index % AUDIT_USERS.length].name
    const second = AUDIT_USERS[(index + 1) % AUDIT_USERS.length].name
    if (batch.auditStatus === AUDIT_STATUS.PENDING) {
      // 待审核批次：部分批次留有"退回整改"的历史结论（本轮结论尚未形成），首次报送的批次无历史
      if (index % 2 === 1) {
        push(
          batch,
          1,
          AUDIT_STATUS.REJECT,
          auditor,
          TS(6 + (index % 4), 11, 20, 16),
          REJECT_OPINIONS[index % REJECT_OPINIONS.length]
        )
      }
      if (index % 6 === 1) {
        push(
          batch,
          2,
          AUDIT_STATUS.REJECT,
          second,
          TS(9 + (index % 4), 15, 40, 22),
          REJECT_OPINIONS_ROUND2[index % REJECT_OPINIONS_ROUND2.length]
        )
      }
    } else if (batch.auditStatus === AUDIT_STATUS.PASS) {
      if (index % 9 === 0) {
        // 曾被退回，整改后第二轮通过
        push(
          batch,
          1,
          AUDIT_STATUS.REJECT,
          auditor,
          TS(5 + (index % 3), 10, 30, 10),
          REJECT_OPINIONS[index % REJECT_OPINIONS.length]
        )
        push(
          batch,
          2,
          AUDIT_STATUS.PASS,
          auditor,
          TS(11 + (index % 4), 14, 25, 30),
          PASS_OPINIONS[index % PASS_OPINIONS.length]
        )
      } else {
        push(
          batch,
          1,
          AUDIT_STATUS.PASS,
          auditor,
          TS(11 + (index % 4), 14, 25, 30),
          PASS_OPINIONS[index % PASS_OPINIONS.length]
        )
      }
    } else {
      push(
        batch,
        1,
        AUDIT_STATUS.REJECT,
        auditor,
        TS(7 + (index % 4), 9, 50, 14),
        REJECT_OPINIONS[index % REJECT_OPINIONS.length]
      )
      if (index % 12 === 2) {
        push(
          batch,
          2,
          AUDIT_STATUS.REJECT,
          second,
          TS(10 + (index % 4), 16, 5, 40),
          REJECT_OPINIONS_ROUND2[index % REJECT_OPINIONS_ROUND2.length]
        )
      }
    }
  })
  return rows
}

export const crAuditResultTable = defineTable<CrAuditResultRow>('cr.auditResult', buildResultRows)

/* ==================================================================
 * 五、脱敏结果对照
 * ================================================================== */
export interface CrDesensitizeRow {
  id: number
  /** 业务数据标识（投保人编号），同一条数据在多个字段上的脱敏情况按它归集 */
  dataKey: string
  policyNo: string
  rowNo: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  columnCode: string
  /** 数据项（字段）名称 */
  columnName: string
  /** 脱敏前原文 */
  originalValue: string
  /** 脱敏后结果 */
  maskedValue: string
  /** 脱敏规则，见字典 cr_desensitize_type */
  ruleType: DesensitizeRuleType
  /** 脱敏参数 */
  ruleParam: string
  processTime: string
  /** 产生这条对照的脱敏批次号（脱敏执行页写入；种子数据为空） */
  batchNo?: string
  /** 产生这条对照的执行批次 id */
  taskId?: number
  /** 数据来源：seed 种子数据 / execute 页面执行产生 */
  source?: 'seed' | 'execute'
}

type FieldKey =
  | 'holderName'
  | 'insuredName'
  | 'employeeName'
  | 'certNo'
  | 'mobile'
  | 'email'
  | 'address'

interface DesensitizeRuleSpec {
  reportName: string
  field: FieldKey
  columnCode: string
  columnName: string
  ruleType: DesensitizeRuleType
  ruleParam: string
  apply: (value: string) => string
}

/** 同一报表内一个字段只配置一条规则，口径与 metaColumnTable 的脱敏配置保持一致 */
const DESENSITIZE_RULES: DesensitizeRuleSpec[] = [
  {
    reportName: '投保人基本信息表',
    field: 'holderName',
    columnCode: 'DE102',
    columnName: '投保人名称',
    ruleType: 'MASK',
    ruleParam: '前1后1',
    apply: (value) => maskKeep(value, 1, 1)
  },
  {
    reportName: '投保人基本信息表',
    field: 'certNo',
    columnCode: 'DE105',
    columnName: '证件号码',
    ruleType: 'MASK',
    ruleParam: '前3后4',
    apply: (value) => maskKeep(value, 3, 4)
  },
  {
    reportName: '投保人联系方式表',
    field: 'mobile',
    columnCode: 'DE122',
    columnName: '手机号码',
    ruleType: 'MASK',
    ruleParam: '前3后4',
    apply: (value) => maskKeep(value, 3, 4)
  },
  {
    reportName: '投保人联系方式表',
    field: 'email',
    columnCode: 'DE123',
    columnName: '电子邮箱',
    ruleType: 'MASK',
    ruleParam: '首字符（保留域名）',
    apply: maskEmail
  },
  {
    reportName: '投保人联系方式表',
    field: 'address',
    columnCode: 'DE124',
    columnName: '联系地址',
    ruleType: 'TRUNCATE',
    ruleParam: '保留前6位',
    apply: (value) => truncate(value, 6)
  },
  {
    reportName: '被保险人基本信息表',
    field: 'insuredName',
    columnCode: 'DE142',
    columnName: '被保险人名称',
    ruleType: 'MASK',
    ruleParam: '前1后1',
    apply: (value) => maskKeep(value, 1, 1)
  },
  {
    reportName: '被保险人基本信息表',
    field: 'certNo',
    columnCode: 'DE143',
    columnName: '证件号码',
    ruleType: 'HASH',
    ruleParam: 'SHA-256 + 盐值 HX2026',
    apply: (value) => hashValue(value)
  },
  {
    reportName: '从业人员信息表',
    field: 'employeeName',
    columnCode: 'DE272',
    columnName: '从业人员姓名',
    ruleType: 'REPLACE',
    ruleParam: '固定值「客户」',
    apply: () => '客户'
  },
  {
    reportName: '从业人员信息表',
    field: 'mobile',
    columnCode: 'DE274',
    columnName: '手机号码',
    ruleType: 'REPLACE',
    ruleParam: '固定值 13800000000',
    apply: () => '13800000000'
  },
  {
    reportName: '从业人员信息表',
    field: 'certNo',
    columnCode: 'DE273',
    columnName: '证件号码',
    ruleType: 'HASH',
    ruleParam: 'SHA-256 + 盐值 HX2026',
    apply: (value) => hashValue(value)
  }
]

const buildDesensitizeRows = (): CrDesensitizeRow[] => {
  const orgs = branches()
  const rows: CrDesensitizeRow[] = []
  let id = 1
  for (let i = 0; i < PERSON_COUNT; i++) {
    const person = buildPerson(i, 11 + i * 5)
    const org = orgs[i % orgs.length]
    // 每条业务数据取 5 个字段的脱敏情况（同一报表内字段不重复）
    for (let k = 0; k < 5; k++) {
      const spec = DESENSITIZE_RULES[(i * 3 + k) % DESENSITIZE_RULES.length]
      const report = reportOf(spec.reportName)
      const original = person[spec.field]
      rows.push({
        id: id++,
        dataKey: person.dataKey,
        policyNo: person.policyNo,
        rowNo: person.rowNo,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report?.id ?? 0,
        reportCode: report?.reportCode ?? '',
        reportName: report?.reportName ?? spec.reportName,
        period: PERIOD,
        columnCode: spec.columnCode,
        columnName: spec.columnName,
        originalValue: original,
        maskedValue: spec.apply(original),
        ruleType: spec.ruleType,
        ruleParam: spec.ruleParam,
        processTime: TS(5 + (i % 6), 8 + (k % 8), 10 + ((i * 7 + k) % 45), 30)
      })
    }
  }
  return rows
}

export const crDesensitizeTable = defineTable<CrDesensitizeRow>(
  'cr.desensitize',
  buildDesensitizeRows
)
