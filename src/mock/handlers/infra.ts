/**
 * Mock Handler — 基础设施（参数配置 / 定时任务 / 调度日志 / 文件 / API 日志）
 */
import { onDelete, onGet, onPost, onPut } from '../route'
import { registerResource } from '../resource'
import { likeAny, csvBlob, paginate } from '../util'
import {
  apiAccessLogTable,
  apiErrorLogTable,
  configTable,
  fileTable,
  jobLogTable,
  jobTable
} from '../db/infra'

/* ---------- 参数配置 ---------- */
registerResource({
  prefix: '/infra/config',
  table: configTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => likeAny(row, ['name', 'key'], params.name),
  exportColumns: [
    { field: 'id', label: '参数编号' },
    { field: 'category', label: '参数分类' },
    { field: 'name', label: '参数名称' },
    { field: 'key', label: '参数键名' },
    { field: 'value', label: '参数键值' },
    { field: 'createTime', label: '创建时间' }
  ]
})

onGet('/infra/config/get-value-by-key', (ctx) => {
  const row = configTable.findOne((item) => item.key === ctx.params.key)
  if (!row) throw new Error(`参数不存在：${ctx.params.key}`)
  return row.value
})

/* ---------- 定时任务 ---------- */
registerResource({
  prefix: '/infra/job',
  table: jobTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => likeAny(row, ['name', 'handlerName'], params.name),
  exportColumns: [
    { field: 'id', label: '任务编号' },
    { field: 'name', label: '任务名称' },
    { field: 'handlerName', label: '处理器' },
    { field: 'cronExpression', label: 'Cron 表达式' },
    { field: 'status', label: '状态' }
  ]
})

onPut('/infra/job/update-status', (ctx) => {
  const { id, status } = { ...ctx.params, ...(ctx.body || {}) }
  jobTable.update({ id: Number(id), status: Number(status) })
  return true
})

onPut('/infra/job/trigger', (ctx) => {
  const id = Number(ctx.params.id)
  const job = jobTable.get(id)
  if (!job) throw new Error('任务不存在')
  // 触发后在调度日志里追加一条执行中记录，便于演示"任务监控"
  const log = jobLogTable.insert({
    jobId: job.id,
    handlerName: job.handlerName,
    handlerParam: job.handlerParam,
    executeIndex: jobLogTable.all().filter((item) => item.jobId === job.id).length + 1,
    beginTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    endTime: '',
    duration: '',
    status: 1,
    result: '手工触发，执行中…',
    createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
  })
  return log.id
})

onGet('/infra/job/get_next_times', () => [])

onPost('/infra/job/sync', () => true)

/* ---------- 调度日志 ---------- */
registerResource({
  prefix: '/infra/job-log',
  table: jobLogTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) =>
    (params.jobId ? Number(row.jobId) === Number(params.jobId) : true) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['handlerName'], params.handlerName),
  exportColumns: [
    { field: 'id', label: '日志编号' },
    { field: 'jobId', label: '任务编号' },
    { field: 'handlerName', label: '处理器' },
    { field: 'beginTime', label: '开始时间' },
    { field: 'duration', label: '执行时长' },
    { field: 'status', label: '状态' },
    { field: 'result', label: '执行结果' }
  ]
})

/* ---------- 文件管理 ---------- */
registerResource({
  prefix: '/infra/file',
  table: fileTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => likeAny(row, ['name', 'path'], params.name),
  toSimple: (row) => ({ id: row.id, name: row.name, url: row.url })
})

/**
 * 上传：无后端时不做真实存储，直接返回一条本地记录。
 * 页面拿到 url 后会立刻预览，所以这里用一个可用的占位地址。
 */
onPost('/infra/file/upload', (ctx) => {
  const body = ctx.body
  const fileName =
    (typeof FormData !== 'undefined' &&
      body instanceof FormData &&
      String(body.get('file')?.['name'] || '')) ||
    `upload_${Date.now()}.dat`
  const row = fileTable.insert({
    configId: 1,
    name: fileName,
    path: `/cr/upload/${fileName}`,
    url: `/admin-api/infra/file/${fileName}`,
    type: 'application/octet-stream',
    size: 0,
    createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
  })
  return row.url
})

onPost('/infra/file/create', (ctx) => {
  const body = ctx.body || {}
  fileTable.insert({
    configId: 1,
    name: body.name || '未命名文件',
    path: body.path || '/cr/upload/unknown',
    url: body.url || '',
    type: body.type || 'application/octet-stream',
    size: body.size || 0,
    createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
  })
  return true
})

onPost('/infra/file/presigned-url', () => ({
  configId: 1,
  uploadUrl: '',
  url: '',
  path: ''
}))

/* ---------- API 访问日志 ---------- */
onGet('/infra/api-access-log/page', (ctx) => {
  const params = ctx.params
  const rows = apiAccessLogTable
    .all()
    .filter(
      (row) =>
        likeAny(row, ['requestUrl', 'operateName'], params.requestUrl) &&
        (params.userId ? Number(row.userId) === Number(params.userId) : true) &&
        (params.resultCode === undefined ||
          params.resultCode === '' ||
          Number(row.resultCode) === Number(params.resultCode))
    )
    .sort((a, b) => b.id - a.id)
  return paginate(rows, params)
})

onGet('/infra/api-access-log/export-excel', (ctx) =>
  csvBlob(apiAccessLogTable.all(), autoColumns(apiAccessLogTable.all()))
)

/* ---------- API 错误日志 ---------- */
onGet('/infra/api-error-log/page', (ctx) => {
  const params = ctx.params
  const rows = apiErrorLogTable
    .all()
    .filter(
      (row) =>
        likeAny(row, ['requestUrl', 'exceptionMessage'], params.requestUrl) &&
        (params.processStatus === undefined ||
          params.processStatus === '' ||
          Number(row.processStatus) === Number(params.processStatus))
    )
    .sort((a, b) => b.id - a.id)
  return paginate(rows, params)
})

onPut('/infra/api-error-log/update-status', (ctx) => {
  const { id, processStatus } = { ...ctx.params, ...(ctx.body || {}) }
  apiErrorLogTable.update({
    id: Number(id),
    processStatus: Number(processStatus),
    processUserId: 1,
    processTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
  })
  return true
})

onGet('/infra/api-error-log/export-excel', (ctx) =>
  csvBlob(apiErrorLogTable.all(), autoColumns(apiErrorLogTable.all()))
)

/** 内部：按第一行数据的字段自动生成导出列 */
function autoColumns(rows: Array<Record<string, any>>) {
  void rows
  return [
    { field: 'id', label: '日志编号' },
    { field: 'traceId', label: '链路追踪编号' },
    { field: 'requestUrl', label: '请求地址' },
    { field: 'userIp', label: '用户 IP' },
    { field: 'createTime', label: '发生时间' }
  ]
}

/* ---------- 监控类页面（Demo 无后端，返回空实现避免报错） ---------- */
onGet('/infra/redis/get-monitor-info', () => ({ info: {}, dbSize: 0, commandStats: [] }))
onGet('/infra/server/page', (ctx) => paginate([], ctx.params))
onGet('/infra/codegen/table/page', (ctx) => paginate([], ctx.params))
onDelete('/infra/codegen/delete', () => true)
