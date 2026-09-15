/**
 * Mock Handler — 一键报送域（/cr-submit 5 个页面）
 *
 * | 页面           | 接口前缀                 |
 * | -------------- | ------------------------ |
 * | 报文生成       | /cr/submit-generate      |
 * | 报文状态查询   | /cr/submit-status        |
 * | 报送文件配置   | /cr/submit-file-config   |
 * | 数据报送清单   | /cr/submit-list          |
 * | 质量检核结果   | /cr/submit-quality       |
 *
 * 机构 / 报表 / 期次下拉统一从 crCommon 取，保证与任务、填报、校验各域口径一致。
 * 报文生成会真实写入 crSubmitStatusTable（生成即一条状态记录），
 * 并生成报送批次与批次明细，供「数据报送清单」页展示。
 */
import { currentUser } from './auth'
import { onGet, onPut } from '../route'
import { parseIds, registerResource } from '../resource'
import { csvBlob, formatDateTime, isEmpty, likeAny } from '../util'
import { BRANCH_NAMES, PERIOD, PERIODS, reportOptions, reportOrgs } from '../db/crCommon'
import { buildSubmitFile, fileSizeText } from '../db/crSubmitFile'
import {
  BATCH_STATUS,
  SUBMIT_STATUS,
  crSubmitBatchItemTable,
  crSubmitBatchTable,
  crSubmitFileConfigTable,
  crSubmitQualityTable,
  crSubmitStatusTable,
  estimateReportRows,
  fileConfigOf,
  planReportFile,
  type SubmitBatchItemRow,
  type SubmitBatchRow,
  type SubmitQualityRow,
  type SubmitStatusRow
} from '../db/crSubmit'

/* ==================================================================
 * 公共工具
 * ================================================================== */
type MockParams = Record<string, any>

/** 参数可能是数组（axios config.params）或逗号分隔字符串（URL query） */
const toArray = (value: any): string[] => {
  if (isEmpty(value)) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.map((item) => String(item).trim()).filter(Boolean)
}

const branchOrgs = () => reportOrgs().filter((org) => BRANCH_NAMES.includes(org.orgName))

const allReports = () => reportOptions()

const findOrg = (orgId: any) => branchOrgs().find((org) => String(org.id) === String(orgId))

/** 字典 / 常量中文名（导出与回执展示用） */
const SUBMIT_STATUS_NAME: Record<number, string> = {
  [SUBMIT_STATUS.WAIT_GENERATE]: '待生成',
  [SUBMIT_STATUS.GENERATED]: '已生成',
  [SUBMIT_STATUS.REPORTING]: '上报中',
  [SUBMIT_STATUS.SUCCESS]: '上报成功',
  [SUBMIT_STATUS.FAILED]: '上报失败',
  [SUBMIT_STATUS.RECEIPTED]: '已回执'
}

const BATCH_STATUS_NAME: Record<number, string> = {
  [BATCH_STATUS.GENERATING]: '生成中',
  [BATCH_STATUS.GENERATED]: '已生成',
  [BATCH_STATUS.REPORTING]: '上报中',
  [BATCH_STATUS.SUCCESS]: '上报成功',
  [BATCH_STATUS.FAILED]: '存在上报失败'
}

const QUALITY_RESULT_NAME: Record<number, string> = { 1: '通过', 0: '不通过' }

/**
 * 受保护的报文状态：已上报 / 已回执的报文不再重复生成，避免覆盖监管已接收的文件；
 * 处于「已生成」但尚未上报的报文允许重新生成（例如源数据修正后重跑）。
 */
const PROTECTED_STATUS = [SUBMIT_STATUS.REPORTING, SUBMIT_STATUS.SUCCESS, SUBMIT_STATUS.RECEIPTED]

/** 是否已上报（生成时需要跳过） */
const isProtected = (row?: SubmitStatusRow): boolean =>
  !!row && PROTECTED_STATUS.includes(row.submitStatus as (typeof PROTECTED_STATUS)[number])

/** 批次明细待插入行（id / batchId 由 mock 表分配） */
type NewBatchItem = Omit<SubmitBatchItemRow, 'id' | 'batchId'>

/* ==================================================================
 * 一、报文生成
 * ================================================================== */

/** 生成预览：将生成多少个文件（已上报过的会被跳过） */
onGet('/cr/submit-generate/preview', (ctx) => {
  const period = String(ctx.params.period || PERIOD)
  const orgIds = parseIds(ctx.params.orgIds)
  const reportIds = parseIds(ctx.params.reportIds)
  const orgs = branchOrgs().filter((org) => orgIds.includes(org.id))
  const reports = allReports().filter((report) => reportIds.includes(report.id))

  let skipCount = 0
  let estimateRows = 0
  let estimateSize = 0
  orgs.forEach((org) => {
    reports.forEach((report) => {
      const exist = crSubmitStatusTable.find(
        (row) => row.orgId === org.id && row.reportId === report.id && row.period === period
      )[0]
      const rows = estimateReportRows(org.id, report.id)
      if (isProtected(exist)) {
        skipCount += 1
      } else {
        estimateRows += rows
        // 与真正生成时同一套口径：文件大小按实际报文内容推导
        estimateSize += planReportFile({
          orgId: org.id,
          orgCode: org.orgCode,
          orgName: org.orgName,
          reportCode: report.reportCode,
          reportName: report.reportName,
          period,
          dataRows: rows,
          reportType: org.id === 13 ? 'FTP' : 'SFTP'
        }).bytes
      }
    })
  })
  return {
    period,
    orgCount: orgs.length,
    reportCount: reports.length,
    /** 选中组合总数 */
    totalCount: orgs.length * reports.length,
    /** 本次将生成的文件数 */
    fileCount: orgs.length * reports.length - skipCount,
    skipCount,
    estimateRows,
    estimateSize,
    orgNames: orgs.map((org) => org.orgName),
    reportNames: reports.map((report) => report.reportName)
  }
})

/** 执行生成：返回批次号、逐条日志与汇总 */
onGet('/cr/submit-generate/run', (ctx) => {
  const period = String(ctx.params.period || PERIOD)
  const orgIds = parseIds(ctx.params.orgIds)
  const reportIds = parseIds(ctx.params.reportIds)
  if (!orgIds.length) throw new Error('请至少选择一个报送机构')
  if (!reportIds.length) throw new Error('请至少选择一张报表')

  const orgs = branchOrgs().filter((org) => orgIds.includes(org.id))
  if (!orgs.length) throw new Error('所选机构中没有可报送的分公司机构，请重新选择')
  const reports = allReports().filter((report) => reportIds.includes(report.id))
  if (!reports.length) throw new Error('所选报表不存在，请重新选择')

  const generateTime = formatDateTime()
  const user = currentUser(ctx)
  const submitter = user?.nickname || user?.username || '系统自动'

  const logs: Array<{ time: string; text: string; level: string }> = []
  let cursor = Date.now()
  const push = (text: string, level = 'info') => {
    logs.push({ time: formatDateTime(cursor).slice(11), text, level })
    cursor += 1200
  }

  const dayPart = generateTime.slice(0, 10).replace(/-/g, '')
  const batchNos: string[] = []
  let successCount = 0
  let failCount = 0
  let skipCount = 0
  let totalRows = 0
  let totalSize = 0

  push(`一键报送开始：期次 ${period}，${orgs.length} 个机构 × ${reports.length} 张报表`)

  orgs.forEach((org) => {
    const config = fileConfigOf(org.id)
    const batchSeq = crSubmitBatchTable.all().length + batchNos.length + 1
    const batchNo = `BS${dayPart}${String(batchSeq).padStart(3, '0')}`
    const items: NewBatchItem[] = []
    let orgSuccess = 0
    let orgFail = 0
    let orgSkip = 0
    let orgRows = 0
    let orgSize = 0

    push(
      `${org.orgName} 开始生成报文：${reports.length} 张报表，命名规则 ${config?.fileNameRule || '-'}`
    )

    reports.forEach((report) => {
      // 文件名按机构命名规则生成（扩展名即报文格式：.txt 竖线分隔 / .csv / .xml）
      const fileName = planReportFile({
        orgId: org.id,
        orgCode: org.orgCode,
        orgName: org.orgName,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period,
        dataRows: 0,
        generateTime,
        reportType: org.id === 13 ? 'FTP' : 'SFTP'
      }).fileName
      const exist = crSubmitStatusTable.find(
        (row) => row.orgId === org.id && row.reportId === report.id && row.period === period
      )[0]

      // 上报中 / 上报成功 / 已回执 → 跳过，不覆盖监管已接收的报文
      if (isProtected(exist)) {
        orgSkip += 1
        push(
          `${org.orgName}｜${report.reportName} 已存在报文 ${exist!.fileName}（${
            SUBMIT_STATUS_NAME[exist!.submitStatus]
          }），本次跳过`,
          'warning'
        )
        return
      }

      // 生成失败样例：源数据表未采集到数据（确定性命中，便于演示失败与重试）
      if ((org.id + report.id) % 17 === 0) {
        orgFail += 1
        const failReason = '源数据表未采集到数据，无法生成报文，请检查数据加工任务执行结果'
        const payload = {
          orgId: org.id,
          orgCode: org.orgCode,
          orgName: org.orgName,
          reportId: report.id,
          reportCode: report.reportCode,
          reportName: report.reportName,
          period,
          fileName,
          fileSize: 0,
          reportType: org.id === 13 ? 'FTP' : 'SFTP',
          submitStatus: SUBMIT_STATUS.FAILED,
          generateTime,
          submitTime: '',
          receiptNo: '',
          failReason,
          batchNo,
          dataRows: 0,
          remark: '报文生成失败'
        }
        if (exist) {
          crSubmitStatusTable.update({ id: exist.id, ...payload })
        } else {
          crSubmitStatusTable.insert(payload)
        }
        items.push({
          batchNo,
          orgId: org.id,
          orgName: org.orgName,
          reportCode: report.reportCode,
          reportName: report.reportName,
          period,
          fileName,
          rowCount: 0,
          fileSize: 0,
          submitStatus: SUBMIT_STATUS.FAILED,
          submitTime: ''
        })
        push(`${org.orgName}｜${report.reportName} 报文生成失败：${failReason}`, 'error')
        return
      }

      const dataRows = estimateReportRows(org.id, report.id)
      // 文件大小 = 真实报文内容的字节数（与「下载报文」拿到的 Blob 大小严格相等）
      const fileSize = planReportFile({
        orgId: org.id,
        orgCode: org.orgCode,
        orgName: org.orgName,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period,
        dataRows,
        generateTime,
        reportType: org.id === 13 ? 'FTP' : 'SFTP',
        fileName
      }).bytes
      const payload = {
        orgId: org.id,
        orgCode: org.orgCode,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period,
        fileName,
        fileSize,
        reportType: org.id === 13 ? 'FTP' : 'SFTP',
        submitStatus: SUBMIT_STATUS.GENERATED,
        generateTime,
        submitTime: '',
        receiptNo: '',
        failReason: '',
        batchNo,
        dataRows,
        remark: '报文已生成，等待上报'
      }
      if (exist) {
        crSubmitStatusTable.update({ id: exist.id, ...payload })
      } else {
        crSubmitStatusTable.insert(payload)
      }
      orgSuccess += 1
      orgRows += dataRows
      orgSize += fileSize
      items.push({
        batchNo,
        orgId: org.id,
        orgName: org.orgName,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period,
        fileName,
        rowCount: dataRows,
        fileSize,
        submitStatus: SUBMIT_STATUS.GENERATED,
        submitTime: ''
      })
      push(
        `${org.orgName}｜${report.reportName} 报文生成成功：${fileName}（${dataRows.toLocaleString(
          'zh-CN'
        )} 行 / ${fileSizeText(fileSize)}）`,
        'success'
      )
    })

    successCount += orgSuccess
    failCount += orgFail
    skipCount += orgSkip
    totalRows += orgRows
    totalSize += orgSize

    push(
      `${org.orgName} 报文生成完成：成功 ${orgSuccess} 个 / 失败 ${orgFail} 个 / 跳过 ${orgSkip} 个`,
      orgFail > 0 ? 'warning' : 'success'
    )

    // 只为本轮真正产生动作（生成 / 失败）的机构建立报送批次
    if (items.length) {
      const batchId = crSubmitBatchTable.insert({
        batchNo,
        orgId: org.id,
        orgName: org.orgName,
        period,
        reportCount: items.length,
        totalRows: orgRows,
        totalSize: orgSize,
        submitter,
        submitTime: '',
        status: orgFail > 0 ? BATCH_STATUS.FAILED : BATCH_STATUS.GENERATED,
        remark:
          orgFail > 0
            ? `一键报送生成：成功 ${orgSuccess} 个，失败 ${orgFail} 个`
            : `一键报送生成：${orgSuccess} 个报文已生成，等待上报`,
        createTime: generateTime
      }).id
      items.forEach((item) => crSubmitBatchItemTable.insert({ ...item, batchId }))
      batchNos.push(batchNo)
    }
  })

  push(
    `本次一键报送完成：成功 ${successCount} 个 / 失败 ${failCount} 个 / 跳过 ${skipCount} 个，共 ${
      batchNos.length
    } 个报送批次`,
    failCount > 0 ? 'warning' : 'success'
  )

  return {
    batchNo:
      batchNos.length > 1 ? `${batchNos[0]} 等 ${batchNos.length} 个批次` : batchNos[0] || '',
    batchNos,
    logs,
    summary: {
      batchNo:
        batchNos.length > 1 ? `${batchNos[0]} 等 ${batchNos.length} 个批次` : batchNos[0] || '',
      period,
      orgCount: orgs.length,
      reportCount: reports.length,
      totalCount: orgs.length * reports.length,
      successCount,
      failCount,
      skipCount,
      totalRows,
      totalSize,
      submitter,
      generateTime
    }
  }
})

/** 最近生成记录（生成过的报文一眼可见） */
onGet('/cr/submit-generate/recent', (ctx) => {
  const limit = Number(ctx.params.limit) || 8
  // 按生成时间倒序：种子数据的时间固定在本期次较早日期，因此刚生成的报文必然排在最前
  return crSubmitStatusTable
    .all()
    .filter((row) => !!row.generateTime)
    .sort(
      (a, b) =>
        String(b.generateTime).localeCompare(String(a.generateTime)) || Number(b.id) - Number(a.id)
    )
    .slice(0, limit)
})

/* ==================================================================
 * 二、报文状态查询
 * ================================================================== */
const statusFilter = (row: SubmitStatusRow, params: MockParams) => {
  if (!isEmpty(params.period) && String(row.period) !== String(params.period)) return false
  const orgIds = toArray(params.orgIds)
  if (orgIds.length && !orgIds.includes(String(row.orgId))) return false
  if (!isEmpty(params.orgId) && String(row.orgId) !== String(params.orgId)) return false
  if (!isEmpty(params.reportId) && String(row.reportId) !== String(params.reportId)) return false
  if (!isEmpty(params.submitStatus) && Number(row.submitStatus) !== Number(params.submitStatus)) {
    return false
  }
  if (!isEmpty(params.reportType) && String(row.reportType) !== String(params.reportType)) {
    return false
  }
  return likeAny(
    row,
    ['orgName', 'reportName', 'reportCode', 'fileName', 'receiptNo', 'failReason'],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/submit-status',
  table: crSubmitStatusTable,
  sort: (a, b) => Number(b.id) - Number(a.id),
  filter: statusFilter
})

/** 重新上报 */
onPut('/cr/submit-status/report', (ctx) => {
  const { id } = ctx.body || {}
  const row = crSubmitStatusTable.get(Number(id))
  if (!row) throw new Error('报文记录不存在')
  if (row.submitStatus === SUBMIT_STATUS.REPORTING) {
    throw new Error('该报文正在上报中，请稍后再试')
  }
  if (row.submitStatus === SUBMIT_STATUS.WAIT_GENERATE) {
    throw new Error('该报文尚未生成，请先在「报文生成」中生成报文')
  }
  // 没有报文文件（生成失败 / 源数据为空）时重报没有意义，必须先重新生成
  if (!row.dataRows || !row.fileSize) {
    throw new Error('该报文没有可上报的文件（生成失败或源数据为空），请先在「报文生成」中重新生成')
  }
  // 文件名不符合监管规范属于「配置问题」，重报前必须先改配置 —— 对齐真实报送处置流程
  if (String(row.failReason).includes('文件名不符合规范')) {
    throw new Error('文件名不符合监管规范，请先在「报送文件配置」中修正命名规则后再重新上报')
  }
  const submitTime = formatDateTime()
  crSubmitStatusTable.update({
    id: row.id,
    submitStatus: SUBMIT_STATUS.SUCCESS,
    submitTime,
    failReason: '',
    receiptNo: '',
    remark: '重新上报成功，等待监管回执'
  })
  return {
    ...row,
    submitStatus: SUBMIT_STATUS.SUCCESS,
    submitTime,
    failReason: '',
    remark: '重新上报成功，等待监管回执'
  }
})

/**
 * 下载报文
 *
 * 完全按列表上显示的口径下发文件：
 * - 行数 = 列表的 dataRows，一行不少（旧的 200 行截断已去掉）；
 * - 格式 = 文件名后缀（.txt 竖线分隔纯文本 / .csv 逗号分隔 / .xml 结构良好 XML）；
 * - 字节数 = 列表的 fileSize（同一个 planReportFile 推导，这里再用实际 Blob 校验一次）。
 */
onGet('/cr/submit-status/download', (ctx) => {
  const row = crSubmitStatusTable.get(Number(ctx.params.id))
  if (!row) throw new Error('报文记录不存在')
  if (row.submitStatus === SUBMIT_STATUS.WAIT_GENERATE) {
    throw new Error('该报文尚未生成，无法下载')
  }
  if (!row.dataRows || !row.fileSize) {
    throw new Error('该报文没有可下载数据（生成失败或源数据为空），请先重新生成报文')
  }
  const plan = planReportFile({
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
  })
  const file = buildSubmitFile(plan.meta, plan.options)
  // 列表上的文件大小必须等于实际下载的字节数：万一历史数据对不上，按真实内容回写并告警
  if (plan.bytes !== row.fileSize) {
    console.warn(
      `[Mock] 报文 ${row.fileName} 列表大小 ${row.fileSize} 与实际生成 ${plan.bytes} 不一致，已按实际内容回写`
    )
    crSubmitStatusTable.update({ id: row.id, fileSize: plan.bytes })
  }
  return file.blob
})

/** 查看回执（上报成功但监管尚未回写回执时，返回「待回执」状态） */
onGet('/cr/submit-status/receipt', (ctx) => {
  const row = crSubmitStatusTable.get(Number(ctx.params.id))
  if (!row) throw new Error('报文记录不存在')
  if (row.submitStatus < SUBMIT_STATUS.SUCCESS) {
    throw new Error('该报文尚未上报成功，暂无监管回执')
  }
  const org = findOrg(row.orgId)
  const receipted = !!row.receiptNo
  return {
    receiptNo: row.receiptNo,
    orgName: row.orgName,
    reportName: row.reportName,
    reportCode: row.reportCode,
    period: row.period,
    fileName: row.fileName,
    fileSize: row.fileSize,
    reportType: row.reportType,
    submitTime: row.submitTime,
    receiptTime: receipted ? `${String(row.submitTime).slice(0, 10)} 10:58:20` : '',
    receiver: org?.regulator || '国家金融监督管理总局',
    result: receipted ? '接收成功' : '待回执',
    records: receipted ? row.dataRows : 0,
    message: receipted
      ? '报文格式校验通过，数据已入库'
      : '报文已被监管前置机接收，监管端正在校验，回执尚未回写',
    items: receipted
      ? [
          { name: '文件命名规范校验', result: '通过', remark: `符合 ${row.fileName} 命名规则` },
          { name: '文件格式校验', result: '通过', remark: '首行表头与字段数一致' },
          {
            name: '数据项校验',
            result: '通过',
            remark: `共校验 ${row.dataRows.toLocaleString('zh-CN')} 条数据`
          },
          { name: '重复报送校验', result: '通过', remark: '本期次未发现重复报送记录' }
        ]
      : [
          {
            name: '报文接收',
            result: '待回执',
            remark: '监管端尚未回写回执，请稍后在「报文状态查询」中刷新查看'
          }
        ]
  }
})

/* ==================================================================
 * 三、报送文件配置
 * ================================================================== */
registerResource({
  prefix: '/cr/submit-file-config',
  table: crSubmitFileConfigTable,
  sort: (a, b) => Number(b.id) - Number(a.id),
  filter: (row, params) => {
    if (!isEmpty(params.orgId) && Number(row.orgId) !== Number(params.orgId)) return false
    if (!isEmpty(params.fileType) && String(row.fileType) !== String(params.fileType)) return false
    if (
      params.status !== undefined &&
      params.status !== '' &&
      Number(row.status) !== Number(params.status)
    ) {
      return false
    }
    return likeAny(
      row,
      ['configName', 'fileNameRule', 'remark'],
      params.keyword || params.configName
    )
  },
  beforeCreate: (body) => ({ ...body, createTime: formatDateTime() }),
  toSimple: (row) => ({ id: row.id, name: row.configName, fileType: row.fileType }),
  exportColumns: [
    { field: 'configName', label: '配置名称' },
    { field: 'orgName', label: '适用机构' },
    { field: 'fileType', label: '文件类型' },
    { field: 'fileNameRule', label: '文件命名规则' },
    { field: 'fieldSeparator', label: '字段分隔符' },
    { field: 'charset', label: '字符编码' },
    { field: 'headerRows', label: '表头行数' },
    { field: 'remark', label: '备注' }
  ]
})

/* ==================================================================
 * 四、数据报送清单
 * ================================================================== */
const batchFilter = (row: SubmitBatchRow, params: MockParams) => {
  if (!isEmpty(params.period) && String(row.period) !== String(params.period)) return false
  if (!isEmpty(params.orgId) && String(row.orgId) !== String(params.orgId)) return false
  if (!isEmpty(params.status) && Number(row.status) !== Number(params.status)) return false
  return likeAny(
    row,
    ['batchNo', 'orgName', 'submitter', 'remark'],
    params.keyword || params.batchNo
  )
}

registerResource({
  prefix: '/cr/submit-list',
  table: crSubmitBatchTable,
  sort: (a, b) => Number(b.id) - Number(a.id),
  filter: batchFilter,
  exportColumns: [
    { field: 'batchNo', label: '报送批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'period', label: '期次' },
    { field: 'reportCount', label: '报表数量' },
    { field: 'totalRows', label: '数据总行数' },
    { field: 'totalSizeText', label: '文件总大小' },
    { field: 'submitter', label: '报送人' },
    { field: 'submitTime', label: '报送时间' },
    { field: 'statusName', label: '状态' },
    { field: 'remark', label: '备注' }
  ]
})

/** 批次明细 */
onGet('/cr/submit-list/items', (ctx) => {
  const batchId = Number(ctx.params.batchId)
  if (!batchId) throw new Error('缺少批次 id')
  return crSubmitBatchItemTable
    .find((row) => Number(row.batchId) === batchId)
    .sort((a, b) => Number(a.id) - Number(b.id))
})

/** 清单导出：状态与文件大小转成可读文案 */
onGet('/cr/submit-list/export-excel', (ctx) => {
  const rows = crSubmitBatchTable
    .all()
    .filter((row) => batchFilter(row, ctx.params))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .map((row) => ({
      ...row,
      totalSizeText: fileSizeText(row.totalSize),
      statusName: BATCH_STATUS_NAME[Number(row.status)] || ''
    }))
  return csvBlob(rows, [
    { field: 'batchNo', label: '报送批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'period', label: '期次' },
    { field: 'reportCount', label: '报表数量' },
    { field: 'totalRows', label: '数据总行数' },
    { field: 'totalSizeText', label: '文件总大小' },
    { field: 'submitter', label: '报送人' },
    { field: 'submitTime', label: '报送时间' },
    { field: 'statusName', label: '状态' },
    { field: 'remark', label: '备注' }
  ])
})

/* ==================================================================
 * 五、质量检核结果
 * ================================================================== */
const qualityFilter = (row: SubmitQualityRow, params: MockParams) => {
  if (!isEmpty(params.period) && String(row.period) !== String(params.period)) return false
  if (!isEmpty(params.orgId) && String(row.orgId) !== String(params.orgId)) return false
  if (!isEmpty(params.reportId) && String(row.reportId) !== String(params.reportId)) return false
  if (
    params.result !== undefined &&
    params.result !== '' &&
    Number(row.result) !== Number(params.result)
  ) {
    return false
  }
  return likeAny(
    row,
    ['orgName', 'reportName', 'reportCode', 'checkItem', 'problemDesc'],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/submit-quality',
  table: crSubmitQualityTable,
  sort: (a, b) => Number(b.id) - Number(a.id),
  filter: qualityFilter
})

/** 质量小结：总检核项 / 通过 / 不通过 / 问题总数 */
onGet('/cr/submit-quality/summary', (ctx) => {
  const rows = crSubmitQualityTable.all().filter((row) => qualityFilter(row, ctx.params))
  const passCount = rows.filter((row) => Number(row.result) === 1).length
  return {
    total: rows.length,
    passCount,
    failCount: rows.length - passCount,
    problemCount: rows.reduce((sum, row) => sum + (Number(row.problemCount) || 0), 0),
    passRate: rows.length ? Math.round((passCount / rows.length) * 1000) / 10 : 0
  }
})

/** 质量检核结果导出 */
onGet('/cr/submit-quality/export-excel', (ctx) => {
  const rows = crSubmitQualityTable
    .all()
    .filter((row) => qualityFilter(row, ctx.params))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .map((row) => ({ ...row, resultName: QUALITY_RESULT_NAME[Number(row.result)] || '' }))
  return csvBlob(rows, [
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '期次' },
    { field: 'checkItem', label: '检核项目' },
    { field: 'resultName', label: '检核结论' },
    { field: 'problemCount', label: '问题数量' },
    { field: 'problemDesc', label: '问题描述' },
    { field: 'feedbackTime', label: '反馈时间' }
  ])
})

/* ==================================================================
 * 六、分页共用的下拉选项（机构 / 报表 / 期次）
 * ================================================================== */
const orgOptionHandler = () =>
  branchOrgs().map((org) => ({
    id: org.id,
    name: org.orgName,
    code: org.orgCode,
    level: org.orgLevel
  }))

const reportOptionHandler = () =>
  allReports().map((report) => ({
    id: report.id,
    name: report.reportName,
    code: report.reportCode,
    freq: report.freq,
    subjectName: report.subjectName
  }))

const periodOptionHandler = () => PERIODS

;['/cr/submit-generate', '/cr/submit-status', '/cr/submit-list', '/cr/submit-quality'].forEach(
  (prefix) => {
    onGet(`${prefix}/org-options`, orgOptionHandler)
    onGet(`${prefix}/report-options`, reportOptionHandler)
    onGet(`${prefix}/period-options`, periodOptionHandler)
  }
)
