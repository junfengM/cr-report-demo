/**
 * Mock 种子数据 — 数据采集域（P1）
 *
 * 十二张表：
 * - cr.collectPeriod   报送期次（采集窗口、开放/关闭、是否允许补录）
 * - cr.collectChannel  采集方式（机构 × 报表 → 系统直连 / 文件导入 / 接口推送 / 手工录入）
 * - cr.importConfig    导入设置（文件类型、分隔符、编码、表头行数、字段映射、校验策略）
 * - cr.importTask      导入任务（一次导入 = 一个批次）
 * - cr.importTaskRow   导入明细（解析出的错误行 / 警告行）
 * - cr.importTaskData  导入暂存（解析通过、尚未入库的行）
 * - cr.importAudit     导入审核流水
 * - cr.importAuth      导入权限（角色 / 用户 × 机构 × 报表），由 effectiveImportAuth() 落成校验
 * - cr.importLog       导入日志
 * - cr.supplement      数据补录申请
 * - cr.supplementFile  补录附件（内容以 base64 存本地，能真的下载下来）
 * - cr.collectJob      取数任务（系统直连 / 接口推送的每一次调用留痕）
 *
 * 与主链路的咬合（这是本模块最值钱的地方）：
 * 导入任务「入库」时会**真实写入** cr.fillData / cr.fillRecord（复用同一张填报数据表），
 * 因此「数据填报」页面立刻能看到导入进来的行；写入行的 remark 标注导入批次号，
 * 回滚时按批次号删除。期次设置里的 deadline 也会同步到填报记录的报送截止日。
 */
import { defineTable } from '../store'
import { formatDateTime, nextId } from '../util'
import { PERIOD, PERIODS, reportOrgs, reportOptions } from './crCommon'
import { ROLE_CODE, roleTable, userTable } from './system'
import { crTaskTable } from './crTask'
import { crFillDataTable, crFillRecordTable, type FillRecordRow } from './crData'

/* ==================================================================
 * 小工具：按机构名 / 报表 id 取口径一致的名称
 * ================================================================== */
const orgOf = (orgName: string) => {
  const org = reportOrgs().find((item) => item.orgName === orgName)
  return org
    ? { id: org.id, orgCode: org.orgCode, orgName: org.orgName }
    : { id: 0, orgCode: '', orgName }
}

const reportOf = (reportId: number) => {
  const report = reportOptions().find((item) => item.id === reportId)
  return report
    ? { id: report.id, reportCode: report.reportCode, reportName: report.reportName }
    : { id: reportId, reportCode: 'BX000', reportName: '未知报表' }
}

/** 种子数据里用的引用：字段名与表字段一致（orgOf / reportOf 返回的是 id，不要直接展开进种子行） */
const orgRef = (orgName: string) => {
  const org = orgOf(orgName)
  return { orgId: org.id, orgName: org.orgName }
}

const reportRef = (reportId: number) => {
  const report = reportOf(reportId)
  return { reportId: report.id, reportCode: report.reportCode, reportName: report.reportName }
}

const userOf = (nickname: string) =>
  userTable.all().find((user) => user.nickname === nickname)?.nickname || nickname

/** 该「机构 × 报表 × 期次」已有的填报明细行数（种子任务的行数与填报数据保持一致） */
const fillRowsOf = (orgId: number, reportId: number, period: string): number =>
  crFillDataTable
    .all()
    .filter((row) => row.orgId === orgId && row.reportId === reportId && row.period === period)
    .length

/** 期次截止日（导入 / 补录写填报记录时同步） */
export const deadlineOfPeriod = (period: string): string =>
  collectPeriodTable.all().find((row) => row.period === period)?.deadline || ''

/* ==================================================================
 * 1. 报送期次
 * ================================================================== */
export interface CollectPeriodRow {
  id: number
  /** 期次，如 202608 */
  period: string
  periodName: string
  /** 频度，见字典 cr_report_freq */
  freq: number
  /** 数据采集窗口 */
  collectStart: string
  collectEnd: string
  /** 报送截止日（会同步到填报记录） */
  deadline: string
  /** 是否允许补录 */
  allowSupplement: boolean
  /** 状态，见字典 cr_period_status：0 未开始 / 1 进行中 / 2 已关闭 */
  status: number
  /** 已下发任务数 / 已审核通过任务数（列表按任务表实时汇总，不落库） */
  taskCount?: number
  finishedCount?: number
  closeTime: string
  closeUser: string
  createTime: string
  remark: string
}

const periodSeed: CollectPeriodRow[] = [
  {
    id: 1,
    period: '202603',
    periodName: '2026年3月',
    freq: 3,
    collectStart: '2026-04-01',
    collectEnd: '2026-04-10',
    deadline: '2026-04-15',
    allowSupplement: false,
    status: 2,
    closeTime: '2026-04-16 09:20:00',
    closeUser: '系统管理员',
    createTime: '2026-03-25 09:00:00',
    remark: '期次已关闭，不再接收数据'
  },
  {
    id: 2,
    period: '202604',
    periodName: '2026年4月',
    freq: 3,
    collectStart: '2026-05-01',
    collectEnd: '2026-05-11',
    deadline: '2026-05-15',
    allowSupplement: false,
    status: 2,
    closeTime: '2026-05-16 09:05:00',
    closeUser: '系统管理员',
    createTime: '2026-04-25 09:00:00',
    remark: '期次已关闭'
  },
  {
    id: 3,
    period: '202605',
    periodName: '2026年5月',
    freq: 3,
    collectStart: '2026-06-01',
    collectEnd: '2026-06-10',
    deadline: '2026-06-15',
    allowSupplement: false,
    status: 2,
    closeTime: '2026-06-16 09:10:00',
    closeUser: '系统管理员',
    createTime: '2026-05-25 09:00:00',
    remark: '期次已关闭'
  },
  {
    id: 4,
    period: '202606',
    periodName: '2026年6月',
    freq: 3,
    collectStart: '2026-07-01',
    collectEnd: '2026-07-10',
    deadline: '2026-07-15',
    allowSupplement: true,
    status: 2,
    closeTime: '2026-07-17 10:30:00',
    closeUser: '系统管理员',
    createTime: '2026-06-25 09:00:00',
    remark: '关闭后办理过 1 次补录'
  },
  {
    id: 5,
    period: '202607',
    periodName: '2026年7月',
    freq: 3,
    collectStart: '2026-08-01',
    collectEnd: '2026-08-10',
    deadline: '2026-08-15',
    allowSupplement: true,
    status: 2,
    closeTime: '2026-08-18 09:00:00',
    closeUser: '系统管理员',
    createTime: '2026-07-25 09:00:00',
    remark: '期次已关闭，允许补录申请'
  },
  {
    id: 6,
    period: '202608',
    periodName: '2026年8月',
    freq: 3,
    collectStart: '2026-09-01',
    collectEnd: '2026-09-12',
    deadline: '2026-09-15',
    allowSupplement: true,
    status: 1,
    closeTime: '',
    closeUser: '',
    createTime: '2026-08-25 09:00:00',
    remark: '当前期次：采集进行中，允许申请补录'
  },
  {
    id: 7,
    period: '202609',
    periodName: '2026年9月',
    freq: 3,
    collectStart: '2026-10-01',
    collectEnd: '2026-10-12',
    deadline: '2026-10-15',
    allowSupplement: true,
    status: 0,
    closeTime: '',
    closeUser: '',
    createTime: '2026-09-10 09:00:00',
    remark: '已建期次，采集窗口未到'
  }
]

export const collectPeriodTable = defineTable<CollectPeriodRow>('cr.collectPeriod', periodSeed)

/** 期次下拉 */
export const periodOptions = () =>
  collectPeriodTable
    .all()
    .slice()
    .sort((a, b) => (a.period < b.period ? 1 : -1))
    .map((row) => ({
      period: row.period,
      periodName: row.periodName,
      status: row.status,
      deadline: row.deadline,
      allowSupplement: row.allowSupplement
    }))

/**
 * 期次进度：从报表任务表实时汇总（列表页用它显示「任务数 / 已完成」，不落库）
 * 已完成口径 = 任务状态 90 审核通过
 */
export const periodProgress = (): Record<
  string,
  { taskCount: number; finishedCount: number; submitRate: number; fillCount: number }
> => {
  const result: Record<
    string,
    { taskCount: number; finishedCount: number; submitRate: number; fillCount: number }
  > = {}
  PERIODS.concat(['202609']).forEach((period) => {
    const tasks = crTaskTable.all().filter((task) => task.period === period)
    const finished = tasks.filter((task) => task.status === 90).length
    result[period] = {
      taskCount: tasks.length,
      finishedCount: finished,
      submitRate: tasks.length ? Math.round((finished / tasks.length) * 1000) / 10 : 0,
      fillCount: crFillDataTable.all().filter((row) => row.period === period).length
    }
  })
  return result
}

/* ==================================================================
 * 2. 采集方式
 * ================================================================== */
export interface CollectChannelRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  /** 采集方式，见字典 cr_collect_channel：1 系统直连 / 2 文件导入 / 3 接口推送 / 4 手工录入 */
  channelType: number
  /** 源系统 */
  dataSource: string
  /** 采集地址（接口 URL / FTP 目录 / 库表名） */
  endpoint: string
  protocol: string
  /** 调度周期描述 */
  cronText: string
  lastCollectTime: string
  /** 上次采集结果：1 成功 / 0 失败 */
  lastStatus: number
  lastMessage: string
  /** 启停状态，见字典 cr_enable_status */
  status: number
  owner: string
  remark: string
}

const channelSeed: CollectChannelRow[] = [
  {
    id: 1,
    ...orgRef('总公司'),
    ...reportRef(1),
    channelType: 1,
    dataSource: '核心业务系统',
    endpoint: 'jdbc:oracle:thin:@10.1.9.11:1521/CRDB',
    protocol: 'DB-LINK',
    cronText: '每月 1 日 02:00 全量抽取',
    lastCollectTime: '2026-09-01 02:03:12',
    lastStatus: 1,
    lastMessage: '抽取 3,278 行',
    status: 1,
    owner: userOf('王信息'),
    remark: '总公司统一抽取后下发分公司'
  },
  {
    id: 2,
    ...orgRef('北京分公司'),
    ...reportRef(1),
    channelType: 1,
    dataSource: '核心业务系统',
    endpoint: 'jdbc:oracle:thin:@10.1.9.11:1521/CRDB',
    protocol: 'DB-LINK',
    cronText: '每月 1 日 02:10 全量抽取',
    lastCollectTime: '2026-09-01 02:11:40',
    lastStatus: 1,
    lastMessage: '抽取 42 行',
    status: 1,
    owner: userOf('周北京'),
    remark: ''
  },
  {
    id: 3,
    ...orgRef('北京分公司'),
    ...reportRef(11),
    channelType: 2,
    dataSource: '银保通系统',
    endpoint: 'sftp://10.2.3.21/report/upload',
    protocol: 'SFTP',
    cronText: '每月 3 日前人工上传',
    lastCollectTime: '2026-09-03 08:55:20',
    lastStatus: 1,
    lastMessage: '上传 1 个文件，入库 52 行',
    status: 1,
    owner: userOf('周北京'),
    remark: '分公司导出 CSV 后上传'
  },
  {
    id: 4,
    ...orgRef('上海分公司'),
    ...reportRef(11),
    channelType: 2,
    dataSource: '银保通系统',
    endpoint: 'sftp://10.3.3.21/report/upload',
    protocol: 'SFTP',
    cronText: '每月 3 日前人工上传',
    lastCollectTime: '2026-09-03 09:30:11',
    lastStatus: 1,
    lastMessage: '上传 1 个文件，入库 46 行',
    status: 1,
    owner: userOf('吴上海'),
    remark: ''
  },
  {
    id: 5,
    ...orgRef('上海分公司'),
    ...reportRef(12),
    channelType: 3,
    dataSource: '团险核心系统',
    endpoint: 'https://api.hx-life.com/br/report/push',
    protocol: 'HTTPS',
    cronText: '每月 2 日 23:00 推送',
    lastCollectTime: '2026-09-02 23:00:35',
    lastStatus: 1,
    lastMessage: '接收 36 行',
    status: 1,
    owner: userOf('吴上海'),
    remark: '接口推送自动入库'
  },
  {
    id: 6,
    ...orgRef('江苏分公司'),
    ...reportRef(12),
    channelType: 2,
    dataSource: '团险核心系统',
    endpoint: 'sftp://10.4.3.21/report/upload',
    protocol: 'SFTP',
    cronText: '每月 3 日前人工上传',
    lastCollectTime: '2026-09-04 09:02:18',
    lastStatus: 0,
    lastMessage: '文件分隔符与导入设置不符，解析失败',
    status: 1,
    owner: userOf('郑江苏'),
    remark: '需按导入设置重新导出'
  },
  {
    id: 7,
    ...orgRef('江苏分公司'),
    ...reportRef(2),
    channelType: 4,
    dataSource: '手工台账',
    endpoint: '—',
    protocol: '—',
    cronText: '不适用',
    lastCollectTime: '2026-09-02 09:40:02',
    lastStatus: 1,
    lastMessage: '页面录入 31 行',
    status: 1,
    owner: userOf('郑江苏'),
    remark: '量小，直接页面录入'
  },
  {
    id: 8,
    ...orgRef('广东分公司'),
    ...reportRef(18),
    channelType: 1,
    dataSource: '人力外包系统',
    endpoint: 'jdbc:mysql://10.5.7.31:3306/hr',
    protocol: 'DB-LINK',
    cronText: '每月 1 日 03:00 全量抽取',
    lastCollectTime: '2026-09-01 03:01:55',
    lastStatus: 1,
    lastMessage: '抽取 4,516 行',
    status: 1,
    owner: userOf('黄粤生'),
    remark: ''
  },
  {
    id: 9,
    ...orgRef('广东分公司'),
    ...reportRef(11),
    channelType: 2,
    dataSource: '银保通系统',
    endpoint: 'sftp://10.5.3.21/report/upload',
    protocol: 'SFTP',
    cronText: '每月 3 日前人工上传',
    lastCollectTime: '2026-09-04 08:20:44',
    lastStatus: 1,
    lastMessage: '上传 1 个文件，34 行待审核',
    status: 1,
    owner: userOf('黄粤生'),
    remark: ''
  },
  {
    id: 10,
    ...orgRef('江苏分公司'),
    ...reportRef(11),
    channelType: 2,
    dataSource: '银保通系统',
    endpoint: 'sftp://10.4.3.21/report/upload',
    protocol: 'SFTP',
    cronText: '每月 3 日前人工上传',
    lastCollectTime: '2026-09-03 10:10:07',
    lastStatus: 1,
    lastMessage: '上传 1 个文件，38 行已入库',
    status: 1,
    owner: userOf('郑江苏'),
    remark: ''
  },
  {
    id: 11,
    ...orgRef('北京分公司'),
    ...reportRef(12),
    channelType: 3,
    dataSource: '团险核心系统',
    endpoint: 'https://api.hx-life.com/br/report/push',
    protocol: 'HTTPS',
    cronText: '每月 2 日 23:30 推送',
    lastCollectTime: '2026-09-04 09:15:31',
    lastStatus: 1,
    lastMessage: '接收 35 行',
    status: 1,
    owner: userOf('周北京'),
    remark: ''
  },
  {
    id: 12,
    ...orgRef('广东分公司'),
    ...reportRef(2),
    channelType: 4,
    dataSource: '手工台账',
    endpoint: '—',
    protocol: '—',
    cronText: '不适用',
    lastCollectTime: '',
    lastStatus: 0,
    lastMessage: '尚未使用',
    status: 0,
    owner: userOf('黄粤生'),
    remark: '已停用，改用文件导入'
  }
]

export const collectChannelTable = defineTable<CollectChannelRow>('cr.collectChannel', channelSeed)

/* ==================================================================
 * 3. 导入设置
 * ================================================================== */
/** 列映射：文件第 column 列（从 1 开始）对应系统字段 field */
export interface ImportMappingItem {
  column: number
  field: string
  label: string
}

export interface ImportConfigRow {
  id: number
  /** 0 表示「全部机构」/「全部报表」，用于配置默认模板 */
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  /** 文件类型，见字典 cr_file_type：1 CSV / 2 TXT / 3 XLSX */
  fileType: number
  separator: string
  charset: string
  /** 表头行数（0 表示无表头） */
  headerRows: number
  /** 数据起始行号 */
  startRow: number
  dateFormat: string
  /** 字段映射 */
  mapping: ImportMappingItem[]
  /** 严格校验：任意错误行即整批失败 */
  strictCheck: boolean
  /** 允许覆盖已有填报数据 */
  allowOverwrite: boolean
  /** 入库前需要审核 */
  needAudit: boolean
  /** 启停状态，见字典 cr_enable_status */
  status: number
  updateUser: string
  updateTime: string
  remark: string
}

/** 标准列映射（保单类报表通用） */
export const DEFAULT_MAPPING: ImportMappingItem[] = [
  { column: 1, field: 'policyNo', label: '保单号' },
  { column: 2, field: 'holderName', label: '投保人' },
  { column: 3, field: 'certNo', label: '证件号码' },
  { column: 4, field: 'productName', label: '险种名称' },
  { column: 5, field: 'premiumAmount', label: '保费金额' },
  { column: 6, field: 'rate', label: '费率' },
  { column: 7, field: 'sumAssured', label: '保险金额' },
  { column: 8, field: 'effectDate', label: '保单生效日期' },
  { column: 9, field: 'channel', label: '销售渠道' },
  { column: 10, field: 'dataStatus', label: '数据状态' }
]

const importConfigSeed: ImportConfigRow[] = [
  {
    id: 1,
    orgId: 0,
    orgName: '全部机构',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    fileType: 1,
    separator: ',',
    charset: 'UTF-8',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: false,
    allowOverwrite: true,
    needAudit: false,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-08-20 10:00:00',
    remark: '全局默认导入模板'
  },
  {
    id: 2,
    ...orgRef('北京分公司'),
    ...reportRef(1),
    fileType: 1,
    separator: ',',
    charset: 'UTF-8',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: false,
    allowOverwrite: true,
    needAudit: false,
    status: 1,
    updateUser: '周北京',
    updateTime: '2026-08-28 14:20:00',
    remark: '系统直连导出文件，直接覆盖'
  },
  {
    id: 3,
    ...orgRef('北京分公司'),
    ...reportRef(11),
    fileType: 1,
    separator: ',',
    charset: 'UTF-8',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: true,
    allowOverwrite: true,
    needAudit: true,
    status: 1,
    updateUser: '周北京',
    updateTime: '2026-08-28 14:25:00',
    remark: '银保通导出，需审核后入库'
  },
  {
    id: 4,
    ...orgRef('上海分公司'),
    ...reportRef(11),
    fileType: 2,
    separator: '|',
    charset: 'GBK',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyyMMdd',
    mapping: DEFAULT_MAPPING,
    strictCheck: false,
    allowOverwrite: true,
    needAudit: false,
    status: 1,
    updateUser: '吴上海',
    updateTime: '2026-08-29 09:10:00',
    remark: '旧系统导出 TXT，日期为 yyyyMMdd'
  },
  {
    id: 5,
    ...orgRef('江苏分公司'),
    ...reportRef(12),
    fileType: 1,
    separator: ';',
    charset: 'UTF-8',
    headerRows: 2,
    startRow: 3,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: false,
    allowOverwrite: false,
    needAudit: true,
    status: 1,
    updateUser: '郑江苏',
    updateTime: '2026-08-30 11:05:00',
    remark: '两行表头，禁止覆盖已填报数据'
  },
  {
    id: 6,
    ...orgRef('江苏分公司'),
    ...reportRef(2),
    fileType: 1,
    separator: ',',
    charset: 'UTF-8',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: true,
    allowOverwrite: true,
    needAudit: true,
    status: 1,
    updateUser: '郑江苏',
    updateTime: '2026-08-30 11:12:00',
    remark: '手工台账，严格校验'
  },
  {
    id: 7,
    ...orgRef('广东分公司'),
    ...reportRef(18),
    fileType: 1,
    separator: ',',
    charset: 'UTF-8',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: false,
    allowOverwrite: true,
    needAudit: false,
    status: 1,
    updateUser: '黄粤生',
    updateTime: '2026-09-01 09:40:00',
    remark: ''
  },
  {
    id: 8,
    ...orgRef('广东分公司'),
    ...reportRef(11),
    fileType: 3,
    separator: '—',
    charset: 'UTF-8',
    headerRows: 1,
    startRow: 2,
    dateFormat: 'yyyy-MM-dd',
    mapping: DEFAULT_MAPPING,
    strictCheck: false,
    allowOverwrite: true,
    needAudit: true,
    status: 1,
    updateUser: '黄粤生',
    updateTime: '2026-09-02 15:00:00',
    remark: '银保通导出 XLSX，浏览器内直接解析（日期自动归一化）'
  }
]

export const importConfigTable = defineTable<ImportConfigRow>('cr.importConfig', importConfigSeed)

/**
 * 取生效的导入设置：机构 + 报表精确匹配 → 报表默认 → 机构默认 → 全局默认
 * 导入页在「解析文件」前先调它，拿到分隔符 / 表头行数 / 字段映射，再按真实文件内容解析。
 */
export const effectiveImportConfig = (orgId: number, reportId: number): ImportConfigRow => {
  const rows = importConfigTable.all()
  const exact = rows.find((row) => row.orgId === Number(orgId) && row.reportId === Number(reportId))
  const byReport = rows.find((row) => row.orgId === 0 && row.reportId === Number(reportId))
  const byOrg = rows.find((row) => row.orgId === Number(orgId) && row.reportId === 0)
  const global = rows.find((row) => row.orgId === 0 && row.reportId === 0)
  return exact || byReport || byOrg || global || rows[0]
}

/* ==================================================================
 * 4. 导入任务 + 5. 导入明细
 * ================================================================== */
export interface ImportTaskRow {
  id: number
  /** 批次号，如 IMP20260901001 */
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  fileName: string
  fileSize: number
  /** 文件类型，见字典 cr_file_type */
  fileType: number
  totalRows: number
  successRows: number
  failRows: number
  /** 状态，见字典 cr_import_status：1 解析中 / 2 解析失败 / 3 待审核 / 4 已入库 / 5 已驳回 */
  status: number
  /** 数据来源，见字典 cr_collect_channel */
  sourceType: number
  importer: string
  importTime: string
  importCost: number
  auditor: string
  auditTime: string
  auditRemark: string
  /** 入库写入的填报数据行数（0 表示未入库） */
  writtenRows: number
  remark: string
}

interface TaskSpec {
  orgName: string
  reportId: number
  period: string
  fileName: string
  fileSize: number
  fileType: number
  status: number
  sourceType: number
  importer: string
  importTime: string
  importCost: number
  auditor?: string
  auditTime?: string
  auditRemark?: string
  /** 覆盖自动算出的行数（默认取填报数据行数） */
  totalRows?: number
  failRows?: number
  remark?: string
}

const taskSpecs: TaskSpec[] = [
  {
    orgName: '北京分公司',
    reportId: 1,
    period: '202608',
    fileName: 'HX_110000_BX001_202608.csv',
    fileSize: 285328,
    fileType: 1,
    status: 4,
    sourceType: 1,
    importer: '周北京',
    importTime: '2026-09-01 09:12:33',
    importCost: 1820,
    auditor: '系统自动',
    auditTime: '2026-09-01 09:12:35',
    remark: '系统直连导出后自动导入'
  },
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    fileName: 'HX_310000_BX011_202608.csv',
    fileSize: 412066,
    fileType: 1,
    status: 4,
    sourceType: 2,
    importer: '吴上海',
    importTime: '2026-09-01 10:05:18',
    importCost: 2410,
    auditor: '系统自动',
    auditTime: '2026-09-01 10:05:20',
    remark: ''
  },
  {
    orgName: '江苏分公司',
    reportId: 2,
    period: '202608',
    fileName: 'HX_320000_BX002_202608.csv',
    fileSize: 231044,
    fileType: 1,
    status: 3,
    sourceType: 2,
    importer: '郑江苏',
    importTime: '2026-09-02 09:40:02',
    importCost: 1560,
    failRows: 2,
    remark: '手工台账，2 行校验不通过'
  },
  {
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    fileName: 'HX_440000_BX012_202608.csv',
    fileSize: 268901,
    fileType: 1,
    status: 5,
    sourceType: 2,
    importer: '黄粤生',
    importTime: '2026-09-02 14:20:41',
    importCost: 1980,
    failRows: 3,
    auditor: '系统管理员',
    auditTime: '2026-09-03 09:10:00',
    auditRemark: '3 行保单号重复，请核对后重新导入',
    remark: ''
  },
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202608',
    fileName: 'push_BX011_20260903.json',
    fileSize: 51230,
    fileType: 1,
    status: 4,
    sourceType: 3,
    importer: '接口推送',
    importTime: '2026-09-03 08:55:20',
    importCost: 640,
    auditor: '系统自动',
    auditTime: '2026-09-03 08:55:21',
    remark: '银保通系统接口推送'
  },
  {
    orgName: '上海分公司',
    reportId: 12,
    period: '202608',
    fileName: 'push_BX012_20260903.json',
    fileSize: 44980,
    fileType: 1,
    status: 4,
    sourceType: 3,
    importer: '接口推送',
    importTime: '2026-09-03 09:30:11',
    importCost: 590,
    auditor: '系统自动',
    auditTime: '2026-09-03 09:30:12',
    remark: ''
  },
  {
    orgName: '江苏分公司',
    reportId: 11,
    period: '202608',
    fileName: 'HX_320000_BX011_202608.txt',
    fileSize: 0,
    fileType: 2,
    status: 2,
    sourceType: 2,
    importer: '郑江苏',
    importTime: '2026-09-03 10:10:07',
    importCost: 320,
    totalRows: 0,
    remark: '解析失败：文件表头行数与导入设置（2 行）不符'
  },
  {
    orgName: '广东分公司',
    reportId: 11,
    period: '202608',
    fileName: 'HX_440000_BX011_202608.csv',
    fileSize: 198233,
    fileType: 1,
    status: 3,
    sourceType: 2,
    importer: '黄粤生',
    importTime: '2026-09-04 08:20:44',
    importCost: 1310,
    remark: '待审核，审核通过后才会写入填报数据'
  },
  {
    orgName: '江苏分公司',
    reportId: 12,
    period: '202608',
    fileName: 'HX_320000_BX012_202608.csv',
    fileSize: 176540,
    fileType: 1,
    status: 4,
    sourceType: 2,
    importer: '郑江苏',
    importTime: '2026-09-04 09:02:18',
    importCost: 1120,
    auditor: '系统自动',
    auditTime: '2026-09-04 09:02:19',
    totalRows: 28,
    remark: ''
  },
  {
    orgName: '北京分公司',
    reportId: 12,
    period: '202608',
    fileName: 'push_BX012_20260904.json',
    fileSize: 47210,
    fileType: 1,
    status: 3,
    sourceType: 3,
    importer: '接口推送',
    importTime: '2026-09-04 09:15:31',
    importCost: 610,
    totalRows: 35,
    remark: '接口推送批次，按配置需人工审核'
  }
]

export const importTaskTable = defineTable<ImportTaskRow>('cr.importTask', () => {
  let id = 0
  return taskSpecs.map((spec, index) => {
    id += 1
    const org = orgOf(spec.orgName)
    const report = reportOf(spec.reportId)
    const stored = fillRowsOf(org.id, report.id, spec.period)
    const totalRows = spec.totalRows ?? stored ?? 0
    const failRows = spec.failRows || 0
    const successRows = spec.status === 2 ? 0 : Math.max(totalRows - failRows, 0)
    const written = spec.status === 4 ? successRows : 0
    const seq = String(index + 1).padStart(3, '0')
    return {
      id,
      batchNo: 'IMP' + spec.period + seq,
      orgId: org.id,
      orgName: org.orgName,
      reportId: report.id,
      reportCode: report.reportCode,
      reportName: report.reportName,
      period: spec.period,
      fileName: spec.fileName,
      fileSize: spec.fileSize,
      fileType: spec.fileType,
      totalRows,
      successRows,
      failRows,
      status: spec.status,
      sourceType: spec.sourceType,
      importer: spec.importer,
      importTime: spec.importTime,
      importCost: spec.importCost,
      auditor: spec.auditor || '',
      auditTime: spec.auditTime || '',
      auditRemark: spec.auditRemark || '',
      writtenRows: written,
      remark: spec.remark || ''
    } as ImportTaskRow
  })
})

export interface ImportTaskRowDetail {
  id: number
  taskId: number
  batchNo: string
  /** 文件内的行号 */
  rowNo: number
  /** 原始行内容（截断展示） */
  content: string
  errorField: string
  errorMsg: string
  /** 1 错误 / 2 警告 */
  level: number
}

const taskRowSeed: ImportTaskRowDetail[] = [
  {
    id: 1,
    taskId: 3,
    batchNo: 'IMP202608003',
    rowNo: 7,
    content: 'HX202600000017,赵敏,110101199001011234,安康重疾险,,0.032,500000,2026-08-11,银保,正常',
    errorField: 'premiumAmount',
    errorMsg: '保费金额不能为空',
    level: 1
  },
  {
    id: 2,
    taskId: 3,
    batchNo: 'IMP202608003',
    rowNo: 19,
    content:
      'HX202600000029,孙悦,110101199203055678,安康重疾险,3200,0.032,500000,20260812,银保,正常',
    errorField: 'effectDate',
    errorMsg: '保单生效日期格式应为 yyyy-MM-dd',
    level: 1
  },
  {
    id: 3,
    taskId: 4,
    batchNo: 'IMP202608004',
    rowNo: 3,
    content:
      'HX202600000101,李强,440101198801013456,百万医疗险,1800,0.05,300000,2026-08-02,网销,正常',
    errorField: 'policyNo',
    errorMsg: '保单号在同一批次内重复',
    level: 1
  },
  {
    id: 4,
    taskId: 4,
    batchNo: 'IMP202608004',
    rowNo: 11,
    content:
      'HX202600000101,李强,440101198801013456,百万医疗险,1800,0.05,300000,2026-08-02,网销,正常',
    errorField: 'policyNo',
    errorMsg: '保单号在同一批次内重复',
    level: 1
  },
  {
    id: 5,
    taskId: 4,
    batchNo: 'IMP202608004',
    rowNo: 27,
    content:
      'HX202600000118,周婷,440101199507081234,百万医疗险,2400,abc,300000,2026-08-07,网销,正常',
    errorField: 'rate',
    errorMsg: '费率必须为数字',
    level: 1
  },
  {
    id: 6,
    taskId: 7,
    batchNo: 'IMP202608007',
    rowNo: 1,
    content: '保单号|投保人|证件号码|险种名称|保费金额',
    errorField: 'header',
    errorMsg: '表头行数与导入设置（2 行）不符',
    level: 1
  },
  {
    id: 7,
    taskId: 7,
    batchNo: 'IMP202608007',
    rowNo: 2,
    content: 'HX202600000201 王芳 320101199001011234 安康重疾险 2600',
    errorField: 'separator',
    errorMsg: '字段个数与字段映射不一致（期望 10 列，实际 5 列）',
    level: 1
  },
  {
    id: 8,
    taskId: 3,
    batchNo: 'IMP202608003',
    rowNo: 25,
    content: 'HX202600000031,吴磊,320101198706121234,安康重疾险,2900,0.032,500000,2026-08-20,银保,',
    errorField: 'dataStatus',
    errorMsg: '数据状态为空，已按「正常」处理',
    level: 2
  },
  {
    id: 9,
    taskId: 4,
    batchNo: 'IMP202608004',
    rowNo: 30,
    content:
      'HX202600000121,郑爽,440101199901011234,百万医疗险,2100,0.05,300000,2026-08-09,网销,正常',
    errorField: 'certNo',
    errorMsg: '证件号码校验位不规范',
    level: 2
  }
]

export const importTaskRowTable = defineTable<ImportTaskRowDetail>('cr.importTaskRow', taskRowSeed)

/* ==================================================================
 * 6. 导入审核流水
 * ================================================================== */
export interface ImportAuditRow {
  id: number
  taskId: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportName: string
  period: string
  totalRows: number
  successRows: number
  failRows: number
  submitUser: string
  submitTime: string
  /** 见字典 cr_audit_status：1 待审核 / 2 已通过 / 3 已驳回 */
  status: number
  auditor: string
  auditTime: string
  auditRemark: string
}

const auditSeed: ImportAuditRow[] = [
  {
    id: 1,
    taskId: 1,
    batchNo: 'IMP202608001',
    orgId: orgOf('北京分公司').id,
    orgName: '北京分公司',
    reportId: 1,
    reportName: reportOf(1).reportName,
    period: '202608',
    totalRows: fillRowsOf(orgOf('北京分公司').id, 1, '202608'),
    successRows: fillRowsOf(orgOf('北京分公司').id, 1, '202608'),
    failRows: 0,
    submitUser: '周北京',
    submitTime: '2026-09-01 09:12:33',
    status: 1,
    auditor: '系统自动',
    auditTime: '2026-09-01 09:12:35',
    auditRemark: '免审核配置，自动入库'
  },
  {
    id: 2,
    taskId: 2,
    batchNo: 'IMP202608002',
    orgId: orgOf('上海分公司').id,
    orgName: '上海分公司',
    reportId: 11,
    reportName: reportOf(11).reportName,
    period: '202608',
    totalRows: fillRowsOf(orgOf('上海分公司').id, 11, '202608'),
    successRows: fillRowsOf(orgOf('上海分公司').id, 11, '202608'),
    failRows: 0,
    submitUser: '吴上海',
    submitTime: '2026-09-01 10:05:18',
    status: 1,
    auditor: '系统自动',
    auditTime: '2026-09-01 10:05:20',
    auditRemark: '免审核配置，自动入库'
  },
  {
    id: 3,
    taskId: 3,
    batchNo: 'IMP202608003',
    orgId: orgOf('江苏分公司').id,
    orgName: '江苏分公司',
    reportId: 2,
    reportName: reportOf(2).reportName,
    period: '202608',
    totalRows: fillRowsOf(orgOf('江苏分公司').id, 2, '202608'),
    successRows: Math.max(fillRowsOf(orgOf('江苏分公司').id, 2, '202608') - 2, 0),
    failRows: 2,
    submitUser: '郑江苏',
    submitTime: '2026-09-02 09:40:02',
    status: 0,
    auditor: '',
    auditTime: '',
    auditRemark: ''
  },
  {
    id: 4,
    taskId: 4,
    batchNo: 'IMP202608004',
    orgId: orgOf('广东分公司').id,
    orgName: '广东分公司',
    reportId: 12,
    reportName: reportOf(12).reportName,
    period: '202608',
    totalRows: fillRowsOf(orgOf('广东分公司').id, 12, '202608'),
    successRows: Math.max(fillRowsOf(orgOf('广东分公司').id, 12, '202608') - 3, 0),
    failRows: 3,
    submitUser: '黄粤生',
    submitTime: '2026-09-02 14:20:41',
    status: 2,
    auditor: '系统管理员',
    auditTime: '2026-09-03 09:10:00',
    auditRemark: '3 行保单号重复，请核对后重新导入'
  },
  {
    id: 5,
    taskId: 5,
    batchNo: 'IMP202608005',
    orgId: orgOf('北京分公司').id,
    orgName: '北京分公司',
    reportId: 11,
    reportName: reportOf(11).reportName,
    period: '202608',
    totalRows: fillRowsOf(orgOf('北京分公司').id, 11, '202608'),
    successRows: fillRowsOf(orgOf('北京分公司').id, 11, '202608'),
    failRows: 0,
    submitUser: '接口推送',
    submitTime: '2026-09-03 08:55:20',
    status: 1,
    auditor: '系统自动',
    auditTime: '2026-09-03 08:55:21',
    auditRemark: '接口推送自动入库'
  },
  {
    id: 6,
    taskId: 8,
    batchNo: 'IMP202608008',
    orgId: orgOf('广东分公司').id,
    orgName: '广东分公司',
    reportId: 11,
    reportName: reportOf(11).reportName,
    period: '202608',
    totalRows: fillRowsOf(orgOf('广东分公司').id, 11, '202608'),
    successRows: fillRowsOf(orgOf('广东分公司').id, 11, '202608'),
    failRows: 0,
    submitUser: '黄粤生',
    submitTime: '2026-09-04 08:20:44',
    status: 0,
    auditor: '',
    auditTime: '',
    auditRemark: ''
  },
  {
    id: 7,
    taskId: 10,
    batchNo: 'IMP202608010',
    orgId: orgOf('北京分公司').id,
    orgName: '北京分公司',
    reportId: 12,
    reportName: reportOf(12).reportName,
    period: '202608',
    totalRows: 35,
    successRows: 35,
    failRows: 0,
    submitUser: '接口推送',
    submitTime: '2026-09-04 09:15:31',
    status: 0,
    auditor: '',
    auditTime: '',
    auditRemark: ''
  }
]

export const importAuditTable = defineTable<ImportAuditRow>('cr.importAudit', auditSeed)

/* ==================================================================
 * 7. 导入权限
 * ================================================================== */
export interface ImportAuthRow {
  id: number
  /** 授权主体，见字典 cr_subject_type：1 角色 / 2 用户 */
  subjectType: number
  subjectId: number
  subjectName: string
  /** 0 表示全部机构 */
  orgId: number
  orgName: string
  /** 0 表示全部报表 */
  reportId: number
  reportCode: string
  reportName: string
  canImport: boolean
  canOverwrite: boolean
  needAudit: boolean
  /** 单批最大行数 */
  maxRows: number
  status: number
  grantUser: string
  grantTime: string
  remark: string
}

const authSeed: ImportAuthRow[] = [
  {
    id: 1,
    subjectType: 1,
    subjectId: 2,
    subjectName: '报送填报岗',
    orgId: 0,
    orgName: '全部机构',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    canImport: true,
    canOverwrite: true,
    needAudit: false,
    maxRows: 20000,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-08-20 10:00:00',
    remark: '填报岗默认权限'
  },
  {
    id: 2,
    subjectType: 1,
    subjectId: 3,
    subjectName: '报送复核岗',
    orgId: 0,
    orgName: '全部机构',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    canImport: true,
    canOverwrite: false,
    needAudit: true,
    maxRows: 20000,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-08-20 10:05:00',
    remark: '复核岗导入必须走审核'
  },
  {
    id: 3,
    subjectType: 1,
    subjectId: 4,
    subjectName: '报送审核岗',
    orgId: 0,
    orgName: '全部机构',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    canImport: false,
    canOverwrite: false,
    needAudit: true,
    maxRows: 0,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-08-20 10:08:00',
    remark: '审核岗只审不导'
  },
  {
    id: 4,
    subjectType: 2,
    subjectId: 9,
    subjectName: '周北京',
    orgId: orgOf('北京分公司').id,
    orgName: '北京分公司',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    canImport: true,
    canOverwrite: true,
    needAudit: false,
    maxRows: 5000,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-08-28 14:00:00',
    remark: '北京分公司数据员'
  },
  {
    id: 5,
    subjectType: 2,
    subjectId: 10,
    subjectName: '吴上海',
    orgId: orgOf('上海分公司').id,
    orgName: '上海分公司',
    reportId: 11,
    reportCode: reportOf(11).reportCode,
    reportName: reportOf(11).reportName,
    canImport: true,
    canOverwrite: true,
    needAudit: false,
    maxRows: 3000,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-08-29 09:00:00',
    remark: ''
  },
  {
    id: 6,
    subjectType: 2,
    subjectId: 11,
    subjectName: '郑江苏',
    orgId: orgOf('江苏分公司').id,
    orgName: '江苏分公司',
    reportId: 12,
    reportCode: reportOf(12).reportCode,
    reportName: reportOf(12).reportName,
    canImport: true,
    canOverwrite: false,
    needAudit: true,
    maxRows: 2000,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-08-30 11:00:00',
    remark: '两行表头模板，禁止覆盖'
  },
  {
    id: 7,
    subjectType: 2,
    subjectId: 12,
    subjectName: '黄粤生',
    orgId: orgOf('广东分公司').id,
    orgName: '广东分公司',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    canImport: true,
    canOverwrite: true,
    needAudit: true,
    maxRows: 5000,
    status: 1,
    grantUser: '系统管理员',
    grantTime: '2026-09-01 09:30:00',
    remark: '广东分公司数据员'
  },
  {
    id: 8,
    subjectType: 2,
    subjectId: 5,
    subjectName: '李银芬',
    orgId: 0,
    orgName: '全部机构',
    reportId: 11,
    reportCode: reportOf(11).reportCode,
    reportName: reportOf(11).reportName,
    canImport: true,
    canOverwrite: false,
    needAudit: true,
    maxRows: 1000,
    status: 0,
    grantUser: '系统管理员',
    grantTime: '2026-09-02 10:20:00',
    remark: '已停用：该用户改用页面填报'
  }
]

export const importAuthTable = defineTable<ImportAuthRow>('cr.importAuth', authSeed)

/** 生效的导入权限（页面横幅、导入校验都读它，保证「看到的就是拦你的那条」） */
export interface EffectiveImportAuth {
  /** 是否命中了授权记录 */
  matched: boolean
  /** 是否系统管理员（不受导入权限约束） */
  superAdmin: boolean
  canImport: boolean
  canOverwrite: boolean
  needAudit: boolean
  /** 单批上限行数，0 = 不限制 */
  maxRows: number
  /** 生效规则 id，0 表示未命中或超管兜底 */
  ruleId: number
  /** 生效来源，一句话说明，直接显示在页面上 */
  source: string
  /** 当前账号 */
  userId: number
  userName: string
  roleNames: string[]
  /** 命中的全部规则（按优先级排序，第一个生效），便于页面上解释「为什么是这条」 */
  rules: ImportAuthRow[]
}

/**
 * 取某个用户在「机构 × 报表」上真正生效的导入权限。
 *
 * 优先级（与真实系统的数据权限一致，取最精确的一条）：
 *   1. 用户级 > 角色级
 *   2. 机构 + 报表精确 > 指定机构 > 指定报表 > 全部机构 + 全部报表
 *   3. 同精度多条时取 id 小的（先配的先生效）
 * 停用（status = 0）的规则不参与；系统管理员直接返回全权限，与「角色管理里超管拥有全部菜单」一致。
 */
export const effectiveImportAuth = (
  userId: number | undefined,
  orgId: number,
  reportId: number
): EffectiveImportAuth => {
  const id = Number(userId) || 0
  const user = id ? userTable.get(id) : undefined
  const roleIds = (user?.roleIds || []).map((roleId) => Number(roleId))
  const roles = roleTable.all().filter((role) => roleIds.includes(Number(role.id)))
  const base = {
    userId: id,
    userName: user ? user.nickname : '未登录',
    roleNames: roles.map((role) => role.name)
  }
  // 系统管理员不受导入权限约束：演示时切到 admin 永远能导，切到业务角色才看得到限制
  if (roles.some((role) => role.code === ROLE_CODE.ADMIN)) {
    return {
      ...base,
      matched: true,
      superAdmin: true,
      canImport: true,
      canOverwrite: true,
      needAudit: false,
      maxRows: 0,
      ruleId: 0,
      source: '系统管理员不受导入权限约束（可导入任意机构 × 报表）',
      rules: []
    }
  }
  const hit = importAuthTable
    .all()
    .filter((row) => Number(row.status) === 1)
    .filter((row) =>
      row.subjectType === 2 ? Number(row.subjectId) === id : roleIds.includes(Number(row.subjectId))
    )
    .filter(
      (row) =>
        (Number(row.orgId) === 0 || Number(row.orgId) === Number(orgId)) &&
        (Number(row.reportId) === 0 || Number(row.reportId) === Number(reportId))
    )
    // 用户级 8 分 > 角色级 0 分；指定机构 2 分 > 指定报表 1 分 > 全部 0 分
    .sort(
      (a, b) =>
        (b.subjectType === 2 ? 8 : 0) +
          (Number(b.orgId) !== 0 ? 2 : 0) +
          (Number(b.reportId) !== 0 ? 1 : 0) -
          ((a.subjectType === 2 ? 8 : 0) +
            (Number(a.orgId) !== 0 ? 2 : 0) +
            (Number(a.reportId) !== 0 ? 1 : 0)) || a.id - b.id
    )
  const best = hit[0]
  if (!best) {
    return {
      ...base,
      matched: false,
      superAdmin: false,
      canImport: false,
      canOverwrite: false,
      needAudit: true,
      maxRows: 0,
      ruleId: 0,
      source: '未授权：当前账号在「导入权限」里没有任何匹配记录',
      rules: []
    }
  }
  return {
    ...base,
    matched: true,
    superAdmin: false,
    canImport: !!best.canImport,
    canOverwrite: !!best.canOverwrite,
    needAudit: !!best.needAudit,
    maxRows: Number(best.maxRows) || 0,
    ruleId: best.id,
    source:
      (best.subjectType === 2 ? '用户级授权' : '角色级授权') +
      '：' +
      best.subjectName +
      ' × ' +
      (best.orgName || '全部机构') +
      ' × ' +
      (best.reportName || '全部报表'),
    rules: hit
  }
}

/* ==================================================================
 * 8. 导入日志
 * ================================================================== */
export interface ImportLogRow {
  id: number
  batchNo: string
  orgName: string
  reportName: string
  period: string
  /** 动作，见字典 cr_import_action：1 文件解析 / 2 数据校验 / 3 数据入库 / 4 数据回滚 / 5 审核通过 / 6 审核驳回 */
  action: number
  operator: string
  operateTime: string
  /** 1 成功 / 0 失败 */
  result: number
  duration: number
  ip: string
  message: string
}

const logSeed: ImportLogRow[] = [
  {
    id: 1,
    batchNo: 'IMP202608001',
    orgName: '北京分公司',
    reportName: reportOf(1).reportName,
    period: '202608',
    action: 1,
    operator: '周北京',
    operateTime: '2026-09-01 09:12:33',
    result: 1,
    duration: 820,
    ip: '10.2.1.11',
    message: '解析 ' + fillRowsOf(orgOf('北京分公司').id, 1, '202608') + ' 行，耗时 0.8s'
  },
  {
    id: 2,
    batchNo: 'IMP202608001',
    orgName: '北京分公司',
    reportName: reportOf(1).reportName,
    period: '202608',
    action: 2,
    operator: '周北京',
    operateTime: '2026-09-01 09:12:34',
    result: 1,
    duration: 260,
    ip: '10.2.1.11',
    message: '校验通过，无错误行'
  },
  {
    id: 3,
    batchNo: 'IMP202608001',
    orgName: '北京分公司',
    reportName: reportOf(1).reportName,
    period: '202608',
    action: 3,
    operator: '系统自动',
    operateTime: '2026-09-01 09:12:35',
    result: 1,
    duration: 740,
    ip: '127.0.0.1',
    message: '写入填报数据 ' + fillRowsOf(orgOf('北京分公司').id, 1, '202608') + ' 行'
  },
  {
    id: 4,
    batchNo: 'IMP202608002',
    orgName: '上海分公司',
    reportName: reportOf(11).reportName,
    period: '202608',
    action: 1,
    operator: '吴上海',
    operateTime: '2026-09-01 10:05:18',
    result: 1,
    duration: 1120,
    ip: '10.3.1.11',
    message: '解析 ' + fillRowsOf(orgOf('上海分公司').id, 11, '202608') + ' 行'
  },
  {
    id: 5,
    batchNo: 'IMP202608002',
    orgName: '上海分公司',
    reportName: reportOf(11).reportName,
    period: '202608',
    action: 3,
    operator: '系统自动',
    operateTime: '2026-09-01 10:05:20',
    result: 1,
    duration: 690,
    ip: '127.0.0.1',
    message: '写入填报数据 ' + fillRowsOf(orgOf('上海分公司').id, 11, '202608') + ' 行'
  },
  {
    id: 6,
    batchNo: 'IMP202608003',
    orgName: '江苏分公司',
    reportName: reportOf(2).reportName,
    period: '202608',
    action: 1,
    operator: '郑江苏',
    operateTime: '2026-09-02 09:40:02',
    result: 1,
    duration: 940,
    ip: '10.4.1.11',
    message: '解析 ' + fillRowsOf(orgOf('江苏分公司').id, 2, '202608') + ' 行'
  },
  {
    id: 7,
    batchNo: 'IMP202608003',
    orgName: '江苏分公司',
    reportName: reportOf(2).reportName,
    period: '202608',
    action: 2,
    operator: '郑江苏',
    operateTime: '2026-09-02 09:40:03',
    result: 0,
    duration: 320,
    ip: '10.4.1.11',
    message: '校验发现 2 行错误、1 行警告，已转人工审核'
  },
  {
    id: 8,
    batchNo: 'IMP202608004',
    orgName: '广东分公司',
    reportName: reportOf(12).reportName,
    period: '202608',
    action: 2,
    operator: '黄粤生',
    operateTime: '2026-09-02 14:20:42',
    result: 0,
    duration: 410,
    ip: '10.5.1.11',
    message: '校验发现 3 行错误（保单号重复）'
  },
  {
    id: 9,
    batchNo: 'IMP202608004',
    orgName: '广东分公司',
    reportName: reportOf(12).reportName,
    period: '202608',
    action: 6,
    operator: '系统管理员',
    operateTime: '2026-09-03 09:10:00',
    result: 1,
    duration: 180,
    ip: '127.0.0.1',
    message: '审核驳回：3 行保单号重复，请核对后重新导入'
  },
  {
    id: 10,
    batchNo: 'IMP202608005',
    orgName: '北京分公司',
    reportName: reportOf(11).reportName,
    period: '202608',
    action: 1,
    operator: '接口推送',
    operateTime: '2026-09-03 08:55:20',
    result: 1,
    duration: 300,
    ip: '10.1.9.31',
    message: '接口接收 ' + fillRowsOf(orgOf('北京分公司').id, 11, '202608') + ' 行'
  },
  {
    id: 11,
    batchNo: 'IMP202608005',
    orgName: '北京分公司',
    reportName: reportOf(11).reportName,
    period: '202608',
    action: 3,
    operator: '系统自动',
    operateTime: '2026-09-03 08:55:21',
    result: 1,
    duration: 520,
    ip: '127.0.0.1',
    message: '写入填报数据 ' + fillRowsOf(orgOf('北京分公司').id, 11, '202608') + ' 行'
  },
  {
    id: 12,
    batchNo: 'IMP202608006',
    orgName: '上海分公司',
    reportName: reportOf(12).reportName,
    period: '202608',
    action: 3,
    operator: '系统自动',
    operateTime: '2026-09-03 09:30:12',
    result: 1,
    duration: 480,
    ip: '127.0.0.1',
    message: '写入填报数据 ' + fillRowsOf(orgOf('上海分公司').id, 12, '202608') + ' 行'
  },
  {
    id: 13,
    batchNo: 'IMP202608007',
    orgName: '江苏分公司',
    reportName: reportOf(11).reportName,
    period: '202608',
    action: 1,
    operator: '郑江苏',
    operateTime: '2026-09-03 10:10:07',
    result: 0,
    duration: 130,
    ip: '10.4.1.11',
    message: '解析失败：文件表头行数与导入设置（2 行）不符'
  },
  {
    id: 14,
    batchNo: 'IMP202608008',
    orgName: '广东分公司',
    reportName: reportOf(11).reportName,
    period: '202608',
    action: 2,
    operator: '黄粤生',
    operateTime: '2026-09-04 08:20:45',
    result: 1,
    duration: 360,
    ip: '10.5.1.11',
    message: '校验通过，等待审核'
  },
  {
    id: 15,
    batchNo: 'IMP202608009',
    orgName: '江苏分公司',
    reportName: reportOf(12).reportName,
    period: '202608',
    action: 3,
    operator: '系统自动',
    operateTime: '2026-09-04 09:02:19',
    result: 1,
    duration: 430,
    ip: '127.0.0.1',
    message: '写入填报数据 28 行'
  },
  {
    id: 16,
    batchNo: 'IMP202608010',
    orgName: '北京分公司',
    reportName: reportOf(12).reportName,
    period: '202608',
    action: 2,
    operator: '接口推送',
    operateTime: '2026-09-04 09:15:32',
    result: 1,
    duration: 350,
    ip: '10.1.9.31',
    message: '校验通过，等待审核'
  }
]

export const importLogTable = defineTable<ImportLogRow>('cr.importLog', logSeed)

/* ==================================================================
 * 9. 数据补录
 * ================================================================== */
export interface SupplementRow {
  id: number
  /** 补录申请单号 */
  applyNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 补录范围：1 整表补录 / 2 指定行补录 */
  scopeType: number
  rowCount: number
  reason: string
  applyUser: string
  applyTime: string
  /** 状态，见字典 cr_supplement_status：1 待审核 / 2 已通过 / 3 已驳回 / 4 已补录 */
  status: number
  auditor: string
  auditTime: string
  auditRemark: string
  /** 补录完成时间 */
  finishTime: string
  attachment: string
  remark: string
}

const supplementSeed: SupplementRow[] = [
  {
    id: 1,
    applyNo: 'BL20260901001',
    ...orgRef('北京分公司'),
    ...reportRef(1),
    period: '202608',
    scopeType: 2,
    rowCount: 12,
    reason: '系统升级期间漏报 12 笔保单，需补录后重新生成报文',
    applyUser: '周北京',
    applyTime: '2026-09-01 11:20:00',
    status: 1,
    auditor: '',
    auditTime: '',
    auditRemark: '',
    finishTime: '',
    attachment: '漏报明细.xlsx',
    remark: ''
  },
  {
    id: 2,
    applyNo: 'BL20260901002',
    ...orgRef('上海分公司'),
    ...reportRef(11),
    period: '202608',
    scopeType: 1,
    rowCount: 46,
    reason: '银保通系统切换，整表需要重新导入',
    applyUser: '吴上海',
    applyTime: '2026-09-01 14:05:00',
    status: 2,
    auditor: '系统管理员',
    auditTime: '2026-09-01 15:30:00',
    auditRemark: '情况属实，同意补录',
    finishTime: '',
    attachment: '系统切换说明.docx',
    remark: ''
  },
  {
    id: 3,
    applyNo: 'BL20260902001',
    ...orgRef('江苏分公司'),
    ...reportRef(2),
    period: '202608',
    scopeType: 2,
    rowCount: 3,
    reason: '3 笔团险保单生效日期录错，需更正后补录',
    applyUser: '郑江苏',
    applyTime: '2026-09-02 09:10:00',
    status: 4,
    auditor: '系统管理员',
    auditTime: '2026-09-02 10:00:00',
    auditRemark: '同意，已补录 3 行',
    finishTime: '2026-09-02 10:35:00',
    attachment: '',
    remark: '补录后已重新校验通过'
  },
  {
    id: 4,
    applyNo: 'BL20260902002',
    ...orgRef('广东分公司'),
    ...reportRef(12),
    period: '202608',
    scopeType: 1,
    rowCount: 33,
    reason: '导入批次被驳回，申请整表补录',
    applyUser: '黄粤生',
    applyTime: '2026-09-02 16:40:00',
    status: 3,
    auditor: '系统管理员',
    auditTime: '2026-09-03 09:20:00',
    auditRemark: '驳回：请先修正保单号重复问题再申请补录',
    finishTime: '',
    attachment: '',
    remark: ''
  },
  {
    id: 5,
    applyNo: 'BL20260903001',
    ...orgRef('江苏分公司'),
    ...reportRef(11),
    period: '202608',
    scopeType: 2,
    rowCount: 5,
    reason: '解析失败的文件中有 5 行需要手工补录',
    applyUser: '郑江苏',
    applyTime: '2026-09-03 10:30:00',
    status: 1,
    auditor: '',
    auditTime: '',
    auditRemark: '',
    finishTime: '',
    attachment: '手工台账.xlsx',
    remark: ''
  },
  {
    id: 6,
    applyNo: 'BL20260903002',
    ...orgRef('上海分公司'),
    ...reportRef(12),
    period: '202608',
    scopeType: 2,
    rowCount: 2,
    reason: '团险接口推送遗漏 2 行',
    applyUser: '吴上海',
    applyTime: '2026-09-03 15:12:00',
    status: 4,
    auditor: '系统管理员',
    auditTime: '2026-09-03 16:00:00',
    auditRemark: '同意补录',
    finishTime: '2026-09-03 16:22:00',
    attachment: '',
    remark: ''
  },
  {
    id: 7,
    applyNo: 'BL20260904001',
    ...orgRef('北京分公司'),
    ...reportRef(11),
    period: '202608',
    scopeType: 1,
    rowCount: 52,
    reason: '银保通推送批次需整表覆盖',
    applyUser: '周北京',
    applyTime: '2026-09-04 08:40:00',
    status: 2,
    auditor: '系统管理员',
    auditTime: '2026-09-04 09:05:00',
    auditRemark: '同意，等待执行补录',
    finishTime: '',
    attachment: '',
    remark: ''
  },
  {
    id: 8,
    applyNo: 'BL20260815001',
    ...orgRef('广东分公司'),
    ...reportRef(18),
    period: '202607',
    scopeType: 2,
    rowCount: 8,
    reason: '上期从业人员报表漏报 8 人（已关闭期次补录）',
    applyUser: '黄粤生',
    applyTime: '2026-08-15 10:00:00',
    status: 4,
    auditor: '系统管理员',
    auditTime: '2026-08-15 11:20:00',
    auditRemark: '同意，已补录（期次允许补录）',
    finishTime: '2026-08-15 11:45:00',
    attachment: '人员清单.xlsx',
    remark: '关闭期次补录案例'
  }
]

export const supplementTable = defineTable<SupplementRow>('cr.supplement', supplementSeed)

/* ==================================================================
 * 10. 导入暂存（解析出来的行先落这里，审核通过才写进填报数据）
 * ================================================================== */
export interface ImportTaskDataRow {
  id: number
  taskId: number
  batchNo: string
  rowNo: number
  policyNo: string
  holderName: string
  certNo: string
  productName: string
  premiumAmount: number
  rate: number
  sumAssured: number
  effectDate: string
  channel: string
  dataStatus: string
}

export const importTaskDataTable = defineTable<ImportTaskDataRow>('cr.importTaskData', [])

/** 写入暂存行（覆盖该批次原有的暂存） */
export const saveStagingRows = (
  taskId: number,
  batchNo: string,
  rows: Array<Record<string, any>>
): number => {
  const stale = importTaskDataTable.all().filter((row) => row.taskId === taskId)
  if (stale.length) importTaskDataTable.removeBatch(stale.map((row) => row.id))
  let id = nextId(importTaskDataTable.all())
  rows.forEach((row, index) => {
    importTaskDataTable.insert({
      id: id + index,
      taskId,
      batchNo,
      rowNo: index + 1,
      policyNo: String(row.policyNo || ''),
      holderName: String(row.holderName || ''),
      certNo: String(row.certNo || ''),
      productName: String(row.productName || ''),
      premiumAmount: Number(row.premiumAmount) || 0,
      rate: Number(row.rate) || 0,
      sumAssured: Number(row.sumAssured) || 0,
      effectDate: String(row.effectDate || ''),
      channel: String(row.channel || ''),
      dataStatus: String(row.dataStatus || '正常')
    })
  })
  return rows.length
}

export const stagingRowsOf = (taskId: number): ImportTaskDataRow[] =>
  importTaskDataTable
    .all()
    .filter((row) => row.taskId === taskId)
    .sort((a, b) => a.rowNo - b.rowNo)

/** 暂存行 → 填报数据行（字段名一致，直接透传） */
export const stagingToFillRows = (taskId: number): Array<Record<string, any>> =>
  stagingRowsOf(taskId).map((row) => ({
    policyNo: row.policyNo,
    holderName: row.holderName,
    certNo: row.certNo,
    productName: row.productName,
    premiumAmount: row.premiumAmount,
    rate: row.rate,
    sumAssured: row.sumAssured,
    effectDate: row.effectDate,
    channel: row.channel,
    dataStatus: row.dataStatus
  }))

/**
 * 系统直连 / 接口推送「立即采集」时生成的数据行
 * —— 确定性伪随机，保证同一机构同一报表每次采集结果一致，演示可复现。
 */
export const buildCollectedRows = (
  orgId: number,
  reportId: number,
  period: string,
  count: number
): Array<Record<string, any>> => {
  const products = ['安康重疾险', '百万医疗险', '终身寿险', '年金保险', '意外伤害险']
  const channels = ['银保', '个险', '团险', '网销', '经代']
  const surnames = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴']
  const given = ['伟', '芳', '敏', '静', '强', '磊', '洋', '婷', '超', '丹']
  let state = (Number(orgId) * 7919 + Number(reportId) * 104729 + Number(period)) % 2147483647
  if (state <= 0) state += 2147483646
  const random = () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
  const rows: Array<Record<string, any>> = []
  for (let index = 0; index < count; index++) {
    const premium = Math.round((1200 + random() * 6800) * 100) / 100
    const rate = Math.round((0.012 + random() * 0.06) * 10000) / 10000
    const month = String(1 + Math.floor(random() * 8)).padStart(2, '0')
    const day = String(1 + Math.floor(random() * 28)).padStart(2, '0')
    rows.push({
      policyNo: 'HX' + period + String(index + 1).padStart(6, '0'),
      holderName:
        surnames[Math.floor(random() * surnames.length)] +
        given[Math.floor(random() * given.length)],
      certNo:
        '11010119' +
        String(60 + Math.floor(random() * 39)) +
        month +
        day +
        String(1000 + Math.floor(random() * 8999)),
      productName: products[Math.floor(random() * products.length)],
      premiumAmount: premium,
      rate,
      sumAssured: Math.round(premium / rate),
      effectDate: '2026-' + month + '-' + day,
      channel: channels[Math.floor(random() * channels.length)],
      dataStatus: '正常'
    })
  }
  return rows
}
/* ==================================================================
 * 与「数据填报」的联动：导入 / 补录最终都要落到 cr.fillData
 * ================================================================== */
/** 该「机构 × 报表 × 期次」已有的填报明细行数 */
export const fillRowsOfKey = (orgId: number, reportId: number, period: string): number =>
  fillRowsOf(Number(orgId), Number(reportId), period)

/** 按「机构 × 报表 × 期次」找填报记录，没有就建一条（与数据填报页共用一张表） */
const upsertFillRecord = (
  key: { orgId: number; reportId: number; period: string },
  patch: Partial<FillRecordRow>
): FillRecordRow => {
  const realOrg = reportOrgs().find((item) => item.id === Number(key.orgId))
  const report = reportOf(key.reportId)
  const existing = crFillRecordTable
    .all()
    .find(
      (row) =>
        row.orgId === Number(key.orgId) &&
        row.reportId === Number(key.reportId) &&
        row.period === key.period
    )
  if (existing) {
    const updated = crFillRecordTable.update({ id: existing.id, ...patch })
    return (updated || existing) as FillRecordRow
  }
  const blank: Omit<FillRecordRow, 'id'> = {
    orgId: Number(key.orgId),
    orgName: realOrg ? realOrg.orgName : '',
    reportId: Number(key.reportId),
    reportCode: report.reportCode,
    reportName: report.reportName,
    period: key.period,
    rowCount: 0,
    fillStatus: 1,
    checkStatus: 0,
    fillUser: patch.fillUser || '',
    lastModifier: patch.lastModifier || '',
    lastModifyTime: patch.lastModifyTime || '',
    deadline: deadlineOfPeriod(key.period),
    submitTime: '',
    remark: ''
  }
  return crFillRecordTable.insert({
    ...blank,
    ...patch,
    id: nextId(crFillRecordTable.all())
  } as FillRecordRow)
}

/**
 * 把导入 / 补录解析出来的行写进填报数据（整表覆盖）
 * - remark 统一打上来源标记，回滚时按标记删除
 * - 同时把填报记录更新为「已填报」并同步行数与截止日
 */
export const importIntoFillData = (
  key: { orgId: number; reportId: number; period: string },
  rows: Array<Record<string, any>>,
  sourceTag: string,
  operator: string
): { written: number; replaced: number } => {
  const stale = crFillDataTable
    .all()
    .filter(
      (row) =>
        row.orgId === Number(key.orgId) &&
        row.reportId === Number(key.reportId) &&
        row.period === key.period
    )
  if (stale.length) crFillDataTable.removeBatch(stale.map((row) => row.id))
  const org = reportOrgs().find((item) => item.id === Number(key.orgId))
  const report = reportOf(key.reportId)
  const now = formatDateTime()
  let id = nextId(crFillDataTable.all())
  rows.forEach((row, index) => {
    crFillDataTable.insert({
      id: id + index,
      orgId: Number(key.orgId),
      orgName: org ? org.orgName : '',
      reportId: Number(key.reportId),
      reportCode: report.reportCode,
      reportName: report.reportName,
      period: key.period,
      rowNo: index + 1,
      policyNo: String(row.policyNo || ''),
      holderName: String(row.holderName || ''),
      certNo: String(row.certNo || ''),
      productName: String(row.productName || ''),
      sumAssured: Number(row.sumAssured) || 0,
      premiumAmount: Number(row.premiumAmount) || 0,
      rate: Number(row.rate) || 0,
      effectDate: String(row.effectDate || ''),
      channel: String(row.channel || ''),
      dataStatus: String(row.dataStatus || '正常'),
      remark: sourceTag,
      updateTime: now
    })
  })
  const total = fillRowsOf(Number(key.orgId), Number(key.reportId), key.period)
  upsertFillRecord(key, {
    rowCount: total,
    fillStatus: total > 0 ? 1 : 0,
    lastModifier: operator,
    lastModifyTime: now,
    deadline: deadlineOfPeriod(key.period),
    remark: sourceTag
  })
  return { written: rows.length, replaced: stale.length }
}

/** 建/更新填报记录（补录执行用：只改状态与备注，不动已有明细） */
export const ensureFillRecordFor = (
  key: { orgId: number; reportId: number; period: string },
  patch: Partial<FillRecordRow>
): FillRecordRow => upsertFillRecord(key, patch)

/** 按来源标记回滚（删除该批次写入的填报数据），返回删除行数 */
export const rollbackFillData = (
  key: { orgId: number; reportId: number; period: string },
  sourceTag: string
): number => {
  const hit = crFillDataTable
    .all()
    .filter(
      (row) =>
        row.orgId === Number(key.orgId) &&
        row.reportId === Number(key.reportId) &&
        row.period === key.period &&
        String(row.remark || '').indexOf(sourceTag) >= 0
    )
  if (!hit.length) return 0
  crFillDataTable.removeBatch(hit.map((row) => row.id))
  const rest = fillRowsOf(Number(key.orgId), Number(key.reportId), key.period)
  upsertFillRecord(key, {
    rowCount: rest,
    fillStatus: rest > 0 ? 1 : 0,
    lastModifier: '系统管理员',
    lastModifyTime: formatDateTime(),
    remark: '导入批次 ' + sourceTag + ' 已回滚'
  })
  return hit.length
}

/** 角色 / 用户下拉（导入权限、补录申请用） */
export const subjectOptionList = () => {
  const roles = [
    { id: 2, name: '报送填报岗' },
    { id: 3, name: '报送复核岗' },
    { id: 4, name: '报送审核岗' }
  ]
  const users = userTable
    .all()
    .filter((user) => user.status === 0)
    .map((user) => ({ id: user.id, name: user.nickname }))
  return { roles, users }
}

/** 生成批次号：IMP + 期次 + 3 位流水（按已有最大流水递增，删除后不复用） */
export const nextBatchNo = (period: string): string => {
  const prefix = 'IMP' + period
  const max = importTaskTable
    .all()
    .filter((row) => row.batchNo.indexOf(prefix) === 0)
    .reduce((acc, row) => Math.max(acc, Number(row.batchNo.slice(prefix.length)) || 0), 0)
  return prefix + String(max + 1).padStart(3, '0')
}

/** 生成补录单号：BL + 日期 + 3 位流水 */
export const nextApplyNo = (): string => {
  const date = formatDateTime().slice(0, 10).replace(/-/g, '')
  const prefix = 'BL' + date
  const max = supplementTable
    .all()
    .filter((row) => row.applyNo.indexOf(prefix) === 0)
    .reduce((acc, row) => Math.max(acc, Number(row.applyNo.slice(prefix.length)) || 0), 0)
  return prefix + String(max + 1).padStart(3, '0')
}

/* ==================================================================
 * 11. 补录附件（Demo 无后端：文件内容以 base64 存在本地，供下载 / 预览）
 * ================================================================== */
/**
 * 单个附件大小上限。
 * base64 会把体积放大 1.33 倍，而 localStorage 通常只有 5MB —— 不设上限的话
 * 传两个 Excel 就会把整个 mock 库写爆（后续所有表都写不进去）。
 */
export const MAX_ATTACHMENT_SIZE = 1024 * 1024

/** 允许的附件扩展名（演示口径：文本 / 表格 / 文档 / 图片 / PDF） */
export const ATTACHMENT_EXTS = [
  'csv',
  'txt',
  'xlsx',
  'xls',
  'doc',
  'docx',
  'pdf',
  'png',
  'jpg',
  'jpeg'
]

export interface SupplementFileRow {
  id: number
  supplementId: number
  applyNo: string
  fileName: string
  /** 扩展名（小写，不含点） */
  fileExt: string
  fileSize: number
  /** data URL（base64）。真实系统这里是文件服务地址，Demo 直接存内容才能真的下载下来 */
  content: string
  uploadUser: string
  uploadTime: string
}

/** 文本 → data URL（种子附件用，省得在代码里贴一长串 base64） */
const textFileDataUrl = (text: string, mime = 'text/csv'): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return 'data:' + mime + ';base64,' + btoa(binary)
}

/** 种子附件内容（真实可下载的 CSV，演示时点「下载」能拿到文件） */
const SEED_ATTACHMENT_CSV: Record<number, { name: string; text: string }> = {
  3: {
    name: '团险生效日期更正明细.csv',
    text:
      '保单号,投保人,险种名称,原生效日期,更正后生效日期,更正原因\n' +
      'HX202608000101,郑海,团体意外伤害险,2026-08-03,2026-08-13,系统切换导致日期偏移\n' +
      'HX202608000102,李文,团体定期寿险,2026-08-05,2026-08-15,系统切换导致日期偏移\n' +
      'HX202608000103,周敏,团体医疗保险,2026-08-09,2026-08-19,系统切换导致日期偏移\n'
  },
  6: {
    name: '团险接口遗漏核对表.csv',
    text:
      '保单号,投保人,险种名称,保费金额,生效日期,核对说明\n' +
      'HX202608000201,吴桐,团体意外伤害险,3200.00,2026-08-06,接口推送遗漏\n' +
      'HX202608000202,孙悦,团体医疗保险,2100.00,2026-08-11,接口推送遗漏\n'
  }
}

export const supplementFileTable = defineTable<SupplementFileRow>('cr.supplementFile', () => {
  const rows = Object.keys(SEED_ATTACHMENT_CSV).map((key, index) => {
    const supplementId = Number(key)
    const apply = supplementTable.get(supplementId)
    const seed = SEED_ATTACHMENT_CSV[supplementId]
    const content = textFileDataUrl(seed.text)
    return {
      id: index + 1,
      supplementId,
      applyNo: apply ? apply.applyNo : '',
      fileName: seed.name,
      fileExt: 'csv',
      fileSize: seed.text.length,
      content,
      uploadUser: apply ? apply.applyUser : '',
      uploadTime: apply ? apply.applyTime : ''
    }
  })
  // 把种子附件名回写到补录主表，保证列表页「附件」列与详情里的附件一致
  rows.forEach((row) => supplementTable.update({ id: row.supplementId, attachment: row.fileName }))
  return rows
})

/** 某个补录申请下的附件（按上传时间正序） */
export const supplementFilesOf = (supplementId: number): SupplementFileRow[] =>
  supplementFileTable
    .all()
    .filter((row) => Number(row.supplementId) === Number(supplementId))
    .sort((a, b) => (a.uploadTime < b.uploadTime ? -1 : 1))

/**
 * 附件增删后，把补录主表的 attachment 字段同步成「附件名顿号连接」。
 * 列表页的「附件」列读的就是这个字段，保证列表与详情永远一致。
 */
export const syncSupplementAttachment = (supplementId: number): string => {
  const apply = supplementTable.get(Number(supplementId))
  if (!apply) return ''
  const text = supplementFilesOf(supplementId)
    .map((row) => row.fileName)
    .join('、')
  supplementTable.update({ id: apply.id, attachment: text })
  return text
}

/* ==================================================================
 * 12. 取数任务（系统直连 / 接口推送的每一次调用留痕）
 * ================================================================== */
/** 任务类型：1 取数 / 2 连接测试 */
export const COLLECT_JOB_TYPE = { COLLECT: 1, TEST: 2 } as const

export interface CollectJobRow {
  id: number
  /** 任务号：CJ + 期次 + 4 位流水 */
  jobNo: string
  /** 1 取数任务 / 2 连接测试，见 COLLECT_JOB_TYPE */
  jobType: number
  channelId: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 采集方式，见字典 cr_collect_channel */
  channelType: number
  dataSource: string
  endpoint: string
  protocol: string
  /** 取数模式：全量抽取 / 增量推送 / 连接测试 */
  mode: string
  /** 请求参数摘要（真实系统里就是接口入参 / 抽取 SQL 条件） */
  requestParams: string
  /** 链路追踪号，排查问题时对账用 */
  traceId: string
  startTime: string
  endTime: string
  /** 耗时（毫秒） */
  cost: number
  /** 返回 / 预计返回行数 */
  rowCount: number
  /** 1 成功 / 0 失败 */
  status: number
  /** 响应摘要或失败原因 */
  message: string
  /** 关联的导入批次（连接测试为 0） */
  taskId: number
  batchNo: string
  operator: string
}

/** 取数任务号：CJ + 期次 + 4 位流水（取已用最大流水 + 1，删记录也不撞号） */
export const nextCollectJobNo = (period: string): string => {
  const prefix = 'CJ' + period
  const max = collectJobTable
    .all()
    .filter((row) => row.jobNo.indexOf(prefix) === 0)
    .reduce((acc, row) => Math.max(acc, Number(row.jobNo.slice(prefix.length)) || 0), 0)
  return prefix + String(max + 1).padStart(4, '0')
}

/** 链路追踪号：TR + 期次 + 6 位序号 */
export const nextTraceId = (period: string): string =>
  'TR' + period + String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')

/** 该「机构 × 报表」的系统直连 / 接口推送预计取数行数（确定性，演示可复现） */
export const collectRowCountOf = (orgId: number, reportId: number): number =>
  20 + ((Number(orgId) * 7 + Number(reportId) * 13) % 40)

/** 机构编码：取数请求参数里要用它，否则页面上看到的入参永远是空字符串 */
export const orgCodeOf = (orgId: number): string =>
  reportOrgs().find((item) => item.id === Number(orgId))?.orgCode || ''

/** 取数请求参数摘要（按协议给出不同的入参样式） */
export const collectParamsOf = (protocol: string, orgCode: string, period: string): string => {
  if (protocol === 'HTTPS')
    return '{"orgCode":"' + orgCode + '","period":"' + period + '","pageSize":500}'
  if (protocol === 'SFTP')
    return 'get /report/' + period + '/' + (orgCode || 'ALL') + '_' + period + '.csv'
  return 'table=CORE_POLICY&orgCode=' + orgCode + '&period=' + period + '&mode=FULL'
}

const collectJobSeed = (): CollectJobRow[] => {
  // 历史记录从「采集方式」的上次采集结果反推：两页口径必须一致，
  // 否则演示时会出现「采集方式说抽了 42 行、取数记录说抽了 3,278 行」这种自相矛盾。
  return collectChannelTable
    .all()
    .filter(
      (channel) =>
        (channel.channelType === 1 || channel.channelType === 3) && !!channel.lastCollectTime
    )
    .sort((a, b) => (a.lastCollectTime < b.lastCollectTime ? 1 : -1))
    .map((channel, index) => {
      const parsed = String(channel.lastMessage)
        .replace(/,/g, '')
        .match(/(\d+)\s*行/)
      const cost = 300 + ((channel.id * 137) % 1200)
      const start = new Date(String(channel.lastCollectTime).replace(/-/g, '/')).getTime()
      const task = importTaskTable
        .all()
        .filter(
          (row) =>
            row.orgId === channel.orgId &&
            row.reportId === channel.reportId &&
            row.sourceType === channel.channelType
        )
        .sort((a, b) => (a.importTime < b.importTime ? 1 : -1))[0]
      return {
        id: index + 1,
        jobNo: 'CJ' + PERIOD + String(index + 1).padStart(4, '0'),
        jobType: COLLECT_JOB_TYPE.COLLECT,
        channelId: channel.id,
        orgId: channel.orgId,
        orgName: channel.orgName,
        reportId: channel.reportId,
        reportCode: channel.reportCode,
        reportName: channel.reportName,
        period: PERIOD,
        channelType: channel.channelType,
        dataSource: channel.dataSource,
        endpoint: channel.endpoint,
        protocol: channel.protocol,
        mode: channel.channelType === 1 ? '全量抽取' : '增量推送',
        requestParams: collectParamsOf(channel.protocol, orgCodeOf(channel.orgId), PERIOD),
        traceId: 'TR' + PERIOD + String((channel.id * 7919) % 1000000).padStart(6, '0'),
        startTime: channel.lastCollectTime,
        endTime: formatDateTime(new Date(start + cost)),
        cost,
        rowCount: parsed ? Number(parsed[1]) : 0,
        status: Number(channel.lastStatus) === 1 ? 1 : 0,
        message: channel.lastMessage,
        taskId: task ? task.id : 0,
        batchNo: task ? task.batchNo : '',
        operator: channel.channelType === 1 ? '系统直连' : '接口推送'
      } as CollectJobRow
    })
}

export const collectJobTable = defineTable<CollectJobRow>('cr.collectJob', collectJobSeed)
