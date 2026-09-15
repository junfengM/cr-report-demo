/**
 * Mock Handler — 报送工作台（首页）
 *
 * 工作台不再有独立的统计种子表：所有数字都以「任务表 crTaskTable」为主数据源，
 * 再按 (orgId, reportId, period) join 填报 / 报文域的业务表实时算出来。
 * 因此在任务复核 / 审核 / 打回页面改了状态，回到首页即可看到数字联动。
 *
 * 口径（与首页六张卡片、节点跟踪、机构进度、我的待办一一对应）：
 *   应报报表 = 当期任务数
 *   数据填报 = status ∈ {40 待复核, 50 复核通过, 70 本级审核中, 80 上级审核中, 90 审核通过}（已提交到复核及以后）
 *   数据校验 = join crFillRecordTable.checkStatus === 2（校验通过）；
 *              该 (机构, 报表, 期次) 没有填报记录时按「填报口径」兜底（已提交到复核及以后即视为已校验）
 *   复核     = status ∈ {50, 70, 80, 90}
 *   本级审核 = status ∈ {80, 90}
 *   上级审核 = status === 90
 *   报文生成 = 任务已进入上级审核及以后（status ∈ {80, 90}）且 join crSubmitStatusTable.submitStatus ≥ 1
 *              （已生成及以后，含上报中 / 上报成功 / 上报失败 / 已回执）
 *   报送完成 = 同上门槛，且 join crSubmitStatusTable.submitStatus ∈ {3 上报成功, 5 已回执}
 *              （注意 4 是上报失败，不能按大小比较）
 *   逾期未报 = deadline 已过 且 status ≠ 90
 *   机构进度 = 按 orgName 分组算 已报 / 应报
 *   我的待办 = 当期未完成任务按状态映射到「待填报 / 待复核 / 待本级审核 / 待上级审核」
 *
 * 报文口径为什么要加任务状态门槛：
 *   crTaskTable 与 crSubmitStatusTable 是两套独立种子（任务域只铺了 6 张月报，报文域铺的是另一套 12 张，
 *   两者只有 4 张重叠），
 *   若只按 (机构, 报表, 期次) join 报文表，会出现「报文生成 14 > 上级审核 4」这类下游大于上游的倒挂，
 *   节点跟踪一眼看去就是错的。加了门槛后链路严格非递增：25 → 18 → 13 → 13 → 8 → 4 → 4 → 2。
 *   门槛取「进入上级审核及以后（80/90）」而不是「仅审核通过（90）」：仅 90 本期实测只有 1 条已生成、
 *   0 条已报送（4 条已通过任务里 3 条在报文域是待生成 / 无记录），「已报送 / 报送完成率」会掉成 0；
 *   80 的语义是「本级审核已通过、报文生成环节已开始」，与首页节点顺序一致。
 *   若确实只认审核通过，把 SUBMIT_GATE_STATUSES 改成 [TASK_STATUS.FINISHED] 即可（末两格会变 1 / 0）。
 *
 * 期次兜底：历史期次（202603~202607）在报文域没有种子数据，若仍按 join 计算，
 * 报文生成 / 报送完成会恒为 0、趋势线会断。因此当「该期次在 crSubmitStatusTable 中一条记录都没有」时，
 * 退回任务口径：status === 90 审核通过 ⇒ 视为报文已生成且已报送成功。
 */
import { onGet } from '../route'
import { PERIOD, PERIODS } from '../db/crCommon'
import { dashboardActivityTable } from '../db/crDashboard'
import { TASK_STATUS, crTaskTable, type CrTaskRow } from '../db/crTask'
import { crFillRecordTable } from '../db/crData'
import { SUBMIT_STATUS, crSubmitStatusTable } from '../db/crSubmit'
import { formatDate } from '../util'

const currentPeriod = (ctx: { params: Record<string, any> }) => ctx.params.period || PERIOD

/* ==================================================================
 * 口径常量
 * ================================================================== */

/** 已提交到复核及以后（数据填报口径） */
const FILLED_STATUSES: number[] = [
  TASK_STATUS.WAIT_REVIEW,
  TASK_STATUS.REVIEW_PASSED,
  TASK_STATUS.WAIT_LOCAL_AUDIT,
  TASK_STATUS.WAIT_UPPER_AUDIT,
  TASK_STATUS.FINISHED
]

/** 复核口径：复核通过及以后 */
const REVIEWED_STATUSES: number[] = [
  TASK_STATUS.REVIEW_PASSED,
  TASK_STATUS.WAIT_LOCAL_AUDIT,
  TASK_STATUS.WAIT_UPPER_AUDIT,
  TASK_STATUS.FINISHED
]

/** 本级审核口径：本级审核通过及以后 */
const LOCAL_AUDITED_STATUSES: number[] = [TASK_STATUS.WAIT_UPPER_AUDIT, TASK_STATUS.FINISHED]

/** 校验通过（字典 cr_check_status：0 未校验 / 1 校验中 / 2 校验通过 / 3 校验不通过） */
const CHECK_PASSED = 2

/** 报送完成口径：上报成功 / 已回执（上报失败=4 不在其中，故用枚举判断而非大小比较） */
const SUBMITTED_STATUSES: number[] = [SUBMIT_STATUS.SUCCESS, SUBMIT_STATUS.RECEIPTED]

/**
 * 报文口径的任务门槛：任务必须已通过本级审核、进入上级审核环节（80）及以后（90），
 * 报文才可能已生成 / 已报送。理由见文件头注释（避免下游节点大于上游节点）。
 */
const SUBMIT_GATE_STATUSES: number[] = [TASK_STATUS.WAIT_UPPER_AUDIT, TASK_STATUS.FINISHED]

/* ==================================================================
 * 汇总计算
 * ================================================================== */

/** 任务 + 各环节完成标记（一条任务算一行） */
type TaskStat = CrTaskRow & {
  filled: boolean
  checked: boolean
  reviewed: boolean
  localAudited: boolean
  upperAudited: boolean
  generated: boolean
  submitted: boolean
  overdue: boolean
}

/** join 键：机构 × 报表 × 期次（填报 / 校验 / 报文三张表都用这个粒度） */
const joinKey = (orgId: number, reportId: number, period: string) =>
  `${orgId}|${reportId}|${period}`

/**
 * 汇总某个期次的任务：以 crTaskTable 为主，join 填报记录（校验状态）与报文状态。
 * 每次请求实时计算，所以任务状态一变，工作台数字立刻跟着变。
 */
const statOfPeriod = (period: string): TaskStat[] => {
  const tasks = crTaskTable.all().filter((task) => task.period === period)

  const fillIndex = new Map(
    crFillRecordTable
      .all()
      .filter((row) => row.period === period)
      .map((row) => [joinKey(row.orgId, row.reportId, row.period), row])
  )
  const submitRows = crSubmitStatusTable.all().filter((row) => row.period === period)
  const submitIndex = new Map(
    submitRows.map((row) => [joinKey(row.orgId, row.reportId, row.period), row])
  )
  // 该期次在报文域完全没有种子数据（历史期次）⇒ 退回任务口径
  const fallbackToTask = submitRows.length === 0
  const today = formatDate()

  return tasks.map((task) => {
    const key = joinKey(task.orgId, task.reportId, task.period)
    const fillRecord = fillIndex.get(key)
    const submitRecord = submitIndex.get(key)
    const filled = FILLED_STATUSES.includes(task.status)
    const finished = task.status === TASK_STATUS.FINISHED
    // 报文口径受任务状态约束：任务没走到上级审核及以后，报文再"超前"也不计入
    const submitGated = SUBMIT_GATE_STATUSES.includes(task.status)
    return {
      ...task,
      filled,
      // 有填报记录 → 看它自己的校验状态；没有记录 → 按填报口径兜底
      checked: fillRecord ? fillRecord.checkStatus === CHECK_PASSED : filled,
      reviewed: REVIEWED_STATUSES.includes(task.status),
      localAudited: LOCAL_AUDITED_STATUSES.includes(task.status),
      upperAudited: finished,
      generated: fallbackToTask
        ? finished
        : submitGated && !!submitRecord && submitRecord.submitStatus >= SUBMIT_STATUS.GENERATED,
      submitted: fallbackToTask
        ? finished
        : submitGated && !!submitRecord && SUBMITTED_STATUSES.includes(submitRecord.submitStatus),
      overdue: task.deadline < today && !finished
    }
  })
}

const countBy = (rows: TaskStat[], pick: (row: TaskStat) => boolean) => rows.filter(pick).length

/** 按机构名分组（保持机构 id 升序），机构进度 / 完成机构数共用 */
const groupByOrg = (
  rows: TaskStat[]
): Array<{ orgId: number; orgName: string; rows: TaskStat[] }> => {
  const groups = new Map<string, TaskStat[]>()
  rows.forEach((row) => {
    if (!groups.has(row.orgName)) groups.set(row.orgName, [])
    groups.get(row.orgName)!.push(row)
  })
  return [...groups.entries()]
    .map(([orgName, orgRows]) => ({ orgId: orgRows[0].orgId, orgName, rows: orgRows }))
    .sort((a, b) => a.orgId - b.orgId)
}

const rate = (value: number, total: number) => (total ? Math.round((value / total) * 1000) / 10 : 0)

/* ==================================================================
 * 我的待办：任务状态 → 环节
 * ================================================================== */

/**
 * 未完成任务落在哪个环节。
 *
 * 90 审核通过是已完成，不在这里（也就不会出现在待办里）；
 * 10 待下发 / 20 已下发 / 30 填报中 / 60 复核不通过 / 100 已打回都需要回到填报环节重新处理。
 */
const TODO_STAGE: Record<number, string> = {
  [TASK_STATUS.PENDING_DISPATCH]: '待填报',
  [TASK_STATUS.DISPATCHED]: '待填报',
  [TASK_STATUS.FILLING]: '待填报',
  [TASK_STATUS.REVIEW_REJECTED]: '待填报',
  [TASK_STATUS.RETURNED]: '待填报',
  [TASK_STATUS.WAIT_REVIEW]: '待复核',
  [TASK_STATUS.REVIEW_PASSED]: '待本级审核',
  [TASK_STATUS.WAIT_LOCAL_AUDIT]: '待本级审核',
  [TASK_STATUS.WAIT_UPPER_AUDIT]: '待上级审核'
}

/** 紧急程度：3 逾期 / 2 临近截止（3 天内）/ 1 进行中（与首页标签颜色对应） */
const urgencyOf = (deadline: string, today: string): number => {
  if (deadline < today) return 3
  const days = Math.round(
    (Date.parse(`${deadline}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000
  )
  return days <= 3 ? 2 : 1
}

/* ==================================================================
 * 接口
 * ================================================================== */

/** 报送总体概况 */
onGet('/cr/dashboard/overview', (ctx) => {
  const period = currentPeriod(ctx)
  const rows = statOfPeriod(period)
  const shouldReport = rows.length
  const filled = countBy(rows, (row) => row.filled)
  const checked = countBy(rows, (row) => row.checked)
  const submitted = countBy(rows, (row) => row.submitted)
  const overdue = countBy(rows, (row) => row.overdue)
  const orgs = groupByOrg(rows)
  return {
    period,
    shouldReport,
    filled,
    checked,
    submitted,
    overdue,
    fillRate: rate(filled, shouldReport),
    checkRate: rate(checked, shouldReport),
    submitRate: rate(submitted, shouldReport),
    orgCount: orgs.length,
    // 该机构当期任务全部报送完成才算"完成机构"
    doneOrgCount: orgs.filter((org) => org.rows.every((row) => row.submitted)).length
  }
})

/** 报送节点跟踪：链路上每个环节的完成情况 */
onGet('/cr/dashboard/nodes', (ctx) => {
  const period = currentPeriod(ctx)
  const rows = statOfPeriod(period)
  const total = rows.length
  const nodes: Array<[string, (row: TaskStat) => boolean]> = [
    ['数据填报', (row) => row.filled],
    ['数据校验', (row) => row.checked],
    ['复核', (row) => row.reviewed],
    ['本级审核', (row) => row.localAudited],
    ['上级审核', (row) => row.upperAudited],
    ['报文生成', (row) => row.generated],
    ['报送完成', (row) => row.submitted]
  ]
  return nodes.map(([name, pick]) => {
    const done = countBy(rows, pick)
    const percent = total ? Math.round((done / total) * 100) : 0
    return {
      name,
      done,
      total,
      percent,
      status: percent >= 100 ? 'success' : percent > 0 ? 'process' : 'wait'
    }
  })
})

/** 近 6 期报送完成率趋势 */
onGet('/cr/dashboard/trend', () =>
  PERIODS.map((period) => {
    const rows = statOfPeriod(period)
    const total = rows.length
    return {
      period,
      fillRate: rate(
        countBy(rows, (row) => row.filled),
        total
      ),
      checkRate: rate(
        countBy(rows, (row) => row.checked),
        total
      ),
      submitRate: rate(
        countBy(rows, (row) => row.submitted),
        total
      )
    }
  })
)

/** 各机构本期推进情况 */
onGet('/cr/dashboard/org-progress', (ctx) => {
  const period = currentPeriod(ctx)
  const rows = statOfPeriod(period)
  return groupByOrg(rows).map((org) => {
    const submitted = countBy(org.rows, (row) => row.submitted)
    return {
      orgId: org.orgId,
      orgName: org.orgName,
      shouldReport: org.rows.length,
      filled: countBy(org.rows, (row) => row.filled),
      submitted,
      overdue: countBy(org.rows, (row) => row.overdue),
      submitRate: rate(submitted, org.rows.length)
    }
  })
})

/** 我的待办：当期未完成任务（不再单独维护待办种子表） */
onGet('/cr/dashboard/todo', (ctx) => {
  const period = currentPeriod(ctx)
  const today = formatDate()
  return statOfPeriod(period)
    .filter((row) => TODO_STAGE[row.status] !== undefined)
    .map((row) => ({
      id: row.id,
      taskNo: row.taskCode,
      title: row.reportName,
      orgName: row.orgName,
      period: row.period,
      stage: TODO_STAGE[row.status],
      deadline: row.deadline,
      urgency: urgencyOf(row.deadline, today)
    }))
    .sort(
      (a, b) =>
        b.urgency - a.urgency ||
        (a.deadline === b.deadline ? a.id - b.id : a.deadline < b.deadline ? -1 : 1)
    )
})

/** 最近动态 */
onGet('/cr/dashboard/activity', () =>
  dashboardActivityTable.all().sort((a, b) => (a.time < b.time ? 1 : -1))
)
