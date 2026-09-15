/**
 * Mock 种子数据 — 一键报送域（/cr-submit 5 个页面）
 *
 * 覆盖「报文生成 → 报文上报 → 回执 → 报送清单 → 质量检核反馈」全链路：
 * - crSubmitFileConfigTable ：报送文件配置（命名规则 / 分隔符 / 压缩 / 编码）
 * - crSubmitStatusTable     ：报文上报状态（机构 × 报表 × 期次，6 种状态全覆盖）
 * - crSubmitBatchTable      ：数据报送清单（报送批次）
 * - crSubmitBatchItemTable  ：报送批次明细
 * - crSubmitQualityTable    ：监管侧质量检核结果
 *
 * 期次统一 202608（见 crCommon.PERIOD），机构取 BRANCH_NAMES 的 4 家分公司，
 * 报表从 reportOptions() 取，保证与任务 / 填报 / 校验各域口径一致。
 *
 * 文件大小口径：所有 fileSize 都由 crSubmitFile 的报文生成器按真实内容推导
 * （见 planReportFile），不再使用"每行估算多少字节"的第二套公式，
 * 保证列表上显示的大小与「下载报文」拿到的 Blob 字节数严格相等。
 */
import { defineTable } from '../store'
import { BRANCH_NAMES, PERIOD, reportOptions, reportOrgs } from './crCommon'
import {
  extOfRule,
  formatOfFile,
  submitFileBytes,
  type ReportFileMeta,
  type ReportFileOptions,
  type ReportFileFormat
} from './crSubmitFile'

/* ==================================================================
 * 本域常量（页面侧镜像见 src/views/cr/submit/constants.ts）
 * ================================================================== */

/** 报文上报状态 */
export const SUBMIT_STATUS = {
  /** 待生成 */
  WAIT_GENERATE: 0,
  /** 已生成 */
  GENERATED: 1,
  /** 上报中 */
  REPORTING: 2,
  /** 上报成功 */
  SUCCESS: 3,
  /** 上报失败 */
  FAILED: 4,
  /** 已回执 */
  RECEIPTED: 5
} as const

/** 报送批次状态 */
export const BATCH_STATUS = {
  /** 生成中 */
  GENERATING: 0,
  /** 已生成（待上报） */
  GENERATED: 1,
  /** 上报中 */
  REPORTING: 2,
  /** 上报成功 */
  SUCCESS: 3,
  /** 存在上报失败 */
  FAILED: 4
} as const

/** 质量检核结论：1 通过 / 0 不通过 */
export const QUALITY_RESULT = { PASS: 1, FAIL: 0 } as const

/** 报文文件命名：HX_{orgCode}_{reportCode}_{period}.txt */
export const reportFileName = (
  orgCode: string,
  reportCode: string,
  period: string,
  ext = 'txt'
): string => `HX_${orgCode}_${reportCode}_${period}.${ext}`

/* ==================================================================
 * 公共取数辅助
 * ================================================================== */
const branchOrgs = () => reportOrgs().filter((org) => BRANCH_NAMES.includes(org.orgName))

const allReports = () => reportOptions()

/** 与任务模板下发口径一致的报表（12 张） */
const SEED_REPORT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13]

/** 确定性伪随机：保证每次播种数值一致，便于演示讲数 */
const pick = (seed: number, min: number, max: number) => min + (seed % (max - min + 1))

/** 某机构某报表的报文数据行数（种子与生成预览共用，保证口径一致） */
export const estimateReportRows = (orgId: number, reportId: number): number =>
  pick(reportId * 977 + orgId * 131, 860, 4800)

/* ==================================================================
 * 一、报送文件配置（7 条）
 * ================================================================== */
export interface SubmitFileConfigRow {
  id: number
  /** 配置名称 */
  configName: string
  /** 适用机构 */
  orgId: number
  orgName: string
  /** 文件类型：TXT / XML / CSV */
  fileType: string
  /** 文件命名规则，支持 {orgCode} {reportCode} {tableCode} {period} {date} {seq} */
  fileNameRule: string
  /** 字段分隔符 */
  fieldSeparator: string
  /** 是否压缩 */
  compress: boolean
  /** 字符编码 */
  charset: string
  /** 表头行数 */
  headerRows: number
  status: number
  remark: string
  createTime: string
}

export const submitFileConfigSeed: SubmitFileConfigRow[] = [
  {
    id: 1,
    configName: '总公司月报报文配置（TXT）',
    orgId: 1,
    orgName: '华信人寿保险股份有限公司',
    fileType: 'TXT',
    fileNameRule: 'HX_{orgCode}_{reportCode}_{period}.txt',
    fieldSeparator: '|',
    compress: false,
    charset: 'UTF-8',
    headerRows: 1,
    status: 0,
    remark: '监管总局前置机要求：竖线分隔、首行表头、不压缩',
    createTime: '2026-08-20 09:10:00'
  },
  {
    id: 2,
    configName: '北京分公司月报报文配置（TXT）',
    orgId: 11,
    orgName: '北京分公司',
    fileType: 'TXT',
    fileNameRule: 'HX_{orgCode}_{reportCode}_{period}.txt',
    fieldSeparator: '|',
    compress: false,
    charset: 'UTF-8',
    headerRows: 1,
    status: 0,
    remark: '北京监管局要求单文件不超过 200MB',
    createTime: '2026-08-20 09:20:00'
  },
  {
    id: 3,
    configName: '上海分公司月报报文配置（XML）',
    orgId: 12,
    orgName: '上海分公司',
    fileType: 'XML',
    fileNameRule: 'HX_{orgCode}_{tableCode}_{period}.xml',
    fieldSeparator: ',',
    compress: true,
    charset: 'UTF-8',
    headerRows: 0,
    status: 0,
    remark: '上海监管局要求 XML 报文并压缩为 zip',
    createTime: '2026-08-20 09:30:00'
  },
  {
    id: 4,
    configName: '江苏分公司月报报文配置（CSV）',
    orgId: 13,
    orgName: '江苏分公司',
    fileType: 'CSV',
    fileNameRule: 'HX_{orgCode}_{reportCode}_{period}.csv',
    fieldSeparator: ',',
    compress: false,
    charset: 'GBK',
    headerRows: 1,
    status: 0,
    remark: '江苏监管局前置机仅识别 GBK 编码',
    createTime: '2026-08-21 10:05:00'
  },
  {
    id: 5,
    configName: '广东分公司月报报文配置（TXT 压缩）',
    orgId: 14,
    orgName: '广东分公司',
    fileType: 'TXT',
    fileNameRule: 'HX_{orgCode}_{reportCode}_{period}_{date}.txt',
    fieldSeparator: '|',
    compress: true,
    charset: 'UTF-8',
    headerRows: 1,
    status: 0,
    remark: '广东监管局要求文件名带报送日期并压缩',
    createTime: '2026-08-21 10:20:00'
  },
  {
    id: 6,
    configName: '监管专项检查报文配置（XML）',
    orgId: 1,
    orgName: '华信人寿保险股份有限公司',
    fileType: 'XML',
    fileNameRule: 'HX_{orgCode}_SPECIAL_{period}_{seq}.xml',
    fieldSeparator: '|',
    compress: true,
    charset: 'UTF-8',
    headerRows: 0,
    status: 0,
    remark: '专项检查临时报文，按批次分片生成',
    createTime: '2026-08-25 14:00:00'
  },
  {
    id: 7,
    configName: '河南分公司月报报文配置（TXT，停用）',
    orgId: 1,
    orgName: '华信人寿保险股份有限公司',
    fileType: 'TXT',
    fileNameRule: 'HX_{orgCode}_{reportCode}_{period}.txt',
    fieldSeparator: '|',
    compress: false,
    charset: 'UTF-8',
    headerRows: 1,
    status: 1,
    remark: '分公司筹建中，暂未启用',
    createTime: '2026-08-26 11:30:00'
  }
]

export const crSubmitFileConfigTable = defineTable<SubmitFileConfigRow>(
  'cr.submitFileConfig',
  submitFileConfigSeed
)

/* ==================================================================
 * 报文文件口径（列表 fileSize / 数据行数 = 实际下载到的内容）
 * ================================================================== */

/** 机构当前启用的报文文件配置（与「报文生成」取配置的口径一致） */
export const fileConfigOf = (orgId: number): SubmitFileConfigRow | undefined => {
  const rows = crSubmitFileConfigTable.all().filter((row) => Number(row.status) === 0)
  return (
    rows.find((row) => row.orgId === Number(orgId)) ||
    rows.find((row) => row.orgId === 1) ||
    rows[0]
  )
}

/** 机构报文的扩展名：由命名规则决定（.txt / .csv / .xml） */
export const fileExtOfOrg = (orgId: number): string => {
  const config = fileConfigOf(orgId)
  return extOfRule(config?.fileNameRule || '', config?.fileType === 'XML' ? 'xml' : 'txt')
}

/** 报文内容参数：格式以文件名后缀为准（列表上显示 .csv，下载就必须是 CSV） */
export const submitFileOptions = (orgId: number, fileName?: string): ReportFileOptions => {
  const config = fileConfigOf(orgId)
  return {
    format: formatOfFile(fileName, (config?.fileType as ReportFileFormat) || 'TXT'),
    separator: config?.fieldSeparator || '|',
    headerRows: config?.headerRows ?? 1
  }
}

/** 报文文件计划：文件名 + 内容参数 + 真实字节数 */
export interface ReportFilePlan {
  fileName: string
  format: ReportFileFormat
  options: ReportFileOptions
  meta: ReportFileMeta
  /** 按真实报文内容推导的字节数（= 下载到的 Blob 大小） */
  bytes: number
}

/**
 * 报文文件计划 —— 种子、生成预览、生成执行、下载校验全部走这里。
 * dataRows 有多少就生成多少行，不做任何截断；bytes 与实际下载内容严格相等。
 */
export const planReportFile = (params: {
  orgId: number
  orgCode: string
  orgName?: string
  reportCode: string
  reportName?: string
  period: string
  dataRows: number
  generateTime?: string
  reportType?: string
  /** 下载时以记录上已保存的文件名为准（列表展示的就是它） */
  fileName?: string
  /** 字段分隔符覆盖（缺省用机构报送文件配置里的分隔符；报文生成下载页按所选格式取规范分隔符） */
  separator?: string
}): ReportFilePlan => {
  const fileName =
    params.fileName ||
    reportFileName(params.orgCode, params.reportCode, params.period, fileExtOfOrg(params.orgId))
  const configOptions = submitFileOptions(params.orgId, fileName)
  const options: ReportFileOptions = params.separator
    ? { ...configOptions, separator: params.separator }
    : configOptions
  const meta: ReportFileMeta = {
    orgCode: params.orgCode,
    orgName: params.orgName,
    reportCode: params.reportCode,
    reportName: params.reportName,
    period: params.period,
    dataRows: Math.max(0, Number(params.dataRows) || 0),
    generateTime: params.generateTime,
    reportType: params.reportType
  }
  return {
    fileName,
    format: options.format || 'TXT',
    options,
    meta,
    bytes: submitFileBytes(meta, options)
  }
}

/** 报文状态记录 → 报文文件大小（与下载接口完全同源，下载时用它做一致性校验） */
export const submitFileBytesOfRow = (row: SubmitStatusRow): number =>
  planReportFile({
    orgId: row.orgId,
    orgCode: row.orgCode,
    orgName: row.orgName,
    reportCode: row.reportCode,
    reportName: row.reportName,
    period: row.period,
    dataRows: row.dataRows,
    generateTime: row.generateTime,
    reportType: row.reportType,
    fileName: row.fileName
  }).bytes

/* ==================================================================
 * 二、报文上报状态（4 家分公司 × 12 张报表 = 48 条）
 * ================================================================== */
export interface SubmitStatusRow {
  id: number
  orgId: number
  orgCode: string
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 报文文件名 */
  fileName: string
  /** 报文文件大小（字节） */
  fileSize: number
  /** 上报方式：FTP / SFTP / MANUAL，见字典 cr_report_type */
  reportType: string
  /** 上报状态，见 SUBMIT_STATUS */
  submitStatus: number
  /** 报文生成时间 */
  generateTime: string
  /** 上报时间 */
  submitTime: string
  /** 监管回执号 */
  receiptNo: string
  /** 失败原因（仅上报失败有值） */
  failReason: string
  /** 所属报送批次号 */
  batchNo: string
  /** 报文数据行数 */
  dataRows: number
  remark: string
}

/** 每个机构使用的上报方式（与机构上报配置一致） */
const ORG_REPORT_TYPE = ['SFTP', 'SFTP', 'FTP', 'SFTP']

/** 报表位次上的状态分布：5 已回执 / 3 上报成功 / 2 上报中 / 1 已生成 / 0 待生成 */
const STATUS_PATTERN = [5, 3, 1, 0, 2, 3, 1, 0, 5, 1, 3, 0]

/** 机构位次上的状态偏移：让不同机构同一张报表的状态不同，列表更有层次 */
const ORG_SHIFT = 4

/** 上报失败样例：真实失败原因，用于「上报失败」状态与失败原因展示 */
const FAIL_CASES: Array<[number, number, string]> = [
  [11, 5, '监管前置机连接超时（10.10.21.11:22），已重试 3 次仍失败，请检查机构主机配置'],
  [
    12,
    8,
    '文件名不符合规范：监管要求 HX_{orgCode}_{tableCode}_{period}.xml，当前报文缺少机构编码段'
  ],
  [13, 4, '报文内容校验失败：第 128 行字段数为 26，与表头声明的 27 个字段不一致'],
  [14, 11, '上报账号认证失败：SFTP 账号 hx_gd 密码错误，已连续 3 次登录失败'],
  [11, 13, '监管端返回：期次 202608 尚未开放报送窗口，报文被拒绝接收']
]

export const crSubmitStatusTable = defineTable<SubmitStatusRow>('cr.submitStatus', () => {
  const orgs = branchOrgs()
  const reports = allReports().filter((report) => SEED_REPORT_IDS.includes(report.id))
  const rows: SubmitStatusRow[] = []
  let id = 0
  orgs.forEach((org, orgIndex) => {
    reports.forEach((report, reportIndex) => {
      const status = STATUS_PATTERN[(reportIndex + orgIndex * ORG_SHIFT) % STATUS_PATTERN.length]
      const seq = String(++id).padStart(3, '0')
      const minute = String((reportIndex * 7 + orgIndex * 5) % 60).padStart(2, '0')
      const reportType = ORG_REPORT_TYPE[orgIndex % ORG_REPORT_TYPE.length]
      // 种子报文生成 / 上报时间固定在本期次内较早的 2026-09-10 ~ 09-11，
      // 保证页面上「最近生成记录」按时间倒序时，真正刚生成的报文排在最前
      const day = 11 - (reportIndex % 2)
      const generateTime =
        status === 0 ? '' : `2026-09-${String(day).padStart(2, '0')} 08:${minute}:12`
      // 待生成：还没有报文文件（大小 - / 0 行）；其余状态都有已生成的真实报文
      const dataRows = status === 0 ? 0 : estimateReportRows(org.id, report.id)
      const plan = planReportFile({
        orgId: org.id,
        orgCode: org.orgCode,
        orgName: org.orgName,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: PERIOD,
        dataRows,
        generateTime,
        reportType
      })
      rows.push({
        id,
        orgId: org.id,
        orgCode: org.orgCode,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: PERIOD,
        fileName: plan.fileName,
        fileSize: status === 0 ? 0 : plan.bytes,
        reportType,
        submitStatus: status,
        generateTime,
        submitTime: status >= 2 ? `2026-09-${String(day).padStart(2, '0')} 09:${minute}:36` : '',
        receiptNo:
          status === SUBMIT_STATUS.RECEIPTED ? `HZ202609${String(day).padStart(2, '0')}${seq}` : '',
        failReason: '',
        batchNo: `BS202609${String(day).padStart(2, '0')}${String(orgIndex + 1).padStart(2, '0')}`,
        dataRows,
        remark: status === SUBMIT_STATUS.REPORTING ? '报文已提交前置机，等待监管端确认' : ''
      })
    })
  })
  // 覆盖「上报失败」状态：3~5 条带真实失败原因。
  // 上报失败 = 报文已生成但被监管拒绝接收，所以同样要有可下载的真实报文文件。
  FAIL_CASES.forEach(([orgId, reportId, failReason]) => {
    const row = rows.find((item) => item.orgId === orgId && item.reportId === reportId)
    if (!row) return
    row.submitStatus = SUBMIT_STATUS.FAILED
    row.failReason = failReason
    row.receiptNo = ''
    row.submitTime = row.submitTime || '2026-09-11 10:41:08'
    row.generateTime = row.generateTime || '2026-09-11 08:41:08'
    if (!row.dataRows) row.dataRows = estimateReportRows(row.orgId, row.reportId)
    row.fileSize = submitFileBytesOfRow(row)
    row.remark = '上报失败，请排查后重新上报'
  })
  return rows
})

/* ==================================================================
 * 三、数据报送清单（报送批次，14 条）
 * ================================================================== */
export interface SubmitBatchRow {
  id: number
  /** 报送批次号 */
  batchNo: string
  orgId: number
  orgName: string
  period: string
  /** 报表数量 */
  reportCount: number
  /** 数据总行数 */
  totalRows: number
  /** 文件总大小（字节） */
  totalSize: number
  /** 报送人 */
  submitter: string
  /** 报送时间 */
  submitTime: string
  /** 批次状态，见 BATCH_STATUS */
  status: number
  remark: string
  createTime: string
}

/** 各期次的批次状态（按机构位次）：3 上报成功 / 2 上报中 / 1 已生成 / 4 存在失败 */
const BATCH_STATUS_BY_PERIOD: Record<string, number[]> = {
  '202606': [3, 3, 3, 3],
  '202607': [3, 4, 3, 3],
  '202608': [3, 2, 4, 1]
}

const SUBMITTERS = ['李思远', '王雅琴', '张明浩', '刘婉婷']

/**
 * 批次明细（报送清单种子与批次合计共用）：
 * 一个批次 = reportCount 张报表，逐张给出行数与**真实**报文文件大小，
 * 批次上的「数据总行数 / 文件总大小」就是这些明细之和，明细大小又来自报文生成器。
 */
const batchItemsOf = (
  batch: Pick<
    SubmitBatchRow,
    'id' | 'batchNo' | 'orgId' | 'orgName' | 'period' | 'status' | 'submitTime' | 'createTime'
  >,
  reportCount: number,
  reports: ReturnType<typeof allReports>,
  orgs: ReturnType<typeof branchOrgs>
): Array<Omit<SubmitBatchItemRow, 'id' | 'batchId'>> => {
  const start = (batch.id * 2) % Math.max(1, reports.length - 4)
  const org = orgs.find((item) => item.id === batch.orgId)
  const items: Array<Omit<SubmitBatchItemRow, 'id' | 'batchId'>> = []
  for (let i = 0; i < reportCount; i++) {
    const report = reports[(start + i) % reports.length]
    const rowCount = pick(batch.id * 271 + report.id * 53, 1200, 6800)
    // 失败批次内的第 2 条明细模拟为上报失败，与批次状态呼应
    const itemStatus =
      batch.status === BATCH_STATUS.FAILED && i === 1
        ? SUBMIT_STATUS.FAILED
        : batch.status === BATCH_STATUS.GENERATING
          ? SUBMIT_STATUS.WAIT_GENERATE
          : Math.min(batch.status, SUBMIT_STATUS.SUCCESS)
    const plan = planReportFile({
      orgId: batch.orgId,
      orgCode: org?.orgCode || '000000',
      orgName: batch.orgName,
      reportCode: report.reportCode,
      reportName: report.reportName,
      period: batch.period,
      dataRows: rowCount,
      generateTime: batch.createTime,
      reportType: 'SFTP'
    })
    items.push({
      batchNo: batch.batchNo,
      orgId: batch.orgId,
      orgName: batch.orgName,
      reportCode: report.reportCode,
      reportName: report.reportName,
      period: batch.period,
      fileName: plan.fileName,
      rowCount,
      fileSize: plan.bytes,
      submitStatus: itemStatus,
      submitTime: batch.submitTime
    })
  }
  return items
}

/** 批次合计 = 明细之和（避免「合计」与「明细」两套口径） */
const withBatchTotals = (
  batch: Omit<SubmitBatchRow, 'totalRows' | 'totalSize'>,
  items: Array<Omit<SubmitBatchItemRow, 'id' | 'batchId'>>
): SubmitBatchRow => ({
  ...batch,
  totalRows: items.reduce((sum, item) => sum + item.rowCount, 0),
  totalSize: items.reduce((sum, item) => sum + item.fileSize, 0)
})

export const crSubmitBatchTable = defineTable<SubmitBatchRow>('cr.submitBatch', () => {
  const orgs = branchOrgs()
  const reports = allReports()
  const rows: SubmitBatchRow[] = []
  const periods: Array<[string, string]> = [
    ['202606', '20260703'],
    ['202607', '20260804'],
    ['202608', '20260912']
  ]
  let id = 0
  periods.forEach(([period, day], periodIndex) => {
    orgs.forEach((org, orgIndex) => {
      const reportCount = SEED_REPORT_IDS.slice(0, 6 + periodIndex * 3).length
      const status = BATCH_STATUS_BY_PERIOD[period][orgIndex]
      id += 1
      const seq = String(id).padStart(2, '0')
      const hour = String(9 + ((orgIndex + periodIndex) % 6)).padStart(2, '0')
      const draft: Omit<SubmitBatchRow, 'totalRows' | 'totalSize'> = {
        id,
        batchNo: `BS${day}${seq}`,
        orgId: org.id,
        orgName: org.orgName,
        period,
        reportCount,
        submitter: SUBMITTERS[orgIndex % SUBMITTERS.length],
        submitTime:
          status >= 2
            ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)} ${hour}:26:41`
            : '',
        status,
        remark:
          status === 4
            ? '批次内存在上报失败报文，需重新上报'
            : status === 1
              ? '报文已生成，等待上报窗口'
              : '',
        createTime: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)} ${hour}:12:05`
      }
      rows.push(withBatchTotals(draft, batchItemsOf(draft, reportCount, reports, orgs)))
    })
  })
  // 两批补充批次：补报 / 重报
  const extras: Array<Omit<SubmitBatchRow, 'totalRows' | 'totalSize'>> = [
    {
      id: 13,
      batchNo: 'BS2026091213',
      orgId: 11,
      orgName: '北京分公司',
      period: PERIOD,
      reportCount: 4,
      submitter: '陈志强',
      submitTime: '2026-09-12 15:42:07',
      status: BATCH_STATUS.GENERATED,
      remark: '赔案与赔付信息补报批次，已生成待上报',
      createTime: '2026-09-12 15:38:20'
    },
    {
      id: 14,
      batchNo: 'BS2026091214',
      orgId: 12,
      orgName: '上海分公司',
      period: PERIOD,
      reportCount: 3,
      submitter: '赵敏',
      submitTime: '2026-09-12 16:05:33',
      status: BATCH_STATUS.FAILED,
      remark: 'XML 报文格式校验未通过，需修正后重报',
      createTime: '2026-09-12 16:01:02'
    }
  ]
  extras.forEach((extra) => {
    rows.push(withBatchTotals(extra, batchItemsOf(extra, extra.reportCount, reports, orgs)))
  })
  return rows
})

/* ==================================================================
 * 四、报送批次明细（每个批次一张报表一条，与批次合计同源）
 * ================================================================== */
export interface SubmitBatchItemRow {
  id: number
  batchId: number
  batchNo: string
  orgId: number
  orgName: string
  reportCode: string
  reportName: string
  period: string
  fileName: string
  /** 数据行数 */
  rowCount: number
  /** 文件大小（字节）：按真实报文内容推导 */
  fileSize: number
  submitStatus: number
  submitTime: string
}

export const crSubmitBatchItemTable = defineTable<SubmitBatchItemRow>('cr.submitBatchItem', () => {
  const reports = allReports()
  const orgs = branchOrgs()
  const rows: SubmitBatchItemRow[] = []
  let id = 0
  crSubmitBatchTable.all().forEach((batch) => {
    // 与 crSubmitBatchTable 里的合计用的是同一个 batchItemsOf，口径必然一致
    batchItemsOf(batch, batch.reportCount, reports, orgs).forEach((item) => {
      id += 1
      rows.push({ ...item, id, batchId: batch.id })
    })
  })
  return rows
})

/* ==================================================================
 * 五、质量检核结果（监管侧反馈，4 家 × 8 张 = 32 条）
 * ================================================================== */
export interface SubmitQualityRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 检核项目 */
  checkItem: string
  /** 检核结论：1 通过 / 0 不通过，见 QUALITY_RESULT */
  result: number
  /** 问题数量 */
  problemCount: number
  /** 问题描述 */
  problemDesc: string
  /** 监管反馈时间 */
  feedbackTime: string
}

/** 监管侧检核项目 */
const QUALITY_ITEMS = [
  '数据完整性检核',
  '数据准确性检核',
  '数据一致性检核',
  '码值规范性检核',
  '报送及时性检核'
]

/** 不通过样例的结论描述 */
const QUALITY_PROBLEMS = [
  '保单号存在 6 条重复记录，同一保单在期内出现多次有效状态',
  '保险金额与小计金额不一致，差额 12,800.00 元',
  '证件号码脱敏不符合监管要求，存在 3 条未脱敏数据',
  '职业编码存在监管码值范围外的取值（如 99），共 4 条',
  '报送时间晚于监管截止时间 2026-09-15 24:00，超期 3 小时',
  '被保险人出生日期晚于保单生效日期，逻辑矛盾共 2 条',
  '保费收入与缴费金额跨表不一致，差异 8 条记录',
  '机构编码未使用监管下发的 6 位行政区划码，共 5 条'
]

/** 结论分布：1 通过 / 0 不通过 */
const QUALITY_PATTERN = [1, 1, 0, 1, 1, 1, 0, 1]

export const crSubmitQualityTable = defineTable<SubmitQualityRow>('cr.submitQuality', () => {
  const orgs = branchOrgs()
  const reports = allReports().filter((report) => SEED_REPORT_IDS.includes(report.id))
  const rows: SubmitQualityRow[] = []
  let id = 0
  orgs.forEach((org, orgIndex) => {
    reports.slice(0, 8).forEach((report, reportIndex) => {
      const result = QUALITY_PATTERN[(reportIndex + orgIndex * 2) % QUALITY_PATTERN.length]
      const item = QUALITY_ITEMS[(reportIndex + orgIndex) % QUALITY_ITEMS.length]
      const problemCount =
        result === QUALITY_RESULT.PASS ? 0 : pick(report.id * 31 + org.id * 7, 2, 9)
      id += 1
      rows.push({
        id,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: PERIOD,
        checkItem: item,
        result,
        problemCount,
        problemDesc:
          result === QUALITY_RESULT.PASS
            ? '未发现问题，数据符合监管检核规则'
            : QUALITY_PROBLEMS[(reportIndex + orgIndex) % QUALITY_PROBLEMS.length],
        feedbackTime: `2026-09-${String(14 + (reportIndex % 3)).padStart(2, '0')} ${String(
          9 + ((reportIndex + orgIndex) % 8)
        ).padStart(2, '0')}:${String((reportIndex * 11 + orgIndex * 7) % 60).padStart(2, '0')}:00`
      })
    })
  })
  return rows
})
