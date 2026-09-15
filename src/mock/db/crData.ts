/**
 * Mock 种子数据 — 报表数据处理域
 *
 * 五张表：
 * - cr.fillRecord  填报记录（机构 × 报表 × 期次）
 * - cr.fillData    填报数据明细（核心，可编辑表格的数据源）
 * - cr.fillHistory 填报修改历史
 * - cr.batchTask   批处理任务（校验 / 计算 / 汇总 / 报文生成 / 批量提交）
 * - cr.message     报文文件记录
 *
 * 明细数据用「确定性伪随机」生成，保证每次刷新浏览器看到的种子数据完全一致，
 * 便于演示时讲解（保单号、金额、日期都可复现）。
 */
import { defineTable } from '../store'
import { FILL_USERS, PERIOD, reportOptions, reportOrgs } from './crCommon'
import {
  crSubmitStatusTable,
  fileExtOfOrg,
  planReportFile,
  reportFileName,
  type ReportFilePlan
} from './crSubmit'
import type { ReportFileFormat } from './crSubmitFile'
import { defaultSeparatorOf, formatOfFile } from './crSubmitFile'

/* ==================================================================
 * 通用：确定性伪随机 + 业务码值字典
 * ================================================================== */
const makeRandom = (seed: number) => {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')
const pick = <T>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)]

const SURNAMES = [
  '王',
  '李',
  '张',
  '刘',
  '陈',
  '杨',
  '赵',
  '黄',
  '周',
  '吴',
  '徐',
  '孙',
  '马',
  '朱',
  '胡',
  '郭',
  '何',
  '林',
  '高',
  '罗'
]
const GIVEN_NAMES = [
  '伟',
  '芳',
  '娜',
  '秀英',
  '敏',
  '静',
  '丽',
  '强',
  '磊',
  '洋',
  '艳',
  '勇',
  '军',
  '杰',
  '娟',
  '涛',
  '明',
  '超',
  '秀兰',
  '霞'
]
const PRODUCTS = [
  '华信鑫享终身寿险',
  '华信安康重大疾病保险',
  '华信稳盈年金保险',
  '华信百万医疗保险',
  '华信福瑞两全保险',
  '华信康健防癌疾病保险',
  '华信出行意外伤害保险'
]
const CHANNELS = ['个险', '银保', '团险', '经代', '网销']
const DATA_STATUS = ['正常', '正常', '正常', '正常', '正常', '待复核', '已作废']

/** 填报人（按机构固定，便于"最后修改人"看起来像真人操作） */
const USER_BY_ORG: Record<string, string> = {
  北京分公司: '李思远',
  上海分公司: '王雅琴',
  江苏分公司: '张明浩',
  广东分公司: '刘婉婷'
}

/* ==================================================================
 * 可编辑表格的列定义
 *
 * 由 mock 下发给页面，页面据此渲染「表头 + 单元格编辑器 + 汇总列」，
 * 与「列管理」里的监管数据项保持同一口径。
 * ================================================================== */
export interface FillColumn {
  field: string
  label: string
  width?: number
  minWidth?: number
  align: 'left' | 'center' | 'right'
  /** 单元格编辑器类型 */
  editor: 'input' | 'number' | 'date' | 'none'
  /** 参与合计的数值列 */
  numeric?: boolean
  /** 必填（校验用） */
  required?: boolean
}

export const FILL_COLUMNS: FillColumn[] = [
  {
    field: 'policyNo',
    label: '保单号',
    width: 150,
    align: 'center',
    editor: 'input',
    required: true
  },
  {
    field: 'holderName',
    label: '投保人名称',
    width: 120,
    align: 'left',
    editor: 'input',
    required: true
  },
  { field: 'certNo', label: '证件号码', width: 180, align: 'center', editor: 'input' },
  { field: 'productName', label: '险种名称', minWidth: 190, align: 'left', editor: 'input' },
  {
    field: 'sumAssured',
    label: '保险金额',
    width: 140,
    align: 'right',
    editor: 'number',
    numeric: true
  },
  {
    field: 'premiumAmount',
    label: '保费金额',
    width: 140,
    align: 'right',
    editor: 'number',
    numeric: true
  },
  { field: 'rate', label: '费率', width: 100, align: 'right', editor: 'number' },
  {
    field: 'effectDate',
    label: '生效日期',
    width: 155,
    align: 'center',
    editor: 'date',
    required: true
  },
  { field: 'channel', label: '销售渠道', width: 110, align: 'center', editor: 'input' },
  { field: 'dataStatus', label: '数据状态', width: 110, align: 'center', editor: 'input' },
  { field: 'remark', label: '备注', minWidth: 140, align: 'left', editor: 'input' }
]

/* ==================================================================
 * 填报数据明细
 * ================================================================== */
export interface FillDataRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 报表内行号（保存时按顺序重排） */
  rowNo: number
  policyNo: string
  holderName: string
  certNo: string
  productName: string
  /** 保险金额（计算规则：保费金额 × 费率） */
  sumAssured: number
  premiumAmount: number
  rate: number
  effectDate: string
  channel: string
  dataStatus: string
  remark: string
  updateTime: string
}

/** 需要生成明细数据的「机构 × 报表 × 期次」组合 */
const DATA_COMBOS: Array<{ orgName: string; reportId: number; period: string; count: number }> = [
  // 本期（202608）
  { orgName: '北京分公司', reportId: 11, period: '202608', count: 52 },
  { orgName: '上海分公司', reportId: 11, period: '202608', count: 46 },
  { orgName: '江苏分公司', reportId: 11, period: '202608', count: 38 },
  { orgName: '广东分公司', reportId: 11, period: '202608', count: 34 },
  { orgName: '北京分公司', reportId: 1, period: '202608', count: 42 },
  { orgName: '上海分公司', reportId: 12, period: '202608', count: 36 },
  { orgName: '江苏分公司', reportId: 2, period: '202608', count: 31 },
  { orgName: '广东分公司', reportId: 12, period: '202608', count: 33 },
  // 上期（202607）：供「批量复制上期数据」使用
  { orgName: '北京分公司', reportId: 11, period: '202607', count: 28 },
  { orgName: '上海分公司', reportId: 11, period: '202607', count: 26 },
  { orgName: '江苏分公司', reportId: 11, period: '202607', count: 24 }
]

const buildFillData = (): FillDataRow[] => {
  const rows: FillDataRow[] = []
  const orgs = reportOrgs()
  const reports = reportOptions()
  let id = 0

  DATA_COMBOS.forEach((combo, comboIndex) => {
    const org = orgs.find((item) => item.orgName === combo.orgName)
    const report = reports.find((item) => item.id === combo.reportId)
    if (!org || !report) return
    const random = makeRandom(comboIndex * 977 + combo.reportId * 31 + 7)
    const seqPrefix = combo.period === PERIOD ? 'P202608' : 'P202607'
    const lastMonth = combo.period === PERIOD ? 7 : 6

    for (let index = 0; index < combo.count; index++) {
      const seq = index + 1
      const premium = Number((860 + random() * 52000).toFixed(2))
      const rate = Number((6 + random() * 24).toFixed(2))
      let sumAssured = Number((premium * rate).toFixed(2))
      let holderName = `${pick(SURNAMES, random)}${pick(GIVEN_NAMES, random)}`
      const effectMonth = 1 + Math.floor(random() * lastMonth)
      const effectDay = 1 + Math.floor(random() * 28)
      let effectDate = `2026-${pad(effectMonth)}-${pad(effectDay)}`
      const productName = pick(PRODUCTS, random)
      const channel = pick(CHANNELS, random)
      const dataStatus = pick(DATA_STATUS, random)

      // ---- 演示用异常数据：让「数据校验」能查出真实问题 ----
      if (seq % 17 === 0) {
        // 逻辑校验：保险金额 ≠ 保费金额 × 费率
        sumAssured = Number((premium * rate * 0.62).toFixed(2))
      }
      if (seq % 31 === 0) {
        holderName = ''
      }
      if (seq % 43 === 0) {
        sumAssured = 0
      }
      if (seq % 19 === 0) {
        // 值域校验（警告）：生效日期晚于报送期末
        effectDate =
          combo.period === PERIOD ? `2026-09-${pad(effectDay)}` : `2026-08-${pad(effectDay)}`
      }

      id += 1
      rows.push({
        id,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: combo.period,
        rowNo: seq,
        policyNo: `${seqPrefix}${String(seq).padStart(4, '0')}`,
        holderName,
        // 填报数据存的是原文（18 位），脱敏是「脱敏执行」页的职责：
        // 执行一次就会变成 110***********1234 这种掩码，还原可以倒回来
        certNo: `11010119${pad(70 + ((comboIndex * 7 + seq) % 30))}${pad(1 + ((seq * 3) % 12))}${pad(1 + ((seq * 7) % 28))}${String(1000 + ((comboIndex * 37 + seq * 13) % 8999))}`,
        productName,
        sumAssured,
        premiumAmount: seq % 43 === 0 ? 0 : premium,
        rate,
        effectDate,
        channel,
        dataStatus,
        remark: seq % 11 === 0 ? '跨期保单，已核对原始凭证' : '',
        updateTime: `2026-09-${pad(9 + (index % 12))} ${pad(9 + (index % 9))}:${pad((index * 7) % 60)}:00`
      })
    }
  })

  return rows
}

export const crFillDataTable = defineTable<FillDataRow>('cr.fillData', buildFillData)

/* ==================================================================
 * 填报记录（机构 × 报表 × 期次）
 * ================================================================== */
export interface FillRecordRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 数据行数 */
  rowCount: number
  /** 填报状态：见字典 cr_fill_status（0 未填报 / 1 已填报 / 2 已提交） */
  fillStatus: number
  /** 校验状态：见字典 cr_check_status（0 未校验 / 1 校验中 / 2 校验通过 / 3 校验不通过） */
  checkStatus: number
  /** 填报人 */
  fillUser: string
  /** 最后修改人 */
  lastModifier: string
  lastModifyTime: string
  /** 报送截止日期 */
  deadline: string
  submitTime: string
  remark: string
}

const DEADLINE_BY_PERIOD: Record<string, string> = {
  '202607': '2026-08-15',
  '202608': '2026-09-15'
}

const buildFillRecords = (): FillRecordRow[] => {
  const dataRows = crFillDataTable.all()
  const records: FillRecordRow[] = []
  const groups = new Map<string, FillDataRow[]>()
  dataRows.forEach((row) => {
    const key = `${row.orgId}|${row.reportId}|${row.period}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  })

  let id = 0
  groups.forEach((rows) => {
    const first = rows[0]
    const isCurrent = first.period === PERIOD
    id += 1
    // 本期数据：多数"已填报"，部分已提交；上期数据统一"已提交"
    const submitted = !isCurrent || (first.orgName === '广东分公司' && first.reportId === 12)
    const modified = rows.reduce((max, row) => (row.updateTime > max ? row.updateTime : max), '')
    records.push({
      id,
      orgId: first.orgId,
      orgName: first.orgName,
      reportId: first.reportId,
      reportCode: first.reportCode,
      reportName: first.reportName,
      period: first.period,
      rowCount: rows.length,
      fillStatus: submitted ? 2 : 1,
      checkStatus: submitted ? 2 : first.orgName === '北京分公司' && first.reportId === 11 ? 3 : 2,
      fillUser: USER_BY_ORG[first.orgName] || '李思远',
      lastModifier: USER_BY_ORG[first.orgName] || '李思远',
      lastModifyTime: modified || '2026-09-10 09:30:00',
      deadline: DEADLINE_BY_PERIOD[first.period] || '2026-09-15',
      submitTime: submitted ? '2026-09-12 15:20:00' : '',
      remark: ''
    })
  })

  // 补充"未填报"记录：覆盖其余报表，凑齐列表页的各类状态
  const pendingReports = [13, 14, 5, 7, 17, 18, 6, 8, 9, 15]
  const orgs = reportOrgs().filter((org) => org.orgLevel === 2)
  const reports = reportOptions()
  pendingReports.forEach((reportId, reportIndex) => {
    orgs.forEach((org, orgIndex) => {
      const report = reports.find((item) => item.id === reportId)
      if (!report) return
      const exists = records.some(
        (item) => item.orgId === org.id && item.reportId === reportId && item.period === PERIOD
      )
      if (exists) return
      id += 1
      records.push({
        id,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: PERIOD,
        rowCount: 0,
        fillStatus: 0,
        checkStatus: 0,
        fillUser: USER_BY_ORG[org.orgName] || '李思远',
        lastModifier: '',
        lastModifyTime: '',
        deadline: DEADLINE_BY_PERIOD[PERIOD],
        submitTime: '',
        remark: (reportIndex + orgIndex) % 5 === 0 ? '尚未开始填报' : ''
      })
    })
  })

  return records
}

export const crFillRecordTable = defineTable<FillRecordRow>('cr.fillRecord', buildFillRecords)

/* ==================================================================
 * 填报修改历史
 * ================================================================== */
export interface FillHistoryRow {
  id: number
  recordId: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 操作类型：保存 / 修改单元格 / 新增行 / 删除行 / 插入行 / 复制行 / 数据校验 / 数据恢复 / 计算 / 批量操作 / 提交 */
  action: string
  detail: string
  beforeValue: string
  afterValue: string
  operator: string
  operateTime: string
}

const buildHistorySpecs = (): Array<[string, string, string, string]> => [
  ['修改单元格', '投保人名称由「王秀英」更正为「王秀瑛」', '王秀英', '王秀瑛'],
  ['新增行', '在报表末尾新增 1 行保单数据', '0 行', '1 行'],
  ['计算', '执行计算规则「保险金额 = 保费金额 × 费率」，更新 12 行', '—', '12 行'],
  ['数据校验', '校验完成：通过 45 行，警告 2 行，错误 3 行', '通过 45 行', '错误 3 行'],
  ['修改单元格', '保费金额由 12,000.00 调整为 12,800.00', '12000.00', '12800.00'],
  ['删除行', '删除作废保单 P2026080007', '1 行', '0 行'],
  ['保存', '保存填报数据并更新数据行数', '48 行', '51 行'],
  ['数据恢复', '回滚到上次保存版本', '51 行', '48 行'],
  ['复制行', '复制保单 P2026080012 生成新行', '0 行', '1 行'],
  ['插入行', '在第 8 行后插入 1 行', '—', '第 9 行'],
  ['批量操作', '批量复制上期数据：成功 1 条', '0 行', '28 行'],
  ['提交', '提交本期填报数据，状态变更为已提交', '已填报', '已提交']
]

const buildFillHistory = (): FillHistoryRow[] => {
  const records = crFillRecordTable.all().filter((record) => record.rowCount > 0)
  const specs = buildHistorySpecs()
  const rows: FillHistoryRow[] = []
  let id = 0
  records.forEach((record, recordIndex) => {
    specs.forEach((spec, specIndex) => {
      // 每条记录取 2 条历史，形成交错的操作轨迹
      if ((recordIndex + specIndex) % 3 !== 0) return
      id += 1
      rows.push({
        id,
        recordId: record.id,
        orgId: record.orgId,
        orgName: record.orgName,
        reportId: record.reportId,
        reportCode: record.reportCode,
        reportName: record.reportName,
        period: record.period,
        action: spec[0],
        detail: spec[1],
        beforeValue: spec[2],
        afterValue: spec[3],
        operator: record.lastModifier || '李思远',
        operateTime: `2026-09-${pad(8 + (id % 8))} ${pad(9 + (id % 9))}:${pad((id * 13) % 60)}:00`
      })
    })
  })
  return rows
}

export const crFillHistoryTable = defineTable<FillHistoryRow>('cr.fillHistory', buildFillHistory)

/** 向修改历史追加一条记录（handler 里调用） */
export const appendFillHistory = (
  record: FillRecordRow,
  action: string,
  detail: string,
  operator = '李思远',
  beforeValue = '',
  afterValue = ''
): FillHistoryRow => {
  const nextId = crFillHistoryTable.all().reduce((max, row) => Math.max(max, row.id), 0) + 1
  const now = new Date()
  const time =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return crFillHistoryTable.insert({
    id: nextId,
    recordId: record?.id || 0,
    orgId: record?.orgId || 0,
    orgName: record?.orgName || '',
    reportId: record?.reportId || 0,
    reportCode: record?.reportCode || '',
    reportName: record?.reportName || '',
    period: record?.period || PERIOD,
    action,
    detail,
    beforeValue,
    afterValue,
    operator,
    operateTime: time
  })
}

/* ==================================================================
 * 批处理任务
 * ================================================================== */
export const BATCH_TASK_TYPE = {
  CHECK: 1,
  CALCULATE: 2,
  SUMMARY: 3,
  MESSAGE: 4,
  SUBMIT: 5
} as const

export const BATCH_TASK_TYPE_LABEL: Record<number, string> = {
  1: '数据校验',
  2: '数据计算',
  3: '数据汇总',
  4: '报文生成',
  5: '批量提交'
}

export const BATCH_TASK_STATUS = { RUNNING: 1, SUCCESS: 2, FAIL: 3 } as const

export const BATCH_TASK_STATUS_LABEL: Record<number, string> = {
  1: '运行中',
  2: '成功',
  3: '失败'
}

export interface BatchLog {
  time: string
  text: string
  level: string
}

export interface BatchTaskRow {
  id: number
  /** 任务号，如 PC2026080013 */
  taskNo: string
  /** 任务类型：1 校验 / 2 计算 / 3 汇总 / 4 报文生成 / 5 批量提交 */
  taskType: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 状态：1 运行中 / 2 成功 / 3 失败 */
  status: number
  /** 进度百分比 0~100 */
  percent: number
  startTime: string
  endTime: string
  /** 已耗时（秒） */
  costTime: number
  /** 涉及数据行数 */
  rowCount: number
  /** 结果说明 */
  resultMessage: string
  /** 失败原因 */
  errorMessage: string
  logs: BatchLog[]
}

interface TaskSpec {
  taskType: number
  orgName: string
  reportId: number
  period: string
  status: number
  percent: number
  rowCount: number
  startTime: string
  costTime: number
  resultMessage: string
  errorMessage?: string
}

const TASK_SPECS: TaskSpec[] = [
  {
    taskType: 1,
    orgName: '北京分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 52,
    startTime: '2026-09-12 09:10:12',
    costTime: 34,
    resultMessage: '校验完成：通过 47 行，警告 2 行，错误 3 行'
  },
  {
    taskType: 2,
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 46,
    startTime: '2026-09-12 09:12:40',
    costTime: 21,
    resultMessage: '计算完成：更新 46 行，规则「保险金额 = 保费金额 × 费率」'
  },
  {
    taskType: 3,
    orgName: '江苏分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 38,
    startTime: '2026-09-12 09:15:03',
    costTime: 12,
    resultMessage: '汇总完成：保费金额合计 862,431.55 元'
  },
  {
    taskType: 4,
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    status: 3,
    percent: 100,
    rowCount: 33,
    startTime: '2026-09-12 09:18:22',
    costTime: 47,
    resultMessage: '',
    errorMessage: '报文生成失败：目标目录不可写，请联系运维检查 SFTP 配置'
  },
  {
    taskType: 5,
    orgName: '北京分公司',
    reportId: 11,
    period: '202607',
    status: 2,
    percent: 100,
    rowCount: 28,
    startTime: '2026-09-12 09:20:11',
    costTime: 8,
    resultMessage: '批量提交成功：1 条填报记录已提交'
  },
  {
    taskType: 1,
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 33,
    startTime: '2026-09-12 09:24:36',
    costTime: 29,
    resultMessage: '校验完成：通过 33 行，未发现异常'
  },
  {
    taskType: 3,
    orgName: '北京分公司',
    reportId: 1,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 42,
    startTime: '2026-09-12 09:31:08',
    costTime: 15,
    resultMessage: '汇总完成：保险金额合计 21,904,332.00 元'
  },
  {
    taskType: 2,
    orgName: '江苏分公司',
    reportId: 2,
    period: '202608',
    status: 3,
    percent: 100,
    rowCount: 31,
    startTime: '2026-09-12 09:35:52',
    costTime: 63,
    resultMessage: '',
    errorMessage: '计算失败：费率存在空值，无法执行「保险金额 = 保费金额 × 费率」'
  },
  {
    taskType: 4,
    orgName: '上海分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 36,
    startTime: '2026-09-12 09:41:19',
    costTime: 26,
    // 历史日志：文件名与统一报文口径一致（上海分公司 BX012 202608 → HX_310000_BX012_202608.xml）
    resultMessage:
      '报文生成成功：HX_310000_BX012_202608.xml（可在「报文生成下载」中查看行数与大小）'
  },
  {
    taskType: 1,
    orgName: '江苏分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 38,
    startTime: '2026-09-12 09:48:02',
    costTime: 31,
    resultMessage: '校验完成：通过 37 行，警告 1 行'
  },
  {
    taskType: 5,
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 33,
    startTime: '2026-09-12 09:52:47',
    costTime: 9,
    resultMessage: '批量提交成功：1 条填报记录已提交'
  },
  {
    taskType: 3,
    orgName: '上海分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    percent: 100,
    rowCount: 36,
    startTime: '2026-09-12 10:01:15',
    costTime: 14,
    resultMessage: '汇总完成：保费金额合计 742,118.90 元'
  },
  {
    taskType: 1,
    orgName: '北京分公司',
    reportId: 1,
    period: '202608',
    status: 1,
    percent: 68,
    rowCount: 42,
    startTime: '2026-09-12 10:12:03',
    costTime: 22,
    resultMessage: '正在校验第 29/42 行……'
  },
  {
    taskType: 3,
    orgName: '广东分公司',
    reportId: 11,
    period: '202608',
    status: 1,
    percent: 42,
    rowCount: 34,
    startTime: '2026-09-12 10:13:41',
    costTime: 17,
    resultMessage: '正在汇总保费金额列……'
  },
  {
    taskType: 4,
    orgName: '江苏分公司',
    reportId: 2,
    period: '202608',
    status: 1,
    percent: 25,
    rowCount: 31,
    startTime: '2026-09-12 10:14:56',
    costTime: 11,
    resultMessage: '正在生成报文文件……'
  },
  {
    taskType: 2,
    orgName: '广东分公司',
    reportId: 11,
    period: '202608',
    status: 1,
    percent: 15,
    rowCount: 34,
    startTime: '2026-09-12 10:15:38',
    costTime: 6,
    resultMessage: '正在执行计算规则……'
  },
  {
    taskType: 5,
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    status: 1,
    percent: 55,
    rowCount: 46,
    startTime: '2026-09-12 10:16:02',
    costTime: 9,
    resultMessage: '正在提交填报记录……'
  },
  {
    taskType: 1,
    orgName: '广东分公司',
    reportId: 11,
    period: '202607',
    status: 3,
    percent: 100,
    rowCount: 24,
    startTime: '2026-09-11 16:22:31',
    costTime: 41,
    resultMessage: '',
    errorMessage: '校验任务失败：校验规则 JC2026007 表达式解析异常'
  }
]

const buildTaskLogs = (spec: TaskSpec, taskNo: string): BatchLog[] => {
  const typeLabel = BATCH_TASK_TYPE_LABEL[spec.taskType]
  const at = (offset: number) => {
    const base = spec.startTime
      .slice(11)
      .split(':')
      .map((v) => Number(v))
    const total = base[0] * 3600 + base[1] * 60 + base[2] + offset
    return `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
  }
  const logs: BatchLog[] = [
    { time: at(0), text: `任务 ${taskNo} 已创建，任务类型：${typeLabel}`, level: 'info' },
    {
      time: at(1),
      text: `加载填报数据：${spec.orgName} / ${spec.period}，共 ${spec.rowCount} 行`,
      level: 'info'
    },
    { time: at(3), text: `读取批处理参数：批量大小 500，失败重试 0 次`, level: 'info' }
  ]
  const half = Math.max(1, Math.floor(spec.rowCount / 2))
  if (spec.percent >= 50) {
    logs.push({ time: at(6), text: `已完成第 ${half}/${spec.rowCount} 行处理`, level: 'info' })
  }
  if (spec.status === 3) {
    logs.push({
      time: at(spec.costTime - 2),
      text: spec.errorMessage || '任务执行失败',
      level: 'error'
    })
    logs.push({
      time: at(spec.costTime),
      text: `任务 ${taskNo} 执行失败，已回滚本次批处理`,
      level: 'error'
    })
  } else if (spec.status === 1) {
    logs.push({ time: at(8), text: spec.resultMessage, level: 'info' })
    logs.push({ time: at(9), text: `任务进行中，当前进度 ${spec.percent}%`, level: 'warning' })
  } else {
    logs.push({ time: at(spec.costTime), text: spec.resultMessage, level: 'success' })
    logs.push({
      time: at(spec.costTime),
      text: `任务 ${taskNo} 执行完成，耗时 ${spec.costTime} 秒`,
      level: 'success'
    })
  }
  return logs
}

/** 在 startTime 基础上加 seconds 秒 */
const plusSeconds = (startTime: string, seconds: number): string => {
  const [date, time] = startTime.split(' ')
  const [h, m, s] = time.split(':').map((v) => Number(v))
  const total = h * 3600 + m * 60 + s + seconds
  const dayOffset = Math.floor(total / 86400)
  const hour = Math.floor(total / 3600) % 24
  const dateObj = new Date(`${date}T00:00:00`)
  dateObj.setDate(dateObj.getDate() + dayOffset)
  const nextDate = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`
  return `${nextDate} ${pad(hour)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
}

const buildBatchTasks = (): BatchTaskRow[] => {
  const orgs = reportOrgs()
  const reports = reportOptions()
  return TASK_SPECS.map((spec, index) => {
    const org = orgs.find((item) => item.orgName === spec.orgName)
    const report = reports.find((item) => item.id === spec.reportId)
    const taskNo = `PC${spec.period}${String(index + 1).padStart(4, '0')}`
    return {
      id: index + 1,
      taskNo,
      taskType: spec.taskType,
      orgId: org?.id || 0,
      orgName: spec.orgName,
      reportId: spec.reportId,
      reportCode: report?.reportCode || '',
      reportName: report?.reportName || '',
      period: spec.period,
      status: spec.status,
      percent: spec.percent,
      startTime: spec.startTime,
      endTime: spec.status === 1 ? '' : plusSeconds(spec.startTime, spec.costTime),
      costTime: spec.costTime,
      rowCount: spec.rowCount,
      resultMessage: spec.resultMessage,
      errorMessage: spec.errorMessage || '',
      logs: buildTaskLogs(spec, taskNo)
    }
  })
}

export const crBatchTaskTable = defineTable<BatchTaskRow>('cr.batchTask', buildBatchTasks)

/** 追加一个批处理任务（各业务动作调用，便于在批处理监控里看到） */
export const appendBatchTask = (payload: {
  taskType: number
  orgId?: number
  orgName?: string
  reportId?: number
  reportCode?: string
  reportName?: string
  period: string
  rowCount?: number
  status?: number
  percent?: number
  resultMessage?: string
  errorMessage?: string
}): BatchTaskRow => {
  const rows = crBatchTaskTable.all()
  const nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
  const now = new Date()
  const startTime =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const taskNo = `PC${payload.period}${String(nextId).padStart(4, '0')}`
  const status = payload.status ?? BATCH_TASK_STATUS.RUNNING
  return crBatchTaskTable.insert({
    id: nextId,
    taskNo,
    taskType: payload.taskType,
    orgId: payload.orgId || 0,
    orgName: payload.orgName || '',
    reportId: payload.reportId || 0,
    reportCode: payload.reportCode || '',
    reportName: payload.reportName || '',
    period: payload.period,
    status,
    percent: payload.percent ?? 0,
    startTime,
    endTime: '',
    costTime: 0,
    rowCount: payload.rowCount || 0,
    resultMessage: payload.resultMessage || '',
    errorMessage: payload.errorMessage || '',
    logs: [
      {
        time: startTime.slice(11),
        text: `任务 ${taskNo} 已创建，任务类型：${BATCH_TASK_TYPE_LABEL[payload.taskType]}`,
        level: 'info'
      },
      {
        time: startTime.slice(11),
        text: `加载填报数据：${payload.orgName || '全部机构'} / ${payload.period}，共 ${payload.rowCount || 0} 行`,
        level: 'info'
      }
    ]
  })
}

/* ==================================================================
 * 报文文件记录
 * ================================================================== */
export const MESSAGE_FILE_TYPES = ['TXT', 'XML', 'CSV'] as const

export const MESSAGE_STATUS = { GENERATING: 1, SUCCESS: 2, FAIL: 3 } as const

export const MESSAGE_STATUS_LABEL: Record<number, string> = {
  1: '生成中',
  2: '生成成功',
  3: '生成失败'
}

export interface MessageRow {
  id: number
  /** 报文文件名：HX_{orgCode}_{reportCode}_{period}.{ext}，后缀即内容格式 */
  messageName: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 文件类型：TXT / XML / CSV，由文件名后缀推导（与下载内容格式一致） */
  fileType: ReportFileFormat
  /** 文件大小（字节）= 实际下载到的 Blob 大小；0 表示还没有可下载的文件 */
  fileSize: number
  /** 数据行数 = 报文文件里的业务数据行数（不含表头 / XML 声明与根节点） */
  rowCount: number
  /** 1 生成中 / 2 生成成功 / 3 生成失败 */
  status: number
  genTime: string
  genUser: string
  /** 上报方式（SFTP / FTP / MANUAL）：XML 报文根节点会带上它 */
  reportType?: string
  /** 报送方向 */
  direction: string
  remark: string
}

/* ------------------------------------------------------------------
 * 报文文件口径（列表的 messageName / fileType / rowCount / fileSize = 实际下载到的文件）
 *
 * 全部复用 src/mock/db/crSubmit 的 planReportFile（它又基于 crSubmitFile 的生成器）：
 * 同机构同报表同期次就是同一份报文 —— 与「一键报送 → 报文状态查询」的文件名、
 * 数据行数、文件大小、下载内容完全一致；这里不再写死文件大小，也没有第二套估算公式。
 * ------------------------------------------------------------------ */

/** 用户选择的文件类型 → 扩展名 */
const MESSAGE_EXT: Record<string, string> = { TXT: 'txt', CSV: 'csv', XML: 'xml' }

/**
 * 一键报送同源记录（同机构同报表同期次，且已生成出报文文件）。
 * 存在即代表两处展示的是同一份报文，文件名与大小必须一致。
 */
export const submitMirrorOf = (orgId: number, reportId: number, period: string) =>
  crSubmitStatusTable.findOne(
    (row) =>
      row.orgId === Number(orgId) &&
      row.reportId === Number(reportId) &&
      row.period === period &&
      Number(row.dataRows) > 0
  )

/** 该组合的填报明细行数（与 queryFillData 同口径；直接用表查询，便于种子初始化期求值） */
const fillDataCountOf = (orgId: number, reportId: number, period: string): number =>
  crFillDataTable.find(
    (row) =>
      row.orgId === Number(orgId) && row.reportId === Number(reportId) && row.period === period
  ).length

/**
 * 报文文件计划 —— 列表、生成、重新生成、下载四处共用，是「列表显示 = 实际下载」的唯一口径。
 *
 * - 文件名：已存在的行以行上的文件名为准（列表上显示的就是它）；生成新报文时按命名规则
 *   HX_{orgCode}_{reportCode}_{period}.{ext} 生成，扩展名 = 用户选择的类型 / 机构报送文件配置；
 * - 数据行数：优先取一键报送同源记录（同一份报文行数一致），否则取该组合的填报明细行数；
 * - 字节数：由 crSubmitFile 的生成器按真实内容推导，与下载接口返回的 Blob 严格相等。
 */
export const planMessageFile = (params: {
  orgId: number
  reportId: number
  period: string
  /** 已存在的文件名（重新生成 / 下载时以列表上的名字为准） */
  fileName?: string
  /** 生成报文时选择的文件类型：TXT / CSV / XML */
  fileType?: string
  /** 报文生成时间：显式传入时以它为准（重新生成 / 下载都用列表上的值，保证内容一致） */
  genTime?: string
  /** 无同源记录时的生成时间（种子数据用列表上的时间） */
  defaultGenTime?: string
  /** 上报方式（缺省与一键报送同源记录一致） */
  reportType?: string
  /** 数据行数（列表上已有的行数；缺省按上面的行数口径推导） */
  dataRows?: number
  /** 是否复用一键报送同源记录（缺省复用；false 表示只按本域填报数据） */
  mirrorSubmit?: boolean
}): ReportFilePlan => {
  const orgId = Number(params.orgId)
  const org = reportOrgs().find((item) => item.id === orgId)
  const report = reportOptions().find((item) => item.id === Number(params.reportId))
  const period = String(params.period || '')
  const mirror =
    params.mirrorSubmit === false
      ? undefined
      : submitMirrorOf(orgId, Number(params.reportId), period)
  const orgCode = org?.orgCode || '000000'
  const reportCode = report?.reportCode || ''
  const fileName =
    params.fileName ||
    (params.fileType
      ? reportFileName(
          orgCode,
          reportCode,
          period,
          MESSAGE_EXT[String(params.fileType).toUpperCase()] || 'txt'
        )
      : mirror?.fileName || reportFileName(orgCode, reportCode, period, fileExtOfOrg(orgId)))
  const dataRows =
    params.dataRows !== undefined
      ? params.dataRows
      : mirror
        ? mirror.dataRows
        : fillDataCountOf(orgId, Number(params.reportId), period)
  // 分隔符按内容格式取规范值（.txt 竖线分隔 / .csv 逗号分隔），
  // 避免"给 CSV 配置的机构选了 TXT，却下发出逗号分隔的仿 CSV 文本"
  const format = formatOfFile(fileName, (params.fileType as ReportFileFormat) || 'TXT')
  return planReportFile({
    orgId,
    orgCode,
    orgName: org?.orgName,
    reportCode,
    reportName: report?.reportName,
    period,
    dataRows: Math.max(0, Number(dataRows) || 0),
    generateTime: params.genTime || mirror?.generateTime || params.defaultGenTime,
    reportType: params.reportType || mirror?.reportType || 'SFTP',
    fileName,
    separator: defaultSeparatorOf(format)
  })
}

interface MessageSpec {
  orgName: string
  reportId: number
  period: string
  status: number
  genTime: string
  direction: string
  remark?: string
}

const MESSAGE_SPECS: MessageSpec[] = [
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:20:31',
    direction: '上报'
  },
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:22:08',
    direction: '上报'
  },
  {
    orgName: '江苏分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:25:44',
    direction: '上报'
  },
  {
    orgName: '广东分公司',
    reportId: 11,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:28:19',
    direction: '上报'
  },
  {
    orgName: '北京分公司',
    reportId: 1,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:31:52',
    direction: '上报'
  },
  {
    orgName: '上海分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:34:27',
    direction: '上报'
  },
  {
    orgName: '江苏分公司',
    reportId: 2,
    period: '202608',
    status: 3,
    genTime: '2026-09-12 10:36:03',
    direction: '上报',
    remark: '目标目录不可写，重新生成后恢复'
  },
  {
    orgName: '广东分公司',
    reportId: 12,
    period: '202608',
    status: 2,
    genTime: '2026-09-12 10:38:46',
    direction: '上报'
  },
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202607',
    status: 2,
    genTime: '2026-08-14 16:05:12',
    direction: '上报'
  },
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202607',
    status: 2,
    genTime: '2026-08-14 16:08:39',
    direction: '上报'
  },
  {
    orgName: '江苏分公司',
    reportId: 11,
    period: '202607',
    status: 2,
    genTime: '2026-08-14 16:11:24',
    direction: '上报'
  },
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202608',
    status: 1,
    genTime: '2026-09-12 10:42:05',
    direction: '上报',
    remark: '正在生成，请稍候刷新'
  },
  {
    orgName: '上海分公司',
    reportId: 1,
    period: '202608',
    status: 3,
    genTime: '2026-09-12 10:44:31',
    direction: '上报',
    remark: '报文生成失败：源数据未加工完成，报文内容为空，请重新生成'
  },
  {
    orgName: '华信人寿保险股份有限公司',
    reportId: 15,
    period: '2026Q3',
    status: 3,
    genTime: '2026-09-12 10:47:58',
    direction: '上报',
    remark: '季报数据源未就绪，报文内容为空，请重新生成'
  }
]

const buildMessages = (): MessageRow[] =>
  MESSAGE_SPECS.map((spec, index) => {
    const org = reportOrgs().find((item) => item.orgName === spec.orgName)
    const orgId = org?.id || 0
    // 文件名 / 格式 / 数据行数 / 字节数全部按真实报文内容推导（不再写死）
    const plan = planMessageFile({
      orgId,
      reportId: spec.reportId,
      period: spec.period,
      defaultGenTime: spec.genTime
    })
    // 生成中 / 生成失败：还没有产出文件，大小记 0（下载接口会拒绝并给出中文提示）
    const ready = spec.status === MESSAGE_STATUS.SUCCESS
    return {
      id: index + 1,
      messageName: plan.fileName,
      orgId,
      orgName: org?.orgName || spec.orgName,
      reportId: spec.reportId,
      reportCode: plan.meta.reportCode,
      reportName: plan.meta.reportName || '',
      period: spec.period,
      fileType: plan.format,
      fileSize: ready ? plan.bytes : 0,
      rowCount: ready || spec.status === MESSAGE_STATUS.GENERATING ? plan.meta.dataRows : 0,
      status: spec.status,
      // 生成成功：生成时间与文件内容（XML 根节点）严格同源；其余状态用本条记录的时间
      genTime: ready ? plan.meta.generateTime || spec.genTime : spec.genTime,
      genUser: index % 2 === 0 ? '李思远' : '王雅琴',
      reportType: plan.meta.reportType,
      direction: spec.direction,
      remark: spec.remark || ''
    }
  })

export const crMessageTable = defineTable<MessageRow>('cr.message', buildMessages)

/** 按机构 + 报表 + 期次取填报记录 */
export const findFillRecord = (orgId: number, reportId: number, period: string) =>
  crFillRecordTable.find(
    (row) =>
      row.orgId === Number(orgId) && row.reportId === Number(reportId) && row.period === period
  )[0]

/** 按机构 + 报表 + 期次取明细数据（按行号排序） */
export const queryFillData = (orgId: number, reportId: number, period: string) =>
  crFillDataTable
    .find(
      (row) =>
        row.orgId === Number(orgId) && row.reportId === Number(reportId) && row.period === period
    )
    .sort((a, b) => a.rowNo - b.rowNo || a.id - b.id)

/** 填报人（按机构） */
export const fillUserOf = (orgName: string): string => USER_BY_ORG[orgName] || FILL_USERS[0].name

/** 全部填报人姓名（下拉/展示用） */
export const FILL_USER_NAMES = FILL_USERS.map((user) => user.name)

export { PERIOD }
