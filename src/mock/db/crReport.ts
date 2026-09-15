/**
 * Mock 种子数据 — 报表功能（数据源 / 数据集 / 报表维护）
 *
 * 附件文档第 16 章的「报表功能（数据源/数据集/报表维护）」在工程内没有可对照的字段说明，
 * 这里按通行做法提案：**数据源 → 数据集 → 报表** 三层，
 * 并且「数据集预览」与「报表预览」都**真的去读业务表**（不另造一份演示数据）：
 *   - 数据集预览：按 dataset 的取数来源从真实 mock 表里取前 N 行；
 *   - 报表预览：拿数据集的行，按维度分组、对度量求和，生成表格 + 图表数据。
 * 这样演示时"改一条业务数据 → 刷新报表预览，数字跟着变"这条链路是真的。
 */
import { defineTable } from '../store'

/** 数据源 */
export interface ReportDatasourceRow {
  id: number
  dsCode: string
  dsName: string
  /** 1 数据库 / 2 文件目录 / 3 接口 */
  dsType: number
  /** 数据库类型：1 MySQL / 2 Oracle / 3 达梦 / 0 不适用 */
  dbType: number
  /** 展示用连接串（口令永远不落库，这里只是脱敏后的样子） */
  connText: string
  status: number
  lastTestTime: string
  /** 最近一次连接测试结论（原文展示，不翻译成"成功/失败"两个词） */
  lastTestResult: string
  lastTestRows: number
  lastTestCost: number
  owner: string
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 数据集：一次取数的定义（数据表或 SQL） */
export interface ReportDatasetRow {
  id: number
  datasetCode: string
  datasetName: string
  /** 1 数据表 / 2 SQL */
  sourceType: number
  datasourceId: number
  datasourceName: string
  /** 取数来源（展示用表名） */
  tableCode: string
  sqlText: string
  /**
   * 预览取数的真实来源（内部标识，不是数据库名）：
   * task / fillRecord / fillData / importTask / checkResult / submitStatus
   */
  previewSource: string
  /** 字段清单（name 与真实行字段一致，label 是中文名） */
  fields: Array<{ name: string; label: string; type: string }>
  rowCount: number
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 报表维护：数据集之上的展示定义 */
export interface ReportDesignRow {
  id: number
  reportCode: string
  reportName: string
  datasetId: number
  datasetName: string
  /** 1 表格 / 2 柱状图 / 3 折线图 / 4 饼图 */
  chartType: number
  /** 维度字段（分组用） */
  dimensionField: string
  /** 度量字段（求和用，可多个） */
  measureFields: string[]
  filterText: string
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

const dsSeed: ReportDatasourceRow[] = [
  {
    id: 1,
    dsCode: 'DS_CR_BIZ',
    dsName: '报送业务库',
    dsType: 1,
    dbType: 1,
    connText: 'jdbc:mysql://10.1.2.30:3306/cr_report?user=cr_ro&password=****',
    status: 1,
    lastTestTime: '2026-09-10 09:12:40',
    lastTestResult: '连接成功（只读账号 cr_ro）',
    lastTestRows: 1286,
    lastTestCost: 62,
    owner: '信息技术部',
    updateUser: '系统管理员',
    updateTime: '2026-09-10 09:12:40',
    remark: '报送主库，只读账号接入',
    createTime: '2026-08-20 10:00:00'
  },
  {
    id: 2,
    dsCode: 'DS_CR_HIS',
    dsName: '报送历史库',
    dsType: 1,
    dbType: 2,
    connText: 'jdbc:oracle:thin:@10.1.2.41:1521/CRHIS?user=cr_his&password=****',
    status: 1,
    lastTestTime: '2026-09-10 09:15:02',
    lastTestResult: '连接成功（历史库，含 202301 以来全部期次）',
    lastTestRows: 8642,
    lastTestCost: 118,
    owner: '信息技术部',
    updateUser: '系统管理员',
    updateTime: '2026-09-10 09:15:02',
    remark: '历史期次对比用',
    createTime: '2026-08-20 10:05:00'
  },
  {
    id: 3,
    dsCode: 'DS_CHECK_FILE',
    dsName: '校验结果文件目录',
    dsType: 2,
    dbType: 0,
    connText: '/data/cr/check-report（SFTP，key: CR_SFTP_PROD）',
    status: 1,
    lastTestTime: '2026-09-09 17:40:11',
    lastTestResult: '目录可读，最近文件 20260909_check.csv',
    lastTestRows: 0,
    lastTestCost: 95,
    owner: '数据管理部',
    updateUser: '系统管理员',
    updateTime: '2026-09-09 17:40:11',
    remark: '监管方校验报告回执目录',
    createTime: '2026-08-21 14:20:00'
  },
  {
    id: 4,
    dsCode: 'DS_REG_API',
    dsName: '监管回执接口',
    dsType: 3,
    dbType: 0,
    connText: 'https://api.reg-demo.gov.cn/cr/receipt（API Key: sk-****3f7c）',
    status: 0,
    lastTestTime: '2026-09-11 08:05:33',
    lastTestResult: '连接超时（演示分支：监管侧接口不可达，需等待窗口期）',
    lastTestRows: 0,
    lastTestCost: 3000,
    owner: '报送管理部',
    updateUser: '系统管理员',
    updateTime: '2026-09-11 08:05:33',
    remark: '演示失败分支用，默认停用',
    createTime: '2026-08-21 14:30:00'
  }
]

const dsFields = {
  task: [
    { name: 'taskCode', label: '任务编号', type: 'string' },
    { name: 'orgName', label: '填报机构', type: 'string' },
    { name: 'reportName', label: '报表名称', type: 'string' },
    { name: 'period', label: '报送期次', type: 'string' },
    { name: 'status', label: '任务状态', type: 'number' },
    { name: 'deadline', label: '截止日期', type: 'string' }
  ],
  fillRecord: [
    { name: 'orgName', label: '机构', type: 'string' },
    { name: 'reportName', label: '报表', type: 'string' },
    { name: 'period', label: '期次', type: 'string' },
    { name: 'rowCount', label: '数据行数', type: 'number' },
    { name: 'fillStatus', label: '填报状态', type: 'number' },
    { name: 'submitTime', label: '提交时间', type: 'string' }
  ],
  importTask: [
    { name: 'batchNo', label: '批次号', type: 'string' },
    { name: 'orgName', label: '机构', type: 'string' },
    { name: 'fileName', label: '文件名', type: 'string' },
    { name: 'totalRows', label: '总行数', type: 'number' },
    { name: 'successRows', label: '成功行数', type: 'number' },
    { name: 'writtenRows', label: '入库行数', type: 'number' }
  ],
  checkResult: [
    { name: 'orgName', label: '机构', type: 'string' },
    { name: 'reportName', label: '报表', type: 'string' },
    { name: 'ruleType', label: '规则类型', type: 'number' },
    { name: 'errorLevel', label: '错误级别', type: 'number' },
    { name: 'columnName', label: '数据项', type: 'string' }
  ]
}

const datasetSeed: ReportDatasetRow[] = [
  {
    id: 1,
    datasetCode: 'DSET_TASK',
    datasetName: '报送任务明细',
    sourceType: 1,
    datasourceId: 1,
    datasourceName: '报送业务库',
    tableCode: 'cr.crTask',
    sqlText: '',
    previewSource: 'task',
    fields: dsFields.task,
    rowCount: 25,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 10:20:00',
    remark: '任务域取数，报表功能的基础数据集',
    createTime: '2026-08-22 09:00:00'
  },
  {
    id: 2,
    datasetCode: 'DSET_FILL',
    datasetName: '填报记录明细',
    sourceType: 1,
    datasourceId: 1,
    datasourceName: '报送业务库',
    tableCode: 'cr.fillRecord',
    sqlText: '',
    previewSource: 'fillRecord',
    fields: dsFields.fillRecord,
    rowCount: 36,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 10:24:00',
    remark: '',
    createTime: '2026-08-22 09:05:00'
  },
  {
    id: 3,
    datasetCode: 'DSET_IMPORT',
    datasetName: '采集批次明细',
    sourceType: 2,
    datasourceId: 1,
    datasourceName: '报送业务库',
    tableCode: 'cr.importTask',
    sqlText:
      'select batch_no, org_name, file_name, total_rows, success_rows, written_rows from cr_import_task',
    previewSource: 'importTask',
    fields: dsFields.importTask,
    rowCount: 10,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 10:30:00',
    remark: 'SQL 型数据集示例（预览仍按登记的表取数）',
    createTime: '2026-08-22 09:10:00'
  },
  {
    id: 4,
    datasetCode: 'DSET_CHECK',
    datasetName: '检核问题明细',
    sourceType: 1,
    datasourceId: 1,
    datasourceName: '报送业务库',
    tableCode: 'cr.checkResult',
    sqlText: '',
    previewSource: 'checkResult',
    fields: dsFields.checkResult,
    rowCount: 42,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 10:35:00',
    remark: '',
    createTime: '2026-08-22 09:15:00'
  }
]

const designSeed: ReportDesignRow[] = [
  {
    id: 1,
    reportCode: 'RPT_TASK_ORG',
    reportName: '各机构任务完成情况',
    datasetId: 1,
    datasetName: '报送任务明细',
    chartType: 2,
    dimensionField: 'orgName',
    // 数据集「报送任务明细」里没有数值字段，度量留空 = 按分组计数（记录数）
    measureFields: [],
    filterText: '期次 = 202608',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 11:00:00',
    remark: '按机构统计任务条数（度量＝记录数，分组计数）',
    createTime: '2026-08-23 09:00:00'
  },
  {
    id: 2,
    reportCode: 'RPT_FILL_ORG',
    reportName: '各机构填报行数',
    datasetId: 2,
    datasetName: '填报记录明细',
    chartType: 2,
    dimensionField: 'orgName',
    measureFields: ['rowCount'],
    filterText: '期次 = 202608',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 11:05:00',
    remark: '度量 rowCount 求和',
    createTime: '2026-08-23 09:05:00'
  },
  {
    id: 3,
    reportCode: 'RPT_FILL_STATUS',
    reportName: '填报状态分布',
    datasetId: 2,
    datasetName: '填报记录明细',
    chartType: 4,
    dimensionField: 'fillStatus',
    measureFields: ['rowCount'],
    filterText: '期次 = 202608',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 11:10:00',
    remark: '饼图看分布',
    createTime: '2026-08-23 09:10:00'
  },
  {
    id: 4,
    reportCode: 'RPT_IMPORT_CHANNEL',
    reportName: '采集批次行数趋势',
    datasetId: 3,
    datasetName: '采集批次明细',
    chartType: 3,
    dimensionField: 'orgName',
    measureFields: ['totalRows', 'writtenRows'],
    filterText: '',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 11:15:00',
    remark: '两条度量对比：总行数 / 入库行数',
    createTime: '2026-08-23 09:15:00'
  },
  {
    id: 5,
    reportCode: 'RPT_CHECK_RULE',
    reportName: '检核问题按规则类型分布',
    datasetId: 4,
    datasetName: '检核问题明细',
    chartType: 4,
    dimensionField: 'ruleType',
    measureFields: [],
    filterText: '',
    status: 0,
    updateUser: '系统管理员',
    updateTime: '2026-09-08 11:20:00',
    remark: '已停用示例：规则类型维度需要先补字典翻译',
    createTime: '2026-08-23 09:20:00'
  }
]

export const reportDatasourceTable = defineTable<ReportDatasourceRow>('cr.reportDatasource', dsSeed)
export const reportDatasetTable = defineTable<ReportDatasetRow>('cr.reportDataset', datasetSeed)
export const reportDesignTable = defineTable<ReportDesignRow>('cr.reportDesign', designSeed)

export const DS_TYPE_LABEL: Record<number, string> = { 1: '数据库', 2: '文件目录', 3: '接口' }
export const DB_TYPE_LABEL: Record<number, string> = {
  1: 'MySQL',
  2: 'Oracle',
  3: '达梦',
  0: '不适用'
}
export const SOURCE_TYPE_LABEL: Record<number, string> = { 1: '数据表', 2: 'SQL' }

/** 预览取数来源的中文名：数据集表单的下拉直接用它，页面不再显示 task / fillRecord 这种英文键 */
export const PREVIEW_SOURCE_LABEL: Record<string, string> = {
  task: '报送任务（cr.crTask）',
  fillRecord: '填报记录（cr.fillRecord）',
  importTask: '采集批次（cr.importTask）',
  checkResult: '检核问题（cr.checkResult）',
  submitStatus: '报文报送（cr.submitStatus）'
}
export const CHART_TYPE_LABEL: Record<number, string> = {
  1: '表格',
  2: '柱状图',
  3: '折线图',
  4: '饼图'
}

/** 维度字段取值 → 中文名（预览时翻译，避免图表上出现 0/1/2） */
export const DIMENSION_VALUE_LABEL: Record<string, Record<string, string>> = {
  fillStatus: { '0': '未填报', '1': '已填报', '2': '已提交' },
  status: {
    '10': '待下发',
    '20': '已下发',
    '30': '填报中',
    '40': '待复核',
    '70': '本级审核中',
    '80': '上级审核中',
    '90': '审核通过',
    '100': '已打回'
  },
  errorLevel: { '1': '警告', '2': '错误' },
  ruleType: {
    '1': '非空校验',
    '2': '长度校验',
    '3': '范围校验',
    '4': '逻辑校验',
    '5': '表间校验',
    '6': '枚举校验'
  }
}
