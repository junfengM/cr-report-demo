/**
 * Mock Handler — 任务调度域（/cr-schedule 5 个页面）
 *
 * | 页面       | 接口前缀                                          |
 * | ---------- | ------------------------------------------------- |
 * | 任务维护   | /cr/collect-task（含分组树 / 前置任务）           |
 * | 批量监控   | /cr/collect-task-log（含立即执行）                |
 * | 调度配置   | /cr/schedule（含启停 / 手工调度 / 手工调度选项）  |
 * | 手工调度   | /cr/schedule/manual-run                           |
 * | 集群配置   | /cr/cluster                                       |
 *
 * 权限落点：本域全部是"会动数据"的写接口，统一 assertAdmin / registerResource 的 guard，
 * 页面上的 v-hasPermi 只负责"看不见"——第三轮独立审核已经证明藏按钮拦不住接口。
 * 只读接口不锁：审核岗需要看跑批结果，锁了反而把人关在门外。
 */
import { onDelete, onGet, onPost, onPut } from '../route'
import { registerResource } from '../resource'
import { csvBlob, formatDateTime, likeAny } from '../util'
import { assertAdmin } from './guards'
import { currentUser } from './auth'
import {
  CRON_SHORTCUTS,
  CRON_FIELDS,
  IMPL_TYPE_LABEL,
  PRIORITY_OPTIONS,
  RUN_STATUS_LABEL,
  RUN_TYPE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_RUN_STATUS,
  buildTaskLogRow,
  clusterTable,
  collectTaskGroupTable,
  collectTaskLogTable,
  collectTaskTable,
  dataDateOfPeriod,
  manualRunByGroups,
  schedulePeriodOptions,
  scheduleTable,
  taskGroupTree,
  taskLogStats,
  validateCron,
  type CollectTaskRow
} from '../db/crSchedule'

/** 当前登录人昵称（记创建人 / 更新人），未登录时兜底 */
const actorOf = (ctx: any) => currentUser(ctx)?.nickname || '系统管理员'

/** 任务列表行投影：补分组名与前置任务名（页面不用再自己查一遍） */
const taskRowOf = (row: CollectTaskRow) => ({
  ...row,
  groupName: collectTaskGroupTable.get(row.groupId)?.groupName || '',
  groupCode: collectTaskGroupTable.get(row.groupId)?.groupCode || '',
  priorityLabel: TASK_PRIORITY_LABEL[row.priority] || '-',
  implTypeLabel: IMPL_TYPE_LABEL[row.implType] || '-',
  preTaskNames: (row.preTaskIds || [])
    .map((id) => collectTaskTable.get(Number(id))?.name || '任务 ' + id)
    .filter((name) => !!name)
})

/** 任务的下拉选项（前置任务选择 / 调度配置选任务共用） */
const taskOptions = () =>
  collectTaskTable
    .all()
    .sort((a, b) => a.groupId - b.groupId || a.priority - b.priority || a.id - b.id)
    .map((task) => ({
      id: task.id,
      code: task.code,
      name: task.name,
      groupId: task.groupId,
      groupName: collectTaskGroupTable.get(task.groupId)?.groupName || '',
      priority: task.priority,
      implType: task.implType,
      // 前置任务列表也带上：前置任务弹窗要用它算"谁依赖它"（反向依赖），别让页面再查一遍
      preTaskIds: task.preTaskIds || []
    }))

/* ==================================================================
 * 一、任务维护（/cr/collect-task）
 * ================================================================== */
registerResource({
  prefix: '/cr/collect-task',
  table: collectTaskTable,
  filter: (row, params) =>
    (params.groupId === undefined ||
      params.groupId === '' ||
      Number(row.groupId) === Number(params.groupId)) &&
    (params.implType === undefined ||
      params.implType === '' ||
      Number(row.implType) === Number(params.implType)) &&
    (params.priority === undefined ||
      params.priority === '' ||
      Number(row.priority) === Number(params.priority)) &&
    likeAny(row as any, ['code', 'name', 'implMethod', 'description'], params.keyword),
  // 分组 → 优先级 → id：高优先级排前面，和手工调度的执行顺序一致
  sort: (a, b) => a.groupId - b.groupId || a.priority - b.priority || a.id - b.id,
  guard: (ctx, action) => assertAdmin(ctx, '采集任务' + action),
  beforeCreate: (body, ctx) => {
    const code = String(body.code || '').trim()
    if (!code) throw new Error('任务编码不能为空')
    if (collectTaskTable.all().some((row) => row.code === code)) {
      throw new Error(
        '任务编码已存在：' + code + '（存储过程英文名在跑批日志里作为关联键，必须唯一）'
      )
    }
    const now = formatDateTime()
    return {
      ...body,
      code,
      preTaskIds: Array.isArray(body.preTaskIds) ? body.preTaskIds.map(Number) : [],
      createUser: actorOf(ctx),
      createTime: now,
      updateUser: actorOf(ctx),
      updateTime: now
    }
  },
  beforeUpdate: (body, ctx) => {
    const exist = collectTaskTable.get(Number(body.id))
    if (!exist) throw new Error('采集任务不存在')
    // 编码是跑批日志的关联键：改了会让历史日志对不上任务，所以只允许改名与配置
    if (body.code !== undefined && String(body.code) !== exist.code) {
      throw new Error(
        '任务编码是跑批日志的关联键，创建后不可修改（如需换编码请新建任务并停用旧任务）'
      )
    }
    const payload: Record<string, any> = {
      name: body.name !== undefined ? String(body.name) : exist.name,
      groupId: body.groupId !== undefined ? Number(body.groupId) : exist.groupId,
      priority: body.priority !== undefined ? Number(body.priority) : exist.priority,
      implType: body.implType !== undefined ? Number(body.implType) : exist.implType,
      implMethod: body.implMethod !== undefined ? String(body.implMethod) : exist.implMethod,
      description: body.description !== undefined ? String(body.description) : exist.description,
      preTaskIds: Array.isArray(body.preTaskIds) ? body.preTaskIds.map(Number) : exist.preTaskIds,
      updateUser: actorOf(ctx),
      updateTime: formatDateTime()
    }
    if (!collectTaskGroupTable.get(payload.groupId)) throw new Error('任务分组不存在')
    return payload
  },
  toListRow: taskRowOf,
  exportColumns: [
    { field: 'groupName', label: '任务分组' },
    { field: 'code', label: '任务编码' },
    { field: 'name', label: '任务名称' },
    {
      field: 'priority',
      label: '优先级',
      formatter: (row) => TASK_PRIORITY_LABEL[row.priority] || ''
    },
    {
      field: 'implType',
      label: '实现类型',
      formatter: (row) => IMPL_TYPE_LABEL[row.implType] || ''
    },
    { field: 'implMethod', label: '实现方法' },
    {
      field: 'preTaskIds',
      label: '前置任务',
      formatter: (row) =>
        (row.preTaskIds || [])
          .map((id: number) => collectTaskTable.get(Number(id))?.name || '任务 ' + id)
          .join('、')
    },
    { field: 'description', label: '任务描述' },
    { field: 'createUser', label: '创建人' },
    { field: 'createTime', label: '创建时间' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' }
  ]
})

/** 左侧任务分组树（含组内任务数，页面上直接显示） */
onGet('/cr/collect-task/group-tree', () => taskGroupTree())

/** 任务下拉（前置任务选择 / 调度配置选任务） */
onGet('/cr/collect-task/options', () => taskOptions())

/** 任务维护页的元数据：实现类型、优先级选项（页面不写第二套） */
onGet('/cr/collect-task/meta', () => ({
  implTypes: Object.keys(IMPL_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: IMPL_TYPE_LABEL[Number(key)]
  })),
  priorities: PRIORITY_OPTIONS,
  runStatusLabels: RUN_STATUS_LABEL,
  runTypeLabels: RUN_TYPE_LABEL,
  cronFields: CRON_FIELDS,
  cronShortcuts: CRON_SHORTCUTS
}))

/**
 * 配置前置任务：校验存在性、自我依赖与环。
 * 环检测用最简单的 DFS —— 任务数量级很小，不必上拓扑排序。
 */
onPut('/cr/collect-task/update-pre-tasks', (ctx) => {
  assertAdmin(ctx, '配置前置任务')
  const id = Number(ctx.body?.id)
  const task = collectTaskTable.get(id)
  if (!task) throw new Error('采集任务不存在')
  const preIds = Array.isArray(ctx.body?.preTaskIds)
    ? ctx.body.preTaskIds.map((preId: any) => Number(preId)).filter((preId: number) => !!preId)
    : []
  // 同一个前置任务被重复勾选时去重，后面的环检测与保存都用这份 id 列表
  const ids: number[] = Array.from(new Set(preIds))
  if (ids.includes(id)) throw new Error('不能把任务自己配成前置任务')
  const missing = ids.filter((preId) => !collectTaskTable.get(preId))
  if (missing.length) throw new Error('前置任务不存在：id=' + missing.join('、'))

  // 环检测：从每个前置任务出发能不能走回自己
  const dfs = (from: number, seen: Set<number>): boolean => {
    if (from === id) return true
    if (seen.has(from)) return false
    seen.add(from)
    const node = collectTaskTable.get(from)
    return (node?.preTaskIds || []).some((next) => dfs(Number(next), seen))
  }
  const cyc = ids.find((preId) => dfs(preId, new Set()))
  if (cyc) {
    const name = collectTaskTable.get(cyc)?.name || '任务 ' + cyc
    throw new Error('前置任务会形成循环依赖：' + name + ' 的链路上已经流回本任务，请调整后再保存')
  }

  collectTaskTable.update({
    id,
    preTaskIds: ids,
    updateUser: actorOf(ctx),
    updateTime: formatDateTime()
  })
  return { id, preTaskIds: ids }
})

/**
 * 删除前的引用校验（覆盖 registerResource 生成的 /delete 与 /delete-list，必须在它之后注册）。
 *
 * 两条拦截规则，都给出中文引用方 —— 目录类数据只做"删得掉"的 Demo 会在演示现场露馅：
 * 1. 被别的任务配成前置任务的任务不能删：删掉之后前置判定会指向一个不存在的任务；
 * 2. 已有调度配置的任务不能删：一个没有任务的 Cron 没有意义，让用户先去「调度配置」里删。
 * 跑批日志（cr.collectTaskLog）不拦：它是历史记录，冗余存了任务编码与中文名，任务删了也查得到。
 */
const assertTaskDeletable = (ids: number[]) => {
  const reasons: string[] = []
  ids.forEach((id) => {
    const task = collectTaskTable.get(id)
    if (!task) return
    const dependents = collectTaskTable
      .all()
      .filter((row) => (row.preTaskIds || []).indexOf(id) >= 0)
    if (dependents.length) {
      reasons.push(
        '任务「' +
          task.code +
          '」被 ' +
          dependents.map((row) => row.code).join('、') +
          ' 配成了前置任务'
      )
    }
    const schedules = scheduleTable.all().filter((row) => row.taskId === id)
    if (schedules.length) {
      reasons.push(
        '任务「' + task.code + '」还有 ' + schedules.length + ' 条调度配置（见「调度配置」页）'
      )
    }
  })
  if (reasons.length) {
    throw new Error('不允许删除：' + reasons.join('；') + '。请先解除引用再删除')
  }
}

onDelete('/cr/collect-task/delete', (ctx) => {
  assertAdmin(ctx, '采集任务删除')
  const id = Number(ctx.params.id)
  if (!id) throw new Error('缺少 id')
  if (!collectTaskTable.get(id)) throw new Error('采集任务不存在：id=' + id)
  assertTaskDeletable([id])
  collectTaskTable.remove(id)
  return true
})

onDelete('/cr/collect-task/delete-list', (ctx) => {
  assertAdmin(ctx, '采集任务批量删除')
  const ids = String(ctx.params.ids || '')
    .split(',')
    .map((id) => Number(id))
    .filter((id) => !!id)
  if (!ids.length) throw new Error('缺少 ids')
  const exist = ids.filter((id) => !!collectTaskTable.get(id))
  if (!exist.length) throw new Error('采集任务不存在：' + ids.join('、'))
  assertTaskDeletable(exist)
  collectTaskTable.removeBatch(exist)
  return true
})

/* ==================================================================
 * 二、批量监控（/cr/collect-task-log）
 * ================================================================== */
/** 列表过滤（page / export 共用一份，避免两边口径不同） */
const logFilter = (row: any, params: Record<string, any>) =>
  (params.dataDate === undefined ||
    params.dataDate === '' ||
    String(row.dataDate) === String(params.dataDate)) &&
  (params.period === undefined ||
    params.period === '' ||
    String(row.period) === String(params.period)) &&
  (params.status === undefined ||
    params.status === '' ||
    Number(row.status) === Number(params.status)) &&
  (params.runType === undefined ||
    params.runType === '' ||
    Number(row.runType) === Number(params.runType)) &&
  (params.groupId === undefined ||
    params.groupId === '' ||
    Number(row.groupId) === Number(params.groupId)) &&
  likeAny(row, ['taskCode', 'taskName', 'errorMsg', 'operator'], params.keyword)

const logRows = (params: Record<string, any>) =>
  collectTaskLogTable
    .all()
    .filter((row) => logFilter(row, params))
    // 数据日期新的在前，同一天按开始时间倒序（未开始的等待行排在后面）
    .sort(
      (a, b) =>
        (a.dataDate < b.dataDate ? 1 : a.dataDate > b.dataDate ? -1 : 0) ||
        String(b.startTime).localeCompare(String(a.startTime)) ||
        b.id - a.id
    )

onGet('/cr/collect-task-log/page', (ctx) => {
  const rows = logRows(ctx.params)
  const pageNo = Math.max(1, Number(ctx.params.pageNo) || 1)
  const pageSize = Math.max(1, Number(ctx.params.pageSize) || 10)
  const start = (pageNo - 1) * pageSize
  return {
    list: rows.slice(start, start + pageSize),
    total: rows.length,
    // 头部统计与列表同源：同一份过滤结果里数出来的，不会出现"卡片说 3 个失败、列表只有 2 行"
    stats: taskLogStats(rows)
  }
})

onGet('/cr/collect-task-log/list', (ctx) => logRows(ctx.params))

onGet('/cr/collect-task-log/export-excel', (ctx) =>
  csvBlob(logRows(ctx.params), [
    { field: 'dataDate', label: '数据日期' },
    { field: 'period', label: '报送期次' },
    { field: 'taskCode', label: '存储过程英文名' },
    { field: 'taskName', label: '存储过程中文名' },
    { field: 'groupName', label: '任务分组' },
    {
      field: 'runType',
      label: '执行方式',
      formatter: (row: any) => RUN_TYPE_LABEL[row.runType] || ''
    },
    {
      field: 'status',
      label: '运行状态',
      formatter: (row: any) => RUN_STATUS_LABEL[row.status] || ''
    },
    { field: 'startTime', label: '开始时间' },
    { field: 'endTime', label: '结束时间' },
    { field: 'duration', label: '执行时长(秒)' },
    { field: 'rowsAdded', label: '新增数据量' },
    { field: 'sqlReturn', label: 'SQL执行返回值' },
    { field: 'errorMsg', label: 'SQL执行错误信息' },
    { field: 'operator', label: '操作人' }
  ])
)

/**
 * 立即执行：按这条日志的任务 / 期次 / 数据日期重跑一次，落一条新日志。
 * 不给"运行中"的任务重复触发（真实系统会拒绝并发跑同一个任务）。
 */
onPost('/cr/collect-task-log/run', (ctx) => {
  assertAdmin(ctx, '立即执行任务')
  const id = Number(ctx.body?.id)
  const row = collectTaskLogTable.get(id)
  if (!row) throw new Error('跑批记录不存在')
  if (row.status === TASK_RUN_STATUS.RUNNING) {
    throw new Error('该任务正在运行中，不能重复触发（请等待本次执行结束后再重跑）')
  }
  const task = collectTaskTable.get(row.taskId)
  if (!task) throw new Error('任务已不存在：id=' + row.taskId + '，请先在「任务维护」里确认')

  // 前置任务同样参与判定：同一次期次里最近一次没成功的，直接落"等待前置任务"
  const blockings = (task.preTaskIds || [])
    .map((preId) => {
      const latest = collectTaskLogTable
        .all()
        .filter((item) => item.taskId === Number(preId) && item.period === row.period)
        .sort((a, b) => b.id - a.id)[0]
      if (!latest || latest.status === TASK_RUN_STATUS.SUCCESS) return ''
      const name = collectTaskTable.get(Number(preId))?.code || '任务 ' + preId
      return name + '（本期次最近一次' + RUN_STATUS_LABEL[latest.status] + '）'
    })
    .filter((text) => !!text)

  const created = collectTaskLogTable.insert(
    buildTaskLogRow({
      task,
      period: row.period,
      dataDate: row.dataDate,
      runType: 2,
      operator: actorOf(ctx),
      ...(blockings.length
        ? { forceStatus: TASK_RUN_STATUS.WAITING, preTaskNames: blockings.join('、') }
        : {})
    }) as any
  )
  return {
    id: created.id,
    status: created.status,
    statusLabel: RUN_STATUS_LABEL[created.status],
    rowsAdded: created.rowsAdded,
    duration: created.duration,
    errorMsg: created.errorMsg,
    waitingFor: blockings
  }
})

/* ==================================================================
 * 三、调度配置（/cr/schedule）
 * ================================================================== */
registerResource({
  prefix: '/cr/schedule',
  table: scheduleTable,
  filter: (row, params) =>
    (params.enabled === undefined ||
      params.enabled === '' ||
      Number(row.enabled) === Number(params.enabled)) &&
    (params.taskId === undefined ||
      params.taskId === '' ||
      Number(row.taskId) === Number(params.taskId)) &&
    likeAny(row as any, ['taskName', 'cron', 'remark'], params.keyword),
  sort: (a, b) => b.enabled - a.enabled || a.id - b.id,
  guard: (ctx, action) => assertAdmin(ctx, '调度配置' + action),
  beforeCreate: (body, ctx) => {
    const taskId = Number(body.taskId)
    const task = collectTaskTable.get(taskId)
    if (!task) throw new Error('任务不存在，请重新选择任务的调度对象')
    if (scheduleTable.all().some((row) => row.taskId === taskId)) {
      throw new Error('任务「' + task.name + '」已经有调度配置了，请直接修改原来那条')
    }
    const cron = String(body.cron || '').trim()
    const cronError = validateCron(cron)
    if (cronError) throw new Error(cronError)
    const now = formatDateTime()
    return {
      taskId,
      taskName: task.name,
      cron,
      enabled: body.enabled === undefined ? 1 : Number(body.enabled),
      stateful: body.stateful !== false,
      remark: String(body.remark || ''),
      createUser: actorOf(ctx),
      createTime: now,
      updateUser: actorOf(ctx),
      updateTime: now
    }
  },
  beforeUpdate: (body, ctx) => {
    const exist = scheduleTable.get(Number(body.id))
    if (!exist) throw new Error('调度配置不存在')
    const taskId = body.taskId === undefined ? exist.taskId : Number(body.taskId)
    const task = collectTaskTable.get(taskId)
    if (!task) throw new Error('任务不存在，请重新选择调度对象')
    if (taskId !== exist.taskId && scheduleTable.all().some((row) => row.taskId === taskId)) {
      throw new Error('任务「' + task.name + '」已经有调度配置了，一个任务只保留一条调度')
    }
    const cron = body.cron === undefined ? exist.cron : String(body.cron).trim()
    const cronError = validateCron(cron)
    if (cronError) throw new Error(cronError)
    return {
      taskId,
      taskName: task.name,
      cron,
      enabled: body.enabled === undefined ? exist.enabled : Number(body.enabled),
      stateful: body.stateful === undefined ? exist.stateful : body.stateful !== false,
      remark: body.remark === undefined ? exist.remark : String(body.remark),
      updateUser: actorOf(ctx),
      updateTime: formatDateTime()
    }
  },
  toListRow: (row) => {
    const task = collectTaskTable.get(row.taskId)
    return {
      ...row,
      taskCode: task?.code || '',
      taskPriority: task?.priority || 0,
      implType: task?.implType || 0
    }
  },
  exportColumns: [
    { field: 'taskName', label: '任务名称' },
    {
      field: 'taskId',
      label: '任务编码',
      formatter: (row) => collectTaskTable.get(row.taskId)?.code || ''
    },
    { field: 'cron', label: 'Cron 表达式' },
    {
      field: 'enabled',
      label: '调度状态',
      formatter: (row) => (Number(row.enabled) === 1 ? '已开启' : '已关闭')
    },
    {
      field: 'stateful',
      label: '是否有状态',
      formatter: (row) => (row.stateful ? '有状态' : '无状态')
    },
    { field: 'remark', label: '备注' },
    { field: 'createUser', label: '创建人' },
    { field: 'createTime', label: '创建时间' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' }
  ]
})

/** 开启 / 关闭某个任务的调度 */
onPost('/cr/schedule/toggle', (ctx) => {
  assertAdmin(ctx, '调度启停')
  const row = scheduleTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('调度配置不存在')
  const enabled = Number(ctx.body?.enabled) === 1 ? 1 : 0
  scheduleTable.update({
    id: row.id,
    enabled,
    updateUser: actorOf(ctx),
    updateTime: formatDateTime()
  })
  return { id: row.id, enabled, enabledLabel: enabled === 1 ? '已开启' : '已关闭' }
})

/** 手工调度页的选项：任务分组 + 期次（期次带上推导出的数据日期） */
onGet('/cr/schedule/manual-options', () => ({
  groups: taskGroupTree(),
  periods: schedulePeriodOptions()
}))

/**
 * 手工调度：勾选任务分组 + 选择期次 → 批量重跑。
 * 这是本域唯一"批量生成数据"的接口，结果直接返回给页面展示（不在前端再算一遍）。
 */
onPost('/cr/schedule/manual-run', (ctx) => {
  assertAdmin(ctx, '手工调度')
  const groupIds = Array.isArray(ctx.body?.groupIds)
    ? ctx.body.groupIds.map((id: any) => Number(id)).filter((id: number) => !!id)
    : []
  if (!groupIds.length) throw new Error('请先勾选要执行的任务分组')
  const period = String(ctx.body?.period || '')
  if (!/^\d{6}$/.test(period)) throw new Error('请选择数据期次（形如 202608）')
  const result = manualRunByGroups({ groupIds, period, operator: actorOf(ctx) })
  return {
    ...result,
    dataDate: dataDateOfPeriod(period),
    logs: result.logs.map((row) => ({ ...row, statusLabel: RUN_STATUS_LABEL[row.status] }))
  }
})

/* ==================================================================
 * 四、集群配置（/cr/cluster）
 * ================================================================== */
registerResource({
  prefix: '/cr/cluster',
  table: clusterTable,
  filter: (row, params) =>
    (params.role === undefined || params.role === '' || String(row.role) === String(params.role)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row as any, ['nodeName', 'address', 'remark'], params.keyword),
  sort: (a, b) => (a.role === 'master' ? -1 : 1) - (b.role === 'master' ? -1 : 1) || a.id - b.id,
  guard: (ctx, action) => assertAdmin(ctx, '集群节点' + action),
  beforeCreate: (body, ctx) => {
    const nodeName = String(body.nodeName || '').trim()
    if (!nodeName) throw new Error('节点名不能为空')
    if (clusterTable.all().some((row) => row.nodeName === nodeName)) {
      throw new Error('节点名已存在：' + nodeName)
    }
    const address = String(body.address || '').trim()
    if (!/^[\w.-]+:\d{2,5}$/.test(address)) {
      throw new Error(
        '节点地址格式应为 IP:端口，如 10.20.31.11:8080（当前：' + (address || '空') + '）'
      )
    }
    const now = formatDateTime()
    return {
      ...body,
      nodeName,
      address,
      role: body.role === 'master' ? 'master' : 'worker',
      status: Number(body.status) === 0 ? 0 : 1,
      remark: String(body.remark || ''),
      createUser: actorOf(ctx),
      createTime: now,
      updateUser: actorOf(ctx),
      updateTime: now
    }
  },
  beforeUpdate: (body, ctx) => {
    const exist = clusterTable.get(Number(body.id))
    if (!exist) throw new Error('集群节点不存在')
    const nodeName = body.nodeName === undefined ? exist.nodeName : String(body.nodeName).trim()
    if (
      nodeName !== exist.nodeName &&
      clusterTable.all().some((row) => row.nodeName === nodeName && row.id !== exist.id)
    ) {
      throw new Error('节点名已存在：' + nodeName)
    }
    const address = body.address === undefined ? exist.address : String(body.address).trim()
    if (!/^[\w.-]+:\d{2,5}$/.test(address)) {
      throw new Error(
        '节点地址格式应为 IP:端口，如 10.20.31.11:8080（当前：' + (address || '空') + '）'
      )
    }
    return {
      nodeName,
      address,
      role: body.role === undefined ? exist.role : body.role === 'master' ? 'master' : 'worker',
      status: body.status === undefined ? exist.status : Number(body.status) === 0 ? 0 : 1,
      remark: body.remark === undefined ? exist.remark : String(body.remark),
      updateUser: actorOf(ctx),
      updateTime: formatDateTime()
    }
  },
  exportColumns: [
    { field: 'nodeName', label: '节点名' },
    { field: 'address', label: '节点地址' },
    {
      field: 'role',
      label: '角色',
      formatter: (row) => (row.role === 'master' ? '主节点' : '工作节点')
    },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '在线' : '离线')
    },
    { field: 'remark', label: '备注' },
    { field: 'createUser', label: '创建人' },
    { field: 'createTime', label: '创建时间' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' }
  ]
})
