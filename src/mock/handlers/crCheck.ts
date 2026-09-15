/**
 * Mock Handler — 数据检核业务接口
 *
 * - /cr/check-rule    校验规则：标准 CRUD + 导出
 * - /cr/check-execute 数据校验：启动校验（run）+ 进度查询（progress）
 * - /cr/check-status  校验状态：标准分页 + 重新校验 + 重置数据
 * - /cr/check-result  校验结果：分页 / 详情 / 处理 / 导出
 */
import { onGet, onPut } from '../route'
import { parseIds, registerResource } from '../resource'
import { csvBlob, formatDateTime, likeAny } from '../util'
import {
  buildCheckResults,
  crCheckResultTable,
  crCheckRuleTable,
  crCheckStatusTable,
  type CheckLog,
  type CheckResultRow,
  type CheckRuleRow,
  type CheckStatusRow
} from '../db/crCheck'
import { PERIOD, reportOptions, reportOrgs } from '../db/crCommon'

/** 字典中文名（导出时用，避免导出文件里只有数字码值） */
const RULE_TYPE_LABEL: Record<number, string> = {
  1: '非空校验',
  2: '长度校验',
  3: '值域校验',
  4: '逻辑校验',
  5: '表间校验',
  6: '枚举校验'
}
const ERROR_LEVEL_LABEL: Record<number, string> = { 1: '警告', 2: '错误' }
const CHECK_STATUS_LABEL: Record<number, string> = {
  0: '未校验',
  1: '校验中',
  2: '校验通过',
  3: '校验不通过'
}

/* ==================================================================
 * 校验规则
 * ================================================================== */
const filterRule = (row: CheckRuleRow, params: Record<string, any>) => {
  if (params.ruleType && Number(row.ruleType) !== Number(params.ruleType)) return false
  if (params.errorLevel && Number(row.errorLevel) !== Number(params.errorLevel)) return false
  if (
    params.status !== undefined &&
    params.status !== '' &&
    Number(row.status) !== Number(params.status)
  ) {
    return false
  }
  if (params.reportId && !row.reportIds.includes(Number(params.reportId))) return false
  return likeAny(row, ['ruleCode', 'ruleName', 'errorMessage'], params.keyword || params.ruleName)
}

/** 适用报表名称由 reportIds 推导，避免前后端两份数据不一致 */
const withReportNames = (body: any) => {
  const reportIds = parseIds(body.reportIds)
  return {
    ...body,
    reportIds,
    reportNames: reportIds.map(
      (reportId) => reportOptions().find((report) => report.id === reportId)?.reportName || ''
    )
  }
}

registerResource({
  prefix: '/cr/check-rule',
  table: crCheckRuleTable,
  sort: (a, b) => b.id - a.id,
  filter: filterRule,
  beforeCreate: withReportNames,
  beforeUpdate: withReportNames
})

onGet('/cr/check-rule/report-options', () =>
  reportOptions().map((report) => ({
    id: report.id,
    name: report.reportName,
    code: report.reportCode,
    freq: report.freq,
    subjectName: report.subjectName
  }))
)

onGet('/cr/check-rule/export-excel', (ctx) =>
  csvBlob(
    crCheckRuleTable
      .all()
      .filter((row) => filterRule(row, ctx.params))
      .sort((a, b) => b.id - a.id)
      .map((row) => ({
        ...row,
        ruleTypeName: RULE_TYPE_LABEL[row.ruleType] || '',
        errorLevelName: ERROR_LEVEL_LABEL[row.errorLevel] || '',
        reportNames: row.reportNames.join('、'),
        statusName: row.status === 0 ? '启用' : '停用'
      })),
    [
      { field: 'ruleCode', label: '规则编码' },
      { field: 'ruleName', label: '规则名称' },
      { field: 'ruleTypeName', label: '规则类型' },
      { field: 'errorLevelName', label: '错误级别' },
      { field: 'reportNames', label: '适用报表' },
      { field: 'leftExpression', label: '左表达式' },
      { field: 'operator', label: '比较符' },
      { field: 'rightExpression', label: '右表达式' },
      { field: 'errorMessage', label: '错误提示语' },
      { field: 'statusName', label: '是否启用' },
      { field: 'remark', label: '备注' }
    ]
  )
)

/* ==================================================================
 * 数据校验（执行 + 进度）
 * ================================================================== */
interface CheckTask {
  percent: number
  done: boolean
  logs: CheckLog[]
  summary: CheckSummary
}

interface CheckSummary {
  taskNo: string
  period: string
  orgCount: number
  reportCount: number
  total: number
  passCount: number
  warnCount: number
  errorCount: number
  resultCount: number
  checkTime: string
  logs: CheckLog[]
}

/** 校验任务进度（内存态，刷新页面即失效——演示用足够） */
const taskMap = new Map<string, CheckTask>()
let taskSeq = 0

const orgOptionList = () =>
  reportOrgs().map((org) => ({
    id: org.id,
    name: org.orgName,
    code: org.orgCode,
    level: org.orgLevel
  }))

const reportOptionList = () =>
  reportOptions().map((report) => ({
    id: report.id,
    name: report.reportName,
    code: report.reportCode,
    freq: report.freq,
    subjectName: report.subjectName
  }))

/**
 * 执行一次校验：逐条推进日志、刷新校验状态、重写校验明细。
 * 说明：mock 一次算完，"逐条推进"由前端用 setInterval 播放 logs 实现。
 */
const executeCheck = (params: {
  period: string
  orgIds: number[]
  reportIds: number[]
}): CheckSummary => {
  const period = params.period || PERIOD
  const orgs = reportOrgs().filter((org) => params.orgIds.includes(org.id))
  const reports = reportOptions().filter((report) => params.reportIds.includes(report.id))
  if (!orgs.length) throw new Error('请至少选择一个报送机构')
  if (!reports.length) throw new Error('请至少选择一张报表')

  const ruleCount = crCheckRuleTable.all().filter((rule) => rule.status === 0).length
  const taskNo = `XJ${period}${String(++taskSeq).padStart(3, '0')}`
  const checkTime = formatDateTime()
  const logs: CheckLog[] = []
  const push = (text: string, level = 'info') =>
    logs.push({ time: checkTime.slice(11), text, level })
  push(
    `开始执行数据校验：期次 ${period}，机构 ${orgs.length} 个，报表 ${reports.length} 张，启用规则 ${ruleCount} 条`
  )

  let passTotal = 0
  let warnTotal = 0
  let errorTotal = 0
  let nextResultId = crCheckResultTable.all().reduce((max, row) => Math.max(max, row.id), 0) + 1
  const staleResultIds: number[] = []
  const freshResults: CheckResultRow[] = []

  orgs.forEach((org, orgIndex) => {
    let orgPass = 0
    let orgWarn = 0
    let orgError = 0
    reports.forEach((report) => {
      // 确定性造数：不同机构 × 报表命中不同数量的警告 / 错误
      const seed = (report.id * 31 + org.id * 17) % 5
      let errorCount = 0
      if (seed >= 2) {
        errorCount = seed >= 4 ? 2 : 1
      }
      const warnCount = seed === 0 ? 0 : seed + 1
      const passCount = 180 + ((report.id * 37 + org.id * 53 + orgIndex * 11) % 620)

      const rows = buildCheckResults({
        taskNo,
        period,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        checkTime,
        warnCount,
        errorCount,
        startId: nextResultId
      })
      nextResultId += rows.length
      freshResults.push(...rows)
      staleResultIds.push(
        ...crCheckResultTable
          .find(
            (row) => row.orgId === org.id && row.reportId === report.id && row.period === period
          )
          .map((row) => row.id)
      )

      // 错误阻断报送、警告不阻断：有错误即"校验不通过"
      const checkStatus = errorCount > 0 ? 3 : 2
      const payload = {
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period,
        checkStatus,
        checkTime,
        costTime: Number((2.4 + ((report.id + org.id) % 9) * 0.7).toFixed(1)),
        passCount,
        warnCount,
        errorCount,
        taskNo,
        remark: ''
      }
      const exist = crCheckStatusTable.find(
        (row) => row.orgId === org.id && row.reportId === report.id && row.period === period
      )[0]
      if (exist) {
        crCheckStatusTable.update({ id: exist.id, ...payload })
      } else {
        crCheckStatusTable.insert(payload)
      }

      passTotal += passCount
      warnTotal += warnCount
      errorTotal += errorCount
      orgPass += passCount
      orgWarn += warnCount
      orgError += errorCount

      const prefix = `[${org.orgName}] ${report.reportName}`
      if (errorCount > 0) {
        push(
          `${prefix} 校验完成：通过 ${passCount} 条，警告 ${warnCount} 条，错误 ${errorCount} 条`,
          'error'
        )
      } else if (warnCount > 0) {
        push(`${prefix} 校验完成：通过 ${passCount} 条，警告 ${warnCount} 条`, 'warning')
      } else {
        push(`${prefix} 校验完成：通过 ${passCount} 条，未发现异常`, 'success')
      }
    })
    push(
      `${org.orgName} 校验完成：通过 ${orgPass} 条，警告 ${orgWarn} 条，错误 ${orgError} 条`,
      orgError > 0 ? 'error' : 'success'
    )
  })

  // 先清理旧明细再写入新明细，避免同一「机构 × 报表 × 期次」重复累计
  if (staleResultIds.length) crCheckResultTable.removeBatch(staleResultIds)
  freshResults.forEach((row) => crCheckResultTable.insert(row))

  push(
    `全部校验任务执行完成：通过 ${passTotal} 条，警告 ${warnTotal} 条，错误 ${errorTotal} 条` +
      (errorTotal > 0 ? '，存在错误级问题，已阻断报送' : '，可继续报送'),
    errorTotal > 0 ? 'error' : 'success'
  )

  const summary: CheckSummary = {
    taskNo,
    period,
    orgCount: orgs.length,
    reportCount: reports.length,
    total: passTotal + warnTotal + errorTotal,
    passCount: passTotal,
    warnCount: warnTotal,
    errorCount: errorTotal,
    resultCount: freshResults.length,
    checkTime,
    logs
  }
  taskMap.set(taskNo, { percent: 100, done: true, logs, summary })
  return summary
}

onGet('/cr/check-execute/run', (ctx) =>
  executeCheck({
    period: ctx.params.period,
    orgIds: parseIds(ctx.params.orgIds),
    reportIds: parseIds(ctx.params.reportIds)
  })
)

onGet('/cr/check-execute/progress', (ctx) => {
  const task = taskMap.get(String(ctx.params.taskNo))
  if (!task) throw new Error('校验任务不存在，请重新执行校验')
  return task
})

onGet('/cr/check-execute/org-options', orgOptionList)
onGet('/cr/check-execute/report-options', reportOptionList)

/* ==================================================================
 * 数据校验状态
 * ================================================================== */
const filterStatus = (row: CheckStatusRow, params: Record<string, any>) => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (
    params.checkStatus !== undefined &&
    params.checkStatus !== '' &&
    Number(row.checkStatus) !== Number(params.checkStatus)
  ) {
    return false
  }
  return likeAny(row, ['orgName', 'reportName', 'reportCode', 'taskNo'], params.keyword)
}

registerResource({
  prefix: '/cr/check-status',
  table: crCheckStatusTable,
  sort: (a, b) => b.id - a.id,
  filter: filterStatus
})

/** 重新校验：按当前行重新跑一遍（会刷新状态与明细） */
onPut('/cr/check-status/recheck', (ctx) => {
  const row = crCheckStatusTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('校验任务记录不存在')
  if (row.checkStatus === 1) throw new Error('该任务正在校验中，请稍后再试')
  const summary = executeCheck({
    period: row.period,
    orgIds: [row.orgId],
    reportIds: [row.reportId]
  })
  return {
    taskNo: summary.taskNo,
    passCount: summary.passCount,
    warnCount: summary.warnCount,
    errorCount: summary.errorCount
  }
})

/** 重置数据：清空该「机构 × 报表 × 期次」的校验状态与校验明细 */
onPut('/cr/check-status/reset', (ctx) => {
  const row = crCheckStatusTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('校验任务记录不存在')
  if (row.checkStatus === 1) throw new Error('该任务正在校验中，请稍后再重置数据')
  const staleIds = crCheckResultTable
    .find(
      (item) =>
        item.orgId === row.orgId && item.reportId === row.reportId && item.period === row.period
    )
    .map((item) => item.id)
  if (staleIds.length) crCheckResultTable.removeBatch(staleIds)
  crCheckStatusTable.update({
    id: row.id,
    checkStatus: 0,
    checkTime: '',
    costTime: 0,
    passCount: 0,
    warnCount: 0,
    errorCount: 0,
    taskNo: '',
    remark: ''
  })
  return true
})

onGet('/cr/check-status/org-options', orgOptionList)
onGet('/cr/check-status/report-options', reportOptionList)

onGet('/cr/check-status/export-excel', (ctx) =>
  csvBlob(
    crCheckStatusTable
      .all()
      .filter((row) => filterStatus(row, ctx.params))
      .sort((a, b) => b.id - a.id)
      .map((row) => ({ ...row, checkStatusName: CHECK_STATUS_LABEL[row.checkStatus] || '' })),
    [
      { field: 'orgName', label: '机构' },
      { field: 'reportCode', label: '报表编码' },
      { field: 'reportName', label: '报表名称' },
      { field: 'period', label: '期次' },
      { field: 'checkStatusName', label: '校验状态' },
      { field: 'checkTime', label: '校验时间' },
      { field: 'costTime', label: '耗时（秒）' },
      { field: 'passCount', label: '通过数' },
      { field: 'warnCount', label: '警告数' },
      { field: 'errorCount', label: '错误数' },
      { field: 'taskNo', label: '校验任务号' }
    ]
  )
)

/* ==================================================================
 * 校验结果
 * ================================================================== */
const filterResult = (row: CheckResultRow, params: Record<string, any>) => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (params.errorLevel && Number(row.errorLevel) !== Number(params.errorLevel)) return false
  if (params.ruleType && Number(row.ruleType) !== Number(params.ruleType)) return false
  if (
    params.handled !== undefined &&
    params.handled !== '' &&
    String(row.handled) !== String(params.handled)
  ) {
    return false
  }
  return likeAny(
    row,
    ['orgName', 'reportName', 'ruleCode', 'ruleName', 'errorMessage', 'location'],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/check-result',
  table: crCheckResultTable,
  sort: (a, b) => b.id - a.id,
  filter: filterResult
})

/** 标记已处理 */
onPut('/cr/check-result/handle', (ctx) => {
  const { id, handler, handleRemark } = ctx.body || {}
  const row = crCheckResultTable.get(Number(id))
  if (!row) throw new Error('校验结果不存在')
  if (row.handled) throw new Error('该条校验结果已处理，无需重复处理')
  crCheckResultTable.update({
    id: row.id,
    handled: true,
    handler: handler || '孙建国',
    handleTime: formatDateTime(),
    handleRemark:
      handleRemark || (row.errorLevel === 2 ? '已修正报送数据并重新抽取' : '已确认，属业务合理差异')
  })
  return true
})

onGet('/cr/check-result/org-options', orgOptionList)
onGet('/cr/check-result/report-options', reportOptionList)

onGet('/cr/check-result/export-excel', (ctx) =>
  csvBlob(
    crCheckResultTable
      .all()
      .filter((row) => filterResult(row, ctx.params))
      .sort((a, b) => b.id - a.id)
      .map((row) => ({
        ...row,
        ruleTypeName: RULE_TYPE_LABEL[row.ruleType] || '',
        errorLevelName: ERROR_LEVEL_LABEL[row.errorLevel] || '',
        handledName: row.handled ? '已处理' : '未处理'
      })),
    [
      { field: 'orgName', label: '机构' },
      { field: 'reportCode', label: '报表编码' },
      { field: 'reportName', label: '报表名称' },
      { field: 'period', label: '期次' },
      { field: 'ruleCode', label: '规则编码' },
      { field: 'ruleName', label: '规则名称' },
      { field: 'ruleTypeName', label: '规则类型' },
      { field: 'errorLevelName', label: '错误级别' },
      { field: 'errorMessage', label: '错误提示' },
      { field: 'location', label: '错误数据定位' },
      { field: 'actualValue', label: '实际值' },
      { field: 'expectValue', label: '期望值' },
      { field: 'handledName', label: '是否已处理' },
      { field: 'handler', label: '处理人' },
      { field: 'handleTime', label: '处理时间' }
    ]
  )
)
