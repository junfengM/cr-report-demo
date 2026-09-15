/**
 * Mock Handler — 报表数据处理域
 *
 * - /cr/data-fill     数据填报：记录分页 / 数据加载 / 保存 / 校验 / 计算 / 恢复 / 历史 / 导出
 * - /cr/data-batch    手工批量操作：记录分页 + 批量执行（清空 / 复制上期 / 计算 / 删除）
 * - /cr/data-submit   批量提交：待提交记录分页 + 批量提交（校验不通过不允许提交）
 * - /cr/data-monitor  批处理监控：任务分页（每次轮询推进进度）+ 任务日志
 * - /cr/data-message  报文生成下载：报文记录分页 + 生成 / 重新生成 / 删除 / 下载
 *
 * 说明：批处理任务的"实时推进"由 mock 在每次分页查询时推进一小步实现，
 * 前端只需 3 秒轮询一次即可看到进度增长。
 */
import { onDelete, onGet, onPost, onPut } from '../route'
import { currentUser } from './auth'
import { assertDeptAction, DEPT_ACTION, reportNameOf } from '../db/crPermission'
import { parseIds } from '../resource'
import { csvBlob, formatDateTime, likeAny, paginate } from '../util'
import {
  BATCH_TASK_STATUS,
  BATCH_TASK_STATUS_LABEL,
  BATCH_TASK_TYPE,
  BATCH_TASK_TYPE_LABEL,
  FILL_COLUMNS,
  MESSAGE_STATUS,
  appendBatchTask,
  appendFillHistory,
  crBatchTaskTable,
  crFillDataTable,
  crFillHistoryTable,
  crFillRecordTable,
  crMessageTable,
  fillUserOf,
  findFillRecord,
  planMessageFile,
  queryFillData,
  type FillDataRow,
  type FillRecordRow
} from '../db/crData'
import { buildSubmitFile } from '../db/crSubmitFile'
import { PERIOD, PERIODS, reportOptions, reportOrgs } from '../db/crCommon'

const CHECK_STATUS_LABEL: Record<number, string> = {
  0: '未校验',
  1: '校验中',
  2: '校验通过',
  3: '校验不通过'
}

const FILL_STATUS_LABEL: Record<number, string> = { 0: '未填报', 1: '已填报', 2: '已提交' }

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

const deadlineOf = (period: string): string =>
  ({ '202607': '2026-08-15', '202608': '2026-09-15' })[period] || '2026-09-20'

/** 期次末（用于「生效日期晚于期末」的值域校验） */
const periodEndOf = (period: string): string =>
  ({ '202607': '2026-07-31', '202608': '2026-08-31' })[period] || '2026-09-30'

const prevPeriodOf = (period: string): string => {
  const index = PERIODS.indexOf(period)
  return index > 0 ? PERIODS[index - 1] : ''
}

/** 各页面共用的机构 / 报表 / 期次下拉选项 */
;[
  '/cr/data-fill',
  '/cr/data-batch',
  '/cr/data-submit',
  '/cr/data-monitor',
  '/cr/data-message'
].forEach((prefix) => {
  onGet(`${prefix}/org-options`, orgOptionList)
  onGet(`${prefix}/report-options`, reportOptionList)
  onGet(`${prefix}/period-options`, () => PERIODS)
})

/* ==================================================================
 * 公共：填报记录过滤 / 新建 / 更新
 * ================================================================== */
const filterFillRecord = (row: FillRecordRow, params: Record<string, any>): boolean => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (
    params.fillStatus !== undefined &&
    params.fillStatus !== '' &&
    Number(row.fillStatus) !== Number(params.fillStatus)
  ) {
    return false
  }
  if (
    params.checkStatus !== undefined &&
    params.checkStatus !== '' &&
    Number(row.checkStatus) !== Number(params.checkStatus)
  ) {
    return false
  }
  if (String(params.pendingOnly) === 'true' && Number(row.fillStatus) === 2) return false
  if (String(params.hasData) === 'true' && !row.rowCount) return false
  return likeAny(
    row,
    ['orgName', 'reportName', 'reportCode', 'period', 'lastModifier'],
    params.keyword
  )
}

const sortFillRecord = (a: FillRecordRow, b: FillRecordRow): number =>
  a.period === b.period ? a.id - b.id : a.period < b.period ? 1 : -1

const blankRecord = (orgId: number, reportId: number, period: string): FillRecordRow => {
  const org = reportOrgs().find((item) => item.id === Number(orgId))
  const report = reportOptions().find((item) => item.id === Number(reportId))
  return {
    id: 0,
    orgId: Number(orgId) || 0,
    orgName: org?.orgName || '',
    reportId: Number(reportId) || 0,
    reportCode: report?.reportCode || '',
    reportName: report?.reportName || '',
    period,
    rowCount: 0,
    fillStatus: 0,
    checkStatus: 0,
    fillUser: fillUserOf(org?.orgName || ''),
    lastModifier: '',
    lastModifyTime: '',
    deadline: deadlineOf(period),
    submitTime: '',
    remark: '暂无填报记录，可新增行后保存'
  }
}

/** 按「机构 × 报表 × 期次」更新（不存在则新建）填报记录 */
const upsertFillRecord = (
  key: { orgId: number; reportId: number; period: string },
  patch: Partial<FillRecordRow>
): FillRecordRow => {
  const existing = findFillRecord(key.orgId, key.reportId, key.period)
  if (existing) {
    const updated = crFillRecordTable.update({ id: existing.id, ...patch })
    return (updated || existing) as FillRecordRow
  }
  const nextId = crFillRecordTable.all().reduce((max, row) => Math.max(max, row.id), 0) + 1
  const blank = blankRecord(key.orgId, key.reportId, key.period)
  return crFillRecordTable.insert({ ...blank, id: nextId, remark: '', ...patch })
}

/** 覆盖写入某「机构 × 报表 × 期次」的明细数据，返回写入行数 */
const writeFillData = (
  key: { orgId: number; reportId: number; period: string },
  rows: Array<Record<string, any>>
): FillDataRow[] => {
  const org = reportOrgs().find((item) => item.id === Number(key.orgId))
  const report = reportOptions().find((item) => item.id === Number(key.reportId))
  const stale = queryFillData(key.orgId, key.reportId, key.period)
  if (stale.length) crFillDataTable.removeBatch(stale.map((row) => row.id))
  let nextId = crFillDataTable.all().reduce((max, row) => Math.max(max, row.id), 0) + 1
  const now = formatDateTime()
  const saved: FillDataRow[] = rows.map((row, index) => ({
    id: nextId++,
    orgId: Number(key.orgId),
    orgName: org?.orgName || '',
    reportId: Number(key.reportId),
    reportCode: report?.reportCode || '',
    reportName: report?.reportName || '',
    period: key.period,
    rowNo: index + 1,
    policyNo: String(row.policyNo ?? ''),
    holderName: String(row.holderName ?? ''),
    certNo: String(row.certNo ?? ''),
    productName: String(row.productName ?? ''),
    sumAssured: Number(row.sumAssured) || 0,
    premiumAmount: Number(row.premiumAmount) || 0,
    rate: Number(row.rate) || 0,
    effectDate: String(row.effectDate ?? ''),
    channel: String(row.channel ?? ''),
    dataStatus: String(row.dataStatus ?? '正常'),
    remark: String(row.remark ?? ''),
    updateTime: now
  }))
  saved.forEach((row) => crFillDataTable.insert(row))
  return saved
}

/* ==================================================================
 * 数据填报
 * ================================================================== */
onGet('/cr/data-fill/page', (ctx) =>
  paginate(
    crFillRecordTable
      .all()
      .filter((row) => filterFillRecord(row, ctx.params))
      .sort(sortFillRecord),
    ctx.params
  )
)

/** 加载某「机构 × 报表 × 期次」的填报表单：记录 + 列定义 + 明细数据 */
onGet('/cr/data-fill/get', (ctx) => {
  const orgId = Number(ctx.params.orgId)
  const reportId = Number(ctx.params.reportId)
  const period = String(ctx.params.period || PERIOD)
  const record = findFillRecord(orgId, reportId, period)
  return {
    record: record || blankRecord(orgId, reportId, period),
    columns: FILL_COLUMNS,
    rows: queryFillData(orgId, reportId, period)
  }
})

onGet('/cr/data-fill/columns', () => FILL_COLUMNS)

/**
 * 填报数据的写入端必须先登录：这是"报表数据本体"，也是脱敏要保护的那份数据。
 * 未登录能整表改写的话，前面那些角色校验都白做了（复验时实测过匿名写入成功）。
 * 这里只判"有没有登录人"，机构数据范围不在本轮口径内（见文档已知简化）。
 */
const assertLogin = (ctx: any, action: string) => {
  const user = currentUser(ctx)
  if (!user) throw new Error('「' + action + '」需要先登录（未取到登录人）')
  return user
}

/** 保存填报数据 */
onPut('/cr/data-fill/save', (ctx) => {
  assertLogin(ctx, '保存填报数据')
  const body = ctx.body || {}
  const orgId = Number(body.orgId)
  const reportId = Number(body.reportId)
  const period = String(body.period || PERIOD)
  if (!orgId) throw new Error('请先选择报送机构')
  if (!reportId) throw new Error('请先选择报表')
  // 部门权限落点：该部门在这张报表上没有被授权「数据填报」时，保存直接拒绝（不靠藏按钮）
  assertDeptAction(
    currentUser(ctx)?.id,
    reportId,
    DEPT_ACTION.FILL,
    '数据填报',
    reportNameOf(reportId)
  )
  const rows = Array.isArray(body.rows) ? body.rows : []
  const before = findFillRecord(orgId, reportId, period)
  const operator = fillUserOf(reportOrgs().find((org) => org.id === orgId)?.orgName || '')
  const saved = writeFillData({ orgId, reportId, period }, rows)
  const now = formatDateTime()
  const record = upsertFillRecord(
    { orgId, reportId, period },
    {
      rowCount: saved.length,
      fillStatus: 1,
      lastModifier: operator,
      lastModifyTime: now,
      remark: ''
    }
  )
  appendFillHistory(
    record,
    '保存',
    `保存填报数据：共 ${saved.length} 行`,
    operator,
    `${before?.rowCount ?? 0} 行`,
    `${saved.length} 行`
  )
  return { recordId: record.id, rowCount: saved.length, saveTime: now }
})

interface CheckItem {
  rowIndex: number
  column: string
  columnLabel: string
  message: string
  /** 见字典 cr_error_level：1 警告 / 2 错误 */
  level: number
  value: string
}

/** 校验明细数据：返回逐单元格的问题清单 + 汇总 */
const checkRows = (
  rows: Array<Record<string, any>>,
  period: string
): {
  items: CheckItem[]
  total: number
  passCount: number
  warnCount: number
  errorCount: number
  checkTime: string
} => {
  const items: CheckItem[] = []
  const labelOf = (field: string) => FILL_COLUMNS.find((col) => col.field === field)?.label || field
  const push = (rowIndex: number, field: string, message: string, level: number, value: any) => {
    items.push({
      rowIndex,
      column: field,
      columnLabel: labelOf(field),
      message,
      level,
      value: value === undefined || value === null ? '' : String(value)
    })
  }
  const periodEnd = periodEndOf(period)

  rows.forEach((row, rowIndex) => {
    const policyNo = String(row.policyNo ?? '').trim()
    if (!policyNo) {
      push(rowIndex, 'policyNo', '保单号不可为空，无法定位数据主体', 2, policyNo)
    } else if (!/^P\d{10}$/.test(policyNo)) {
      push(
        rowIndex,
        'policyNo',
        `保单号「${policyNo}」不符合编码规则（P + 10 位数字）`,
        1,
        policyNo
      )
    }

    const holderName = String(row.holderName ?? '').trim()
    if (!holderName)
      push(rowIndex, 'holderName', '投保人名称不可为空，请补录后再报送', 2, holderName)

    const certNo = String(row.certNo ?? '').trim()
    if (!certNo) {
      push(rowIndex, 'certNo', '证件号码不可为空', 2, certNo)
    } else if (certNo.length < 10) {
      push(rowIndex, 'certNo', '证件号码长度不足，未按监管要求脱敏保留前后位', 2, certNo)
    }

    const sumAssured = Number(row.sumAssured) || 0
    const premiumAmount = Number(row.premiumAmount) || 0
    const rate = Number(row.rate) || 0
    if (premiumAmount <= 0) {
      push(rowIndex, 'premiumAmount', '保费金额必须大于 0', 2, premiumAmount)
    }
    if (rate <= 0 || rate > 100) {
      push(rowIndex, 'rate', '费率取值范围为 0~100', 2, rate)
    }
    if (sumAssured <= 0) {
      push(rowIndex, 'sumAssured', '保险金额必须大于 0', 2, sumAssured)
    } else if (
      premiumAmount > 0 &&
      rate > 0 &&
      Math.abs(sumAssured - premiumAmount * rate) > 0.05
    ) {
      push(
        rowIndex,
        'sumAssured',
        `保险金额应等于 保费金额 × 费率（${(premiumAmount * rate).toFixed(2)}），当前为 ${sumAssured.toFixed(2)}`,
        2,
        sumAssured
      )
    }

    const effectDate = String(row.effectDate ?? '').trim()
    if (!effectDate) {
      push(rowIndex, 'effectDate', '生效日期不可为空', 2, effectDate)
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(effectDate)) {
      push(rowIndex, 'effectDate', '生效日期格式应为 YYYY-MM-DD', 2, effectDate)
    } else if (effectDate > periodEnd) {
      push(
        rowIndex,
        'effectDate',
        `生效日期晚于报送期末（${periodEnd}），请确认是否属于本期数据`,
        1,
        effectDate
      )
    }
  })

  const errorRows = new Set(items.filter((item) => item.level === 2).map((item) => item.rowIndex))
  const warnRows = new Set(items.filter((item) => item.level === 1).map((item) => item.rowIndex))
  const checkTime = formatDateTime()
  return {
    items,
    total: rows.length,
    passCount: rows.length - errorRows.size - warnRows.size,
    warnCount: warnRows.size,
    errorCount: errorRows.size,
    checkTime
  }
}

/**
 * 数据校验：以页面当前（含未保存）的数据为准。
 * 它不是纯查询 —— 会把校验状态写回填报记录（批量提交页据此判断能不能提交）并追加一条修改历史，
 * 所以和保存 / 恢复一样必须先登录，否则谁都盖个"校验通过"、历史里还记着别人的名字。
 */
onPost('/cr/data-fill/check', (ctx) => {
  assertLogin(ctx, '数据校验')
  const body = ctx.body || {}
  const orgId = Number(body.orgId)
  const reportId = Number(body.reportId)
  const period = String(body.period || PERIOD)
  const rows = Array.isArray(body.rows) ? body.rows : queryFillData(orgId, reportId, period)
  if (!rows.length) throw new Error('当前报表暂无数据，请先新增行后再校验')
  const result = checkRows(rows, period)
  // 同步校验状态到填报记录（批量提交页面据此判断是否允许提交）
  const record = findFillRecord(orgId, reportId, period)
  if (record) {
    crFillRecordTable.update({
      id: record.id,
      checkStatus: result.errorCount > 0 ? 3 : 2,
      lastModifier: fillUserOf(record.orgName),
      lastModifyTime: result.checkTime
    })
    appendFillHistory(
      record,
      '数据校验',
      `校验完成：通过 ${result.passCount} 行，警告 ${result.warnCount} 行，错误 ${result.errorCount} 行`,
      fillUserOf(record.orgName),
      CHECK_STATUS_LABEL[record.checkStatus],
      result.errorCount > 0 ? '校验不通过' : '校验通过'
    )
  }
  return result
})

/** 修改历史 */
onGet('/cr/data-fill/history', (ctx) => {
  const orgId = Number(ctx.params.orgId)
  const reportId = Number(ctx.params.reportId)
  const period = String(ctx.params.period || '')
  return crFillHistoryTable
    .all()
    .filter((row) => {
      if (orgId && row.orgId !== orgId) return false
      if (reportId && row.reportId !== reportId) return false
      if (period && row.period !== period) return false
      if (ctx.params.recordId && Number(row.recordId) !== Number(ctx.params.recordId)) return false
      return true
    })
    .sort((a, b) =>
      a.operateTime === b.operateTime ? b.id - a.id : a.operateTime < b.operateTime ? 1 : -1
    )
})

/** 数据恢复：丢弃未保存的修改，回滚到上次保存版本 */
onPut('/cr/data-fill/restore', (ctx) => {
  assertLogin(ctx, '数据恢复')
  const body = ctx.body || {}
  const orgId = Number(body.orgId)
  const reportId = Number(body.reportId)
  const period = String(body.period || PERIOD)
  const record = findFillRecord(orgId, reportId, period)
  if (record && !record.rowCount) throw new Error('该报表尚未保存过数据，无可恢复的版本')
  const rows = queryFillData(orgId, reportId, period)
  if (record) {
    appendFillHistory(
      record,
      '数据恢复',
      '放弃未保存的修改，回滚到上次保存版本',
      fillUserOf(record.orgName),
      '',
      `${rows.length} 行`
    )
  }
  return { rows, rowCount: rows.length, restoreTime: formatDateTime() }
})

/** 计算：保险金额 = 保费金额 × 费率（返回算好的行，同时往修改历史里记一条，同样要求登录） */
onPut('/cr/data-fill/calculate', (ctx) => {
  assertLogin(ctx, '执行计算')
  const body = ctx.body || {}
  const orgId = Number(body.orgId)
  const reportId = Number(body.reportId)
  const period = String(body.period || PERIOD)
  const source: Array<Record<string, any>> =
    Array.isArray(body.rows) && body.rows.length
      ? body.rows
      : queryFillData(orgId, reportId, period)
  if (!source.length) throw new Error('当前报表暂无数据，无法执行计算')
  let changedCount = 0
  const rows = source.map((row, index) => {
    const premiumAmount = Number(row.premiumAmount) || 0
    const rate = Number(row.rate) || 0
    const sumAssured = Number((premiumAmount * rate).toFixed(2))
    if (Math.abs((Number(row.sumAssured) || 0) - sumAssured) > 0.001) changedCount += 1
    return { ...row, rowNo: row.rowNo ?? index + 1, sumAssured }
  })
  const record = findFillRecord(orgId, reportId, period)
  if (record) {
    appendFillHistory(
      record,
      '计算',
      `执行计算规则「保险金额 = 保费金额 × 费率」，更新 ${changedCount} 行`,
      fillUserOf(record.orgName)
    )
  }
  return { rows, changedCount, rule: '保险金额 = 保费金额 × 费率' }
})

/** 导出填报数据 */
onGet('/cr/data-fill/export-excel', (ctx) => {
  const orgId = Number(ctx.params.orgId)
  const reportId = Number(ctx.params.reportId)
  const period = String(ctx.params.period || PERIOD)
  const rows = queryFillData(orgId, reportId, period)
  if (!rows.length) throw new Error('当前报表暂无数据，无法导出')
  return csvBlob(rows, [
    { field: 'rowNo', label: '行号' },
    ...FILL_COLUMNS.map((col) => ({ field: col.field, label: col.label })),
    { field: 'updateTime', label: '最后修改时间' }
  ])
})

/* ==================================================================
 * 手工批量操作
 * ================================================================== */
onGet('/cr/data-batch/page', (ctx) =>
  paginate(
    crFillRecordTable
      .all()
      .filter((row) => filterFillRecord(row, ctx.params))
      .sort(sortFillRecord),
    ctx.params
  )
)

const BATCH_ACTION_LABEL: Record<string, string> = {
  clear: '批量清空',
  copyPrev: '批量复制上期数据',
  calculate: '批量计算',
  delete: '批量删除'
}

interface BatchResult {
  id: number
  orgName: string
  reportName: string
  period: string
  success: boolean
  message: string
}

onPut('/cr/data-batch/execute', (ctx) => {
  const { ids, action } = ctx.body || {}
  const label = BATCH_ACTION_LABEL[action]
  if (!label) throw new Error(`不支持的批量操作：${action}`)
  const records = parseIds(ids)
    .map((id) => crFillRecordTable.get(id))
    .filter((row): row is FillRecordRow => !!row)
  if (!records.length) throw new Error('请至少勾选一条填报记录')

  const now = formatDateTime()
  const results: BatchResult[] = []

  records.forEach((record) => {
    const base = {
      id: record.id,
      orgName: record.orgName,
      reportName: record.reportName,
      period: record.period
    }
    const operator = fillUserOf(record.orgName)
    try {
      if (action === 'delete') {
        const stale = queryFillData(record.orgId, record.reportId, record.period)
        if (stale.length) crFillDataTable.removeBatch(stale.map((row) => row.id))
        crFillRecordTable.remove(record.id)
        results.push({ ...base, success: true, message: `已删除填报记录及 ${stale.length} 行数据` })
        return
      }

      if (action === 'clear') {
        const stale = queryFillData(record.orgId, record.reportId, record.period)
        if (stale.length) crFillDataTable.removeBatch(stale.map((row) => row.id))
        crFillRecordTable.update({
          id: record.id,
          rowCount: 0,
          fillStatus: 0,
          checkStatus: 0,
          lastModifier: operator,
          lastModifyTime: now
        })
        appendFillHistory(
          record,
          '批量操作',
          `批量清空填报数据（原 ${stale.length} 行）`,
          operator,
          `${stale.length} 行`,
          '0 行'
        )
        results.push({
          ...base,
          success: true,
          message: `已清空 ${stale.length} 行数据，状态回到「未填报」`
        })
        return
      }

      if (action === 'copyPrev') {
        const prevPeriod = prevPeriodOf(record.period)
        if (!prevPeriod) {
          results.push({ ...base, success: false, message: `期次 ${record.period} 没有上期数据` })
          return
        }
        const prevRows = queryFillData(record.orgId, record.reportId, prevPeriod)
        if (!prevRows.length) {
          results.push({
            ...base,
            success: false,
            message: `上期（${prevPeriod}）无填报数据，无法复制`
          })
          return
        }
        const copied = prevRows.map((row) => ({
          ...row,
          policyNo: String(row.policyNo).replace(prevPeriod, record.period),
          remark: `复制自 ${prevPeriod}`
        }))
        writeFillData(record, copied)
        crFillRecordTable.update({
          id: record.id,
          rowCount: copied.length,
          fillStatus: 1,
          checkStatus: 0,
          lastModifier: operator,
          lastModifyTime: now
        })
        appendFillHistory(
          record,
          '批量操作',
          `批量复制上期（${prevPeriod}）数据：${copied.length} 行`,
          operator,
          `${record.rowCount} 行`,
          `${copied.length} 行`
        )
        results.push({
          ...base,
          success: true,
          message: `已复制 ${prevPeriod} 的 ${copied.length} 行数据`
        })
        return
      }

      // calculate
      const rows = queryFillData(record.orgId, record.reportId, record.period)
      if (!rows.length) {
        results.push({ ...base, success: false, message: '暂无填报数据，无法计算' })
        return
      }
      let changed = 0
      rows.forEach((row) => {
        const sumAssured = Number(
          ((Number(row.premiumAmount) || 0) * (Number(row.rate) || 0)).toFixed(2)
        )
        if (Math.abs(sumAssured - row.sumAssured) > 0.001) changed += 1
        crFillDataTable.update({ id: row.id, sumAssured, updateTime: now })
      })
      crFillRecordTable.update({
        id: record.id,
        fillStatus: 1,
        lastModifier: operator,
        lastModifyTime: now
      })
      appendFillHistory(
        record,
        '批量操作',
        `批量计算：保险金额 = 保费金额 × 费率，更新 ${changed} 行`,
        operator
      )
      results.push({ ...base, success: true, message: `计算完成，更新 ${changed} 行` })
    } catch (error: any) {
      results.push({ ...base, success: false, message: error?.message || '执行失败' })
    }
  })

  const successCount = results.filter((item) => item.success).length
  const failCount = results.length - successCount
  appendBatchTask({
    taskType: action === 'calculate' ? BATCH_TASK_TYPE.CALCULATE : BATCH_TASK_TYPE.SUMMARY,
    period: records[0].period,
    rowCount: records.reduce((sum, record) => sum + record.rowCount, 0),
    status: successCount ? BATCH_TASK_STATUS.SUCCESS : BATCH_TASK_STATUS.FAIL,
    percent: 100,
    resultMessage: `${label}完成：成功 ${successCount} 条，失败 ${failCount} 条`,
    errorMessage: successCount ? '' : `${label}全部失败：${results[0]?.message || ''}`
  })
  return { action, label, successCount, failCount, results, executeTime: now }
})

/* ==================================================================
 * 批量提交
 * ================================================================== */
onGet('/cr/data-submit/page', (ctx) => {
  const params = { pendingOnly: 'true', ...ctx.params }
  return paginate(
    crFillRecordTable
      .all()
      .filter((row) => filterFillRecord(row, params))
      .sort(sortFillRecord),
    params
  )
})

onPut('/cr/data-submit/submit', (ctx) => {
  const ids = parseIds(ctx.body?.ids)
  const records = ids
    .map((id) => crFillRecordTable.get(id))
    .filter((row): row is FillRecordRow => !!row)
  if (!records.length) throw new Error('请至少勾选一条填报记录')

  const failures: string[] = []
  records.forEach((record) => {
    const prefix = `${record.orgName}《${record.reportName}》`
    // 部门权限落点：逐条按"这条记录是哪张报表"判「批量提交」动作
    try {
      assertDeptAction(
        currentUser(ctx)?.id,
        record.reportId,
        DEPT_ACTION.SUBMIT,
        '批量提交',
        `报表${prefix}`
      )
    } catch (error: any) {
      failures.push(error?.message || prefix + ' 没有批量提交权限')
      return
    }
    if (record.fillStatus === 2) {
      failures.push(`${prefix} 已于 ${record.submitTime || '此前'} 提交，请勿重复提交`)
    } else if (!record.rowCount) {
      failures.push(`${prefix} 暂无填报数据，不允许提交`)
    } else if (record.checkStatus !== 2) {
      failures.push(
        `${prefix} 校验状态为「${CHECK_STATUS_LABEL[record.checkStatus] || '未知'}」，校验通过后方可提交`
      )
    }
  })
  if (failures.length) {
    const shown = failures.slice(0, 3).join('；')
    const tail = failures.length > 3 ? `；等共 ${failures.length} 条不满足条件` : ''
    throw new Error(`以下记录不满足提交条件：${shown}${tail}`)
  }

  const now = formatDateTime()
  records.forEach((record) => {
    crFillRecordTable.update({
      id: record.id,
      fillStatus: 2,
      submitTime: now,
      lastModifier: fillUserOf(record.orgName),
      lastModifyTime: now
    })
    appendFillHistory(
      record,
      '提交',
      '提交本期填报数据，状态变更为已提交',
      fillUserOf(record.orgName),
      FILL_STATUS_LABEL[record.fillStatus],
      '已提交'
    )
  })
  const orgNames = [...new Set(records.map((record) => record.orgName))].join('、')
  appendBatchTask({
    taskType: BATCH_TASK_TYPE.SUBMIT,
    orgId: records.length === 1 ? records[0].orgId : 0,
    orgName: records.length === 1 ? records[0].orgName : `${orgNames} 等 ${records.length} 个机构`,
    reportId: records.length === 1 ? records[0].reportId : 0,
    reportCode: records.length === 1 ? records[0].reportCode : '',
    reportName: records.length === 1 ? records[0].reportName : `${records.length} 张报表`,
    period: records[0].period,
    rowCount: records.reduce((sum, record) => sum + record.rowCount, 0),
    status: BATCH_TASK_STATUS.SUCCESS,
    percent: 100,
    resultMessage: `批量提交成功：${records.length} 条填报记录已提交`
  })
  return {
    successCount: records.length,
    failCount: 0,
    submitTime: now,
    recordIds: records.map((record) => record.id)
  }
})

/* ==================================================================
 * 批处理监控
 * ================================================================== */
const stripLogs = (row: any) => {
  const { logs, ...rest } = row
  return rest
}

/**
 * 推进运行中的任务：每次分页查询前进一小步，让前端 3 秒轮询能看到进度增长。
 * 若当前没有运行中的任务，则自动补一个周期性的「数据汇总」任务，保证监控页始终有动态。
 */
const advanceRunningTasks = (): void => {
  const running = crBatchTaskTable.all().filter((row) => row.status === BATCH_TASK_STATUS.RUNNING)
  const now = formatDateTime()
  running.forEach((task) => {
    const step = 6 + (task.id % 6)
    const percent = Math.min(100, task.percent + step)
    const logs = [...task.logs]
    if (percent >= 100) {
      const failed = task.id % 4 === 0
      const status = failed ? BATCH_TASK_STATUS.FAIL : BATCH_TASK_STATUS.SUCCESS
      const costTime = task.costTime + step
      logs.push({
        time: now.slice(11),
        text: failed
          ? '任务执行失败：存在未通过的校验规则，已回滚本次批处理'
          : `任务执行完成，共处理 ${task.rowCount} 行，耗时 ${costTime} 秒`,
        level: failed ? 'error' : 'success'
      })
      crBatchTaskTable.update({
        id: task.id,
        percent: 100,
        status,
        endTime: now,
        costTime,
        resultMessage: failed
          ? ''
          : `${BATCH_TASK_TYPE_LABEL[task.taskType]}完成：共处理 ${task.rowCount} 行`,
        errorMessage: failed ? '任务执行失败：存在未通过的校验规则，已回滚本次批处理' : '',
        logs
      })
      return
    }
    logs.push({
      time: now.slice(11),
      text: `任务进行中，当前进度 ${percent}%`,
      level: 'info'
    })
    crBatchTaskTable.update({
      id: task.id,
      percent,
      costTime: task.costTime + 3,
      resultMessage: `${BATCH_TASK_TYPE_LABEL[task.taskType]}处理中…… 当前进度 ${percent}%`,
      logs: logs.slice(-40)
    })
  })

  if (!running.length) {
    const orgs = reportOrgs().filter((org) => org.orgLevel === 2)
    const reports = reportOptions()
    const org = orgs[Date.now() % orgs.length]
    const report = reports[Date.now() % reports.length]
    const task = appendBatchTask({
      taskType: BATCH_TASK_TYPE.SUMMARY,
      orgId: org?.id,
      orgName: org?.orgName,
      reportId: report?.id,
      reportCode: report?.reportCode,
      reportName: report?.reportName,
      period: PERIOD,
      rowCount: 20 + (Date.now() % 40),
      status: BATCH_TASK_STATUS.RUNNING,
      percent: 5,
      resultMessage: '定时汇总任务已启动……'
    })
    crBatchTaskTable.update({ id: task.id, logs: task.logs })
  }
}

onGet('/cr/data-monitor/page', (ctx) => {
  advanceRunningTasks()
  const page = paginate(
    crBatchTaskTable
      .all()
      .filter((row) => {
        if (ctx.params.taskType && Number(row.taskType) !== Number(ctx.params.taskType))
          return false
        if (ctx.params.status && Number(row.status) !== Number(ctx.params.status)) return false
        if (ctx.params.period && !String(row.period).includes(String(ctx.params.period)))
          return false
        if (ctx.params.orgId && Number(row.orgId) !== Number(ctx.params.orgId)) return false
        return likeAny(row, ['taskNo', 'orgName', 'reportName', 'reportCode'], ctx.params.keyword)
      })
      .sort((a, b) => b.id - a.id)
      .map(stripLogs),
    ctx.params
  )
  const all = crBatchTaskTable.all()
  return {
    ...page,
    runningCount: all.filter((row) => row.status === BATCH_TASK_STATUS.RUNNING).length,
    successCount: all.filter((row) => row.status === BATCH_TASK_STATUS.SUCCESS).length,
    failCount: all.filter((row) => row.status === BATCH_TASK_STATUS.FAIL).length
  }
})

onGet('/cr/data-monitor/log', (ctx) => {
  const task = crBatchTaskTable.get(Number(ctx.params.id))
  if (!task) throw new Error('批处理任务不存在，请刷新后重试')
  return {
    id: task.id,
    taskNo: task.taskNo,
    taskType: task.taskType,
    taskTypeName: BATCH_TASK_TYPE_LABEL[task.taskType] || '',
    status: task.status,
    statusName: BATCH_TASK_STATUS_LABEL[task.status] || '',
    percent: task.percent,
    orgName: task.orgName,
    reportName: task.reportName,
    period: task.period,
    startTime: task.startTime,
    endTime: task.endTime,
    costTime: task.costTime,
    logs: task.logs
  }
})

/* ==================================================================
 * 报文生成下载
 * ================================================================== */
/** 生成中的报文在下次查询时置为生成成功（模拟异步生成） */
const advanceGeneratingMessages = (): void => {
  crMessageTable
    .all()
    .filter((row) => row.status === MESSAGE_STATUS.GENERATING)
    .forEach((row) => {
      // 生成完成：文件名 / 格式 / 行数 / 字节数都按同一份 planMessageFile 落库
      // （与「报文状态查询」同源时行数、大小完全一致；没有数据则判为生成失败）
      const genTime = formatDateTime()
      const plan = planMessageFile({
        orgId: row.orgId,
        reportId: row.reportId,
        period: row.period,
        fileName: row.messageName,
        genTime,
        reportType: row.reportType
      })
      const dataRows = plan.meta.dataRows
      const ready = dataRows > 0
      crMessageTable.update({
        id: row.id,
        status: ready ? MESSAGE_STATUS.SUCCESS : MESSAGE_STATUS.FAIL,
        messageName: plan.fileName,
        fileType: plan.format,
        fileSize: ready ? plan.bytes : 0,
        rowCount: dataRows,
        genTime,
        reportType: plan.meta.reportType,
        remark: ready ? '' : '报文生成失败：源数据为空，请检查数据加工任务后重新生成'
      })
    })
}

onGet('/cr/data-message/page', (ctx) => {
  advanceGeneratingMessages()
  return paginate(
    crMessageTable
      .all()
      .filter((row) => {
        if (ctx.params.orgId && Number(row.orgId) !== Number(ctx.params.orgId)) return false
        if (ctx.params.reportId && Number(row.reportId) !== Number(ctx.params.reportId))
          return false
        if (ctx.params.period && !String(row.period).includes(String(ctx.params.period)))
          return false
        if (ctx.params.fileType && row.fileType !== ctx.params.fileType) return false
        if (ctx.params.status && Number(row.status) !== Number(ctx.params.status)) return false
        return likeAny(
          row,
          ['messageName', 'orgName', 'reportName', 'reportCode'],
          ctx.params.keyword
        )
      })
      .sort((a, b) => (a.genTime === b.genTime ? b.id - a.id : a.genTime < b.genTime ? 1 : -1)),
    ctx.params
  )
})

onPost('/cr/data-message/generate', (ctx) => {
  const { orgId, reportId, period, fileType } = ctx.body || {}
  const org = reportOrgs().find((item) => item.id === Number(orgId))
  const report = reportOptions().find((item) => item.id === Number(reportId))
  if (!org) throw new Error('请选择报送机构')
  if (!report) throw new Error('请选择报表')
  const targetPeriod = String(period || PERIOD)
  const rows = queryFillData(org.id, report.id, targetPeriod)
  if (!rows.length) {
    throw new Error(
      `「${org.orgName} / ${report.reportName} / ${targetPeriod}」暂无填报数据，无法生成报文`
    )
  }
  const nextId = crMessageTable.all().reduce((max, row) => Math.max(max, row.id), 0) + 1
  const type = String(fileType || 'TXT').toUpperCase()
  const genTime = formatDateTime()
  // 文件名 / 内容格式 / 数据行数都走统一口径：扩展名与所选文件类型一一对应
  const plan = planMessageFile({
    orgId: org.id,
    reportId: report.id,
    period: targetPeriod,
    fileType: type,
    genTime
  })
  const created = crMessageTable.insert({
    id: nextId,
    messageName: plan.fileName,
    orgId: org.id,
    orgName: org.orgName,
    reportId: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName,
    period: targetPeriod,
    fileType: plan.format,
    // 生成中：文件尚未产出，大小 / 行数由下次查询时的生成结果回写
    fileSize: 0,
    rowCount: 0,
    status: MESSAGE_STATUS.GENERATING,
    genTime,
    genUser: fillUserOf(org.orgName),
    reportType: plan.meta.reportType,
    direction: '上报',
    remark: '报文生成中，请稍候刷新'
  })
  appendBatchTask({
    taskType: BATCH_TASK_TYPE.MESSAGE,
    orgId: org.id,
    orgName: org.orgName,
    reportId: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName,
    period: targetPeriod,
    rowCount: rows.length,
    status: BATCH_TASK_STATUS.RUNNING,
    percent: 20,
    resultMessage: `正在生成 ${type} 报文……`
  })
  return created
})

onPut('/cr/data-message/regenerate', (ctx) => {
  const row = crMessageTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('报文记录不存在，请刷新后重试')
  if (row.status === MESSAGE_STATUS.GENERATING)
    throw new Error('该报文正在生成中，请稍后再重新生成')
  crMessageTable.update({
    id: row.id,
    status: MESSAGE_STATUS.GENERATING,
    fileSize: 0,
    genTime: formatDateTime(),
    remark: '重新生成中，请稍候刷新'
  })
  appendBatchTask({
    taskType: BATCH_TASK_TYPE.MESSAGE,
    orgId: row.orgId,
    orgName: row.orgName,
    reportId: row.reportId,
    reportCode: row.reportCode,
    reportName: row.reportName,
    period: row.period,
    rowCount: row.rowCount,
    status: BATCH_TASK_STATUS.RUNNING,
    percent: 20,
    resultMessage: `正在重新生成 ${row.fileType} 报文……`
  })
  return true
})

onDelete('/cr/data-message/delete', (ctx) => {
  const row = crMessageTable.get(Number(ctx.params.id))
  if (!row) throw new Error('报文记录不存在，请刷新后重试')
  if (row.status === MESSAGE_STATUS.GENERATING) throw new Error('该报文正在生成中，不允许删除')
  crMessageTable.remove(row.id)
  return true
})

/**
 * 下载报文
 *
 * 完全按列表上显示的口径下发文件（与「一键报送 → 报文状态查询」共用同一套生成器）：
 * - 行数 = 列表的 rowCount，一行不少（不再截断，也不再是"填报明细导出的 CSV"）；
 * - 格式 = 文件名后缀（.txt 竖线分隔纯文本 / .csv 逗号分隔 / .xml 结构化报文），MIME 与之一致；
 * - 字节数 = 列表的 fileSize（同一份 planMessageFile 推导，这里再用实际 Blob 校验一次）。
 */
onGet('/cr/data-message/download', (ctx) => {
  const row = crMessageTable.get(Number(ctx.params.id))
  if (!row) throw new Error('报文记录不存在，请刷新后重试')
  if (row.status === MESSAGE_STATUS.GENERATING) throw new Error('报文正在生成中，请稍后再下载')
  // 0 行 / 0 字节：没有可下载的内容，直接拒绝（与「报文状态查询」处理一致）
  if (!row.rowCount || !row.fileSize) {
    throw new Error('该报文没有可下载数据（生成失败或源数据为空），请先重新生成报文')
  }
  if (row.status === MESSAGE_STATUS.FAIL) throw new Error('报文生成失败，请先重新生成后再下载')
  const plan = planMessageFile({
    orgId: row.orgId,
    reportId: row.reportId,
    period: row.period,
    fileName: row.messageName,
    genTime: row.genTime,
    reportType: row.reportType,
    dataRows: row.rowCount
  })
  const file = buildSubmitFile(plan.meta, plan.options)
  // 列表上的文件大小必须等于实际下载的字节数：万一历史数据对不上，按真实内容回写并告警
  if (plan.bytes !== row.fileSize) {
    console.warn(
      `[Mock] 报文 ${row.messageName} 列表大小 ${row.fileSize} 与实际生成 ${plan.bytes} 不一致，已按实际内容回写`
    )
    crMessageTable.update({ id: row.id, fileSize: plan.bytes, fileType: plan.format })
  }
  return file.blob
})

export { BATCH_TASK_TYPE_LABEL }
