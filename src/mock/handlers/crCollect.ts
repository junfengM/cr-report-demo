/**
 * Mock 接口 — 数据采集域（P1）
 *
 * 九组接口（前缀 /cr/...）：
 *   collect-period      报送期次（关闭前校验任务完成度）
 *   collect-channel     采集方式（连接测试 / 「立即采集」→ 生成取数任务 + 导入批次）
 *   collect-job         取数记录（系统直连 / 接口推送的每一次调用与连接测试留痕）
 *   import-config       导入设置（生效模板解析：机构+报表 → 报表默认 → 机构默认 → 全局默认）
 *   collect-import      数据导入（真实解析结果落暂存 → 按导入权限与导入设置决定入库或转审核）
 *   import-audit        导入审核（通过才写填报数据）
 *   import-auth         导入权限（由 effectiveImportAuth() 落成真实校验）
 *   import-log          导入日志
 *   collect-supplement  数据补录（附件增删 / 审核 / 执行补录 → 建填报记录 + 深链去填报）
 *
 * 关键联动：导入入库 = importIntoFillData()，写的就是「数据填报」页的那张 cr.fillData，
 * 所以导入完切到数据填报页能立刻看到文件里的行，备注上标着导入批次号。
 *
 * 权限落点（这是本模块第二轮深化的重点）：导入 / 采集都先过 assertImportAuth()，
 * 它读的是「导入权限」页维护的 cr.importAuth —— 页面上藏按钮只是"看不见"，
 * 直接调接口照样会被这里拦下，和真实系统把权限放在服务端是同一条原则。
 */
import { onDelete, onGet, onPost } from '../route'
import { registerResource } from '../resource'
import { eq, formatDateTime, likeAny, paginate } from '../util'
import { currentUser } from './auth'
import { visibleOrgIdsOf } from '../db/crPermission'
import { reportOrgs, reportOptions } from '../db/crCommon'
import { ROLE_CODE, roleTable, userTable } from '../db/system'
import { crTaskTable } from '../db/crTask'
import {
  ATTACHMENT_EXTS,
  COLLECT_JOB_TYPE,
  buildCollectedRows,
  collectChannelTable,
  collectJobTable,
  collectParamsOf,
  collectPeriodTable,
  collectRowCountOf,
  DEFAULT_MAPPING,
  effectiveImportAuth,
  effectiveImportConfig,
  ensureFillRecordFor,
  fillRowsOfKey,
  importAuditTable,
  importAuthTable,
  importConfigTable,
  importIntoFillData,
  importLogTable,
  importTaskDataTable,
  importTaskRowTable,
  importTaskTable,
  MAX_ATTACHMENT_SIZE,
  nextApplyNo,
  nextBatchNo,
  nextCollectJobNo,
  nextTraceId,
  orgCodeOf,
  periodOptions,
  periodProgress,
  rollbackFillData,
  saveStagingRows,
  stagingRowsOf,
  stagingToFillRows,
  subjectOptionList,
  supplementFileTable,
  supplementFilesOf,
  supplementTable,
  syncSupplementAttachment,
  type CollectPeriodRow,
  type ImportTaskRow
} from '../db/crCollect'

/** 期次状态：0 未开始 / 1 进行中 / 2 已关闭 */
const PERIOD_OPEN = 1
const PERIOD_CLOSED = 2
/** 导入任务状态：1 解析中 / 2 解析失败 / 3 待审核 / 4 已入库 / 5 已驳回 */
const IMPORT_FAILED = 2
const IMPORT_AUDITING = 3
const IMPORT_DONE = 4
const IMPORT_REJECTED = 5
/** 导入审核流水状态，复用字典 cr_audit_status：0 待审核 / 1 审核通过 / 2 审核不通过 */
const AUDIT_PENDING = 0
const AUDIT_PASS = 1
const AUDIT_REJECT = 2
/** 导入日志动作 */
const LOG_PARSE = 1
const LOG_CHECK = 2
const LOG_LOAD = 3
const LOG_ROLLBACK = 4
const LOG_PASS = 5
const LOG_REJECT = 6

const now = () => formatDateTime()

/** 操作人：页面可以传当前登录用户，缺省按管理员记录 */
const operatorOf = (ctx: any): string => String(ctx.body?.operator || '')

/**
 * 导入权限校验（数据导入 / 立即采集 / 批次入库共用）。
 *
 * 为什么放在 handler 而不是只放在页面上：页面上藏按钮只是「看不见」，
 * 直接调接口照样能导 —— 真实系统的权限一定落在服务端，这里同理。
 * 不通过时抛中文错误（adapter 会原样弹成业务提示）。
 */
const assertImportAuth = (
  ctx: any,
  params: { orgId: number; reportId: number; rowCount?: number; action: string }
) => {
  const user = currentUser(ctx)
  const auth = effectiveImportAuth(user?.id, params.orgId, params.reportId)
  if (!auth.canImport) {
    throw new Error(
      auth.userName +
        ' 没有「' +
        params.action +
        '」权限：' +
        auth.source +
        '（可联系管理员在「导入权限」中授权）'
    )
  }
  if (auth.maxRows > 0 && Number(params.rowCount) > auth.maxRows) {
    throw new Error(
      '本批次 ' +
        params.rowCount +
        ' 行，超过单批上限 ' +
        auth.maxRows +
        ' 行（来源：' +
        auth.source +
        '）'
    )
  }
  return auth
}

/** 权限来源写成一句话，落进导入日志，事后能查到"这批是按哪条权限进来的" */
const authLogText = (auth: ReturnType<typeof effectiveImportAuth>): string =>
  auth.superAdmin
    ? '权限：系统管理员不受限'
    : '权限：' +
      auth.source +
      (auth.needAudit ? '（需审核）' : '') +
      (auth.maxRows ? '，单批上限 ' + auth.maxRows + ' 行' : '')

/** 当前处于采集中的期次（没有就用 202608） */
const currentPeriod = (): string => {
  const row = collectPeriodTable.all().find((item) => item.status === PERIOD_OPEN)
  return row ? row.period : '202608'
}

/** 取期次配置，不存在直接报错 */
const periodRowOf = (period: string): CollectPeriodRow => {
  const row = collectPeriodTable.all().find((item) => item.period === period)
  if (!row) throw new Error('期次不存在：' + period)
  return row
}

/** 导入 / 补录前的期次校验：已关闭且不允许补录的期次不收数据 */
const assertPeriodWritable = (period: string): CollectPeriodRow => {
  const row = periodRowOf(period)
  if (row.status === PERIOD_CLOSED && !row.allowSupplement) {
    throw new Error(
      '期次 ' + period + ' 已关闭且不允许补录，无法导入数据（可在报送期次设置中开放补录）'
    )
  }
  return row
}

/** 写一条导入日志 */
const addLog = (params: {
  batchNo: string
  orgName: string
  reportName: string
  period: string
  action: number
  operator: string
  result: number
  duration: number
  message: string
}) => {
  importLogTable.insert({
    batchNo: params.batchNo,
    orgName: params.orgName,
    reportName: params.reportName,
    period: params.period,
    action: params.action,
    operator: params.operator,
    operateTime: now(),
    result: params.result,
    duration: params.duration,
    ip: '127.0.0.1',
    message: params.message
  })
}

/* ==================================================================
 * 0. 公共下拉
 * ================================================================== */
onGet('/cr/collect-common/org-options', () =>
  reportOrgs().map((org) => ({
    id: org.id,
    orgCode: org.orgCode,
    orgName: org.orgName,
    orgLevel: org.orgLevel
  }))
)

onGet('/cr/collect-common/report-options', (ctx) =>
  reportOptions()
    .filter((report) => likeAny(report as any, ['reportCode', 'reportName'], ctx.params.keyword))
    .map((report) => ({
      id: report.id,
      reportCode: report.reportCode,
      reportName: report.reportName,
      freq: report.freq
    }))
)

onGet('/cr/collect-common/period-options', () => periodOptions())

onGet('/cr/collect-common/subject-options', () => subjectOptionList())

onGet('/cr/collect-common/user-options', (ctx) =>
  userTable
    .all()
    .filter((user) => user.status === 0)
    .filter((user) => likeAny(user as any, ['nickname', 'username'], ctx.params.keyword))
    .map((user) => ({ id: user.id, nickname: user.nickname, deptId: user.deptId }))
)

/* ==================================================================
 * 1. 报送期次
 * ================================================================== */
registerResource<CollectPeriodRow>({
  prefix: '/cr/collect-period',
  table: collectPeriodTable,
  filter: (row, params) =>
    String(row.period).indexOf(String(params.period || '')) >= 0 &&
    eq(row, 'status', params.status) &&
    likeAny(row as any, ['period', 'periodName', 'remark'], params.keyword),
  sort: (a, b) => (a.period < b.period ? 1 : -1),
  beforeCreate: (body) => ({
    ...body,
    status: body.status === undefined ? 1 : Number(body.status),
    closeTime: '',
    closeUser: '',
    createTime: now()
  }),
  toSimple: (row) => ({
    id: row.id,
    period: row.period,
    periodName: row.periodName,
    status: row.status
  }),
  exportColumns: [
    { field: 'period', label: '期次' },
    { field: 'periodName', label: '期次名称' },
    { field: 'collectStart', label: '采集开始' },
    { field: 'collectEnd', label: '采集结束' },
    { field: 'deadline', label: '报送截止' },
    { field: 'allowSupplement', label: '允许补录' },
    { field: 'status', label: '状态' },
    { field: 'remark', label: '备注' }
  ]
})

/** 期次进度：任务数 / 已完成 / 填报行数，从任务表与填报数据实时汇总 */
onGet('/cr/collect-period/progress', () => periodProgress())

/** 关闭期次前的体检 */
onGet('/cr/collect-period/close-check', (ctx) => {
  const period = String(ctx.params.period || currentPeriod())
  const tasks = crTaskTable.all().filter((task) => task.period === period)
  const unfinished = tasks.filter((task) => task.status !== 90 && task.status !== 100).length
  const draftRecords = 0
  const canClose = unfinished === 0
  return {
    period,
    taskCount: tasks.length,
    unfinished,
    draftRecords,
    canClose,
    message: canClose
      ? '本期 ' + tasks.length + ' 个任务已全部审核通过，可以关闭期次'
      : '本期还有 ' + unfinished + ' 个任务未审核通过，关闭前期次前请先完成填报与审核（可强制关闭）'
  }
})

/** 开放 / 重新开放期次采集 */
onPost('/cr/collect-period/open', (ctx) => {
  const period = String(ctx.body?.period || '')
  const row = periodRowOf(period)
  const operator = operatorOf(ctx) || '系统管理员'
  const updated = collectPeriodTable.update({
    id: row.id,
    status: PERIOD_OPEN,
    closeTime: '',
    closeUser: '',
    remark: ctx.body?.remark || '' || '已开放采集，操作人：' + operator
  })
  return updated
})

/** 关闭期次：默认要求本期任务全部审核通过，force=true 可强制关闭 */
onPost('/cr/collect-period/close', (ctx) => {
  const period = String(ctx.body?.period || '')
  const force = !!ctx.body?.force
  const row = periodRowOf(period)
  if (row.status === PERIOD_CLOSED) throw new Error('期次 ' + period + ' 已经关闭，无需重复操作')
  const tasks = crTaskTable.all().filter((task) => task.period === period)
  const unfinished = tasks.filter((task) => task.status !== 90 && task.status !== 100).length
  if (unfinished > 0 && !force) {
    throw new Error(
      '本期还有 ' + unfinished + ' 个任务未审核通过，不能关闭期次（确认要关闭请使用强制关闭）'
    )
  }
  const operator = operatorOf(ctx) || '系统管理员'
  return collectPeriodTable.update({
    id: row.id,
    status: PERIOD_CLOSED,
    closeTime: now(),
    closeUser: operator,
    remark:
      (unfinished > 0 ? '强制关闭：仍有 ' + unfinished + ' 个任务未完成；' : '') +
      (ctx.body?.remark || '关闭期次，停止接收数据')
  })
})

/* ==================================================================
 * 2. 采集方式
 * ================================================================== */
registerResource({
  prefix: '/cr/collect-channel',
  table: collectChannelTable,
  filter: (row, params) =>
    eq(row, 'orgId', params.orgId) &&
    eq(row, 'reportId', params.reportId) &&
    eq(row, 'channelType', params.channelType) &&
    eq(row, 'status', params.status) &&
    likeAny(
      row as any,
      ['orgName', 'reportName', 'reportCode', 'dataSource', 'endpoint', 'owner'],
      params.keyword
    ),
  sort: (a, b) => a.orgId - b.orgId || a.reportId - b.reportId,
  beforeCreate: (body) => ({
    ...body,
    lastCollectTime: '',
    lastStatus: 0,
    lastMessage: '',
    status: body.status === undefined ? 1 : Number(body.status)
  }),
  toSimple: (row) => ({
    id: row.id,
    orgName: row.orgName,
    reportName: row.reportName,
    channelType: row.channelType
  }),
  exportColumns: [
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表代码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'channelType', label: '采集方式' },
    { field: 'dataSource', label: '源系统' },
    { field: 'endpoint', label: '采集地址' },
    { field: 'protocol', label: '协议' },
    { field: 'cronText', label: '调度周期' },
    { field: 'lastCollectTime', label: '上次采集时间' },
    { field: 'owner', label: '责任人' }
  ]
})

/** 启用 / 停用 */
onPost('/cr/collect-channel/toggle', (ctx) => {
  const row = collectChannelTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('采集配置不存在')
  const status = Number(ctx.body?.status)
  return collectChannelTable.update({ id: row.id, status: status === 1 ? 1 : 0 })
})

/**
 * 连接测试：真实系统里是拿配置好的地址、账号去探一次源系统。
 * Demo 无后端，确定性模拟：采集地址没配、采集方式已停用、或 id 是 5 的倍数时失败
 * （id=5 正好是「上海分公司 · 团险核心系统 · 接口推送」，留着演示"测试不通 → 排查 → 重测"）。
 * 每次测试都落一条取数任务记录（jobType = 2），可追溯"谁在什么时候测过、通不通"。
 */
onPost('/cr/collect-channel/test-connection', (ctx) => {
  const row = collectChannelTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('采集配置不存在')
  if (row.channelType === 2 || row.channelType === 4) {
    throw new Error('文件导入 / 手工录入没有可连接的源系统，无需连接测试')
  }
  const period = currentPeriod()
  const operator = operatorOf(ctx) || currentUser(ctx)?.nickname || '系统管理员'
  const started = Date.now()
  const noEndpoint = !row.endpoint || row.endpoint === '—'
  const reachable = Number(row.status) === 1 && row.id % 5 !== 0 && !noEndpoint
  const handshake = 30 + ((row.id * 137) % 260)
  const expectRows = collectRowCountOf(row.orgId, row.reportId)
  const message = reachable
    ? '连接成功：' +
      row.protocol +
      ' 握手 ' +
      handshake +
      'ms，探测到 ' +
      row.dataSource +
      ' 可读，预计本期可抽取 ' +
      expectRows +
      ' 行'
    : Number(row.status) !== 1
      ? '连接失败：该采集方式已停用，请先启用后再测试'
      : noEndpoint
        ? '连接失败：采集地址为空，请先在「修改」里填写接口地址 / 库表名 / FTP 目录'
        : '连接超时（3000ms）：无法访问 ' + row.endpoint + '，请检查网络、白名单与账号权限'
  const job = collectJobTable.insert({
    jobNo: nextCollectJobNo(period),
    jobType: COLLECT_JOB_TYPE.TEST,
    channelId: row.id,
    orgId: row.orgId,
    orgName: row.orgName,
    reportId: row.reportId,
    reportCode: row.reportCode,
    reportName: row.reportName,
    period,
    channelType: row.channelType,
    dataSource: row.dataSource,
    endpoint: row.endpoint,
    protocol: row.protocol,
    mode: '连接测试',
    requestParams: collectParamsOf(row.protocol, orgCodeOf(row.orgId), period),
    traceId: nextTraceId(period),
    startTime: formatDateTime(started),
    endTime: formatDateTime(Date.now()),
    cost: Date.now() - started + handshake,
    rowCount: reachable ? expectRows : 0,
    status: reachable ? 1 : 0,
    message,
    taskId: 0,
    batchNo: '',
    operator
  })
  addLog({
    batchNo: job.jobNo,
    orgName: row.orgName,
    reportName: row.reportName,
    period,
    action: LOG_PARSE,
    operator,
    result: reachable ? 1 : 0,
    duration: job.cost,
    message: '连接测试：' + message
  })
  return {
    id: job.id,
    jobNo: job.jobNo,
    traceId: job.traceId,
    reachable,
    handshake,
    endpoint: row.endpoint,
    protocol: row.protocol,
    dataSource: row.dataSource,
    expectRows,
    cost: job.cost,
    message
  }
})

/** 取数记录（连接测试 + 取数任务，按时间倒序） */
onGet('/cr/collect-job/page', (ctx) => {
  const params = ctx.params || {}
  const rows = collectJobTable
    .all()
    .filter((row) => eq(row, 'jobType', params.jobType))
    .filter((row) => eq(row, 'status', params.status))
    .filter((row) => eq(row, 'channelType', params.channelType))
    .filter((row) => eq(row, 'orgId', params.orgId))
    .filter((row) => eq(row, 'reportId', params.reportId))
    .filter((row) => eq(row, 'period', params.period))
    .filter((row) =>
      likeAny(
        row as any,
        [
          'jobNo',
          'traceId',
          'orgName',
          'reportName',
          'dataSource',
          'endpoint',
          'message',
          'operator',
          'batchNo'
        ],
        params.keyword
      )
    )
    .sort((a, b) => (a.startTime < b.startTime ? 1 : -1))
  const pageNo = Math.max(1, Number(params.pageNo) || 1)
  const pageSize = Math.max(1, Number(params.pageSize) || 10)
  const start = (pageNo - 1) * pageSize
  return { list: rows.slice(start, start + pageSize), total: rows.length }
})

/**
 * 立即采集：系统直连 / 接口推送才可用。
 * 真实动作 = 生成一个导入批次（含暂存数据），按导入设置 + 导入权限决定「直接入库」还是「转人工审核」，
 * 所以采集完之后能在「数据导入 / 导入审核」里看到这个批次，审核通过才写进填报数据。
 */
onPost('/cr/collect-channel/collect', (ctx) => {
  const row = collectChannelTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('采集配置不存在')
  if (row.status !== 1) throw new Error('该采集方式已停用，请先启用后再采集')
  if (row.channelType === 2) throw new Error('文件导入方式由填报人上传文件，不触发自动采集')
  if (row.channelType === 4) throw new Error('手工录入方式不需要自动采集')
  const period = currentPeriod()
  assertPeriodWritable(period)
  const count = collectRowCountOf(row.orgId, row.reportId)
  // 取数也受导入权限约束：审核岗（不能导入）点立即采集会被拦下
  const auth = assertImportAuth(ctx, {
    orgId: row.orgId,
    reportId: row.reportId,
    rowCount: count,
    action: '数据采集'
  })
  const config = effectiveImportConfig(row.orgId, row.reportId)
  // 配置要求审核 或 权限要求审核，任一为真就走审核
  const needAudit = !!config.needAudit || !!auth.needAudit
  const rows = buildCollectedRows(row.orgId, row.reportId, period, count)
  const batchNo = nextBatchNo(period)
  const status = needAudit ? IMPORT_AUDITING : IMPORT_DONE
  const operator =
    operatorOf(ctx) ||
    currentUser(ctx)?.nickname ||
    (row.channelType === 1 ? '系统直连' : '接口推送')
  const started = Date.now()
  const jobNo = nextCollectJobNo(period)
  const traceId = nextTraceId(period)
  const reqParams = collectParamsOf(row.protocol, orgCodeOf(row.orgId), period)
  const task = importTaskTable.insert({
    batchNo,
    orgId: row.orgId,
    orgName: row.orgName,
    reportId: row.reportId,
    reportCode: row.reportCode,
    reportName: row.reportName,
    period,
    fileName: 'collect_' + row.orgName + '_' + row.reportCode + '_' + period + '.csv',
    fileSize: count * 96,
    fileType: 1,
    totalRows: count,
    successRows: count,
    failRows: 0,
    status,
    sourceType: row.channelType,
    importer: operator,
    importTime: now(),
    importCost: 600 + count * 12,
    auditor: '',
    auditTime: '',
    auditRemark: '',
    writtenRows: 0,
    remark: '由采集方式「' + row.dataSource + '」自动采集生成（取数任务 ' + jobNo + '）'
  })
  saveStagingRows(task.id, batchNo, rows)
  let written = 0
  if (status === IMPORT_DONE) {
    written = importIntoFillData(
      { orgId: row.orgId, reportId: row.reportId, period },
      rows,
      '导入批次 ' + batchNo,
      operator
    ).written
    importTaskTable.update({ id: task.id, writtenRows: written })
  } else {
    importAuditTable.insert({
      taskId: task.id,
      batchNo,
      orgId: row.orgId,
      orgName: row.orgName,
      reportId: row.reportId,
      reportName: row.reportName,
      period,
      totalRows: count,
      successRows: count,
      failRows: 0,
      submitUser: operator,
      submitTime: now(),
      status: 1,
      auditor: '',
      auditTime: '',
      auditRemark: ''
    })
  }
  collectJobTable.insert({
    jobNo,
    jobType: COLLECT_JOB_TYPE.COLLECT,
    channelId: row.id,
    orgId: row.orgId,
    orgName: row.orgName,
    reportId: row.reportId,
    reportCode: row.reportCode,
    reportName: row.reportName,
    period,
    channelType: row.channelType,
    dataSource: row.dataSource,
    endpoint: row.endpoint,
    protocol: row.protocol,
    mode: row.channelType === 1 ? '全量抽取' : '增量推送',
    requestParams: reqParams,
    traceId,
    startTime: formatDateTime(started),
    endTime: formatDateTime(Date.now()),
    cost: Date.now() - started + 400 + count * 6,
    rowCount: count,
    status: 1,
    message: '返回 ' + count + ' 行' + (status === IMPORT_DONE ? '，已入库' : '，已转人工审核'),
    taskId: task.id,
    batchNo,
    operator
  })
  addLog({
    batchNo,
    orgName: row.orgName,
    reportName: row.reportName,
    period,
    action: LOG_PARSE,
    operator,
    result: 1,
    duration: 400 + count * 6,
    message:
      '采集 ' +
      count +
      ' 行（源系统：' +
      row.dataSource +
      '，取数任务 ' +
      jobNo +
      '，' +
      authLogText(auth) +
      '）'
  })
  addLog({
    batchNo,
    orgName: row.orgName,
    reportName: row.reportName,
    period,
    action: LOG_CHECK,
    operator,
    result: 1,
    duration: 120,
    message: '校验通过，无错误行'
  })
  addLog({
    batchNo,
    orgName: row.orgName,
    reportName: row.reportName,
    period,
    action: status === IMPORT_DONE ? LOG_LOAD : LOG_CHECK,
    operator: status === IMPORT_DONE ? '系统自动' : operator,
    result: 1,
    duration: 300,
    message: status === IMPORT_DONE ? '写入填报数据 ' + written + ' 行' : '等待人工审核后入库'
  })
  collectChannelTable.update({
    id: row.id,
    lastCollectTime: now(),
    lastStatus: 1,
    lastMessage: '采集 ' + count + ' 行' + (status === IMPORT_DONE ? '，已入库' : '，待审核')
  })
  return {
    taskId: task.id,
    batchNo,
    status,
    rows: count,
    writtenRows: written,
    needAudit,
    jobNo,
    traceId
  }
})

/* ==================================================================
 * 3. 导入设置
 * ================================================================== */
registerResource({
  prefix: '/cr/import-config',
  table: importConfigTable,
  filter: (row, params) =>
    eq(row, 'orgId', params.orgId) &&
    eq(row, 'reportId', params.reportId) &&
    eq(row, 'fileType', params.fileType) &&
    eq(row, 'status', params.status) &&
    likeAny(row as any, ['orgName', 'reportName', 'reportCode', 'remark'], params.keyword),
  sort: (a, b) => a.orgId - b.orgId || a.reportId - b.reportId,
  beforeCreate: (body) => ({
    ...body,
    updateUser: operatorOf({ body }) || '系统管理员',
    updateTime: now()
  }),
  beforeUpdate: (body) => ({
    ...body,
    updateUser: operatorOf({ body }) || '系统管理员',
    updateTime: now()
  }),
  toSimple: (row) => ({
    id: row.id,
    orgName: row.orgName,
    reportName: row.reportName,
    fileType: row.fileType
  }),
  exportColumns: [
    { field: 'orgName', label: '机构' },
    { field: 'reportName', label: '报表' },
    { field: 'fileType', label: '文件类型' },
    { field: 'separator', label: '分隔符' },
    { field: 'charset', label: '编码' },
    { field: 'headerRows', label: '表头行数' },
    { field: 'startRow', label: '数据起始行' },
    { field: 'dateFormat', label: '日期格式' },
    { field: 'strictCheck', label: '严格校验' },
    { field: 'allowOverwrite', label: '允许覆盖' },
    { field: 'needAudit', label: '需要审核' },
    { field: 'status', label: '状态' }
  ]
})

/** 导入设置可映射的系统字段 */
onGet('/cr/import-config/field-options', () =>
  DEFAULT_MAPPING.map((item) => ({ field: item.field, label: item.label }))
)

/**
 * 生效模板：数据导入页在解析文件前先拿这个，按里面的分隔符 / 表头行数 / 字段映射解析真实文件
 */
onGet('/cr/import-config/effective', (ctx) => {
  const orgId = Number(ctx.params.orgId) || 0
  const reportId = Number(ctx.params.reportId) || 0
  const config = effectiveImportConfig(orgId, reportId)
  const rows = importConfigTable.all()
  let level = '全局默认模板'
  if (config.orgId === orgId && config.reportId === reportId && orgId && reportId)
    level = '机构 + 报表精确匹配'
  else if (config.reportId === reportId && config.orgId === 0) level = '报表默认模板'
  else if (config.orgId === orgId && config.reportId === 0) level = '机构默认模板'
  const exact = rows.find((row) => row.orgId === orgId && row.reportId === reportId)
  return {
    config,
    level,
    matchedId: exact ? exact.id : 0,
    existRows: fillRowsOfKey(orgId, reportId, currentPeriod())
  }
})

/* ==================================================================
 * 4. 数据导入（导入任务 = 一个批次）
 * ================================================================== */
/** 批次列表的筛选条件：/page 覆盖版与导出共用同一份，避免两处口径不一致 */
const filterImportTask = (row: ImportTaskRow, params: Record<string, any>) =>
  eq(row, 'orgId', params.orgId) &&
  eq(row, 'reportId', params.reportId) &&
  eq(row, 'period', params.period) &&
  eq(row, 'status', params.status) &&
  eq(row, 'sourceType', params.sourceType) &&
  eq(row, 'fileType', params.fileType) &&
  likeAny(
    row as any,
    ['batchNo', 'orgName', 'reportName', 'reportCode', 'fileName', 'importer'],
    params.keyword
  )

registerResource<ImportTaskRow>({
  prefix: '/cr/collect-import',
  table: importTaskTable,
  filter: filterImportTask,
  sort: (a, b) => (a.importTime < b.importTime ? 1 : -1),
  beforeCreate: (body) => ({
    ...body,
    batchNo: nextBatchNo(String(body.period || currentPeriod())),
    importTime: now(),
    writtenRows: 0
  }),
  toSimple: (row) => ({
    id: row.id,
    batchNo: row.batchNo,
    orgName: row.orgName,
    reportName: row.reportName,
    status: row.status
  }),
  exportColumns: [
    { field: 'batchNo', label: '批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'reportName', label: '报表' },
    { field: 'period', label: '期次' },
    { field: 'fileName', label: '文件名' },
    { field: 'totalRows', label: '总行数' },
    { field: 'successRows', label: '成功行数' },
    { field: 'failRows', label: '失败行数' },
    { field: 'status', label: '状态' },
    { field: 'importer', label: '导入人' },
    { field: 'importTime', label: '导入时间' }
  ]
})

/**
 * 列表按「数据权限」过滤（覆盖 registerResource 生成的 /page）。
 *
 * 为什么必须覆盖：通用的 filter 回调只拿得到 (row, params)，判定不了"当前登录人是谁"。
 * 这里让填报岗 / 分公司账号只看到自己机构范围内的批次 —— 之前这条边界一直挂在
 * 「已知简化 26：没做机构数据范围过滤（填报岗能看到全部机构的批次）」里，现在由
 * 「数据权限配置」页的规则（含回落角色默认数据范围）真正生效；管理员不受限。
 */
onGet('/cr/collect-import/page', (ctx) => {
  const user = currentUser(ctx)
  const visible = visibleOrgIdsOf(user?.id, Number(ctx.params.reportId || 0))
  const rows = importTaskTable
    .all()
    .filter((row) => (visible ? visible.indexOf(Number(row.orgId)) >= 0 : true))
    .filter((row) => filterImportTask(row, ctx.params))
    .sort((a, b) => (a.importTime < b.importTime ? 1 : -1))
  return paginate(rows, ctx.params)
})

/** 批次详情：任务 + 暂存数据（前 20 行）+ 错误行 + 该批次日志 */
// 覆盖 registerResource 生成的 /delete 与 /delete-list：批次删除同样只给管理员
onDelete('/cr/collect-import/delete', (ctx) => {
  assertBatchAdmin(ctx, '批次删除')
  const id = Number(ctx.params.id)
  if (Number.isNaN(id)) throw new Error('缺少 id')
  importTaskDataTable.removeBatch(
    importTaskDataTable
      .all()
      .filter((row) => row.taskId === id)
      .map((row) => row.id)
  )
  importTaskRowTable.removeBatch(
    importTaskRowTable
      .all()
      .filter((row) => row.taskId === id)
      .map((row) => row.id)
  )
  importTaskTable.remove(id)
  return true
})

onDelete('/cr/collect-import/delete-list', (ctx) => {
  assertBatchAdmin(ctx, '批次删除')
  const ids = String(ctx.params.ids || '')
    .split(',')
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id))
  if (!ids.length) throw new Error('缺少 ids')
  ids.forEach((id) => {
    importTaskDataTable.removeBatch(
      importTaskDataTable
        .all()
        .filter((row) => row.taskId === id)
        .map((row) => row.id)
    )
    importTaskRowTable.removeBatch(
      importTaskRowTable
        .all()
        .filter((row) => row.taskId === id)
        .map((row) => row.id)
    )
  })
  importTaskTable.removeBatch(ids)
  return true
})

onGet('/cr/collect-import/detail', (ctx) => {
  const id = Number(ctx.params.id)
  const task = importTaskTable.get(id)
  if (!task) throw new Error('导入批次不存在：id=' + id)
  return {
    task,
    dataRows: stagingRowsOf(id).slice(0, 20),
    dataTotal: stagingRowsOf(id).length,
    errorRows: importTaskRowTable.all().filter((row) => row.taskId === id),
    logs: importLogTable
      .all()
      .filter((row) => row.batchNo === task.batchNo)
      .sort((a, b) => (a.operateTime < b.operateTime ? -1 : 1)),
    stagingFieldOptions: DEFAULT_MAPPING.map((item) => ({ field: item.field, label: item.label }))
  }
})

/**
 * 我的导入权限：数据导入页顶部的横幅读它。
 * 刻意做成接口而不是页面自己算 —— 保证「页面上看到的限制」与「真正拦你的那条限制」同源，
 * 不会出现横幅说能导、提交却被拒的情况。
 */
onGet('/cr/collect-import/my-auth', (ctx) => {
  const orgId = Number(ctx.params.orgId) || 0
  const reportId = Number(ctx.params.reportId) || 0
  const auth = effectiveImportAuth(currentUser(ctx)?.id, orgId, reportId)
  const scoped = orgId > 0 && reportId > 0
  const config = scoped ? effectiveImportConfig(orgId, reportId) : undefined
  const existRows = scoped ? fillRowsOfKey(orgId, reportId, currentPeriod()) : 0
  return {
    auth,
    orgId,
    reportId,
    existRows,
    // 生效策略 = 导入设置 且 导入权限：任一条说不允许就不能覆盖 / 就需要审核
    allowOverwrite: !!config?.allowOverwrite && auth.canOverwrite,
    needAudit: !!config?.needAudit || auth.needAudit,
    configAllowOverwrite: config ? !!config.allowOverwrite : true,
    configNeedAudit: config ? !!config.needAudit : false,
    message: !scoped
      ? '先选择报送机构与报表，这里会显示当前账号在该范围上的导入权限'
      : !auth.canImport
        ? auth.userName + ' 在该范围没有导入权限：' + auth.source
        : auth.userName +
          ' 可导入（' +
          auth.source +
          '）：' +
          (auth.canOverwrite && config?.allowOverwrite
            ? '允许覆盖已有数据'
            : '不允许覆盖已有数据') +
          '、' +
          (config?.needAudit || auth.needAudit ? '需审核后入库' : '免审核直接入库') +
          (auth.maxRows ? '、单批上限 ' + auth.maxRows + ' 行' : '、单批不限行数')
  }
})

/**
 * 解析结果入库。
 * 页面负责按生效模板解析真实文件（分隔符、表头行数、列映射），这里只做业务判定：
 *   1) 期次是否可写  2) 导入权限是否允许（能不能导 / 单批上限）
 *   3) 是否允许覆盖已有填报数据（导入设置 且 导入权限）
 *   4) 严格校验失败直接判失败
 *   5) 有错误行、或导入设置/导入权限要求审核 → 待审核；否则直接入库（写 cr.fillData）
 */
onPost('/cr/collect-import/parse', (ctx) => {
  const body = ctx.body || {}
  const org = reportOrgs().find((item) => item.id === Number(body.orgId))
  const report = reportOptions().find((item) => item.id === Number(body.reportId))
  if (!org || !report) throw new Error('请先选择报送机构与报表')
  const period = String(body.period || '')
  assertPeriodWritable(period)
  const config = effectiveImportConfig(org.id, report.id)
  const validRows: Array<Record<string, any>> = Array.isArray(body.validRows) ? body.validRows : []
  const errorRows: Array<Record<string, any>> = Array.isArray(body.errorRows) ? body.errorRows : []
  const errors = errorRows.filter((row) => Number(row.level) === 1)
  const totalRows = Number(body.totalRows) || validRows.length + errorRows.length
  const auth = assertImportAuth(ctx, {
    orgId: org.id,
    reportId: report.id,
    rowCount: totalRows,
    action: '数据导入'
  })
  const existing = fillRowsOfKey(org.id, report.id, period)
  if (existing > 0 && !config.allowOverwrite) {
    throw new Error(
      '该机构本期已有 ' +
        existing +
        ' 行填报数据，当前导入设置不允许覆盖（可调整导入设置或先清空数据）'
    )
  }
  if (existing > 0 && !auth.canOverwrite) {
    throw new Error(
      '该机构本期已有 ' +
        existing +
        ' 行填报数据，' +
        auth.userName +
        ' 的导入权限不允许覆盖（来源：' +
        auth.source +
        '）'
    )
  }
  const needAudit = !!config.needAudit || !!auth.needAudit
  const failRows = errorRows.length
  const strictFailed = config.strictCheck && errors.length > 0
  const status = strictFailed
    ? IMPORT_FAILED
    : errors.length > 0 || needAudit
      ? IMPORT_AUDITING
      : IMPORT_DONE
  const operator = operatorOf(ctx) || currentUser(ctx)?.nickname || '系统管理员'
  const batchNo = nextBatchNo(period)
  const task = importTaskTable.insert({
    batchNo,
    orgId: org.id,
    orgName: org.orgName,
    reportId: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName,
    period,
    fileName: String(body.fileName || '未命名文件'),
    fileSize: Number(body.fileSize) || 0,
    fileType: Number(body.fileType) || config.fileType,
    totalRows,
    successRows: strictFailed ? 0 : validRows.length,
    failRows,
    status,
    sourceType: 2,
    importer: operator,
    importTime: now(),
    importCost: Number(body.cost) || 0,
    auditor: status === IMPORT_DONE ? '系统自动' : '',
    auditTime: status === IMPORT_DONE ? now() : '',
    auditRemark: status === IMPORT_DONE ? '导入设置与导入权限均免审核，自动入库' : '',
    writtenRows: 0,
    remark: String(body.remark || '')
  })
  saveStagingRows(task.id, batchNo, strictFailed ? [] : validRows)
  errorRows.forEach((row) => {
    importTaskRowTable.insert({
      taskId: task.id,
      batchNo,
      rowNo: Number(row.rowNo) || 0,
      content: String(row.content || ''),
      errorField: String(row.errorField || ''),
      errorMsg: String(row.errorMsg || ''),
      level: Number(row.level) === 2 ? 2 : 1
    })
  })
  if (status === IMPORT_AUDITING) {
    importAuditTable.insert({
      taskId: task.id,
      batchNo,
      orgId: org.id,
      orgName: org.orgName,
      reportId: report.id,
      reportName: report.reportName,
      period,
      totalRows,
      successRows: validRows.length,
      failRows,
      submitUser: operator,
      submitTime: now(),
      status: AUDIT_PENDING,
      auditor: '',
      auditTime: '',
      auditRemark: ''
    })
  }
  addLog({
    batchNo,
    orgName: org.orgName,
    reportName: report.reportName,
    period,
    action: LOG_PARSE,
    operator,
    result: strictFailed ? 0 : 1,
    duration: Number(body.cost) || 600,
    message:
      '解析 ' +
      totalRows +
      ' 行，成功 ' +
      validRows.length +
      ' 行，失败 ' +
      failRows +
      ' 行（' +
      authLogText(auth) +
      '）'
  })
  addLog({
    batchNo,
    orgName: org.orgName,
    reportName: report.reportName,
    period,
    action: LOG_CHECK,
    operator,
    result: errors.length ? 0 : 1,
    duration: 180,
    message: errors.length
      ? '校验发现 ' +
        errors.length +
        ' 行错误' +
        (config.strictCheck ? '，严格校验模式：整批不予入库' : '，转人工审核')
      : '校验通过，无错误行'
  })
  let written = 0
  if (status === IMPORT_DONE) {
    const result = importIntoFillData(
      { orgId: org.id, reportId: report.id, period },
      validRows,
      '导入批次 ' + batchNo,
      operator
    )
    written = result.written
    importTaskTable.update({ id: task.id, writtenRows: written })
    addLog({
      batchNo,
      orgName: org.orgName,
      reportName: report.reportName,
      period,
      action: LOG_LOAD,
      operator: '系统自动',
      result: 1,
      duration: 420,
      message:
        '写入填报数据 ' +
        written +
        ' 行' +
        (result.replaced ? '，覆盖原有 ' + result.replaced + ' 行' : '')
    })
  } else if (status === IMPORT_AUDITING) {
    addLog({
      batchNo,
      orgName: org.orgName,
      reportName: report.reportName,
      period,
      action: LOG_CHECK,
      operator,
      result: 1,
      duration: 120,
      message: '转人工审核，审核通过后写入填报数据'
    })
  }
  // 转审核的原因要说准：可能是「有错误行」，也可能是导入设置 / 导入权限要求审核
  const auditReason =
    errors.length > 0
      ? '存在 ' + errorRows.length + ' 行错误 / 警告'
      : config.needAudit && auth.needAudit
        ? '导入设置与导入权限都要求审核'
        : config.needAudit
          ? '导入设置要求审核'
          : '导入权限要求审核'
  return {
    id: task.id,
    batchNo,
    status,
    totalRows,
    successRows: strictFailed ? 0 : validRows.length,
    failRows,
    writtenRows: written,
    strictFailed,
    needAudit,
    overlay: existing > 0,
    authSource: auth.source,
    message: strictFailed
      ? '严格校验未通过：' + errors.length + ' 行错误，整批未入库'
      : status === IMPORT_DONE
        ? '导入成功，已写入填报数据 ' + written + ' 行'
        : '已生成待审核批次（' + auditReason + '），审核通过后写入填报数据'
  }
})

/** 审核一个批次（导入审核页与数据导入页共用） */
const auditTask = (taskId: number, pass: boolean, remark: string, auditor: string) => {
  const task = importTaskTable.get(taskId)
  if (!task) throw new Error('导入批次不存在：id=' + taskId)
  if (task.status !== IMPORT_AUDITING)
    throw new Error('批次 ' + task.batchNo + ' 当前状态不允许审核')
  let written = 0
  if (pass) {
    const config = effectiveImportConfig(task.orgId, task.reportId)
    const existing = fillRowsOfKey(task.orgId, task.reportId, task.period)
    if (existing > 0 && !config.allowOverwrite) {
      throw new Error('该机构本期已有 ' + existing + ' 行填报数据，导入设置不允许覆盖，无法入库')
    }
    const rows = stagingToFillRows(task.id)
    written = importIntoFillData(
      { orgId: task.orgId, reportId: task.reportId, period: task.period },
      rows,
      '导入批次 ' + task.batchNo,
      auditor
    ).written
  }
  importTaskTable.update({
    id: task.id,
    status: pass ? IMPORT_DONE : IMPORT_REJECTED,
    auditor,
    auditTime: now(),
    auditRemark: remark || (pass ? '审核通过，已写入填报数据 ' + written + ' 行' : '审核驳回'),
    writtenRows: written
  })
  importAuditTable
    .all()
    .filter((row) => row.taskId === task.id && row.status === AUDIT_PENDING)
    .forEach((row) =>
      importAuditTable.update({
        id: row.id,
        status: pass ? AUDIT_PASS : AUDIT_REJECT,
        auditor,
        auditTime: now(),
        auditRemark: remark || (pass ? '审核通过' : '审核驳回')
      })
    )
  addLog({
    batchNo: task.batchNo,
    orgName: task.orgName,
    reportName: task.reportName,
    period: task.period,
    action: pass ? LOG_PASS : LOG_REJECT,
    operator: auditor,
    result: 1,
    duration: 200,
    message: pass
      ? '审核通过，写入填报数据 ' + written + ' 行'
      : '审核驳回：' + (remark || '未填写驳回原因')
  })
  return {
    id: task.id,
    batchNo: task.batchNo,
    status: pass ? IMPORT_DONE : IMPORT_REJECTED,
    writtenRows: written
  }
}

/**
 * 批次审核 / 回滚 / 删除只给系统管理员。
 *
 * 与菜单里这三个按钮的角色收窄（BUTTONS 的第三个元素）保持一致 —— 同样不能只靠藏按钮：
 * 填报岗拿得到接口地址就能自审自导的批次。审核岗的审核入口是「导入审核」页（同样是管理员专属），
 * 真实系统里这里应改成"按审核岗角色 + 机构数据范围"判定。
 */
const assertBatchAdmin = (ctx: any, action: string) => {
  const user = currentUser(ctx)
  const codes = (user?.roleIds || [])
    .map((roleId) => roleTable.all().find((role) => Number(role.id) === Number(roleId))?.code)
    .filter(Boolean)
  if (!codes.includes(ROLE_CODE.ADMIN)) {
    throw new Error(
      '「' + action + '」仅系统管理员可操作（当前账号：' + (user ? user.nickname : '未登录') + '）'
    )
  }
}

onPost('/cr/collect-import/audit', (ctx) => {
  assertBatchAdmin(ctx, '批次审核')
  return auditTask(
    Number(ctx.body?.id),
    !!ctx.body?.pass,
    String(ctx.body?.remark || ''),
    operatorOf(ctx) || '系统管理员'
  )
})

/** 回滚已入库批次：删掉本批次写入的填报数据，批次退回待审核 */
onPost('/cr/collect-import/rollback', (ctx) => {
  assertBatchAdmin(ctx, '批次回滚')
  const task = importTaskTable.get(Number(ctx.body?.id))
  if (!task) throw new Error('导入批次不存在')
  if (task.status !== IMPORT_DONE) throw new Error('只有「已入库」的批次才能回滚')
  const removed = rollbackFillData(
    { orgId: task.orgId, reportId: task.reportId, period: task.period },
    '导入批次 ' + task.batchNo
  )
  importTaskTable.update({
    id: task.id,
    status: IMPORT_AUDITING,
    writtenRows: 0,
    auditRemark: '已回滚入库数据（删除 ' + removed + ' 行），可重新审核'
  })
  addLog({
    batchNo: task.batchNo,
    orgName: task.orgName,
    reportName: task.reportName,
    period: task.period,
    action: LOG_ROLLBACK,
    operator: operatorOf(ctx) || '系统管理员',
    result: 1,
    duration: 260,
    message: '回滚填报数据 ' + removed + ' 行，批次退回待审核'
  })
  return { id: task.id, removed, status: IMPORT_AUDITING }
})

/** 删除批次：已入库的先回滚，再连同暂存 / 错误行 / 审核流水一起删掉 */
onDelete('/cr/collect-import/remove', (ctx) => {
  assertBatchAdmin(ctx, '批次删除')
  const id = Number(ctx.params.id || ctx.body?.id)
  const task = importTaskTable.get(id)
  if (!task) throw new Error('导入批次不存在')
  let removed = 0
  if (task.status === IMPORT_DONE) {
    removed = rollbackFillData(
      { orgId: task.orgId, reportId: task.reportId, period: task.period },
      '导入批次 ' + task.batchNo
    )
  }
  importTaskDataTable.removeBatch(
    importTaskDataTable
      .all()
      .filter((row) => row.taskId === id)
      .map((row) => row.id)
  )
  importTaskRowTable.removeBatch(
    importTaskRowTable
      .all()
      .filter((row) => row.taskId === id)
      .map((row) => row.id)
  )
  importTaskTable.remove(id)
  addLog({
    batchNo: task.batchNo,
    orgName: task.orgName,
    reportName: task.reportName,
    period: task.period,
    action: LOG_ROLLBACK,
    operator: operatorOf(ctx) || '系统管理员',
    result: 1,
    duration: 150,
    message: '删除批次' + (removed ? '，同时回滚填报数据 ' + removed + ' 行' : '')
  })
  return { id, removed }
})

/* ==================================================================
 * 5. 导入审核
 * ================================================================== */
registerResource({
  prefix: '/cr/import-audit',
  table: importAuditTable,
  filter: (row, params) =>
    eq(row, 'status', params.status) &&
    eq(row, 'orgId', params.orgId) &&
    eq(row, 'reportId', params.reportId) &&
    eq(row, 'period', params.period) &&
    likeAny(
      row as any,
      ['batchNo', 'orgName', 'reportName', 'submitUser', 'auditor'],
      params.keyword
    ),
  sort: (a, b) => (a.submitTime < b.submitTime ? 1 : -1),
  toSimple: (row) => ({
    id: row.id,
    batchNo: row.batchNo,
    orgName: row.orgName,
    status: row.status
  }),
  exportColumns: [
    { field: 'batchNo', label: '批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'reportName', label: '报表' },
    { field: 'period', label: '期次' },
    { field: 'totalRows', label: '总行数' },
    { field: 'successRows', label: '成功行数' },
    { field: 'failRows', label: '失败行数' },
    { field: 'submitUser', label: '提交人' },
    { field: 'status', label: '审核状态' },
    { field: 'auditor', label: '审核人' },
    { field: 'auditRemark', label: '审核意见' }
  ]
})

/** 审核（按审核流水 id 找到对应批次） */
onPost('/cr/import-audit/audit', (ctx) => {
  const row = importAuditTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('审核记录不存在')
  if (row.status !== AUDIT_PENDING) throw new Error('该批次已审核过，无需重复操作')
  return auditTask(
    row.taskId,
    !!ctx.body?.pass,
    String(ctx.body?.remark || ''),
    operatorOf(ctx) || '系统管理员'
  )
})

/* ==================================================================
 * 6. 导入权限
 * ================================================================== */
registerResource({
  prefix: '/cr/import-auth',
  table: importAuthTable,
  filter: (row, params) =>
    eq(row, 'subjectType', params.subjectType) &&
    eq(row, 'orgId', params.orgId) &&
    eq(row, 'reportId', params.reportId) &&
    eq(row, 'status', params.status) &&
    likeAny(
      row as any,
      ['subjectName', 'orgName', 'reportName', 'remark', 'grantUser'],
      params.keyword
    ),
  sort: (a, b) => a.subjectType - b.subjectType || a.id - b.id,
  beforeCreate: (body) => ({
    ...body,
    grantUser: operatorOf({ body }) || '系统管理员',
    grantTime: now()
  }),
  toSimple: (row) => ({
    id: row.id,
    subjectName: row.subjectName,
    orgName: row.orgName,
    reportName: row.reportName
  }),
  exportColumns: [
    { field: 'subjectType', label: '主体类型' },
    { field: 'subjectName', label: '授权主体' },
    { field: 'orgName', label: '机构范围' },
    { field: 'reportName', label: '报表范围' },
    { field: 'canImport', label: '允许导入' },
    { field: 'canOverwrite', label: '允许覆盖' },
    { field: 'needAudit', label: '需要审核' },
    { field: 'maxRows', label: '单批上限' },
    { field: 'status', label: '状态' }
  ]
})

/* ==================================================================
 * 7. 导入日志
 * ================================================================== */
registerResource({
  prefix: '/cr/import-log',
  table: importLogTable,
  filter: (row, params) =>
    eq(row, 'action', params.action) &&
    eq(row, 'result', params.result) &&
    eq(row, 'operator', params.operator) &&
    (isEmptyParam(params.beginTime) || row.operateTime >= String(params.beginTime)) &&
    (isEmptyParam(params.endTime) || row.operateTime <= String(params.endTime) + ' 23:59:59') &&
    likeAny(
      row as any,
      ['batchNo', 'orgName', 'reportName', 'operator', 'message'],
      params.keyword
    ),
  sort: (a, b) => (a.operateTime < b.operateTime ? 1 : -1),
  toSimple: (row) => ({
    id: row.id,
    batchNo: row.batchNo,
    action: row.action,
    operateTime: row.operateTime
  }),
  exportColumns: [
    { field: 'batchNo', label: '批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'reportName', label: '报表' },
    { field: 'action', label: '动作' },
    { field: 'operator', label: '操作人' },
    { field: 'operateTime', label: '操作时间' },
    { field: 'result', label: '结果' },
    { field: 'duration', label: '耗时(ms)' },
    { field: 'ip', label: 'IP' },
    { field: 'message', label: '说明' }
  ]
})

/* ==================================================================
 * 8. 数据补录
 * ================================================================== */
registerResource({
  prefix: '/cr/collect-supplement',
  table: supplementTable,
  filter: (row, params) =>
    eq(row, 'status', params.status) &&
    eq(row, 'orgId', params.orgId) &&
    eq(row, 'reportId', params.reportId) &&
    eq(row, 'period', params.period) &&
    likeAny(
      row as any,
      ['applyNo', 'orgName', 'reportName', 'reason', 'applyUser'],
      params.keyword
    ),
  sort: (a, b) => (a.applyTime < b.applyTime ? 1 : -1),
  beforeCreate: (body) => ({
    ...body,
    applyNo: nextApplyNo(),
    applyTime: now(),
    status: 1,
    auditor: '',
    auditTime: '',
    auditRemark: '',
    finishTime: ''
  }),
  toSimple: (row) => ({
    id: row.id,
    applyNo: row.applyNo,
    orgName: row.orgName,
    status: row.status
  }),
  exportColumns: [
    { field: 'applyNo', label: '申请单号' },
    { field: 'orgName', label: '机构' },
    { field: 'reportName', label: '报表' },
    { field: 'period', label: '期次' },
    { field: 'rowCount', label: '补录行数' },
    { field: 'reason', label: '补录原因' },
    { field: 'applyUser', label: '申请人' },
    { field: 'applyTime', label: '申请时间' },
    { field: 'status', label: '状态' },
    { field: 'auditRemark', label: '审核意见' }
  ]
})

/** 补录申请审核 */
onPost('/cr/collect-supplement/audit', (ctx) => {
  const row = supplementTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('补录申请不存在')
  if (row.status !== 1) throw new Error('该申请当前状态不允许审核')
  const pass = !!ctx.body?.pass
  const auditor = operatorOf(ctx) || '系统管理员'
  const remark = String(ctx.body?.remark || '') || (pass ? '同意补录' : '驳回')
  const updated = supplementTable.update({
    id: row.id,
    status: pass ? 2 : 3,
    auditor,
    auditTime: now(),
    auditRemark: remark
  })
  return updated
})

/**
 * 执行补录：把该「机构 × 报表 × 期次」的填报记录置为待补录状态，
 * 页面拿到 fillLink 后可以直接跳到数据填报页（带 orgId / reportId / period）。
 */
onPost('/cr/collect-supplement/execute', (ctx) => {
  const row = supplementTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('补录申请不存在')
  if (row.status !== 2) throw new Error('只有「已通过」的申请才能执行补录')
  const period = periodRowOf(row.period)
  if (!period.allowSupplement)
    throw new Error('期次 ' + row.period + ' 未开放补录，请先在报送期次设置中允许补录')
  const operator = operatorOf(ctx) || '系统管理员'
  ensureFillRecordFor(
    { orgId: row.orgId, reportId: row.reportId, period: row.period },
    {
      fillStatus: 0,
      lastModifier: operator,
      lastModifyTime: now(),
      deadline: period.deadline,
      remark: '补录申请 ' + row.applyNo + ' 已通过，待重新导入 / 填报'
    }
  )
  const updated = supplementTable.update({
    id: row.id,
    status: 4,
    finishTime: now(),
    remark: '补录通道已打开（' + operator + ' 于 ' + now() + ' 执行）'
  })
  return {
    apply: updated,
    fillLink:
      '/new-unified/cr-data/fill?orgId=' +
      row.orgId +
      '&reportId=' +
      row.reportId +
      '&period=' +
      row.period,
    message: '已打开补录通道：可到「数据填报」重新录入，或回到「数据导入」重新导入文件'
  }
})

/** 补录申请进度：列出该机构该报表该期次的填报与导入现状，给审核人参考 */
onGet('/cr/collect-supplement/context', (ctx) => {
  const orgId = Number(ctx.params.orgId) || 0
  const reportId = Number(ctx.params.reportId) || 0
  const period = String(ctx.params.period || '')
  return {
    fillRows: fillRowsOfKey(orgId, reportId, period),
    importTasks: importTaskTable
      .all()
      .filter((row) => row.orgId === orgId && row.reportId === reportId && row.period === period)
      .map((row) => ({
        batchNo: row.batchNo,
        status: row.status,
        totalRows: row.totalRows,
        importTime: row.importTime
      })),
    allowSupplement: period ? periodRowOf(period).allowSupplement : false
  }
})

/** 单个补录申请的附件数量上限（演示口径，防止把 localStorage 塞满） */
const MAX_ATTACHMENT_COUNT = 3

/**
 * 补录附件上传。
 * Demo 没有文件服务，页面把文件读成 data URL 传上来，这里只做业务校验后整条落库
 * —— 这样「下载附件」拿到的是真实内容，不是个假地址。
 */
onPost('/cr/collect-supplement/upload-file', (ctx) => {
  const body = ctx.body || {}
  const apply = supplementTable.get(Number(body.supplementId))
  if (!apply) throw new Error('补录申请不存在，请先保存申请再上传附件')
  if (apply.status !== 1 && apply.status !== 3) {
    throw new Error(
      '申请已' +
        (apply.status === 2 ? '通过' : '补录完成') +
        '，不能再增删附件（如需补充材料请新建申请）'
    )
  }
  const fileName = String(body.fileName || '').trim()
  if (!fileName) throw new Error('请选择要上传的文件')
  const fileExt = (fileName.split('.').pop() || '').toLowerCase()
  if (ATTACHMENT_EXTS.indexOf(fileExt) < 0) {
    throw new Error('不支持的附件类型 .' + fileExt + '，仅支持 ' + ATTACHMENT_EXTS.join(' / '))
  }
  const fileSize = Number(body.fileSize) || 0
  if (fileSize > MAX_ATTACHMENT_SIZE) {
    throw new Error(
      '附件 ' +
        fileName +
        ' 有 ' +
        (fileSize / 1024 / 1024).toFixed(2) +
        'MB，超过演示环境单文件上限 ' +
        MAX_ATTACHMENT_SIZE / 1024 / 1024 +
        'MB（真实系统上限由文件服务决定）'
    )
  }
  const content = String(body.content || '')
  if (content.indexOf('data:') !== 0) throw new Error('附件内容读取失败，请重新选择文件')
  const exists = supplementFilesOf(apply.id)
  if (exists.some((row) => row.fileName === fileName))
    throw new Error('附件 ' + fileName + ' 已上传，请勿重复提交')
  if (exists.length >= MAX_ATTACHMENT_COUNT) {
    throw new Error(
      '一个补录申请最多上传 ' + MAX_ATTACHMENT_COUNT + ' 个附件，请先删除不再需要的附件'
    )
  }
  const row = supplementFileTable.insert({
    supplementId: apply.id,
    applyNo: apply.applyNo,
    fileName,
    fileExt,
    fileSize,
    content,
    uploadUser: operatorOf(ctx) || currentUser(ctx)?.nickname || '系统管理员',
    uploadTime: now()
  })
  syncSupplementAttachment(apply.id)
  addLog({
    batchNo: apply.applyNo,
    orgName: apply.orgName,
    reportName: apply.reportName,
    period: apply.period,
    action: LOG_LOAD,
    operator: row.uploadUser,
    result: 1,
    duration: 60,
    message: '补录申请上传附件：' + fileName + '（' + (fileSize / 1024).toFixed(1) + 'KB）'
  })
  return { ...row, content: undefined, count: exists.length + 1 }
})

/** 附件列表（不带内容，避免把 base64 塞进列表响应） */
onGet('/cr/collect-supplement/file-list', (ctx) => {
  const supplementId = Number(ctx.params.supplementId) || 0
  return supplementFilesOf(supplementId).map((row) => ({ ...row, content: undefined }))
})

/** 附件内容：下载与预览都读它 */
onGet('/cr/collect-supplement/file-content', (ctx) => {
  const row = supplementFileTable.get(Number(ctx.params.id))
  if (!row) throw new Error('附件不存在或已被删除')
  return row
})

/** 删除附件 */
onDelete('/cr/collect-supplement/file', (ctx) => {
  const id = Number(ctx.params.id || ctx.body?.id)
  const row = supplementFileTable.get(id)
  if (!row) throw new Error('附件不存在或已被删除')
  const apply = supplementTable.get(row.supplementId)
  if (apply && apply.status !== 1 && apply.status !== 3) {
    throw new Error('申请已' + (apply.status === 2 ? '通过' : '补录完成') + '，不能再增删附件')
  }
  supplementFileTable.remove(id)
  syncSupplementAttachment(row.supplementId)
  addLog({
    batchNo: row.applyNo,
    orgName: apply ? apply.orgName : '',
    reportName: apply ? apply.reportName : '',
    period: apply ? apply.period : '',
    action: LOG_ROLLBACK,
    operator: operatorOf(ctx) || currentUser(ctx)?.nickname || '系统管理员',
    result: 1,
    duration: 40,
    message: '补录申请删除附件：' + row.fileName
  })
  return { id, remain: supplementFilesOf(row.supplementId).length }
})

/** 空值判断（导入日志的日期区间用） */
function isEmptyParam(value: any): boolean {
  return value === undefined || value === null || value === ''
}
