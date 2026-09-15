/**
 * Mock Handler — 数据查询域（/cr-query 三个页面）
 *
 * | 页面           | 接口前缀                    |
 * | -------------- | --------------------------- |
 * | 报表状态查询   | /cr/query-status            |
 * | 我的任务       | /cr/query-my-task           |
 * | 综合查询       | /cr/query-comprehensive     |
 * | 查询共用下拉   | /cr/query-common（机构/期次）|
 *
 * 报表清单复用 cr.ts 已注册的 /cr/common/report-options，保证口径一致。
 */
import { currentUser } from './auth'
import { onGet, onPost } from '../route'
import { registerResource } from '../resource'
import { csvBlob, formatDateTime, isEmpty, likeAny, paginate } from '../util'
import { BRANCH_NAMES, PERIOD, PERIODS, reportOrgs, reportOptions } from '../db/crCommon'
import {
  crMyTaskTable,
  crReportRemarkTable,
  crReportDataTable,
  crReportStatusTable,
  crDataTraceTable,
  type QueryReportStatusRow
} from '../db/crQuery'

/* ==================================================================
 * 公共工具
 * ================================================================== */

/** 参数可能是数组（axios config.params）或逗号分隔字符串（URL query） */
const toArray = (value: any): string[] => {
  if (isEmpty(value)) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.map((item) => String(item).trim()).filter(Boolean)
}

const branchOrgs = () => reportOrgs().filter((org) => BRANCH_NAMES.includes(org.orgName))

const allReports = () => reportOptions()

const findOrg = (orgId: any) => branchOrgs().find((org) => String(org.id) === String(orgId))

const findReport = (reportId: any) =>
  allReports().find((report) => String(report.id) === String(reportId))

/** 去年同期期次：202608 → 202508 */
const lastYearPeriod = (period: string) => `${Number(period.slice(0, 4)) - 1}${period.slice(4, 6)}`

/** 同比 / 环比：(本期 - 对比期) / 对比期；除数为 0 或缺失时返回 null（页面显示 -） */
const ratio = (current?: number | null, base?: number | null): number | null => {
  if (current === null || current === undefined || !base) return null
  return Math.round(((current - base) / base) * 10000) / 100
}

/** 填报状态 / 校验状态 / 报送状态的中文名（导出用，字典口径见 src/mock/db/dict.ts） */
const FILL_STATUS_NAME: Record<number, string> = { 0: '未填报', 1: '填报中', 2: '已提交' }
const CHECK_STATUS_NAME: Record<number, string> = {
  0: '未校验',
  1: '校验中',
  2: '校验通过',
  3: '校验不通过'
}
const SUBMIT_STATUS_NAME: Record<number, string> = { 0: '未报送', 1: '报送中', 2: '已报送' }

/** 校验规则（报表状态抽屉里的校验问题清单） */
const CHECK_RULES = [
  { ruleCode: 'R-CR-001', ruleName: '保单号必填校验', level: 1, description: '保单号不可为空' },
  { ruleCode: 'R-CR-014', ruleName: '保费金额值域校验', level: 1, description: '保费金额应大于 0' },
  {
    ruleCode: 'R-CR-022',
    ruleName: '证件号码脱敏校验',
    level: 2,
    description: '证件号码须按监管要求脱敏'
  },
  {
    ruleCode: 'R-CR-031',
    ruleName: '跨表一致性校验（保费-缴费）',
    level: 1,
    description: '保费收入与缴费金额应一致'
  },
  {
    ruleCode: 'R-CR-045',
    ruleName: '职业编码枚举校验',
    level: 2,
    description: '职业编码须在监管码值范围内'
  }
]

/** 环境名称：字典 cr_error_level 为 1 错误 / 2 警告 */
const ERROR_LEVEL_NAME: Record<number, string> = { 1: '错误', 2: '警告' }

/* ==================================================================
 * 查询共用下拉
 * ================================================================== */
onGet('/cr/query-common/period-options', () => PERIODS)

onGet('/cr/query-common/org-options', () =>
  branchOrgs().map((org) => ({ id: org.id, orgCode: org.orgCode, orgName: org.orgName }))
)

/* ==================================================================
 * 一、报表状态查询
 * ================================================================== */
const statusFilter = (row: QueryReportStatusRow, params: Record<string, any>) => {
  const orgIds = toArray(params.orgIds)
  if (!isEmpty(params.period) && String(row.period) !== String(params.period)) return false
  if (orgIds.length && !orgIds.includes(String(row.orgId))) return false
  if (!isEmpty(params.orgId) && String(row.orgId) !== String(params.orgId)) return false
  if (!isEmpty(params.reportId) && String(row.reportId) !== String(params.reportId)) return false
  if (!isEmpty(params.fillStatus) && Number(row.fillStatus) !== Number(params.fillStatus)) {
    return false
  }
  if (!isEmpty(params.checkStatus) && Number(row.checkStatus) !== Number(params.checkStatus)) {
    return false
  }
  if (!isEmpty(params.submitStatus) && Number(row.submitStatus) !== Number(params.submitStatus)) {
    return false
  }
  return likeAny(row, ['reportCode', 'reportName', 'orgName'], params.keyword)
}

registerResource({
  prefix: '/cr/query-status',
  table: crReportStatusTable,
  sort: (a, b) => a.orgId - b.orgId || a.reportId - b.reportId,
  filter: statusFilter
})

/** 小结卡片：应报报表数 / 已填报 / 已校验通过 / 已报送 */
onGet('/cr/query-status/summary', (ctx) => {
  const rows = crReportStatusTable.all().filter((row) => statusFilter(row, ctx.params))
  return {
    shouldReport: rows.length,
    filled: rows.filter((row) => Number(row.fillStatus) === 2).length,
    checked: rows.filter((row) => Number(row.checkStatus) === 2).length,
    submitted: rows.filter((row) => Number(row.submitStatus) === 2).length
  }
})

/** 导出（中文表头，状态列转成字典文案） */
onGet('/cr/query-status/export-excel', (ctx) => {
  const rows = crReportStatusTable
    .all()
    .filter((row) => statusFilter(row, ctx.params))
    .map((row) => ({
      ...row,
      fillStatusName: FILL_STATUS_NAME[Number(row.fillStatus)] || '',
      checkStatusName: CHECK_STATUS_NAME[Number(row.checkStatus)] || '',
      submitStatusName: SUBMIT_STATUS_NAME[Number(row.submitStatus)] || ''
    }))
  return csvBlob(rows, [
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'fillStatusName', label: '填报状态' },
    { field: 'checkStatusName', label: '校验状态' },
    { field: 'submitStatusName', label: '报送状态' },
    { field: 'dataRows', label: '数据行数' },
    { field: 'lastModifier', label: '最后修改人' },
    { field: 'lastModifyTime', label: '最后修改时间' }
  ])
})

/** 抽屉明细：报表状态 + 数据表拆分 + 校验问题 + 处理轨迹 + 备注 */
onGet('/cr/query-status/detail', (ctx) => {
  const orgId = ctx.params.orgId
  const reportId = ctx.params.reportId
  const period = String(ctx.params.period || PERIOD)
  const row = crReportStatusTable.findOne(
    (item) =>
      String(item.orgId) === String(orgId) &&
      String(item.reportId) === String(reportId) &&
      String(item.period) === period
  )
  if (!row) throw new Error('未找到该机构该报表的报送记录')
  const report = findReport(reportId)
  const baseRows = Number(row.dataRows) || 0

  // 数据表拆分：主表占 70%，明细表 20%，变更表 10%
  const tables = report
    ? [
        { tableCode: 'T-MAIN', cnName: report.reportName, share: 0.7 },
        { tableCode: 'T-DETAIL', cnName: `${report.subjectName}明细表`, share: 0.2 },
        { tableCode: 'T-LOG', cnName: `${report.subjectName}变更表`, share: 0.1 }
      ].map((table, index) => ({
        tableCode: table.tableCode,
        tableName: `${report.reportCode}_${table.tableCode.replace('T-', '')}`,
        cnName: table.cnName,
        subjectName: report.subjectName,
        rows: Math.round(baseRows * table.share),
        lastSyncTime: `2026-09-0${1 + index} 0${2 + index}:${String(13 * (index + 1)).padStart(2, '0')}:00`
      }))
    : []

  // 校验问题：按校验状态给出不同口径
  const checkStatus = Number(row.checkStatus)
  const issues =
    checkStatus === 3
      ? CHECK_RULES.slice(0, 3).map((rule, index) => ({
          ...rule,
          levelName: ERROR_LEVEL_NAME[rule.level] || '',
          affectRows: [26, 8, 132][index],
          status: index === 0 ? '待处理' : '处理中',
          foundTime: `2026-09-${String(2 + index).padStart(2, '0')} 1${index}:2${index}:00`
        }))
      : checkStatus === 1
        ? CHECK_RULES.slice(0, 1).map((rule) => ({
            ...rule,
            levelName: ERROR_LEVEL_NAME[rule.level] || '',
            affectRows: 0,
            status: '校验中',
            foundTime: '2026-09-12 09:30:00'
          }))
        : []

  // 处理轨迹：直接取追溯链路，保证与「综合查询 — 数据追溯」口径一致
  const logs = crDataTraceTable
    .all()
    .filter(
      (item) =>
        String(item.orgId) === String(orgId) &&
        String(item.reportId) === String(reportId) &&
        String(item.period) === period
    )
    .sort((a, b) => a.nodeOrder - b.nodeOrder)
    .map((item) => ({
      node: item.node,
      time: item.nodeTime,
      operator: item.operator,
      result: item.result,
      affectRows: item.affectRows,
      remark: item.remark
    }))

  const remarks = crReportRemarkTable
    .all()
    .filter(
      (item) =>
        String(item.orgId) === String(orgId) &&
        String(item.reportId) === String(reportId) &&
        String(item.period) === period
    )
    .sort((a, b) => b.createTime.localeCompare(a.createTime))

  return {
    ...row,
    freq: report?.freq,
    caliber: report?.subjectName ? `${report.subjectName}口径` : '',
    fillStatusName: FILL_STATUS_NAME[Number(row.fillStatus)] || '',
    checkStatusName: CHECK_STATUS_NAME[Number(row.checkStatus)] || '',
    submitStatusName: SUBMIT_STATUS_NAME[Number(row.submitStatus)] || '',
    tables,
    issues,
    logs,
    remarks
  }
})

/* ==================================================================
 * 二、我的任务
 * ================================================================== */
/** 待办：已下发 / 填报中 / 待复核 / 复核不通过 / 本级审核中 / 上级审核中 / 已打回 */
const TASK_TODO_STATUS = [20, 30, 40, 60, 70, 80, 100]
/** 已办：复核通过 / 审核通过 */
const TASK_DONE_STATUS = [50, 90]

const myTaskRows = (ctx: any) => {
  const params = ctx.params || {}
  let rows = crMyTaskTable.all()

  // 当前登录用户的任务；管理员看全量。取不到登录用户时退回全量口径，不报错。
  const user = currentUser(ctx)
  if (user && !(user.roleIds || []).includes(1)) {
    const mine = rows.filter((row) => row.ownerId === user.id)
    // 演示兜底：该账号名下暂无填报任务时退回全量，避免 Demo 出现空列表
    rows = mine.length ? mine : rows
  }

  if (!isEmpty(params.period)) {
    rows = rows.filter((row) => String(row.period) === String(params.period))
  }
  if (!isEmpty(params.keyword) || !isEmpty(params.reportName)) {
    rows = rows.filter((row) =>
      likeAny(row, ['taskCode', 'reportCode', 'reportName'], params.keyword || params.reportName)
    )
  }
  const statusSet = params.tab === 'done' ? TASK_DONE_STATUS : TASK_TODO_STATUS
  rows = rows.filter((row) => statusSet.includes(Number(row.status)))
  if (!isEmpty(params.status)) {
    rows = rows.filter((row) => Number(row.status) === Number(params.status))
  }
  return rows.sort(
    (a, b) => b.period.localeCompare(a.period) || a.deadline.localeCompare(b.deadline)
  )
}

onGet('/cr/query-my-task/page', (ctx) => paginate(myTaskRows(ctx), ctx.params))

onGet('/cr/query-my-task/list', (ctx) => myTaskRows(ctx))

/* ==================================================================
 * 三、综合查询 — 高级对比
 * ================================================================== */
const compareData = (ctx: any) => {
  const reportId = Number(ctx.params.reportId)
  const orgId = Number(ctx.params.orgId)
  const periods = [...new Set(toArray(ctx.params.periods))].sort()
  if (!reportId) throw new Error('请选择需要对比的报表')
  if (!orgId) throw new Error('请选择机构')
  if (!periods.length) throw new Error('请至少选择一个报送期次')
  const report = findReport(reportId)
  const org = findOrg(orgId)
  if (!report) throw new Error('报表不存在')
  if (!org) throw new Error('机构不存在')

  const rows = crReportDataTable
    .all()
    .filter((row) => row.reportId === reportId && row.orgId === orgId)
  const latest = periods[periods.length - 1]
  const momPeriod = periods.length > 1 ? periods[periods.length - 2] : ''
  const yoyPeriod = lastYearPeriod(latest)
  const valueOf = (indicator: string, period: string) => {
    const hit = rows.find((row) => row.indicator === indicator && row.period === period)
    return hit ? hit.value : null
  }

  const indicators: string[] = []
  rows.forEach((row) => {
    if (!indicators.includes(row.indicator)) indicators.push(row.indicator)
  })

  const compareRows = indicators.map((indicator) => {
    const values: Record<string, number | null> = {}
    periods.forEach((period) => {
      values[period] = valueOf(indicator, period)
    })
    const latestValue = values[latest]
    const unit = rows.find((row) => row.indicator === indicator)?.unit || ''
    return {
      indicator,
      unit,
      values,
      latest: latestValue,
      mom: ratio(latestValue, momPeriod ? values[momPeriod] : null),
      yoy: ratio(latestValue, valueOf(indicator, yoyPeriod))
    }
  })

  return {
    reportId,
    reportCode: report.reportCode,
    reportName: report.reportName,
    freq: report.freq,
    orgId,
    orgName: org.orgName,
    periods,
    momPeriod,
    yoyPeriod,
    rows: compareRows
  }
}

onGet('/cr/query-comprehensive/compare', (ctx) => compareData(ctx))

/** 对比结果导出（CSV，带 BOM，Excel 可直接打开） */
onGet('/cr/query-comprehensive/compare-export', (ctx) => {
  const data = compareData(ctx)
  const headers = [
    { field: 'indicator', label: '指标名称' },
    { field: 'unit', label: '单位' },
    ...data.periods.map((period) => ({ field: period, label: period })),
    { field: 'mom', label: data.momPeriod ? `环比(vs ${data.momPeriod})%` : '环比%' },
    { field: 'yoy', label: `同比(vs ${data.yoyPeriod})%` }
  ]
  const rows = data.rows.map((row) => ({
    indicator: row.indicator,
    unit: row.unit,
    ...row.values,
    mom: row.mom === null ? '-' : row.mom,
    yoy: row.yoy === null ? '-' : row.yoy
  }))
  return csvBlob(rows, headers)
})

/* ==================================================================
 * 四、综合查询 — 数据追溯
 * ================================================================== */
onGet('/cr/query-comprehensive/trace', (ctx) => {
  const reportId = Number(ctx.params.reportId)
  const orgId = Number(ctx.params.orgId)
  const period = String(ctx.params.period || PERIOD)
  if (!reportId) throw new Error('请选择需要追溯的报表')
  if (!orgId) throw new Error('请选择机构')
  const report = findReport(reportId)
  const org = findOrg(orgId)
  if (!report) throw new Error('报表不存在')
  if (!org) throw new Error('机构不存在')

  const nodes = crDataTraceTable
    .all()
    .filter(
      (row) => row.reportId === reportId && row.orgId === orgId && String(row.period) === period
    )
    .sort((a, b) => a.nodeOrder - b.nodeOrder)
    .map((row) => ({
      node: row.node,
      nodeTime: row.nodeTime,
      operator: row.operator,
      costSeconds: row.costSeconds,
      result: row.result,
      affectRows: row.affectRows,
      remark: row.remark
    }))

  return {
    reportId,
    reportCode: report.reportCode,
    reportName: report.reportName,
    orgId,
    orgName: org.orgName,
    period,
    nodes
  }
})

/* ==================================================================
 * 五、综合查询 — 报表备注
 * ================================================================== */
registerResource({
  prefix: '/cr/query-comprehensive/remark',
  table: crReportRemarkTable,
  sort: (a, b) => b.createTime.localeCompare(a.createTime),
  filter: (row, params) =>
    (isEmpty(params.orgId) || String(row.orgId) === String(params.orgId)) &&
    (isEmpty(params.reportId) || String(row.reportId) === String(params.reportId)) &&
    (isEmpty(params.period) || String(row.period) === String(params.period)) &&
    likeAny(row, ['content', 'creator', 'reportName'], params.keyword),
  exportColumns: [
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'creator', label: '备注人' },
    { field: 'createTime', label: '备注时间' },
    { field: 'content', label: '备注内容' }
  ]
})

/** 新增备注（后注册覆盖通用 create，补备注人 / 备注时间） */
onPost('/cr/query-comprehensive/remark/create', (ctx) => {
  const body = ctx.body || {}
  const content = String(body.content || '').trim()
  if (!content) throw new Error('备注内容不能为空')
  if (content.length > 500) throw new Error('备注内容不能超过 500 字')
  const report = findReport(body.reportId)
  const org = findOrg(body.orgId)
  if (!report) throw new Error('请选择报表')
  if (!org) throw new Error('请选择机构')
  const user = currentUser(ctx)
  const created = crReportRemarkTable.insert({
    orgId: org.id,
    orgName: org.orgName,
    reportId: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName,
    period: String(body.period || PERIOD),
    content,
    creator: user?.nickname || String(body.creator || '当前用户'),
    createTime: formatDateTime()
  })
  return created.id
})
