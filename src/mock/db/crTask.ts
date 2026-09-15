/**
 * Mock 种子数据 — 报表任务流转域
 *
 * 覆盖附件文档「报表任务管理」的流转链路：
 *   任务模板 → 任务下发（生成各机构填报任务）→ 填报 → 复核 → 本级审核 → 上级审核 → 报文生成
 * 任何环节都可以打回上一环节。
 *
 * 状态取值直接对齐字典 `cr_task_status`（src/mock/db/dict.ts），
 * 这样页面上的 `<dict-tag :type="DICT_TYPE.CR_TASK_STATUS" />` 能直接渲染中文标签：
 *   10 待下发 / 20 已下发（待填报）/ 30 填报中 / 40 待复核 / 50 复核通过
 *   60 复核不通过 / 70 本级审核中 / 80 上级审核中 / 90 审核通过 / 100 已打回
 */
import { defineTable } from '../store'
import { orgTable } from './org'
import { reportTable, taskTemplateTable } from './cr'
import { FILL_USERS, PERIOD, PERIODS, REVIEW_USERS, AUDIT_USERS } from './crCommon'

/* ==================================================================
 * 状态与环节常量
 * ================================================================== */

/** 任务状态：字典 cr_task_status */
export const TASK_STATUS = {
  /** 10 待下发（任务已建，尚未下发到机构） */
  PENDING_DISPATCH: 10,
  /** 20 已下发（机构待填报） */
  DISPATCHED: 20,
  /** 30 填报中 */
  FILLING: 30,
  /** 40 待复核 */
  WAIT_REVIEW: 40,
  /** 50 复核通过（历史节点，随后进入本级审核） */
  REVIEW_PASSED: 50,
  /** 60 复核不通过（历史节点，随后打回填报） */
  REVIEW_REJECTED: 60,
  /** 70 本级审核中 */
  WAIT_LOCAL_AUDIT: 70,
  /** 80 上级审核中 */
  WAIT_UPPER_AUDIT: 80,
  /** 90 审核通过（已完成） */
  FINISHED: 90,
  /** 100 已打回 */
  RETURNED: 100
} as const

/** 打回可选择的环节（对应 crTaskReturnTable.stage） */
export const RETURN_STAGE = {
  FILL: '填报',
  REVIEW: '复核',
  LOCAL_AUDIT: '本级审核',
  UPPER_AUDIT: '上级审核'
} as const

/** 环节 → 打回后任务应回到的状态 */
export const RETURN_STAGE_STATUS: Record<string, number> = {
  [RETURN_STAGE.FILL]: TASK_STATUS.FILLING,
  [RETURN_STAGE.REVIEW]: TASK_STATUS.WAIT_REVIEW,
  [RETURN_STAGE.LOCAL_AUDIT]: TASK_STATUS.WAIT_LOCAL_AUDIT,
  [RETURN_STAGE.UPPER_AUDIT]: TASK_STATUS.WAIT_UPPER_AUDIT
}

/** 流转轨迹和操作流水上的环节名 */
export const FLOW_STAGE = {
  FILL: '填报',
  REVIEW: '复核',
  LOCAL_AUDIT: '本级审核',
  UPPER_AUDIT: '上级审核'
} as const

/** 操作结果，见字典 cr_audit_status */
export const AUDIT_RESULT = {
  PASS: 1,
  REJECT: 2
} as const

/** 状态 → 当前环节（列表「当前环节」列 / el-steps 用） */
export const STATUS_STAGE: Record<number, string> = {
  [TASK_STATUS.PENDING_DISPATCH]: '待下发',
  [TASK_STATUS.DISPATCHED]: '填报',
  [TASK_STATUS.FILLING]: '填报',
  [TASK_STATUS.WAIT_REVIEW]: '复核',
  [TASK_STATUS.REVIEW_PASSED]: '本级审核',
  [TASK_STATUS.REVIEW_REJECTED]: '填报',
  [TASK_STATUS.WAIT_LOCAL_AUDIT]: '本级审核',
  [TASK_STATUS.WAIT_UPPER_AUDIT]: '上级审核',
  [TASK_STATUS.FINISHED]: '已完成',
  [TASK_STATUS.RETURNED]: '打回处理'
}

interface TrailSeed {
  stage: string
  action: string
  result: number
  opinion: string
  operator: string
  time: string
}

/**
 * 打回记录种子：[任务序号, 打回环节, 打回原因, 打回人, 打回时间, 是否已处理, 处理说明, 处理时间]
 *
 * 时间显式给出（统一落在 2026-09-01 ~ 2026-09-10 的历史区间），
 * 与流转轨迹里的"下发 / 提交 / 复核 / 审核"节点保持先后关系，也避免与运行时新产生的流水撞在同一时刻。
 */
const returnSeedSpec: Array<[number, string, string, string, string, boolean, string, string]> = [
  [
    3,
    RETURN_STAGE.REVIEW,
    '保单贷款余额与保费明细存在差异，请核对后重新提交',
    '陈志强',
    '2026-09-05 15:00:00',
    false,
    '',
    ''
  ],
  [
    5,
    RETURN_STAGE.REVIEW,
    '保费与赔案口径存在差异，请核对后重新提交',
    '陈志强',
    '2026-09-03 15:00:00',
    true,
    '已重新填报并再次提交复核',
    '2026-09-04 10:00:00'
  ],
  [
    9,
    RETURN_STAGE.LOCAL_AUDIT,
    '退回复核环节，请重新核对数据一致性',
    '孙建国',
    '2026-09-08 15:00:00',
    true,
    '复核已重新通过，进入本级审核',
    '2026-09-09 10:00:00'
  ],
  [
    10,
    RETURN_STAGE.REVIEW,
    '退保金额与保单状态变更记录不一致',
    '赵敏',
    '2026-09-06 15:00:00',
    true,
    '已重新填报并提交复核',
    '2026-09-07 10:00:00'
  ],
  [
    14,
    RETURN_STAGE.LOCAL_AUDIT,
    '上级审核退回本级：机构编码与机构维护信息不一致，请修正后重报',
    '周文彬',
    '2026-09-09 15:00:00',
    true,
    '已修正机构编码，本级重新把关',
    '2026-09-10 10:00:00'
  ],
  [
    15,
    RETURN_STAGE.REVIEW,
    '本级审核不通过：责任准备金口径需按最新监管要求调整',
    '孙建国',
    '2026-09-07 15:00:00',
    true,
    '已按最新口径重新填报并提交复核',
    '2026-09-08 10:00:00'
  ],
  [
    19,
    RETURN_STAGE.UPPER_AUDIT,
    '退至本级审核，请复核责任准备金口径后再报',
    '周文彬',
    '2026-09-08 15:00:00',
    true,
    '本级审核重新通过',
    '2026-09-09 10:00:00'
  ],
  [
    20,
    RETURN_STAGE.FILL,
    '从业人员信息表存在证件号脱敏不合规数据',
    '孙建国',
    '2026-09-02 15:00:00',
    true,
    '已按脱敏规则重新报送',
    '2026-09-03 10:00:00'
  ],
  [
    23,
    RETURN_STAGE.UPPER_AUDIT,
    '中介机构合作情况表手续费口径需修正',
    '周文彬',
    '2026-09-04 15:00:00',
    true,
    '已修正手续费口径',
    '2026-09-05 10:00:00'
  ],
  [
    24,
    RETURN_STAGE.REVIEW,
    '赔案信息表缺少出险日期字段，请补充后重报',
    '陈志强',
    '2026-09-10 15:00:00',
    false,
    '',
    ''
  ],
  [
    25,
    RETURN_STAGE.LOCAL_AUDIT,
    '本级审核不通过：赔付支出与赔案明细不匹配',
    '孙建国',
    '2026-09-09 15:00:00',
    false,
    '',
    ''
  ]
]

/**
 * 按任务状态生成流转轨迹种子。
 *
 * 轨迹必须与状态自洽：状态落在哪一环，轨迹就走到哪一环，中间不能缺环节。
 * - 任务带"已处理"的打回记录：轨迹末尾补一个"不通过 / 退回"节点（说明它是怎么被打回来的）
 * - 任务带"未处理"的打回记录：轨迹末尾补一个"退回至 X"节点（说明它当前为何停在这一环）
 */
const buildTrail = (row: {
  status: number
  deadline: string
  orgName: string
  fillUser: string
  reviewUser: string
  auditUser: string
  returnRecord?: { stage: string; reason: string; returnUser: string; returnTime: string }
  pendingReturn?: { stage: string; reason: string; returnUser: string; returnTime: string }
}): TrailSeed[] => {
  const { status, deadline, fillUser, reviewUser, auditUser, returnRecord, pendingReturn } = row
  const trail: TrailSeed[] = []
  const at = (days: number, hour: number) => stageTime(deadline, days, hour)
  const dispatch = () => ({
    stage: FLOW_STAGE.FILL,
    action: '任务下发',
    result: AUDIT_RESULT.PASS,
    opinion: `任务已下发至${row.orgName}，待填报`,
    operator: '系统',
    time: at(-14, 9)
  })
  const submitted = (days: number) => ({
    stage: FLOW_STAGE.FILL,
    action: '提交填报数据',
    result: AUDIT_RESULT.PASS,
    opinion: '数据填报完成，已提交复核',
    operator: fillUser,
    time: at(days, 10)
  })
  const reviewPass = (days: number) => ({
    stage: FLOW_STAGE.REVIEW,
    action: '复核通过',
    result: AUDIT_RESULT.PASS,
    opinion: '数据完整性与勾稽关系核对无误',
    operator: reviewUser,
    time: at(days, 11)
  })
  const localPass = (days: number) => ({
    stage: FLOW_STAGE.LOCAL_AUDIT,
    action: '本级审核通过',
    result: AUDIT_RESULT.PASS,
    opinion: '本级审核通过，提交上级审核',
    operator: auditUser,
    time: at(days, 14)
  })
  const upperPass = (days: number) => ({
    stage: FLOW_STAGE.UPPER_AUDIT,
    action: '上级审核通过',
    result: AUDIT_RESULT.PASS,
    opinion: '上级审核通过，报文生成条件已满足',
    operator: auditUser,
    time: at(days, 16)
  })
  /** 打回 / 不通过节点：复用打回记录里的原因、打回人与时间 */
  const rejectNode = (record: {
    stage: string
    reason: string
    returnUser: string
    returnTime: string
  }) => {
    const stage = record.stage
    const stageLabel =
      stage === RETURN_STAGE.FILL || stage === RETURN_STAGE.REVIEW ? FLOW_STAGE.REVIEW : stage
    const action =
      stage === RETURN_STAGE.REVIEW
        ? '复核不通过'
        : stage === RETURN_STAGE.LOCAL_AUDIT
          ? '本级审核不通过'
          : `退回至${stage}`
    return {
      stage: stageLabel,
      action,
      result: AUDIT_RESULT.REJECT,
      opinion: record.reason,
      operator: record.returnUser,
      time: record.returnTime
    }
  }

  switch (status) {
    case TASK_STATUS.PENDING_DISPATCH:
      break
    case TASK_STATUS.DISPATCHED:
      trail.push(dispatch())
      break
    case TASK_STATUS.FILLING:
      trail.push(dispatch())
      if (returnRecord) trail.push(rejectNode(returnRecord))
      if (pendingReturn) trail.push(rejectNode(pendingReturn))
      break
    case TASK_STATUS.WAIT_REVIEW:
      trail.push(dispatch(), submitted(returnRecord || pendingReturn ? -6 : -3))
      if (returnRecord) trail.push(rejectNode(returnRecord))
      if (pendingReturn) trail.push(rejectNode(pendingReturn))
      break
    case TASK_STATUS.WAIT_LOCAL_AUDIT:
      trail.push(
        submitted(returnRecord || pendingReturn ? -8 : -6),
        reviewPass(returnRecord || pendingReturn ? -7 : -5)
      )
      if (returnRecord) trail.push(rejectNode(returnRecord))
      if (pendingReturn) trail.push(rejectNode(pendingReturn))
      break
    case TASK_STATUS.WAIT_UPPER_AUDIT:
      trail.push(submitted(-7), reviewPass(-6), localPass(-4))
      if (pendingReturn) trail.push(rejectNode(pendingReturn))
      break
    case TASK_STATUS.FINISHED:
      trail.push(submitted(-8), reviewPass(-7), localPass(-5), upperPass(-3))
      break
    case TASK_STATUS.RETURNED:
      trail.push(submitted(-8), reviewPass(-7), localPass(-5))
      if (returnRecord) trail.push(rejectNode(returnRecord))
      if (pendingReturn) trail.push(rejectNode(pendingReturn))
      break
    default:
      break
  }
  return trail
}

/* ==================================================================
 * 报表任务实例
 * ================================================================== */
export interface CrTaskRow {
  id: number
  /** 任务编号，如 RW202608001 */
  taskCode: string
  taskName: string
  /** 来源任务模板 */
  templateId: number
  templateName: string
  /** 填报机构 */
  orgId: number
  orgName: string
  /** 报表（表样） */
  reportId: number
  reportName: string
  reportCode: string
  /** 报送期次 */
  period: string
  /** 数据频度，见字典 cr_report_freq */
  freq: number
  /** 下发时间 */
  dispatchTime: string
  /** 截止日期 */
  deadline: string
  /** 当前状态，见字典 cr_task_status */
  status: number
  /** 填报人 */
  fillUser: string
  /** 复核人 */
  reviewUser: string
  /** 审核人 */
  auditUser: string
  remark: string
  createTime: string
}

/** 模板 1（2026年8月新统信月报任务）下的报表，任务实例按机构 × 报表铺开（历史期次沿用同一批月报表样） */
const MONTHLY_REPORTS = [
  { reportId: 1, reportCode: 'BX001', reportName: '人身险公司商保年金业务统计表' },
  { reportId: 2, reportCode: 'BX002', reportName: '人身险保单状态统计表' },
  { reportId: 3, reportCode: 'BX003', reportName: '保单贷款业务统计表' },
  { reportId: 13, reportCode: 'BX013', reportName: '赔案信息表' },
  { reportId: 14, reportCode: 'BX014', reportName: '赔付支出统计表' },
  { reportId: 18, reportCode: 'BX018', reportName: '从业人员信息表' }
]

/** 填报人固定到机构（与 FILL_USERS 的 orgName 对应），复核人 / 审核人在生成种子时轮转 */
const ORG_BINDING: Record<number, { orgName: string; fillUser: string }> = {
  11: { orgName: '北京分公司', fillUser: '李思远' },
  12: { orgName: '上海分公司', fillUser: '王雅琴' },
  13: { orgName: '江苏分公司', fillUser: '张明浩' },
  14: { orgName: '广东分公司', fillUser: '刘婉婷' }
}

/**
 * 任务实例清单：[任务序号, 机构 id, 报表下标, 状态, 是否有打回历史]
 * 状态刻意铺开在不同环节，保证 5 个页面都有活数据；打回历史与 returnSeedSpec 一一对应。
 */
const taskSeedSpec: Array<[number, number, number, number, boolean?]> = [
  // —— 填报环节 ——
  [1, 11, 0, TASK_STATUS.FILLING],
  [2, 12, 3, TASK_STATUS.DISPATCHED],
  [3, 13, 4, TASK_STATUS.FILLING],
  [4, 14, 5, TASK_STATUS.DISPATCHED],
  [5, 11, 3, TASK_STATUS.FILLING, true],
  // —— 复核环节 ——
  [6, 12, 0, TASK_STATUS.WAIT_REVIEW],
  [7, 13, 1, TASK_STATUS.WAIT_REVIEW],
  [8, 14, 2, TASK_STATUS.WAIT_REVIEW],
  [9, 11, 1, TASK_STATUS.WAIT_REVIEW, true],
  [10, 12, 4, TASK_STATUS.WAIT_REVIEW, true],
  // —— 本级审核环节 ——
  [11, 13, 2, TASK_STATUS.WAIT_LOCAL_AUDIT],
  [12, 14, 0, TASK_STATUS.WAIT_LOCAL_AUDIT],
  [13, 11, 5, TASK_STATUS.WAIT_LOCAL_AUDIT],
  [14, 12, 1, TASK_STATUS.WAIT_LOCAL_AUDIT, true],
  [15, 13, 5, TASK_STATUS.WAIT_LOCAL_AUDIT, true],
  // —— 上级审核环节 ——
  [16, 14, 1, TASK_STATUS.WAIT_UPPER_AUDIT],
  [17, 11, 4, TASK_STATUS.WAIT_UPPER_AUDIT],
  [18, 12, 2, TASK_STATUS.WAIT_UPPER_AUDIT],
  [19, 13, 0, TASK_STATUS.WAIT_UPPER_AUDIT, true],
  // —— 已完成 ——
  [20, 14, 3, TASK_STATUS.FINISHED],
  [21, 11, 2, TASK_STATUS.FINISHED],
  [22, 12, 5, TASK_STATUS.FINISHED],
  [23, 13, 3, TASK_STATUS.FINISHED, true],
  // —— 已打回（待打回人重新处理）——
  [24, 14, 4, TASK_STATUS.RETURNED, true],
  [25, 11, 0, TASK_STATUS.RETURNED, true]
]

/**
 * 当期任务的截止日期覆盖：只调整下面 3 条任务的截止日期，其余仍跟随模板（2026-09-15）。
 *
 * 目的：工作台「逾期未报」口径是「deadline 已过 且 status ≠ 90」。
 * 若当期任务全部用模板截止日 2026-09-15，演示当天（2026-09-12）逾期恒为 0，
 * 过了 09-15 又会一次跳到 21 条，两头都不适合演示。这里让 3 家机构各有一条先到期，
 * 体现「大部分机构按时、个别机构已逾期」。
 *
 * 挑选原则：这 3 条对应的 (机构, 报表) 组合不在填报域种子范围内（crFillRecordTable 里没有记录），
 * 避免出现「任务截止 09-08、填报记录截止 09-15」两套截止日期打架。
 */
const DEADLINE_OVERRIDE: Record<number, string> = {
  6: '2026-09-08', // 上海分公司 · 人身险公司商保年金业务统计表（待复核）
  11: '2026-09-10', // 江苏分公司 · 保单贷款业务统计表（本级审核中）
  16: '2026-09-08' // 广东分公司 · 人身险保单状态统计表（上级审核中）
}

/** 生成任务编号：RW<期次><3 位序号>，如 RW202608001 */
export const buildTaskCode = (period: string, seq: number): string =>
  `RW${period}${String(seq).padStart(3, '0')}`

/** 期次 → 中文描述，如 202608 → 2026年8月 */
const periodLabel = (period: string): string => {
  const month = Number(period.slice(4, 6))
  const year = period.slice(0, 4)
  return Number.isNaN(month) ? `${period}期` : `${year}年${month}月`
}

/** 按任务状态倒推"下发时间 / 各环节操作时间"，让轨迹与状态自洽 */
const stageTime = (deadline: string, offsetDays: number, hour = 9): string => {
  const time = Date.parse(`${deadline}T00:00:00`)
  const date = new Date(time + offsetDays * 86400000 + hour * 3600000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  )
}

/* ==================================================================
 * 历史期次任务（工作台「近 6 期趋势」与期次筛选的对照数据）
 * ================================================================== */

/**
 * 历史期次 = PERIODS 中除当期以外的期次（202603 ~ 202607）。
 *
 * 这些期次在任务模板 / 填报 / 报文各域都没有独立种子，任务在这里按「4 家分公司 × 6 张月报」铺齐，
 * 状态统一走到 90 审核通过 —— 工作台的期次趋势要的是「往期都完成了、本期在推进中」的对比。
 */
const HISTORY_PERIODS = PERIODS.filter((period) => period !== PERIOD)

/** 期次 → 截止日期：次月 15 日（与填报域 DEADLINE_BY_PERIOD 的 202607→08-15 / 202608→09-15 口径一致） */
const periodDeadline = (period: string): string => {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(4, 6))
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`
}

/**
 * 生成历史期次任务。
 *
 * - 任务编号沿用 buildTaskCode()，序号在期次内从 001 起算（RW202603001 …），每期 24 条；
 * - id 在全表内继续递增（当期任务占 1~25），避免与按任务 id 关联的打回记录 / 流转轨迹冲突；
 * - 历史期次没有对应的任务模板种子：模板名按期次推导，templateId 沿用上期月报模板（id=2）保持外键有效。
 */
const buildHistoryTasks = (startId: number): CrTaskRow[] => {
  const template = taskTemplateTable.get(2)
  const rows: CrTaskRow[] = []
  let id = startId
  HISTORY_PERIODS.forEach((period) => {
    const deadline = periodDeadline(period)
    let seq = 0
    Object.entries(ORG_BINDING).forEach(([orgId, org]) => {
      MONTHLY_REPORTS.forEach((report) => {
        id += 1
        seq += 1
        rows.push({
          id,
          taskCode: buildTaskCode(period, seq),
          taskName: `${periodLabel(period)}${report.reportName}报送任务（${org.orgName}）`,
          templateId: template?.id || 2,
          templateName: `${periodLabel(period)}新统信月报任务`,
          orgId: Number(orgId),
          orgName: org.orgName,
          reportId: report.reportId,
          reportName: report.reportName,
          reportCode: report.reportCode,
          period,
          freq: template?.freq || 3,
          dispatchTime: stageTime(deadline, -14, 9),
          deadline,
          status: TASK_STATUS.FINISHED,
          fillUser: org.fillUser,
          reviewUser: REVIEW_USERS[id % REVIEW_USERS.length].name,
          auditUser: AUDIT_USERS[id % AUDIT_USERS.length].name,
          remark: '',
          createTime: stageTime(deadline, -15, 9)
        } satisfies CrTaskRow)
      })
    })
  })
  return rows
}

/** 任务实例表：当期任务（taskSeedSpec）+ 历史期次任务（buildHistoryTasks） */
export const crTaskTable = defineTable<CrTaskRow>('cr.crTask', () => {
  const monthly = taskTemplateTable.get(1)
  const current = taskSeedSpec.map((spec) => {
    const [seq, orgId, reportIndex, status, returned] = spec as [
      number,
      number,
      number,
      number,
      boolean?
    ]
    const report = MONTHLY_REPORTS[reportIndex]
    const org = ORG_BINDING[orgId]
    // 少数任务单独提前截止日期（见 DEADLINE_OVERRIDE），其余跟随模板
    const deadline = DEADLINE_OVERRIDE[seq] || monthly?.deadline || '2026-09-15'
    return {
      id: seq,
      taskCode: buildTaskCode(PERIOD, seq),
      taskName: `${periodLabel(PERIOD)}${report.reportName}报送任务（${org.orgName}）`,
      templateId: monthly?.id || 1,
      templateName: monthly?.templateName || '2026年8月新统信月报任务',
      orgId,
      orgName: org.orgName,
      reportId: report.reportId,
      reportName: report.reportName,
      reportCode: report.reportCode,
      period: PERIOD,
      freq: monthly?.freq || 3,
      dispatchTime: stageTime(deadline, -14, 9),
      deadline,
      status,
      fillUser: org.fillUser,
      reviewUser: REVIEW_USERS[seq % REVIEW_USERS.length].name,
      auditUser: AUDIT_USERS[seq % AUDIT_USERS.length].name,
      remark: returned ? '存在打回记录，请关注处理进度' : '',
      createTime: stageTime(deadline, -15, 9)
    } satisfies CrTaskRow
  })
  // 历史任务的 id 接着当期任务往后排
  return [...current, ...buildHistoryTasks(current.length)]
})

/* ==================================================================
 * 复核 / 审核流水
 * ================================================================== */
export interface CrTaskReviewRow {
  id: number
  /** 环节：填报 / 复核 / 本级审核 / 上级审核 */
  stage: string
  taskId: number
  taskCode: string
  taskName: string
  orgName: string
  operator: string
  /** 动作，如"复核通过""本级审核不通过""打回至复核" */
  action: string
  /** 操作结果，见字典 cr_audit_status：1 通过 2 不通过 */
  result: number
  opinion: string
  operateTime: string
}

/** 由任务状态推导流转轨迹（复核 / 审核流水） */
const buildReviewRows = (): CrTaskReviewRow[] => {
  const rows: CrTaskReviewRow[] = []
  let id = 1
  crTaskTable.all().forEach((task) => {
    const records = returnSeedSpec
      .filter((spec) => spec[0] === task.id)
      .map((spec) => ({
        stage: spec[1],
        reason: spec[2],
        returnUser: spec[3],
        returnTime: spec[4],
        processed: spec[5]
      }))
    // 已处理的打回说明该任务曾被打回；未处理的打回说明它当前正停在被打回的那一环
    const handled = records.filter((record) => record.processed)
    const pending = records.filter((record) => !record.processed)
    const trail = buildTrail({
      status: task.status,
      deadline: task.deadline,
      orgName: task.orgName,
      fillUser: task.fillUser,
      reviewUser: task.reviewUser,
      auditUser: task.auditUser,
      returnRecord: handled[handled.length - 1],
      pendingReturn: pending[pending.length - 1]
    })
    trail.forEach((item) => {
      rows.push({
        id: id++,
        stage: item.stage,
        taskId: task.id,
        taskCode: task.taskCode,
        taskName: task.taskName,
        orgName: task.orgName,
        operator: item.operator,
        action: item.action,
        result: item.result,
        opinion: item.opinion,
        operateTime: item.time
      })
    })
  })
  return rows
}

export const crTaskReviewTable = defineTable<CrTaskReviewRow>('cr.crTaskReview', buildReviewRows)

/* ==================================================================
 * 打回记录
 * ================================================================== */
export interface CrTaskReturnRow {
  id: number
  taskId: number
  taskCode: string
  taskName: string
  orgName: string
  /** 打回环节（打回到哪一环） */
  stage: string
  reason: string
  /** 打回人 */
  returnUser: string
  returnTime: string
  /** 处理状态：false 待处理 / true 已处理 */
  processed: boolean
  /** 处理说明 */
  handleRemark: string
  handleTime: string
}

const buildReturnRows = (): CrTaskReturnRow[] => {
  const tasks = crTaskTable.all()
  return returnSeedSpec.map((spec, index) => {
    const [seq, stage, reason, returnUser, returnTime, processed, handleRemark, handleTime] = spec
    const task = tasks.find((item) => item.id === seq)
    return {
      id: index + 1,
      taskId: seq,
      taskCode: task?.taskCode || '',
      taskName: task?.taskName || '',
      orgName: task?.orgName || '',
      stage,
      reason,
      returnUser,
      returnTime,
      processed,
      handleRemark,
      handleTime
    }
  })
}

export const crTaskReturnTable = defineTable<CrTaskReturnRow>('cr.crTaskReturn', buildReturnRows)

/** 组织下拉（总公司 + 分公司），任务下发弹窗用 */
export const taskOrgOptions = () =>
  orgTable
    .all()
    .filter((org) => org.orgLevel <= 2)
    .map((org) => ({
      id: org.id,
      name: org.orgName,
      level: org.orgLevel,
      regulator: org.regulator
    }))

/** 报表下拉，任务下发弹窗回显模板报表用 */
/** 报表（表样）下拉数据：与任务实例的字段名保持一致（reportName / reportCode） */
export const taskReportOptions = () =>
  reportTable.all().map((report) => ({
    id: report.id,
    name: report.reportName,
    reportName: report.reportName,
    code: report.reportCode,
    reportCode: report.reportCode,
    freq: report.freq
  }))

/** 供任务初始化/下发复用的演示用户 */
export const TASK_USERS = { FILL_USERS, REVIEW_USERS, AUDIT_USERS }
