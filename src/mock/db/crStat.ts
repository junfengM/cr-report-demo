/**
 * Mock 种子/聚合 — 报送数据统计系列查询（10 个查询）
 *
 * 附件文档第 16 章只给了"报送数据统计（10 个查询）"这一句 + 若干截图，
 * 工程内没有可对照的字段说明，**具体口径按通行做法提案**，每个查询都在 `note` 里写明口径，
 * 页面上原样展示 —— 接手演示时请如实讲这一句，不要讲成"完全照附件实现"。
 *
 * 更重要的一条：**所有统计都从真实业务表当场汇总**（任务 cr.crTask、填报 cr.fillData /
 * cr.fillRecord、检核 cr.checkResult、采集 cr.importTask、脱敏 cr.desensTask、报送 cr.submitStatus），
 * 不另建"统计结果表"。第一轮独立审核推翻过"工作台统计与业务数据脱钩"（改完数据数字纹丝不动），
 * 这里沿用同一原则：数据一变，刷新统计就能看到数字跟着变。
 */
import { orgTable } from './org'
import { reportOptions } from './crCommon'
import { PERIODS } from './crCommon'
import { formatDateTime } from '../util'
import { crTaskTable, TASK_STATUS } from './crTask'
import { crTaskReturnTable } from './crTask'
import { crFillDataTable, crFillRecordTable } from './crData'
import { crCheckResultTable } from './crCheck'
import { importTaskTable, collectPeriodTable } from './crCollect'
import { crDesensTaskTable } from './crDesensitize'
import { crSubmitStatusTable, SUBMIT_STATUS } from './crSubmit'

export interface StatColumn {
  prop: string
  label: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

export interface StatPayload {
  code: string
  title: string
  description: string
  note: string
  generatedAt: string
  columns: StatColumn[]
  rows: Array<Record<string, any>>
  summary: Array<{ label: string; value: number | string; unit?: string; tip?: string }>
  chart: { categories: string[]; series: Array<{ name: string; data: number[] }> } | null
  filterText: string
}

/** 10 个查询的定义（标题 / 说明 / 口径），页面与接口共用一份 */
export const STAT_DEFS = [
  {
    code: 'progress',
    title: '报送进度统计',
    description: '按机构看本期任务的下发、填报、审核到哪一步了',
    note: '口径：任务数取 cr.crTask（报表任务表）；已完成 = 状态 90 审核通过；进行中 = 30 填报中 / 40 待复核 / 50 复核通过 / 70 本级审核中 / 80 上级审核中；未开始 = 10 待下发 / 20 已下发；已打回 = 100 已打回（含 60 复核不通过）。完成率 = 已完成 ÷ 任务数。',
    icon: 'ep:data-line'
  },
  {
    code: 'timely',
    title: '报送及时率统计',
    description: '哪些机构按时报了、哪些逾期、哪些还没报',
    note: '口径：应报 = 该「机构 × 报表 × 期次」的填报记录（cr.fillRecord）；已提交 = 填报状态 2；按时 = 提交时间 ≤ 报送截止日；逾期 = 提交时间晚于截止日；未报 = 还没提交。及时率 = 按时 ÷ 应报。',
    icon: 'ep:alarm-clock'
  },
  {
    code: 'task',
    title: '任务完成情况统计',
    description: '任务在各流转环节的分布（待下发 → 填报 → 复核 → 审核 → 完成）',
    note: '口径：按 cr.crTask 的当前状态分组计数，状态口径见字典 cr_task_status（10 待下发 / 20 已下发 / 30 填报中 / 40 待复核 / 70 本级审核中 / 80 上级审核中 / 90 审核通过 / 100 已打回）。',
    icon: 'ep:finished'
  },
  {
    code: 'volume',
    title: '报送数据量统计',
    description: '各机构各报表的填报行数与导入行数对比',
    note: '口径：填报行数 = cr.fillData 明细行数；导入行数 = cr.importTask 中状态为「已入库」（4）的批次 writtenRows 之和；两者口径不同（导入只覆盖导入来源的行），出现差异属正常，页面不合并成一个数字。',
    icon: 'ep:grid'
  },
  {
    code: 'check',
    title: '数据检核问题统计',
    description: '校验发现的问题按机构分布，以及处理进展',
    note: '口径：问题数取 cr.checkResult；错误 = 错误级别 2，警告 = 错误级别 1；已处理 / 未处理按 handled 字段；处理率 = 已处理 ÷ 问题数。',
    icon: 'ep:warning'
  },
  {
    code: 'reject',
    title: '审核打回统计',
    description: '被打回的任务集中在哪些机构、打回后有没有处理',
    note: '口径：打回次数取 cr.crTaskReturn（打回记录表），待处理 / 已处理按 processed 字段；同一任务被多次打回会分别计数。',
    icon: 'ep:refresh-left'
  },
  {
    code: 'import',
    title: '数据采集批次统计',
    description: '数据是怎么进来的：各采集渠道的批次数、行数与成功率',
    note: '口径：批次取 cr.importTask；渠道见字典 cr_collect_channel（系统直连 / 文件导入 / 接口推送 / 手工录入）；成功率 = 成功行数 ÷ 总行数（解析失败批次总行数为 0，不参与统计）。',
    icon: 'ep:download'
  },
  {
    code: 'desens',
    title: '脱敏执行统计',
    description: '脱敏批次改写了多少字段值、耗时多少',
    note: '口径：批次取 cr.desensTask；改写字段值 = maskedRows（行 × 字段）；「待审核 / 已驳回」是审批流引入的状态，只有执行成功 / 部分失败的批次才真正改写过数据。',
    icon: 'ep:view'
  },
  {
    code: 'submit',
    title: '报文报送统计',
    description: '报文生成、上报成功与回执情况',
    note: '口径：报文取 cr.submitStatus；上报成功 = 状态 3，已回执 = 状态 5，失败 = 状态 4；文件大小之和为字节数；回执率 = 已回执 ÷ 已上报（成功 + 失败 + 已回执）。',
    icon: 'ep:position'
  },
  {
    code: 'summary',
    title: '期次报送汇总统计',
    description: '按报送期次横向对比：任务完成率、报送批次、采集与脱敏批次',
    note: '口径：期次取 cr.collectPeriod 的期次列表；任务数与完成率同「报送进度统计」；报送批次数取 cr.submitStatus 的去重批次号；采集 / 脱敏批次数分别取 cr.importTask / cr.desensTask。',
    icon: 'ep:calendar'
  },
  // ↓ 以下三个查询是 2026-09-13 补的（需求文档「报送数据统计功能」章里口径偏薄的子项）
  {
    code: 'asof',
    title: '时点数据查询',
    description: '截止某个时间点，各机构各报表已经生成了多少数据（可导出）',
    note: '口径：取「报文生成时间 ≤ 所选时点」的报送报文（cr.submitStatus），按机构 × 报表汇总报文份数、数据行数与文件大小；待生成（状态 0）的报文不计入。时点留空表示取当前时间。这是"截至该时点已生成的报文"的口径，不是数据库闪回 —— 本 Demo 没有行级历史版本。',
    icon: 'ep:clock',
    filters: ['asOf']
  },
  {
    code: 'history',
    title: '历史数据查询',
    description: '已上报的数据按归档月份与机构汇总：迁入历史库的表数与数据量',
    note: '口径：本 Demo 没有真正的归档链路，「历史归档」视图由报送报文表（cr.submitStatus）派生 —— 只取已上报成功（3）与已回执（5）的报文，归档月份取上报时间的年月；按归档月份 × 机构汇总涉及报表数、数据行数与文件大小。可按归档月份（YYYY-MM）筛选，页面不提供"恢复归档数据"这类会改数据的动作。',
    icon: 'ep:folder-opened',
    filters: ['archiveMonth']
  },
  {
    code: 'metric',
    title: '评价指标查询',
    description: '校验出错率、业务总量、监管契合度三个总体评价指标',
    note: '口径（三个指标都按通行做法提案，附件文档该章只有小节标题）：① 校验出错率 = 校验错误条数（cr.checkResult 中错误级别 2 的记录）÷ 填报数据行数（cr.fillData），警告级不计入分子；② 业务总量 = 填报数据行数（条）；③ 监管契合度 = 已上报成功或已回执的报文数（状态 3 / 5）÷ 已生成报文数（状态 ≥ 1），衡量"生成了就送得出去"的程度。三个指标都不做加权综合评分 —— 权重是业务口径，Demo 不替用户拍板。',
    icon: 'ep:medal'
  }
] as const

export const StatCode = STAT_DEFS.map((item) => item.code)
export type StatCodeType = (typeof STAT_DEFS)[number]['code']

const TASK_DONE = TASK_STATUS.FINISHED
const TASK_RUNNING = [
  TASK_STATUS.FILLING,
  TASK_STATUS.WAIT_REVIEW,
  TASK_STATUS.REVIEW_PASSED,
  TASK_STATUS.WAIT_LOCAL_AUDIT,
  TASK_STATUS.WAIT_UPPER_AUDIT
]
const TASK_WAIT = [TASK_STATUS.PENDING_DISPATCH, TASK_STATUS.DISPATCHED]

const TASK_STATUS_LABEL: Record<number, string> = {
  [TASK_STATUS.PENDING_DISPATCH]: '待下发',
  [TASK_STATUS.DISPATCHED]: '已下发',
  [TASK_STATUS.FILLING]: '填报中',
  [TASK_STATUS.WAIT_REVIEW]: '待复核',
  [TASK_STATUS.REVIEW_PASSED]: '复核通过',
  [TASK_STATUS.REVIEW_REJECTED]: '复核不通过',
  [TASK_STATUS.WAIT_LOCAL_AUDIT]: '本级审核中',
  [TASK_STATUS.WAIT_UPPER_AUDIT]: '上级审核中',
  [TASK_STATUS.FINISHED]: '审核通过',
  [TASK_STATUS.RETURNED]: '已打回'
}

const CHANNEL_LABEL: Record<number, string> = {
  1: '系统直连',
  2: '文件导入',
  3: '接口推送',
  4: '手工录入'
}

const DESENS_STATUS_LABEL: Record<number, string> = {
  1: '执行中',
  2: '执行成功',
  3: '部分失败',
  4: '执行失败',
  5: '已还原',
  6: '待审核',
  7: '已驳回'
}

const round1 = (value: number) => Math.round(value * 10) / 10
const rate = (part: number, total: number) => (total ? round1((part / total) * 100) : 0)
const sum = (rows: Array<Record<string, any>>, field: string) =>
  rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0)

interface StatFilter {
  orgId: number
  reportId: number
  period: string
  orgName: string
  reportName: string
  /** 时点数据查询用：截止时点（'yyyy-MM-dd HH:mm:ss'，留空 = 当前时间） */
  asOf: string
  /** 历史数据查询用：归档月份（'yyyy-MM'，留空 = 全部） */
  archiveMonth: string
}

const matchFilter = (row: Record<string, any>, filter: StatFilter) =>
  (!filter.orgId || Number(row.orgId) === filter.orgId) &&
  (!filter.reportId || Number(row.reportId) === filter.reportId) &&
  (!filter.period || String(row.period) === filter.period)

const buildFilter = (params: Record<string, any>): StatFilter => {
  const orgId = Number(params.orgId || 0)
  const reportId = Number(params.reportId || 0)
  const period = String(params.period || '')
  const org = orgTable.get(orgId)
  const report = reportOptions().find((item) => Number(item.id) === reportId)
  return {
    orgId,
    reportId,
    period,
    orgName: org ? org.orgName : '',
    reportName: report ? report.reportName : '',
    asOf: String(params.asOf || ''),
    archiveMonth: String(params.archiveMonth || '')
  }
}

/** 时点归一化：页面给 'yyyy-MM-dd' 或 'yyyy-MM-dd HH:mm:ss'，统一补成后者再比大小 */
const asOfMoment = (asOf: string): string =>
  !asOf ? formatDateTime() : asOf.length <= 10 ? asOf + ' 23:59:59' : asOf

const filterTextOf = (filter: StatFilter) => {
  const parts = [
    filter.orgName || '全部机构',
    filter.reportName || '全部报表',
    filter.period || '全部期次'
  ]
  if (filter.asOf) parts.push('截止 ' + asOfMoment(filter.asOf))
  if (filter.archiveMonth) parts.push('归档月份 ' + filter.archiveMonth)
  return parts.join(' / ')
}

const branchOrgs = () =>
  orgTable
    .all()
    .filter((org) => org.orgLevel <= 2)
    .sort((a, b) => a.id - b.id)

/**
 * 按机构分组，但分组来源是「查询结果本身」而不是一份固定的机构清单。
 * 之前的写法用 branchOrgs() 生成表格行、用全量行数生成卡片，两边口径不同：
 * 卡片算进了不属于任何表格行的数据（例如三级机构、总公司），列求和与卡片对不上。
 * 现在行和卡片都从同一份匹配结果推导，卡片 = 列求和（恒等），谁也不会多算漏算。
 */
const groupByOrg = <T extends { orgId?: number }>(rows: T[]) =>
  Array.from(new Set(rows.map((row) => Number(row.orgId || 0)).filter((id) => !!id)))
    .sort((a, b) => a - b)
    .map((orgId) => ({ orgId, orgName: orgTable.get(orgId)?.orgName || '机构 ' + orgId }))

/* ==================================================================
 * 各查询的聚合实现
 * ================================================================== */

const progressStat = (filter: StatFilter) => {
  const tasks = crTaskTable.all().filter((row) => matchFilter(row, filter))
  const rows = groupByOrg(tasks)
    .map(({ orgId, orgName }) => {
      const own = tasks.filter((row) => Number(row.orgId) === orgId)
      const done = own.filter((row) => row.status === TASK_DONE).length
      return {
        orgName,
        taskCount: own.length,
        doneCount: done,
        runningCount: own.filter((row) => TASK_RUNNING.indexOf(row.status as never) >= 0).length,
        waitCount: own.filter((row) => TASK_WAIT.indexOf(row.status as never) >= 0).length,
        returnedCount: own.filter(
          (row) => row.status === TASK_STATUS.RETURNED || row.status === TASK_STATUS.REVIEW_REJECTED
        ).length,
        doneRate: rate(done, own.length)
      }
    })
    .filter((row) => row.taskCount > 0)
  const total = rows.reduce((acc, row) => acc + row.taskCount, 0)
  const done = rows.reduce((acc, row) => acc + row.doneCount, 0)
  return {
    columns: [
      { prop: 'orgName', label: '填报机构', minWidth: 180, align: 'left' as const },
      { prop: 'taskCount', label: '任务数', width: 100, align: 'right' as const },
      { prop: 'doneCount', label: '已完成', width: 100, align: 'right' as const },
      { prop: 'runningCount', label: '进行中', width: 100, align: 'right' as const },
      { prop: 'waitCount', label: '未开始', width: 100, align: 'right' as const },
      { prop: 'returnedCount', label: '已打回', width: 100, align: 'right' as const },
      { prop: 'doneRate', label: '完成率(%)', width: 110, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '任务总数', value: total, unit: '个' },
      { label: '已完成', value: done, unit: '个' },
      { label: '完成率', value: rate(done, total), unit: '%' },
      { label: '涉及机构', value: rows.length, unit: '个' }
    ],
    chart: {
      categories: rows.map((row) => row.orgName),
      series: [
        { name: '任务数', data: rows.map((row) => row.taskCount) },
        { name: '已完成', data: rows.map((row) => row.doneCount) }
      ]
    }
  }
}

const timelyStat = (filter: StatFilter) => {
  const records = crFillRecordTable.all().filter((row) => matchFilter(row, filter))
  const rows = groupByOrg(records)
    .map(({ orgId, orgName }) => {
      const own = records.filter((row) => Number(row.orgId) === orgId)
      const submitted = own.filter((row) => Number(row.fillStatus) === 2)
      const onTime = submitted.filter(
        (row) => row.deadline && row.submitTime && row.submitTime <= row.deadline + ' 23:59:59'
      ).length
      const late = submitted.length - onTime
      return {
        orgName,
        shouldReport: own.length,
        submitted: submitted.length,
        onTime,
        late,
        missing: own.length - submitted.length,
        onTimeRate: rate(onTime, own.length)
      }
    })
    .filter((row) => row.shouldReport > 0)
  const should = rows.reduce((acc, row) => acc + row.shouldReport, 0)
  const onTime = rows.reduce((acc, row) => acc + row.onTime, 0)
  const late = rows.reduce((acc, row) => acc + row.late, 0)
  return {
    columns: [
      { prop: 'orgName', label: '填报机构', minWidth: 180, align: 'left' as const },
      { prop: 'shouldReport', label: '应报(条)', width: 110, align: 'right' as const },
      { prop: 'onTime', label: '按时提交', width: 110, align: 'right' as const },
      { prop: 'late', label: '逾期提交', width: 110, align: 'right' as const },
      { prop: 'missing', label: '未提交', width: 110, align: 'right' as const },
      { prop: 'onTimeRate', label: '及时率(%)', width: 110, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '应报记录', value: should, unit: '条' },
      { label: '按时提交', value: onTime, unit: '条' },
      { label: '逾期提交', value: late, unit: '条', tip: '提交时间晚于该记录的报送截止日' },
      { label: '及时率', value: rate(onTime, should), unit: '%' }
    ],
    chart: {
      categories: rows.map((row) => row.orgName),
      series: [
        { name: '按时提交', data: rows.map((row) => row.onTime) },
        { name: '逾期提交', data: rows.map((row) => row.late) },
        { name: '未提交', data: rows.map((row) => row.missing) }
      ]
    }
  }
}

const taskStat = (filter: StatFilter) => {
  const tasks = crTaskTable.all().filter((row) => matchFilter(row, filter))
  const rows = Object.keys(TASK_STATUS_LABEL)
    .map((key) => Number(key))
    .map((status) => {
      const count = tasks.filter((row) => Number(row.status) === status).length
      return {
        statusLabel: TASK_STATUS_LABEL[status],
        count,
        percent: rate(count, tasks.length)
      }
    })
    .filter((row) => row.count > 0)
  return {
    columns: [
      { prop: 'statusLabel', label: '任务状态', minWidth: 160, align: 'left' as const },
      { prop: 'count', label: '任务数', width: 120, align: 'right' as const },
      { prop: 'percent', label: '占比(%)', width: 120, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '任务总数', value: tasks.length, unit: '个' },
      {
        label: '已完成',
        value: tasks.filter((row) => row.status === TASK_DONE).length,
        unit: '个'
      },
      {
        label: '待复核',
        value: tasks.filter((row) => row.status === TASK_STATUS.WAIT_REVIEW).length,
        unit: '个'
      },
      {
        label: '已打回',
        value: tasks.filter((row) => row.status === TASK_STATUS.RETURNED).length,
        unit: '个'
      }
    ],
    chart: {
      categories: rows.map((row) => row.statusLabel),
      series: [{ name: '任务数', data: rows.map((row) => row.count) }]
    }
  }
}

const volumeStat = (filter: StatFilter) => {
  const fills = crFillDataTable.all().filter((row) => matchFilter(row, filter))
  const records = crFillRecordTable.all().filter((row) => matchFilter(row, filter))
  // 「已入库」才计入导入行数：解析中 / 解析失败 / 待审核 / 已驳回的批次本来就没有入库行数
  const imports = importTaskTable
    .all()
    .filter((row) => matchFilter(row, filter) && Number(row.status) === 4)
  const groups = new Map<string, { orgName: string; reportName: string }>()
  records.forEach((row) =>
    groups.set(row.orgId + '|' + row.reportId, { orgName: row.orgName, reportName: row.reportName })
  )
  fills.forEach((row) =>
    groups.set(row.orgId + '|' + row.reportId, { orgName: row.orgName, reportName: row.reportName })
  )
  // 只有导入、没有填报记录的「机构 × 报表」也要成行：
  // 不然卡片把它们的行数算进去、表格里却找不到这一行（卡片 204 vs 列求和 176）。
  imports.forEach((row) =>
    groups.set(row.orgId + '|' + row.reportId, { orgName: row.orgName, reportName: row.reportName })
  )
  const rows = Array.from(groups.entries())
    .map(([key, meta]) => {
      const [orgId, reportId] = key.split('|').map(Number)
      const fillRows = fills.filter(
        (row) => Number(row.orgId) === orgId && Number(row.reportId) === reportId
      ).length
      const importRows = imports
        .filter((row) => Number(row.orgId) === orgId && Number(row.reportId) === reportId)
        .reduce((acc, row) => acc + (Number(row.writtenRows) || 0), 0)
      const recordCount = records.filter(
        (row) => Number(row.orgId) === orgId && Number(row.reportId) === reportId
      ).length
      return {
        orgName: meta.orgName,
        reportName: meta.reportName,
        recordCount,
        fillRows,
        importRows,
        diff: fillRows - importRows
      }
    })
    .sort((a, b) => b.fillRows - a.fillRows)
  return {
    columns: [
      { prop: 'orgName', label: '机构', minWidth: 160, align: 'left' as const },
      { prop: 'reportName', label: '报表', minWidth: 200, align: 'left' as const },
      { prop: 'recordCount', label: '填报记录数', width: 120, align: 'right' as const },
      { prop: 'fillRows', label: '填报行数', width: 110, align: 'right' as const },
      { prop: 'importRows', label: '导入入库行数', width: 130, align: 'right' as const },
      { prop: 'diff', label: '差额', width: 100, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '填报总行数', value: rows.reduce((acc, row) => acc + row.fillRows, 0), unit: '行' },
      {
        label: '导入入库行数',
        value: rows.reduce((acc, row) => acc + row.importRows, 0),
        unit: '行'
      },
      {
        label: '填报记录数',
        value: rows.reduce((acc, row) => acc + row.recordCount, 0),
        unit: '条'
      },
      { label: '覆盖机构报表', value: rows.length, unit: '组' }
    ],
    chart: {
      categories: rows.slice(0, 10).map((row) => row.orgName + ' / ' + row.reportName.slice(0, 6)),
      series: [
        { name: '填报行数', data: rows.slice(0, 10).map((row) => row.fillRows) },
        { name: '导入入库行数', data: rows.slice(0, 10).map((row) => row.importRows) }
      ]
    }
  }
}

const checkStat = (filter: StatFilter) => {
  const issues = crCheckResultTable.all().filter((row) => matchFilter(row, filter))
  const rows = groupByOrg(issues)
    .map(({ orgId, orgName }) => {
      const own = issues.filter((row) => Number(row.orgId) === orgId)
      const handled = own.filter((row) => row.handled).length
      return {
        orgName,
        total: own.length,
        errorCount: own.filter((row) => Number(row.errorLevel) === 2).length,
        warnCount: own.filter((row) => Number(row.errorLevel) === 1).length,
        handled,
        pending: own.length - handled,
        handleRate: rate(handled, own.length)
      }
    })
    .filter((row) => row.total > 0)
  const total = rows.reduce((acc, row) => acc + row.total, 0)
  const handled = rows.reduce((acc, row) => acc + row.handled, 0)
  return {
    columns: [
      { prop: 'orgName', label: '机构', minWidth: 180, align: 'left' as const },
      { prop: 'total', label: '问题总数', width: 110, align: 'right' as const },
      { prop: 'errorCount', label: '错误', width: 100, align: 'right' as const },
      { prop: 'warnCount', label: '警告', width: 100, align: 'right' as const },
      { prop: 'handled', label: '已处理', width: 100, align: 'right' as const },
      { prop: 'pending', label: '未处理', width: 100, align: 'right' as const },
      { prop: 'handleRate', label: '处理率(%)', width: 110, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '问题总数', value: total, unit: '个' },
      {
        label: '错误',
        value: rows.reduce((acc, row) => acc + row.errorCount, 0),
        unit: '个'
      },
      {
        label: '警告',
        value: rows.reduce((acc, row) => acc + row.warnCount, 0),
        unit: '个'
      },
      { label: '处理率', value: rate(handled, total), unit: '%' }
    ],
    chart: {
      categories: rows.map((row) => row.orgName),
      series: [
        { name: '错误', data: rows.map((row) => row.errorCount) },
        { name: '警告', data: rows.map((row) => row.warnCount) }
      ]
    }
  }
}

const rejectStat = (filter: StatFilter) => {
  const rows0 = crTaskReturnTable.all()
  const tasks = crTaskTable.all().filter((row) => matchFilter(row, filter))
  const taskIds = tasks.map((task) => task.id)
  // 打回记录自己没有 orgId：用「任务 → 机构」映射还原归属。
  // 之前用 row.orgName === org.orgName 比中文字符串，机构一改名 / 重名就会串行，而且只覆盖 branchOrgs。
  const orgIdOfTask = new Map(tasks.map((task) => [Number(task.id), Number(task.orgId || 0)]))
  const returns = rows0
    .filter((row) => taskIds.indexOf(Number(row.taskId)) >= 0)
    .map((row) => ({ ...row, orgId: orgIdOfTask.get(Number(row.taskId)) || 0 }))
  const rows = groupByOrg(returns)
    .map(({ orgId, orgName }) => {
      const own = returns.filter((row) => Number(row.orgId) === orgId)
      const processed = own.filter((row) => row.processed).length
      return {
        orgName,
        returnCount: own.length,
        processed,
        pending: own.length - processed,
        handleRate: rate(processed, own.length)
      }
    })
    .filter((row) => row.returnCount > 0)
  const processed = rows.reduce((acc, row) => acc + row.processed, 0)
  const stageGroups = new Map<string, number>()
  returns.forEach((row) => stageGroups.set(row.stage, (stageGroups.get(row.stage) || 0) + 1))
  return {
    columns: [
      { prop: 'orgName', label: '机构', minWidth: 180, align: 'left' as const },
      { prop: 'returnCount', label: '打回次数', width: 110, align: 'right' as const },
      { prop: 'pending', label: '待处理', width: 100, align: 'right' as const },
      { prop: 'processed', label: '已处理', width: 100, align: 'right' as const },
      { prop: 'handleRate', label: '处理率(%)', width: 110, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '打回次数', value: rows.reduce((acc, row) => acc + row.returnCount, 0), unit: '次' },
      { label: '待处理', value: rows.reduce((acc, row) => acc + row.pending, 0), unit: '次' },
      { label: '已处理', value: processed, unit: '次' },
      { label: '涉及机构', value: rows.length, unit: '个' }
    ],
    chart: {
      categories: Array.from(stageGroups.keys()),
      series: [{ name: '打回次数', data: Array.from(stageGroups.values()) }]
    }
  }
}

const importStat = (filter: StatFilter) => {
  const batches = importTaskTable.all().filter((row) => matchFilter(row, filter))
  const rows = Object.keys(CHANNEL_LABEL)
    .map((key) => Number(key))
    .map((channel) => {
      const own = batches.filter((row) => Number(row.sourceType) === channel)
      const totalRows = sum(own, 'totalRows')
      return {
        channelLabel: CHANNEL_LABEL[channel],
        batchCount: own.length,
        totalRows,
        successRows: sum(own, 'successRows'),
        failRows: sum(own, 'failRows'),
        writtenRows: sum(own, 'writtenRows'),
        successRate: rate(sum(own, 'successRows'), totalRows)
      }
    })
    .filter((row) => row.batchCount > 0)
  return {
    columns: [
      { prop: 'channelLabel', label: '采集渠道', minWidth: 140, align: 'left' as const },
      { prop: 'batchCount', label: '批次数', width: 100, align: 'right' as const },
      { prop: 'totalRows', label: '总行数', width: 110, align: 'right' as const },
      { prop: 'successRows', label: '成功行数', width: 110, align: 'right' as const },
      { prop: 'failRows', label: '失败行数', width: 110, align: 'right' as const },
      { prop: 'writtenRows', label: '入库行数', width: 110, align: 'right' as const },
      { prop: 'successRate', label: '成功率(%)', width: 110, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '批次数', value: batches.length, unit: '个' },
      { label: '总行数', value: sum(batches, 'totalRows'), unit: '行' },
      { label: '入库行数', value: sum(batches, 'writtenRows'), unit: '行' },
      {
        label: '解析失败批次',
        value: batches.filter((row) => Number(row.status) === 2).length,
        unit: '个'
      }
    ],
    chart: {
      categories: rows.map((row) => row.channelLabel),
      series: [
        { name: '批次数', data: rows.map((row) => row.batchCount) },
        { name: '入库行数', data: rows.map((row) => row.writtenRows) }
      ]
    }
  }
}

const desensStat = (filter: StatFilter) => {
  const batches = crDesensTaskTable.all().filter((row) => matchFilter(row, filter))
  const rows = Object.keys(DESENS_STATUS_LABEL)
    .map((key) => Number(key))
    .map((status) => {
      const own = batches.filter((row) => Number(row.status) === status)
      return {
        statusLabel: DESENS_STATUS_LABEL[status],
        batchCount: own.length,
        totalRows: sum(own, 'totalRows'),
        maskedRows: sum(own, 'maskedRows'),
        avgCost: own.length ? Math.round(sum(own, 'cost') / own.length) : 0
      }
    })
    .filter((row) => row.batchCount > 0)
  const executed = batches.filter((row) => [1, 2, 3, 4].indexOf(Number(row.status)) >= 0)
  return {
    columns: [
      { prop: 'statusLabel', label: '批次状态', minWidth: 140, align: 'left' as const },
      { prop: 'batchCount', label: '批次数', width: 100, align: 'right' as const },
      { prop: 'totalRows', label: '涉及行数', width: 110, align: 'right' as const },
      { prop: 'maskedRows', label: '改写字段值', width: 120, align: 'right' as const },
      { prop: 'avgCost', label: '平均耗时(ms)', width: 130, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '批次数', value: batches.length, unit: '个' },
      { label: '已执行批次', value: executed.length, unit: '个' },
      { label: '累计改写字段值', value: sum(executed, 'maskedRows'), unit: '个' },
      {
        label: '待审核',
        value: batches.filter((row) => Number(row.status) === 6).length,
        unit: '个'
      }
    ],
    chart: {
      categories: rows.map((row) => row.statusLabel),
      series: [{ name: '改写字段值', data: rows.map((row) => row.maskedRows) }]
    }
  }
}

const submitStat = (filter: StatFilter) => {
  const files = crSubmitStatusTable.all().filter((row) => matchFilter(row, filter))
  const rows = groupByOrg(files)
    .map(({ orgId, orgName }) => {
      const own = files.filter((row) => Number(row.orgId) === orgId)
      // 口径以查询说明为准：上报成功 = 状态 3；已回执（5）单列，不重复计入成功
      const success = own.filter((row) => row.submitStatus === SUBMIT_STATUS.SUCCESS).length
      const failed = own.filter((row) => row.submitStatus === SUBMIT_STATUS.FAILED).length
      const receipted = own.filter((row) => row.submitStatus === SUBMIT_STATUS.RECEIPTED).length
      const reported = own.filter(
        (row) =>
          [SUBMIT_STATUS.SUCCESS, SUBMIT_STATUS.FAILED, SUBMIT_STATUS.RECEIPTED].indexOf(
            row.submitStatus as never
          ) >= 0
      ).length
      return {
        orgName,
        fileCount: own.length,
        dataRows: sum(own, 'dataRows'),
        fileSize: sum(own, 'fileSize'),
        success,
        failed,
        pending: own.length - reported,
        receipted,
        receiptRate: rate(receipted, reported)
      }
    })
    .filter((row) => row.fileCount > 0)
  const reported = rows.reduce((acc, row) => acc + row.success + row.failed + row.receipted, 0)
  const receipted = rows.reduce((acc, row) => acc + row.receipted, 0)
  return {
    columns: [
      { prop: 'orgName', label: '机构', minWidth: 180, align: 'left' as const },
      { prop: 'fileCount', label: '报文数', width: 100, align: 'right' as const },
      { prop: 'dataRows', label: '数据行数', width: 110, align: 'right' as const },
      { prop: 'fileSize', label: '文件大小(字节)', width: 140, align: 'right' as const },
      { prop: 'success', label: '上报成功', width: 110, align: 'right' as const },
      { prop: 'failed', label: '上报失败', width: 110, align: 'right' as const },
      { prop: 'pending', label: '待上报', width: 100, align: 'right' as const },
      { prop: 'receipted', label: '已回执', width: 100, align: 'right' as const },
      { prop: 'receiptRate', label: '回执率(%)', width: 110, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '报文数', value: rows.reduce((acc, row) => acc + row.fileCount, 0), unit: '个' },
      { label: '上报成功', value: rows.reduce((acc, row) => acc + row.success, 0), unit: '个' },
      { label: '上报失败', value: rows.reduce((acc, row) => acc + row.failed, 0), unit: '个' },
      { label: '已回执', value: receipted, unit: '个' },
      { label: '回执率', value: rate(receipted, reported), unit: '%' }
    ],
    chart: {
      categories: rows.map((row) => row.orgName),
      series: [
        { name: '上报成功', data: rows.map((row) => row.success) },
        { name: '上报失败', data: rows.map((row) => row.failed) },
        { name: '待上报', data: rows.map((row) => row.pending) }
      ]
    }
  }
}

const summaryStat = (filter: StatFilter) => {
  const tasks = crTaskTable.all().filter((row) => matchFilter(row, filter))
  const periods = collectPeriodTable
    .all()
    .map((row) => row.period)
    .concat(PERIODS)
    .filter((period, index, list) => list.indexOf(period) === index)
    .sort()
    .reverse()
    .filter((period) => !filter.period || period === filter.period)
  const rows = periods.map((period) => {
    const ownTasks = tasks.filter((row) => String(row.period) === period)
    const done = ownTasks.filter((row) => row.status === TASK_DONE).length
    // 报表 / 机构筛选必须同时作用于报文、采集、脱敏：
    // 之前这三列只按期次过滤，选了「某张报表」后它们仍是全部报表的合计，与任务列口径不一致。
    const files = crSubmitStatusTable
      .all()
      .filter((row) => matchFilter(row, filter) && String(row.period) === period)
    const batches = new Set(files.map((row) => row.batchNo).filter(Boolean))
    return {
      period,
      taskCount: ownTasks.length,
      doneCount: done,
      doneRate: rate(done, ownTasks.length),
      batchCount: batches.size,
      fileCount: files.length,
      importCount: importTaskTable
        .all()
        .filter((row) => matchFilter(row, filter) && String(row.period) === period).length,
      desensCount: crDesensTaskTable
        .all()
        .filter((row) => matchFilter(row, filter) && String(row.period) === period).length
    }
  })
  return {
    columns: [
      { prop: 'period', label: '报送期次', width: 120, align: 'left' as const },
      { prop: 'taskCount', label: '任务数', width: 100, align: 'right' as const },
      { prop: 'doneCount', label: '已完成', width: 100, align: 'right' as const },
      { prop: 'doneRate', label: '完成率(%)', width: 110, align: 'right' as const },
      { prop: 'batchCount', label: '报送批次', width: 100, align: 'right' as const },
      { prop: 'fileCount', label: '报文数', width: 100, align: 'right' as const },
      { prop: 'importCount', label: '采集批次', width: 100, align: 'right' as const },
      { prop: 'desensCount', label: '脱敏批次', width: 100, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '期次数', value: rows.length, unit: '个' },
      { label: '当前期次', value: PERIODS[PERIODS.length - 1] },
      { label: '任务总数', value: rows.reduce((acc, row) => acc + row.taskCount, 0), unit: '个' },
      { label: '报文总数', value: rows.reduce((acc, row) => acc + row.fileCount, 0), unit: '个' }
    ],
    chart: {
      categories: rows.map((row) => row.period),
      series: [
        { name: '任务数', data: rows.map((row) => row.taskCount) },
        { name: '已完成', data: rows.map((row) => row.doneCount) }
      ]
    }
  }
}

/* ---------- 时点数据查询（截至某时点已生成的报文） ---------- */
const asofStat = (filter: StatFilter) => {
  const moment = asOfMoment(filter.asOf)
  const matched = crSubmitStatusTable.all().filter((row) => {
    // 待生成的报文还没有数据，不参与"截至时点已有多少数据"的统计
    if (Number(row.submitStatus) === SUBMIT_STATUS.WAIT_GENERATE) return false
    if (!row.generateTime) return false
    if (String(row.generateTime) > moment) return false
    return matchFilter(row, filter)
  })
  const bucket = new Map<
    string,
    {
      orgName: string
      reportName: string
      messageCount: number
      dataRows: number
      fileSize: number
    }
  >()
  matched.forEach((row) => {
    const key = row.orgId + '-' + row.reportId
    const hit = bucket.get(key) || {
      orgName: row.orgName,
      reportName: row.reportName,
      messageCount: 0,
      dataRows: 0,
      fileSize: 0
    }
    hit.messageCount += 1
    hit.dataRows += Number(row.dataRows) || 0
    hit.fileSize += Number(row.fileSize) || 0
    bucket.set(key, hit)
  })
  const rows = Array.from(bucket.values())
    .sort((a, b) => b.dataRows - a.dataRows || a.orgName.localeCompare(b.orgName))
    .map((row) => ({ ...row, fileSizeKb: round1(row.fileSize / 1024) }))
  const totalRows = rows.reduce((acc, row) => acc + row.dataRows, 0)
  const totalBytes = rows.reduce((acc, row) => acc + row.fileSize, 0)
  const orgs = Array.from(new Set(matched.map((row) => row.orgName)))
  // 图表按机构汇总（表格是"机构 × 报表"，图表上摊到机构一层更好读）
  const chartByOrg = new Map<string, number>()
  rows.forEach((row) =>
    chartByOrg.set(row.orgName, (chartByOrg.get(row.orgName) || 0) + row.dataRows)
  )
  return {
    columns: [
      { prop: 'orgName', label: '机构', minWidth: 180, align: 'left' as const },
      { prop: 'reportName', label: '报表', minWidth: 200, align: 'left' as const },
      { prop: 'messageCount', label: '报文份数', width: 100, align: 'right' as const },
      { prop: 'dataRows', label: '数据行数', width: 120, align: 'right' as const },
      { prop: 'fileSizeKb', label: '文件大小(KB)', width: 130, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '截止时点', value: moment, tip: '只统计这个时间点之前已生成的报文' },
      {
        label: '报文份数',
        value: rows.reduce((acc, row) => acc + row.messageCount, 0),
        unit: '份'
      },
      { label: '数据行数', value: totalRows, unit: '行' },
      { label: '文件大小', value: round1(totalBytes / 1024 / 1024), unit: 'MB' },
      { label: '涉及机构', value: orgs.length, unit: '个' }
    ],
    chart: {
      categories: Array.from(chartByOrg.keys()),
      series: [{ name: '数据行数', data: Array.from(chartByOrg.values()) }]
    }
  }
}

/* ---------- 历史数据查询（由报送报文派生的"历史归档"视图） ---------- */
const historyStat = (filter: StatFilter) => {
  const ARCHIVED = [SUBMIT_STATUS.SUCCESS, SUBMIT_STATUS.RECEIPTED]
  const matched = crSubmitStatusTable.all().filter((row) => {
    if (ARCHIVED.indexOf(Number(row.submitStatus) as never) < 0) return false
    // 归档时间取上报时间：没有上报时间的记录谈不上"迁入历史库"
    if (!row.submitTime) return false
    if (filter.archiveMonth && row.submitTime.slice(0, 7) !== filter.archiveMonth) return false
    return matchFilter(row, filter)
  })
  const bucket = new Map<
    string,
    {
      archiveMonth: string
      orgName: string
      reports: Set<string>
      recordCount: number
      fileSize: number
    }
  >()
  matched.forEach((row) => {
    const month = row.submitTime.slice(0, 7)
    const key = month + '-' + row.orgId
    const hit = bucket.get(key) || {
      archiveMonth: month,
      orgName: row.orgName,
      reports: new Set<string>(),
      recordCount: 0,
      fileSize: 0
    }
    hit.reports.add(row.reportCode || row.reportName)
    hit.recordCount += Number(row.dataRows) || 0
    hit.fileSize += Number(row.fileSize) || 0
    bucket.set(key, hit)
  })
  const rows = Array.from(bucket.values())
    .sort((a, b) =>
      a.archiveMonth < b.archiveMonth
        ? 1
        : a.archiveMonth > b.archiveMonth
          ? -1
          : a.orgName.localeCompare(b.orgName)
    )
    .map((row) => ({
      archiveMonth: row.archiveMonth,
      orgName: row.orgName,
      reportCount: row.reports.size,
      recordCount: row.recordCount,
      fileSizeKb: round1(row.fileSize / 1024)
    }))
  const months = Array.from(new Set(rows.map((row) => row.archiveMonth))).sort()
  const monthRows = months.map((month) => ({
    month,
    recordCount: rows
      .filter((row) => row.archiveMonth === month)
      .reduce((acc, row) => acc + row.recordCount, 0)
  }))
  return {
    columns: [
      { prop: 'archiveMonth', label: '归档月份', width: 120, align: 'center' as const },
      { prop: 'orgName', label: '机构', minWidth: 180, align: 'left' as const },
      { prop: 'reportCount', label: '涉及报表数', width: 120, align: 'right' as const },
      { prop: 'recordCount', label: '归档记录数', width: 130, align: 'right' as const },
      { prop: 'fileSizeKb', label: '文件大小(KB)', width: 130, align: 'right' as const }
    ],
    rows,
    summary: [
      {
        label: '归档报文',
        value: matched.length,
        unit: '份',
        tip: '已上报成功 / 已回执的报文（归档时间取上报时间）'
      },
      {
        label: '归档记录数',
        value: rows.reduce((acc, row) => acc + row.recordCount, 0),
        unit: '行'
      },
      {
        label: '文件大小',
        value: round1(rows.reduce((acc, row) => acc + row.fileSizeKb, 0) / 1024),
        unit: 'MB'
      },
      { label: '覆盖月份', value: months.length, unit: '个' },
      { label: '涉及机构', value: new Set(rows.map((row) => row.orgName)).size, unit: '个' }
    ],
    chart: {
      categories: monthRows.map((row) => row.month),
      series: [{ name: '归档记录数', data: monthRows.map((row) => row.recordCount) }]
    }
  }
}

/* ---------- 评价指标查询（校验出错率 / 业务总量 / 监管契合度） ---------- */
const metricStat = (filter: StatFilter) => {
  const fillRows = crFillDataTable.all().filter((row) => matchFilter(row, filter))
  const errors = crCheckResultTable
    .all()
    .filter((row) => matchFilter(row, filter) && Number(row.errorLevel) === 2)
  const generated = crSubmitStatusTable
    .all()
    .filter(
      (row) => matchFilter(row, filter) && Number(row.submitStatus) >= SUBMIT_STATUS.GENERATED
    )
  const delivered = generated.filter(
    (row) =>
      Number(row.submitStatus) === SUBMIT_STATUS.SUCCESS ||
      Number(row.submitStatus) === SUBMIT_STATUS.RECEIPTED
  )
  const rows = groupByOrg([...fillRows, ...errors, ...generated])
    .map(({ orgId, orgName }) => {
      const fill = fillRows.filter((row) => Number(row.orgId) === orgId).length
      const error = errors.filter((row) => Number(row.orgId) === orgId).length
      const own = generated.filter((row) => Number(row.orgId) === orgId)
      const hit = delivered.filter((row) => Number(row.orgId) === orgId).length
      return {
        orgName,
        fillRows: fill,
        errorCount: error,
        errorRate: rate(error, fill),
        generatedCount: own.length,
        deliveredCount: hit,
        fitRate: rate(hit, own.length)
      }
    })
    .filter((row) => row.fillRows > 0 || row.generatedCount > 0)
    .sort((a, b) => b.fitRate - a.fitRate || a.errorRate - b.errorRate)
  const totalFill = rows.reduce((acc, row) => acc + row.fillRows, 0)
  const totalError = rows.reduce((acc, row) => acc + row.errorCount, 0)
  const totalGenerated = rows.reduce((acc, row) => acc + row.generatedCount, 0)
  const totalDelivered = rows.reduce((acc, row) => acc + row.deliveredCount, 0)
  return {
    columns: [
      { prop: 'orgName', label: '机构', minWidth: 180, align: 'left' as const },
      { prop: 'fillRows', label: '业务总量(条)', width: 130, align: 'right' as const },
      { prop: 'errorCount', label: '校验错误', width: 110, align: 'right' as const },
      { prop: 'errorRate', label: '校验出错率(%)', width: 140, align: 'right' as const },
      { prop: 'generatedCount', label: '已生成报文', width: 120, align: 'right' as const },
      { prop: 'deliveredCount', label: '已上报/回执', width: 130, align: 'right' as const },
      { prop: 'fitRate', label: '监管契合度(%)', width: 140, align: 'right' as const }
    ],
    rows,
    summary: [
      { label: '业务总量', value: totalFill, unit: '条', tip: '填报数据行数（cr.fillData）' },
      {
        label: '校验出错率',
        value: rate(totalError, totalFill),
        unit: '%',
        tip: '错误级别为「错误」的校验问题 ÷ 填报数据行数'
      },
      {
        label: '监管契合度',
        value: rate(totalDelivered, totalGenerated),
        unit: '%',
        tip: '已上报成功 / 已回执的报文 ÷ 已生成报文（状态 ≥ 1）'
      },
      { label: '校验错误数', value: totalError, unit: '条' },
      { label: '涉及机构', value: rows.length, unit: '个' }
    ],
    chart: {
      categories: rows.map((row) => row.orgName),
      series: [
        { name: '校验出错率(%)', data: rows.map((row) => row.errorRate) },
        { name: '监管契合度(%)', data: rows.map((row) => row.fitRate) }
      ]
    }
  }
}

const IMPLS: Record<string, (filter: StatFilter) => any> = {
  progress: progressStat,
  timely: timelyStat,
  task: taskStat,
  volume: volumeStat,
  check: checkStat,
  reject: rejectStat,
  import: importStat,
  desens: desensStat,
  submit: submitStat,
  summary: summaryStat,
  asof: asofStat,
  history: historyStat,
  metric: metricStat
}

/** 统一出口：页面只要拿到 code + 筛选条件，就能渲染出完整的一张统计表 */
export const statPayload = (code: string, params: Record<string, any> = {}): StatPayload => {
  const def = STAT_DEFS.find((item) => item.code === code)
  if (!def) throw new Error('统计查询不存在：' + code)
  const impl = IMPLS[code]
  if (!impl) throw new Error('统计查询尚未实现：' + code)
  const filter = buildFilter(params)
  const result = impl(filter)
  return {
    code: def.code,
    title: def.title,
    description: def.description,
    note: def.note,
    generatedAt: formatDateTime(),
    columns: result.columns,
    rows: result.rows,
    summary: result.summary,
    chart: result.chart,
    filterText: filterTextOf(filter)
  }
}

/** 统计口径的期次 / 机构 / 报表下拉（页面筛选栏用） */
export const statFilterOptions = () => ({
  orgs: branchOrgs().map((org) => ({ id: org.id, orgName: org.orgName })),
  reports: reportOptions().map((report) => ({
    id: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName
  })),
  periods: collectPeriodTable
    .all()
    .map((row) => row.period)
    .concat(PERIODS)
    .filter((period, index, list) => list.indexOf(period) === index)
    .sort()
    .reverse()
})
