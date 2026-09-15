/**
 * Mock 种子数据 — 任务调度域（P1，需求文档「任务调度功能」章的采集侧 5 页）
 *
 * 五张表：
 * - cr.collectTaskGroup  任务分组（任务维护页左侧的分组树）
 * - cr.collectTask       采集任务（编码 / 名称 / 实现类型 / 优先级 / 实现方法 / 前置任务）
 * - cr.collectTaskLog    跑批日志（批量监控与手工调度的数据来源，每次执行一行）
 * - cr.schedule          调度配置（任务 + Cron 表达式 + 启停 + 是否有状态）
 * - cr.cluster           集群节点（节点名 / 地址 / 角色 / 状态）
 *
 * 三条口径（写下来避免以后各处各算一套）：
 * 1. **跑批结果是确定性的**：hash(任务编码 + 期次) % 7 === 3 判失败，同一个任务同一个期次
 *    反复执行结果稳定不变，换期次会变。演示时"成功 / 失败"两条分支都能随时重放，不靠随机数。
 * 2. **前置任务真的参与判定**：手工调度按"优先级 → id"顺序执行，前置任务本次失败 / 等待 / 跳过的，
 *    后续任务落「等待前置任务」而不是照跑 —— 让「前置任务」这个配置有可观察的后果。
 * 3. **等待与跳过不计入成功，也不写入 errorMsg**：状态自己会说话，错误信息只留真实报错。
 */
import { defineTable } from '../store'
import { formatDateTime } from '../util'
import { periodOptions } from './crCollect'

/* ==================================================================
 * 1. 任务分组
 * ================================================================== */
export interface CollectTaskGroupRow {
  id: number
  groupCode: string
  groupName: string
  /** 分组说明：这组任务负责取哪一块数据 */
  description: string
  sort: number
  createTime: string
}

export const collectTaskGroupTable = defineTable<CollectTaskGroupRow>('cr.collectTaskGroup', [
  {
    id: 1,
    groupCode: 'G01',
    groupName: '基础数据采集',
    description: '保单、客户、从业人员等主数据，监管报送的底座',
    sort: 1,
    createTime: '2026-08-20 09:10:00'
  },
  {
    id: 2,
    groupCode: 'G02',
    groupName: '财务数据采集',
    description: '保费收入、手续费佣金、收付费流水',
    sort: 2,
    createTime: '2026-08-20 09:12:00'
  },
  {
    id: 3,
    groupCode: 'G03',
    groupName: '监管报送取数',
    description: '按监管口径抽取保单、赔案、中介机构数据',
    sort: 3,
    createTime: '2026-08-20 09:14:00'
  },
  {
    id: 4,
    groupCode: 'G04',
    groupName: '报表加工汇总',
    description: 'BX 系列报表加工、落盘检查与历史归档',
    sort: 4,
    createTime: '2026-08-20 09:16:00'
  }
])

/* ==================================================================
 * 2. 采集任务
 * ================================================================== */
export interface CollectTaskRow {
  id: number
  /** 所属任务分组 */
  groupId: number
  /** 任务编码（存储过程英文名，批量监控按它筛选） */
  code: string
  /** 任务名称（存储过程中文名） */
  name: string
  /** 优先级：1 高 / 2 中 / 3 低（数字小的先跑） */
  priority: number
  /** 实现类型，见字典 cr_task_impl_type：1 存储过程 / 2 Shell / 3 SQL / 4 Java 类 */
  implType: number
  /** 实现方法：存储过程名 / 脚本路径 / SQL 正文 / 类名 */
  implMethod: string
  /** 前置任务 id：这些任务没跑完，本任务不执行 */
  preTaskIds: number[]
  description: string
  createUser: string
  createTime: string
  updateUser: string
  updateTime: string
}

/** 优先级中文名（页面与导出共用一份，别在页面里再写一套） */
export const TASK_PRIORITY_LABEL: Record<number, string> = { 1: '高', 2: '中', 3: '低' }

/** 实现类型中文名 */
export const IMPL_TYPE_LABEL: Record<number, string> = {
  1: '存储过程',
  2: 'Shell 脚本',
  3: 'SQL 语句',
  4: 'Java 类'
}

export const PRIORITY_OPTIONS = [
  { value: 1, label: '高（先执行）' },
  { value: 2, label: '中' },
  { value: 3, label: '低（后执行）' }
]

const taskSeed: CollectTaskRow[] = [
  {
    id: 1,
    groupId: 1,
    code: 'PKG_HX_BASE_POLICY',
    name: '保单基础信息采集',
    priority: 1,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_BASE_POLICY',
    preTaskIds: [],
    description: '从核心业务库抽取保单主表与险种明细，供后续所有监管报表使用',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:20:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-20 09:20:00'
  },
  {
    id: 2,
    groupId: 1,
    code: 'PKG_HX_BASE_CUSTOMER',
    name: '客户主数据采集',
    priority: 2,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_BASE_CUSTOMER',
    preTaskIds: [],
    description: '投保人 / 被保险人 / 受益人三类客户主体信息',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:22:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-21 14:05:00'
  },
  {
    id: 3,
    groupId: 1,
    code: 'PKG_HX_BASE_AGENT',
    name: '从业人员信息采集',
    priority: 2,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_BASE_AGENT',
    preTaskIds: [],
    description: '销售人员执业登记与所属中介机构',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:24:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-20 09:24:00'
  },
  {
    id: 4,
    groupId: 2,
    code: 'PKG_HX_FIN_PREMIUM',
    name: '保费收入采集',
    priority: 1,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_FIN_PREMIUM',
    preTaskIds: [],
    description: '按险种 / 渠道归集保费收入，对应 BX011 报表',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:26:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-20 09:26:00'
  },
  {
    id: 5,
    groupId: 2,
    code: 'PKG_HX_FIN_COMMISSION',
    name: '手续费与佣金采集',
    priority: 2,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_FIN_COMMISSION',
    preTaskIds: [],
    description: '手续费及佣金支出明细，含中介机构维度',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:28:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-20 09:28:00'
  },
  {
    id: 6,
    groupId: 2,
    code: 'PKG_HX_FIN_PAYMENT',
    name: '收付费流水采集',
    priority: 3,
    implType: 3,
    implMethod: 'SELECT * FROM HXUSER.V_FIN_PAYMENT WHERE DATA_DATE = :dataDate',
    preTaskIds: [],
    description: '直接查视图，数据量大时优先降级，允许排在最后',
    createUser: '系统管理员',
    createTime: '2026-08-22 10:02:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-22 10:02:00'
  },
  {
    id: 7,
    groupId: 3,
    code: 'PKG_HX_REG_POLICY',
    name: '监管保单报送取数',
    priority: 1,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_REG_POLICY',
    preTaskIds: [1, 4],
    description: '按监管要素抽取保单，前置：保单基础信息 + 保费收入',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:30:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-25 16:40:00'
  },
  {
    id: 8,
    groupId: 3,
    code: 'PKG_HX_REG_CLAIM',
    name: '监管赔案报送取数',
    priority: 2,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_REG_CLAIM',
    preTaskIds: [1],
    description: '赔案与赔付明细，前置：保单基础信息',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:32:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-25 16:41:00'
  },
  {
    id: 9,
    groupId: 3,
    code: 'PKG_HX_REG_INTERMEDIARY',
    name: '中介机构报送取数',
    priority: 3,
    implType: 1,
    implMethod: 'HXUSER.PKG_HX_REG_INTERMEDIARY',
    preTaskIds: [3, 5],
    description: '中介机构与从业人员执业数据，前置：从业人员 + 手续费佣金',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:34:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-25 16:42:00'
  },
  {
    id: 10,
    groupId: 4,
    code: 'PRC_HX_SUMMARY_BX011',
    name: 'BX011 报表加工',
    priority: 1,
    implType: 1,
    implMethod: 'HXUSER.PRC_HX_SUMMARY_BX011',
    preTaskIds: [7],
    description: '保费收入明细表加工，前置：监管保单报送取数',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:36:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-26 09:15:00'
  },
  {
    id: 11,
    groupId: 4,
    code: 'PRC_HX_SUMMARY_BX021',
    name: 'BX021 报表加工',
    priority: 1,
    implType: 1,
    implMethod: 'HXUSER.PRC_HX_SUMMARY_BX021',
    preTaskIds: [7, 8],
    description: '赔案汇总表加工，前置：监管保单 + 监管赔案取数',
    createUser: '系统管理员',
    createTime: '2026-08-20 09:38:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-26 09:16:00'
  },
  {
    id: 12,
    groupId: 4,
    code: 'SH_HX_EXPORT_CHECK',
    name: '报送文件落盘检查',
    priority: 3,
    implType: 2,
    implMethod: '/opt/hx/collect/export_check.sh',
    preTaskIds: [10],
    description: '校验落盘报文文件的行数与表头，前置：BX011 报表加工',
    createUser: '系统管理员',
    createTime: '2026-08-22 10:12:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-26 09:18:00'
  },
  {
    id: 13,
    groupId: 4,
    code: 'JOB_HX_ARCHIVE',
    name: '历史数据归档',
    priority: 3,
    implType: 4,
    implMethod: 'com.hx.collect.ArchiveJob',
    preTaskIds: [10, 11],
    description: '把已上报数据迁入历史库，前置：两张汇总报表加工完成',
    createUser: '系统管理员',
    createTime: '2026-08-22 10:20:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-26 09:20:00'
  }
]

export const collectTaskTable = defineTable<CollectTaskRow>('cr.collectTask', taskSeed)

/* ==================================================================
 * 3. 跑批日志（批量监控）
 * ================================================================== */
export interface CollectTaskLogRow {
  id: number
  /** 数据日期（这一批处理的是哪天的数据） */
  dataDate: string
  /** 报送期次 */
  period: string
  groupId: number
  groupName: string
  taskId: number
  /** 存储过程英文名 */
  taskCode: string
  /** 存储过程中文名 */
  taskName: string
  /** 执行方式：1 自动调度 / 2 手工调度 */
  runType: number
  /** 运行状态，见字典 cr_task_run_status：1 运行中 / 2 成功 / 3 失败 / 4 等待前置 / 5 已跳过 */
  status: number
  startTime: string
  endTime: string
  /** 执行时长（秒） */
  duration: number
  /** 新增数据量 */
  rowsAdded: number
  /** SQL 执行返回值（存储过程返回码 / SQL 影响行数，0 = 成功） */
  sqlReturn: string
  /** SQL 执行错误信息（仅失败时有值） */
  errorMsg: string
  /** 操作人（自动调度记「调度中心」） */
  operator: string
}

export const TASK_RUN_STATUS = {
  RUNNING: 1,
  SUCCESS: 2,
  FAILED: 3,
  WAITING: 4,
  SKIPPED: 5
} as const

export const RUN_TYPE_LABEL: Record<number, string> = { 1: '自动调度', 2: '手工调度' }
export const RUN_STATUS_LABEL: Record<number, string> = {
  1: '运行中',
  2: '执行成功',
  3: '执行失败',
  4: '等待前置任务',
  5: '已跳过'
}

/** 稳定哈希：同一个"任务 + 期次"永远得到同一个结果，演示可以反复重放 */
const hashOf = (text: string): number => {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000
  }
  return hash
}

/** 期次 → 数据日期（该月最后一天）：202608 → 2026-08-31 */
export const dataDateOfPeriod = (period: string): string => {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(4, 6))
  if (!year || !month) return ''
  const lastDay = new Date(year, month, 0).getDate()
  return year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0')
}

/** 失败原因：按任务编码给真实感的中文报错，不用随机文案 */
const errorOfTask = (task: CollectTaskRow): string => {
  const errors: Record<string, string> = {
    PKG_HX_BASE_CUSTOMER: 'ORA-01555: 快照过旧，回滚段不足（客户主数据表锁等待 120s 超时）',
    PKG_HX_FIN_PAYMENT:
      'ORA-00942: 表或视图不存在：HXUSER.V_FIN_PAYMENT（视图被上游重建，请稍后重试）',
    PKG_HX_REG_CLAIM: 'ORA-12899: 列 REG_CLAIM_NO 的值太大（实际 34，最大 32）',
    PKG_HX_REG_INTERMEDIARY: 'ORA-00054: 资源忙，无法获取 HXUSER.ZJ_TMP 的排他锁',
    PRC_HX_SUMMARY_BX011:
      'ORA-01652: 无法扩展临时段（报表加工临时表空间 TEMP 已满，请联系 DBA 扩容）',
    PRC_HX_SUMMARY_BX021: 'ORA-01400: 无法将 NULL 插入 PRIOR_SUM.PERIOD（期次未初始化）',
    SH_HX_EXPORT_CHECK: '文件校验失败：/opt/hx/data/BX011_202608.txt 行数 128 与库内 126 不一致',
    JOB_HX_ARCHIVE: '历史库连接失败：jdbc:oracle:thin:@10.20.41.7:1521/HXHIS 拒绝连接'
  }
  return errors[task.code] || 'ORA-20100: 存储过程内部未捕获异常，请查看 HXUSER.ERR_LOG'
}

/** 本次执行是否失败：哈希决定，确定性可重放 */
export const taskWillFail = (taskCode: string, period: string): boolean =>
  hashOf(taskCode + '#' + period) % 7 === 3

/** 本次执行新增的数据量：同样确定性 */
const rowsAddedOf = (task: CollectTaskRow, period: string): number =>
  200 + (hashOf(task.code + '@' + period) % 40) * 137

/** 执行时长（秒） */
const durationOf = (task: CollectTaskRow, period: string): number =>
  18 + (hashOf(period + '*' + task.code) % 26) * 9

/**
 * 造一条跑批日志行（纯函数，不落库）—— 立即执行 / 手工调度 / 种子三处共用这一份口径。
 * 种子必须先走这个纯函数：defineTable 在求值种子时表本身还没建好，直接 insert 会踩 TDZ。
 */
export const buildTaskLogRow = (options: {
  task: CollectTaskRow
  period: string
  dataDate: string
  runType: number
  operator: string
  /** 已经开始的时刻（批量执行时按顺序往后推） */
  startedAt?: number
  /** 强制状态（种子里构造历史样本、手工调度里构造"等待前置"用） */
  forceStatus?: number
  /** 等待前置任务时的原因说明（由调用方给出前置任务编码，明细里要指名道姓） */
  preTaskNames?: string
}): Omit<CollectTaskLogRow, 'id'> => {
  const { task, period, dataDate, runType, operator } = options
  const group = collectTaskGroupTable.get(task.groupId)
  const started = options.startedAt ?? Date.now()
  const duration = durationOf(task, period)
  const status =
    options.forceStatus ??
    (taskWillFail(task.code, period) ? TASK_RUN_STATUS.FAILED : TASK_RUN_STATUS.SUCCESS)
  // 「等待前置 / 已跳过」是被判定为不能跑的，没有开始时间与耗时，不要给它编一个假的运行时段
  const notRun = status === TASK_RUN_STATUS.WAITING || status === TASK_RUN_STATUS.SKIPPED
  const rowsAdded = status === TASK_RUN_STATUS.SUCCESS ? rowsAddedOf(task, period) : 0
  const row: Omit<CollectTaskLogRow, 'id'> = {
    // id 故意留空：insert 会用 row.id ?? nextId(rows) 分配；写死 0 会被当成"已指定 id"，
    // 「立即执行」返回的 id 就永远是 0（种子侧另外用 ++seedId 覆盖）
    dataDate,
    period,
    groupId: task.groupId,
    groupName: group?.groupName || '',
    taskId: task.id,
    taskCode: task.code,
    taskName: task.name,
    runType,
    status,
    startTime: notRun ? '' : formatDateTime(started),
    endTime:
      notRun || status === TASK_RUN_STATUS.RUNNING ? '' : formatDateTime(started + duration * 1000),
    duration: notRun || status === TASK_RUN_STATUS.RUNNING ? 0 : duration,
    rowsAdded,
    sqlReturn:
      status === TASK_RUN_STATUS.SUCCESS ? '0' : status === TASK_RUN_STATUS.FAILED ? '-1' : '',
    errorMsg:
      status === TASK_RUN_STATUS.FAILED
        ? errorOfTask(task)
        : notRun
          ? '前置任务未成功：' + (options.preTaskNames || '')
          : '',
    operator
  }
  return row
}

/** 跑一次任务并落一条日志（写库版本，立即执行 / 手工调度用） */
export const runCollectTask = (options: {
  task: CollectTaskRow
  period: string
  dataDate: string
  runType: number
  operator: string
  startedAt?: number
  forceStatus?: number
}): CollectTaskLogRow => collectTaskLogTable.insert(buildTaskLogRow(options))

/**
 * 手工调度：勾选任务分组 + 选择期次 → 按「优先级 → id」顺序批量执行。
 *
 * 前置任务真的参与判定（三条一起看才完整）：
 * - 前置任务**在本次批次里**跑过 → 看本次结果，不是「执行成功」就落「等待前置任务」；
 * - 前置任务**不在本次批次里**（勾了别的分组）→ 看它同期次最近一次的执行结果；
 * - 本期次还没有任何执行记录 → 不做判定（页面上的说明文字写清了这条边界）。
 * 等待行的 errorMsg 会指名道姓写出是哪个前置、什么状态，不做"未知原因"这种糊弄。
 * 返回生成条数与各状态计数，页面直接展示，不在前端再算一遍。
 */
export const manualRunByGroups = (options: {
  groupIds: number[]
  period: string
  operator: string
}) => {
  const { groupIds, period, operator } = options
  const dataDate = dataDateOfPeriod(period)
  const tasks = collectTaskTable
    .all()
    .filter((task) => groupIds.includes(task.groupId))
    .sort((a, b) => a.priority - b.priority || a.id - b.id)
  if (!tasks.length) throw new Error('所选任务分组下没有可执行的任务')

  /** 同一期次里某个任务最近一次执行（种子与本次批量执行都算） */
  const latestLogOf = (taskId: number) =>
    collectTaskLogTable
      .all()
      .filter((row) => row.taskId === taskId && row.period === period)
      .sort((a, b) => b.id - a.id)[0]

  const statusOf = new Map<number, number>()
  const logs: CollectTaskLogRow[] = []
  let started = Date.now()
  tasks.forEach((task) => {
    // 前置任务是否就绪：本次批次里跑过的看本次结果；不在批次里的，看同期次最近一次执行结果
    // （本期次还没有任何记录时不做判定 —— 页面上的说明文字写清了这条边界）
    const blockings = (task.preTaskIds || [])
      .map((id) => {
        const preId = Number(id)
        const name = collectTaskTable.get(preId)?.code || '任务 ' + preId
        const inBatch = statusOf.get(preId)
        if (inBatch !== undefined) {
          return inBatch === TASK_RUN_STATUS.SUCCESS
            ? ''
            : name + '（本批次' + RUN_STATUS_LABEL[inBatch] + '）'
        }
        const latest = latestLogOf(preId)
        if (!latest) return ''
        return latest.status === TASK_RUN_STATUS.SUCCESS
          ? ''
          : name + '（本期次最近一次' + RUN_STATUS_LABEL[latest.status] + '）'
      })
      .filter((text) => !!text)
    if (blockings.length) {
      const row = collectTaskLogTable.insert(
        buildTaskLogRow({
          task,
          period,
          dataDate,
          runType: 2,
          operator,
          forceStatus: TASK_RUN_STATUS.WAITING,
          preTaskNames: blockings.join('、')
        }) as CollectTaskLogRow
      )
      statusOf.set(task.id, TASK_RUN_STATUS.WAITING)
      logs.push(row)
      return
    }
    const row = runCollectTask({ task, period, dataDate, runType: 2, operator, startedAt: started })
    started += 1000
    statusOf.set(task.id, row.status)
    logs.push(row)
  })

  return {
    period,
    dataDate,
    generated: logs.length,
    success: logs.filter((row) => row.status === TASK_RUN_STATUS.SUCCESS).length,
    failed: logs.filter((row) => row.status === TASK_RUN_STATUS.FAILED).length,
    waiting: logs.filter((row) => row.status === TASK_RUN_STATUS.WAITING).length,
    rowsAdded: logs.reduce((acc, row) => acc + row.rowsAdded, 0),
    logs
  }
}

/** 种子：两个数据日期的自动跑批 + 一条手工重跑 */
const buildLogSeed = (): CollectTaskLogRow[] => {
  const rows: CollectTaskLogRow[] = []
  let seedId = 0
  const batches: Array<[string, string, number]> = [
    ['202607', '2026-07-31', 1],
    ['202608', '2026-08-31', 1],
    ['202608', '2026-09-01', 1]
  ]
  const push = (options: Parameters<typeof buildTaskLogRow>[0]) => {
    rows.push({ ...buildTaskLogRow(options), id: ++seedId })
  }
  // 2026-09-01 那次跑批的"事故现场"：BX011 报表加工因临时表空间满失败，
  // 两个后置任务（落盘检查 / 历史归档）因此落「等待前置任务」—— 页面上一眼能看到依赖关系的后果。
  const FORCED: Record<string, Record<string, { forceStatus: number; preTaskNames?: string }>> = {
    '2026-09-01': {
      PRC_HX_SUMMARY_BX011: { forceStatus: TASK_RUN_STATUS.FAILED },
      SH_HX_EXPORT_CHECK: {
        forceStatus: TASK_RUN_STATUS.WAITING,
        preTaskNames: 'PRC_HX_SUMMARY_BX011（本批次执行失败）'
      },
      JOB_HX_ARCHIVE: {
        forceStatus: TASK_RUN_STATUS.WAITING,
        preTaskNames: 'PRC_HX_SUMMARY_BX011（本批次执行失败）'
      }
    }
  }
  batches.forEach(([period, dataDate, runType]) => {
    collectTaskTable.all().forEach((task, index) => {
      const started = Date.parse(dataDate + ' 02:00:00') + index * 1000 * 60 * 3
      const forced = FORCED[dataDate]?.[task.code]
      push({
        task,
        period,
        dataDate,
        runType,
        operator: '调度中心',
        startedAt: started,
        ...(forced || {})
      })
    })
  })
  // 2026-09-01 那次 BX011 报表加工失败过一回，运维在 09:12 手工重跑成功 —— 演示"失败 → 立即执行"
  const target = collectTaskTable.findOne((task) => task.code === 'PRC_HX_SUMMARY_BX011')
  if (target) {
    push({
      task: target,
      period: '202608',
      dataDate: '2026-09-01',
      runType: 2,
      operator: '系统管理员',
      startedAt: Date.parse('2026-09-01 09:12:00'),
      forceStatus: TASK_RUN_STATUS.SUCCESS
    })
  }
  // 一条正在运行的样本（页面能看到"运行中"状态与空结束时间）
  const running = collectTaskTable.findOne((task) => task.code === 'PKG_HX_BASE_CUSTOMER')
  if (running) {
    push({
      task: running,
      period: '202608',
      dataDate: '2026-09-01',
      runType: 1,
      operator: '调度中心',
      startedAt: Date.parse('2026-09-01 02:06:00'),
      forceStatus: TASK_RUN_STATUS.RUNNING
    })
  }
  return rows.reverse()
}

export const collectTaskLogTable = defineTable<CollectTaskLogRow>('cr.collectTaskLog', buildLogSeed)

/* ==================================================================
 * 4. 调度配置
 * ================================================================== */
export interface ScheduleRow {
  id: number
  taskId: number
  /** 任务名称（冗余，列表直接展示，任务改名时级联同步） */
  taskName: string
  /** Cron 表达式（Quartz 六段：秒 分 时 日 月 周） */
  cron: string
  /** 调度状态：0 已关闭 / 1 已开启 */
  enabled: number
  /** 是否有状态：有状态任务串行执行，无状态任务可并发 */
  stateful: boolean
  createUser: string
  createTime: string
  updateUser: string
  updateTime: string
  remark: string
}

const scheduleSeed: ScheduleRow[] = [
  {
    id: 1,
    taskId: 1,
    taskName: '保单基础信息采集',
    cron: '0 0 2 * * ?',
    enabled: 1,
    stateful: true,
    createUser: '系统管理员',
    createTime: '2026-08-20 10:00:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-20 10:00:00',
    remark: '每天凌晨 02:00 跑批，必须串行（有状态）'
  },
  {
    id: 2,
    taskId: 2,
    taskName: '客户主数据采集',
    cron: '0 10 2 * * ?',
    enabled: 1,
    stateful: true,
    createUser: '系统管理员',
    createTime: '2026-08-20 10:02:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-21 14:10:00',
    remark: '保单采集之后 10 分钟'
  },
  {
    id: 3,
    taskId: 4,
    taskName: '保费收入采集',
    cron: '0 30 2 * * ?',
    enabled: 1,
    stateful: true,
    createUser: '系统管理员',
    createTime: '2026-08-20 10:04:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-20 10:04:00',
    remark: ''
  },
  {
    id: 4,
    taskId: 6,
    taskName: '收付费流水采集',
    cron: '0 0/30 1-5 * * ?',
    enabled: 0,
    stateful: false,
    createUser: '系统管理员',
    createTime: '2026-08-22 10:30:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-30 16:20:00',
    remark: '视图被上游重建后一直失败，暂时关闭，待上游确认后开启'
  },
  {
    id: 5,
    taskId: 7,
    taskName: '监管保单报送取数',
    cron: '0 0 3 * * ?',
    enabled: 1,
    stateful: true,
    createUser: '系统管理员',
    createTime: '2026-08-20 10:06:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-25 17:00:00',
    remark: '依赖保单基础信息 + 保费收入'
  },
  {
    id: 6,
    taskId: 10,
    taskName: 'BX011 报表加工',
    cron: '0 0 4 * * ?',
    enabled: 1,
    stateful: true,
    createUser: '系统管理员',
    createTime: '2026-08-20 10:08:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-26 09:30:00',
    remark: '监管报送取数完成后加工'
  },
  {
    id: 7,
    taskId: 13,
    taskName: '历史数据归档',
    cron: '0 0 1 1 * ?',
    enabled: 1,
    stateful: false,
    createUser: '系统管理员',
    createTime: '2026-08-22 10:34:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-22 10:34:00',
    remark: '每月 1 号凌晨 01:00 归档上期数据'
  },
  {
    id: 8,
    taskId: 12,
    taskName: '报送文件落盘检查',
    cron: '0 0/20 * * * ?',
    enabled: 1,
    stateful: false,
    createUser: '系统管理员',
    createTime: '2026-08-22 10:36:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-26 09:32:00',
    remark: '每 20 分钟检查一次落盘文件，无状态可并发'
  }
]

export const scheduleTable = defineTable<ScheduleRow>('cr.schedule', scheduleSeed)

/** Cron 段数校验：Quartz 六段（秒 分 时 日 月 周），页面与接口共用一份 */
export const CRON_FIELDS = ['秒', '分', '时', '日', '月', '周']

export const validateCron = (cron: string): string => {
  const text = String(cron || '').trim()
  if (!text) return 'Cron 表达式不能为空'
  const parts = text.split(/\s+/)
  if (parts.length !== 6) {
    return (
      'Cron 表达式需要 6 段（秒 分 时 日 月 周，如 0 0 2 * * ?），当前 ' +
      parts.length +
      ' 段。缺少：' +
      CRON_FIELDS.slice(parts.length).join('、')
    )
  }
  const invalid = parts.findIndex((part) => !/^[0-9A-Za-z*?/,#\-]+$/.test(part))
  if (invalid >= 0) {
    return (
      'Cron 第 ' +
      (invalid + 1) +
      ' 段（' +
      CRON_FIELDS[invalid] +
      '）含非法字符：' +
      parts[invalid]
    )
  }
  return ''
}

/** 常用 Cron 快捷项（调度配置表单里给几个"看一眼就懂"的预设） */
export const CRON_SHORTCUTS = [
  { text: '每天凌晨 02:00', value: '0 0 2 * * ?' },
  { text: '每天凌晨 03:00', value: '0 0 3 * * ?' },
  { text: '每 30 分钟', value: '0 0/30 * * * ?' },
  { text: '每小时整点', value: '0 0 * * * ?' },
  { text: '每月 1 号 01:00', value: '0 0 1 1 * ?' }
]

/* ==================================================================
 * 5. 集群配置
 * ================================================================== */
export interface ClusterRow {
  id: number
  /** 节点名 */
  nodeName: string
  /** 节点地址（IP:端口） */
  address: string
  /** 角色：master / worker，见字典 cr_cluster_role */
  role: string
  /** 状态：1 在线 / 0 离线，见字典 cr_cluster_status */
  status: number
  createUser: string
  createTime: string
  updateUser: string
  updateTime: string
  remark: string
}

export const clusterTable = defineTable<ClusterRow>('cr.cluster', [
  {
    id: 1,
    nodeName: 'HX-APP-01',
    address: '10.20.31.11:8080',
    role: 'master',
    status: 1,
    createUser: '系统管理员',
    createTime: '2026-08-18 09:00:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-18 09:00:00',
    remark: '主节点，负责任务分发与调度决策'
  },
  {
    id: 2,
    nodeName: 'HX-APP-02',
    address: '10.20.31.12:8080',
    role: 'worker',
    status: 1,
    createUser: '系统管理员',
    createTime: '2026-08-18 09:02:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-18 09:02:00',
    remark: '工作节点，承担基础数据采集'
  },
  {
    id: 3,
    nodeName: 'HX-APP-03',
    address: '10.20.31.13:8080',
    role: 'worker',
    status: 1,
    createUser: '系统管理员',
    createTime: '2026-08-18 09:04:00',
    updateUser: '系统管理员',
    updateTime: '2026-09-02 11:30:00',
    remark: '工作节点，承担报表加工'
  },
  {
    id: 4,
    nodeName: 'HX-APP-04',
    address: '10.20.31.14:8080',
    role: 'worker',
    status: 0,
    createUser: '系统管理员',
    createTime: '2026-08-18 09:06:00',
    updateUser: '系统管理员',
    updateTime: '2026-09-05 08:40:00',
    remark: '节点宕机，2026-09-05 起停止接收调度，待运维更换硬盘'
  }
])

/* ==================================================================
 * 6. 供页面 / handler 复用的查询
 * ================================================================== */

/** 任务分组树：分组 + 组内任务数（任务维护页左侧） */
export const taskGroupTree = () =>
  collectTaskGroupTable
    .all()
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((group) => {
      const tasks = collectTaskTable.all().filter((task) => task.groupId === group.id)
      return {
        id: group.id,
        groupCode: group.groupCode,
        groupName: group.groupName,
        description: group.description,
        taskCount: tasks.length,
        highPriorityCount: tasks.filter((task) => task.priority === 1).length,
        children: []
      }
    })

/** 期次下拉（复用采集域的期次表，任务调度不另建一份期次） */
export const schedulePeriodOptions = () =>
  periodOptions().map((item) => ({
    period: item.period,
    periodName: item.periodName,
    status: item.status,
    dataDate: dataDateOfPeriod(item.period)
  }))

/** 批量监控的头部统计（当前筛选条件下的运行概况，与列表同源） */
export const taskLogStats = (rows: CollectTaskLogRow[]) => ({
  total: rows.length,
  success: rows.filter((row) => row.status === TASK_RUN_STATUS.SUCCESS).length,
  failed: rows.filter((row) => row.status === TASK_RUN_STATUS.FAILED).length,
  waiting: rows.filter((row) => row.status === TASK_RUN_STATUS.WAITING).length,
  running: rows.filter((row) => row.status === TASK_RUN_STATUS.RUNNING).length,
  rowsAdded: rows.reduce((acc, row) => acc + (Number(row.rowsAdded) || 0), 0)
})
