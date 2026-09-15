/**
 * Mock Handler — 报文配置域（/cr-message 5 个页面）
 *
 * | 页面           | 接口前缀            |
 * | -------------- | ------------------- |
 * | 报表定制       | /cr/report-custom   |
 * | 报文信息管理   | /cr/message-info    |
 * | 口径信息配置   | /cr/message-caliber |
 * | 报文集配置     | /cr/report-set      |
 * | 填报人管理     | /cr/filler-assign   |
 *
 * 与主链路的咬合点：
 * - 报文集「生成报文」真实写入 cr.submitStatus（一键报送 → 报文状态查询里能看到、能下载），
 *   已上报 / 已回执的报文不会被覆盖，与 /cr/submit-generate/run 的保护口径一致。
 * - 报文信息管理的「报文样例」用 db/crSubmitFile 的同一个生成器产出，
 *   列表展示的行数 / 字节数与下载内容严格相等。
 */
import { onGet, onPost, onPut, type MockContext } from '../route'
import { assertAdmin, assertLogin } from './guards'
import { currentUser } from './auth'
import { parseIds, registerResource } from '../resource'
import { likeAny, formatDateTime } from '../util'
import { metaTableTable, reportTable } from '../db/cr'
import { reportOptions, reportOrgs } from '../db/crCommon'
import { userTable } from '../db/system'

/**
 * 当前操作人昵称。beforeCreate / beforeUpdate 钩子里的 ctx 在类型上是可选的
 * （resource.ts 运行时一定会传），所以这里显式兜底，别指望 ctx 一定在。
 */
const actorOf = (ctx?: MockContext) => (ctx ? currentUser(ctx)?.nickname : '') || '系统管理员'
import { buildSubmitFile } from '../db/crSubmitFile'
import {
  SUBMIT_STATUS,
  crSubmitStatusTable,
  estimateReportRows,
  planReportFile,
  reportFileName
} from '../db/crSubmit'
import {
  FORMULA_CODE_PATTERN,
  FORMULA_TYPE_LABEL,
  caliberTable,
  columnsOfTable,
  fillerAssignTable,
  messageInfoTable,
  reportCustomItemTable,
  reportCustomTable,
  reportSetTable,
  sqlFormulaTable,
  tableNameOf,
  tryRunFormula,
  type ReportSetRow
} from '../db/crMessage'

/** 通用状态过滤：0 正常 / 1 停用 */
const matchStatus = (row: { status: number }, params: Record<string, any>) =>
  params.status === undefined ||
  params.status === '' ||
  Number(row.status) === Number(params.status)

/** 报表 id 列表 → 报表行 */
const reportsOf = (reportIds: number[]) =>
  reportTable.all().filter((report) => reportIds.includes(report.id))

/** 报文类型 → 文件后缀 */
const EXT_OF_MESSAGE_TYPE: Record<string, string> = { TXT: 'txt', XML: 'xml', CSV: 'csv' }

/** 报表集合的频度一致性校验（与任务模板同一条业务约束） */
const assertFreqMatched = (freq: number, reportIds: number[]) => {
  const mismatch = reportsOf(reportIds).filter((report) => Number(report.freq) !== Number(freq))
  if (mismatch.length) {
    throw new Error(
      '以下报表频度与当前配置不一致，无法加入：' + mismatch.map((r) => r.reportName).join('、')
    )
  }
}

/* ==================================================================
 * 一、报表定制
 * ================================================================== */
registerResource({
  prefix: '/cr/report-custom',
  table: reportCustomTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['customCode', 'customName', 'reportCode', 'reportName'],
      params.keyword || params.customName
    )
  },
  beforeCreate: (body) => {
    const report = reportTable.get(Number(body.reportId))
    if (!report) throw new Error('请选择有效的报表')
    const table = tableNameOf(Number(report.tableId))
    return {
      ...body,
      reportCode: report.reportCode,
      reportName: report.reportName,
      freq: report.freq,
      dataTableId: Number(report.tableId),
      dataTableCode: table.tableCode,
      dataTableName: table.cnName,
      columnCount: 0,
      createTime: formatDateTime()
    }
  },
  beforeUpdate: (body) => {
    const patch: Record<string, any> = { ...body }
    if (body.reportId !== undefined) {
      const report = reportTable.get(Number(body.reportId))
      if (!report) throw new Error('请选择有效的报表')
      const table = tableNameOf(Number(report.tableId))
      patch.reportCode = report.reportCode
      patch.reportName = report.reportName
      patch.freq = report.freq
      patch.dataTableId = Number(report.tableId)
      patch.dataTableCode = table.tableCode
      patch.dataTableName = table.cnName
    }
    return patch
  },
  toSimple: (row) => ({ id: row.id, name: row.customName, code: row.customCode }),
  exportColumns: [
    { field: 'customCode', label: '定制编码' },
    { field: 'customName', label: '定制名称' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'dataTableName', label: '取数数据表' },
    { field: 'columnCount', label: '定制字段数' },
    { field: 'version', label: '版本' },
    { field: 'effectDate', label: '生效日期' },
    { field: 'status', label: '状态' }
  ]
})

/** 定制字段明细 */
onGet('/cr/report-custom/items', (ctx) => {
  const customId = Number(ctx.params.id)
  if (!customId) throw new Error('缺少定制 id')
  return reportCustomItemTable
    .all()
    .filter((item) => Number(item.customId) === customId)
    .sort((a, b) => a.sortNo - b.sortNo)
})

/** 可定制字段（含是否已选、加工方式回显） */
onGet('/cr/report-custom/column-options', (ctx) => {
  const custom = reportCustomTable.get(Number(ctx.params.id))
  if (!custom) throw new Error('报表定制记录不存在')
  const selected = reportCustomItemTable.all().filter((item) => Number(item.customId) === custom.id)
  return {
    customId: custom.id,
    dataTableId: custom.dataTableId,
    dataTableCode: custom.dataTableCode,
    dataTableName: custom.dataTableName,
    options: columnsOfTable(custom.dataTableId).map((column) => {
      const hit = selected.find((item) => item.columnCode === column.columnCode)
      return {
        ...column,
        selected: !!hit,
        transform: hit?.transform || 'DIRECT',
        sortNo: hit?.sortNo ?? 0,
        remark: hit?.remark || ''
      }
    })
  }
})

/**
 * 保存定制字段。
 * 业务约束：必填字段不允许移除（对齐附件文档「监管数据项必填项不得裁剪」）。
 */
onPut('/cr/report-custom/update-items', (ctx) => {
  const { id, items } = ctx.body || {}
  const custom = reportCustomTable.get(Number(id))
  if (!custom) throw new Error('报表定制记录不存在')
  const list = Array.isArray(items) ? items : []
  if (!list.length) throw new Error('请至少选择一个定制字段')

  const available = columnsOfTable(custom.dataTableId)
  const required = available.filter((column) => column.required)
  const codes = list.map((item: any) => String(item.columnCode))
  const missing = required.filter((column) => !codes.includes(column.columnCode))
  if (missing.length) {
    throw new Error('必填字段不允许移除：' + missing.map((column) => column.cnName).join('、'))
  }
  const unknown = codes.filter((code) => !available.some((column) => column.columnCode === code))
  if (unknown.length) throw new Error('存在无效字段：' + unknown.join('、'))

  const exists = reportCustomItemTable.all().filter((item) => Number(item.customId) === custom.id)
  if (exists.length) {
    reportCustomItemTable.removeBatch(exists.map((item) => item.id))
  }
  list.forEach((item: any, index: number) => {
    const column = available.find((option) => option.columnCode === String(item.columnCode))!
    reportCustomItemTable.insert({
      customId: custom.id,
      columnCode: column.columnCode,
      columnName: column.columnName,
      cnName: column.cnName,
      dataType: column.dataType,
      required: column.required,
      transform: String(item.transform || 'DIRECT'),
      sortNo: index + 1,
      remark: String(item.remark || '')
    })
  })
  reportCustomTable.update({ id: custom.id, columnCount: list.length })
  return true
})

/* ==================================================================
 * 二、报文信息管理
 * ================================================================== */
registerResource({
  prefix: '/cr/message-info',
  table: messageInfoTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.messageType && row.messageType !== params.messageType) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['messageCode', 'messageName', 'period', 'regulatoryRef'],
      params.keyword || params.messageName
    )
  },
  beforeCreate: (body) => {
    const reportIds = parseIds(body.reportIds)
    if (!reportIds.length) throw new Error('请至少选择一张报表')
    assertFreqMatched(Number(body.freq), reportIds)
    const tableIds = new Set(
      reportIds.map((reportId) => Number(reportTable.get(reportId)?.tableId || 0))
    )
    return {
      ...body,
      reportIds,
      reportCount: reportIds.length,
      tableCount: tableIds.size,
      columnCount: [...tableIds].reduce(
        (total, tableId) => total + columnsOfTable(tableId).length,
        0
      ),
      createTime: formatDateTime()
    }
  },
  beforeUpdate: (body) => {
    const patch: Record<string, any> = { ...body }
    if (body.reportIds !== undefined) {
      const reportIds = parseIds(body.reportIds)
      if (!reportIds.length) throw new Error('请至少选择一张报表')
      const freq = Number(body.freq)
      if (freq) assertFreqMatched(freq, reportIds)
      const tableIds = new Set(
        reportIds.map((reportId) => Number(reportTable.get(reportId)?.tableId || 0))
      )
      patch.reportIds = reportIds
      patch.reportCount = reportIds.length
      patch.tableCount = tableIds.size
      patch.columnCount = [...tableIds].reduce(
        (total, tableId) => total + columnsOfTable(tableId).length,
        0
      )
    }
    return patch
  },
  toSimple: (row) => ({ id: row.id, name: row.messageName, code: row.messageCode }),
  exportColumns: [
    { field: 'messageCode', label: '报文编码' },
    { field: 'messageName', label: '报文名称' },
    { field: 'messageType', label: '报文类型' },
    { field: 'period', label: '适用期次' },
    { field: 'reportCount', label: '报表数量' },
    { field: 'columnCount', label: '字段数量' },
    { field: 'version', label: '版本' },
    { field: 'regulatoryRef', label: '监管文号' },
    { field: 'status', label: '状态' }
  ]
})

/** 报文结构：按报文段列出关联报表 / 数据表 / 字段数 */
onGet('/cr/message-info/report-list', (ctx) => {
  const message = messageInfoTable.get(Number(ctx.params.id))
  if (!message) throw new Error('报文信息不存在')
  return message.reportIds.map((reportId, index) => {
    const report = reportTable.get(reportId)
    const tableId = Number(report?.tableId || 0)
    const table = metaTableTable.get(tableId)
    return {
      segNo: index + 1,
      reportId,
      reportCode: report?.reportCode || '',
      reportName: report?.reportName || '',
      freq: report?.freq || 0,
      tableId,
      tableCode: table?.tableCode || '',
      tableName: table?.cnName || '',
      columnCount: columnsOfTable(tableId).length
    }
  })
})

/**
 * 报文样例：用一键报送同一个生成器产出，取前 20 行展示。
 * 行数 / 字节数与真正下载到的文件一致（同一份 buildSubmitFile 结果）。
 */
onGet('/cr/message-info/sample', (ctx) => {
  const message = messageInfoTable.get(Number(ctx.params.id))
  if (!message) throw new Error('报文信息不存在')
  const reportId = message.reportIds[0]
  const report = reportTable.get(reportId)
  if (!report) throw new Error('该报文未关联报表，无法生成样例')
  const org = reportOrgs().find((item) => item.orgLevel === 2)
  if (!org) throw new Error('缺少可用于生成样例的报送机构')
  const ext = EXT_OF_MESSAGE_TYPE[message.messageType] || 'txt'
  const fileName = reportFileName(org.orgCode, report.reportCode, message.period, ext)
  const dataRows = estimateReportRows(org.id, report.id)
  const plan = planReportFile({
    orgId: org.id,
    orgCode: org.orgCode,
    orgName: org.orgName,
    reportCode: report.reportCode,
    reportName: report.reportName,
    period: message.period,
    dataRows,
    generateTime: formatDateTime(),
    fileName
  })
  const file = buildSubmitFile(plan.meta, plan.options)
  return {
    fileName,
    format: file.format,
    orgName: org.orgName,
    dataRows: file.dataRows,
    lineCount: file.lineCount,
    bytes: file.bytes,
    preview: file.text.split('\n').slice(0, 20)
  }
})

/* ==================================================================
 * 三、口径信息配置
 * ================================================================== */
registerResource({
  prefix: '/cr/message-caliber',
  table: caliberTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.caliberType && Number(row.caliberType) !== Number(params.caliberType)) return false
    if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['caliberCode', 'caliberName', 'targetCode', 'targetName', 'reportName', 'owner'],
      params.keyword || params.caliberName
    )
  },
  beforeCreate: (body) => {
    const report = reportTable.get(Number(body.reportId))
    if (!report) throw new Error('请选择有效的报表')
    return {
      ...body,
      reportCode: report.reportCode,
      reportName: report.reportName,
      createTime: formatDateTime()
    }
  },
  beforeUpdate: (body) => {
    const patch: Record<string, any> = { ...body }
    if (body.reportId !== undefined) {
      const report = reportTable.get(Number(body.reportId))
      if (!report) throw new Error('请选择有效的报表')
      patch.reportCode = report.reportCode
      patch.reportName = report.reportName
    }
    return patch
  },
  toSimple: (row) => ({ id: row.id, name: row.caliberName, code: row.caliberCode }),
  exportColumns: [
    { field: 'caliberCode', label: '口径编码' },
    { field: 'caliberName', label: '口径名称' },
    { field: 'caliberType', label: '口径类型' },
    { field: 'reportName', label: '所属报表' },
    { field: 'targetName', label: '指标名称' },
    { field: 'sourceTable', label: '来源表' },
    { field: 'sourceField', label: '来源字段' },
    { field: 'owner', label: '责任部门' },
    { field: 'version', label: '版本' },
    { field: 'status', label: '状态' }
  ]
})

/* ==================================================================
 * 四、报文集配置
 * ================================================================== */

/** 报文集 → 机构清单（ALL = 全部报送机构） */
const orgsOfSet = (set: ReportSetRow) => {
  const all = reportOrgs()
  if (set.orgScope === 'ALL') return all
  return set.orgScope
    .split(',')
    .map((id) => all.find((org) => String(org.id) === String(id.trim())))
    .filter((org): org is NonNullable<typeof org> => !!org)
}

/** 报文集的生成计划：逐条给出机构 × 报表的目标状态 */
const planOfSet = (set: ReportSetRow) => {
  const orgs = orgsOfSet(set)
  const reports = reportsOf(set.reportIds)
  const ext =
    EXT_OF_MESSAGE_TYPE[messageInfoTable.get(Number(set.messageId))?.messageType || 'TXT'] || 'txt'
  const targets: Array<{
    org: (typeof orgs)[number]
    report: (typeof reports)[number]
    dataRows: number
    fileName: string
    bytes: number
    protectedRow: boolean
    exists: boolean
  }> = []
  orgs.forEach((org) => {
    reports.forEach((report) => {
      const exist = crSubmitStatusTable.find(
        (row) => row.orgId === org.id && row.reportId === report.id && row.period === set.period
      )[0]
      const dataRows = estimateReportRows(org.id, report.id)
      const fileName = reportFileName(org.orgCode, report.reportCode, set.period, ext)
      const plan = planReportFile({
        orgId: org.id,
        orgCode: org.orgCode,
        orgName: org.orgName,
        reportCode: report.reportCode,
        reportName: report.reportName,
        period: set.period,
        dataRows,
        fileName
      })
      targets.push({
        org,
        report,
        dataRows,
        fileName,
        bytes: plan.bytes,
        exists: !!exist,
        protectedRow:
          !!exist &&
          [SUBMIT_STATUS.REPORTING, SUBMIT_STATUS.SUCCESS, SUBMIT_STATUS.RECEIPTED].includes(
            exist.submitStatus as any
          )
      })
    })
  })
  return { orgs, reports, targets }
}

registerResource({
  prefix: '/cr/report-set',
  table: reportSetTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(row, ['setCode', 'setName', 'period'], params.keyword || params.setName)
  },
  beforeCreate: (body) => {
    const reportIds = parseIds(body.reportIds)
    if (!reportIds.length) throw new Error('请至少选择一张报表')
    assertFreqMatched(Number(body.freq), reportIds)
    const message = messageInfoTable.get(Number(body.messageId))
    const orgScope = String(body.orgScope || 'ALL')
    return {
      ...body,
      orgScope,
      orgNames:
        orgScope === 'ALL'
          ? '全部报送机构'
          : orgScope
              .split(',')
              .map(
                (id) =>
                  reportOrgs().find((org) => String(org.id) === String(id.trim()))?.orgName || ''
              )
              .filter(Boolean)
              .join('、'),
      messageCode: message?.messageCode || '',
      reportIds,
      reportCount: reportIds.length,
      createTime: formatDateTime()
    }
  },
  beforeUpdate: (body) => {
    const patch: Record<string, any> = { ...body }
    if (body.reportIds !== undefined) {
      const reportIds = parseIds(body.reportIds)
      if (!reportIds.length) throw new Error('请至少选择一张报表')
      if (body.freq) assertFreqMatched(Number(body.freq), reportIds)
      patch.reportIds = reportIds
      patch.reportCount = reportIds.length
    }
    if (body.messageId !== undefined) {
      patch.messageCode = messageInfoTable.get(Number(body.messageId))?.messageCode || ''
    }
    if (body.orgScope !== undefined) {
      const orgScope = String(body.orgScope)
      patch.orgScope = orgScope
      patch.orgNames =
        orgScope === 'ALL'
          ? '全部报送机构'
          : orgScope
              .split(',')
              .map(
                (id) =>
                  reportOrgs().find((org) => String(org.id) === String(id.trim()))?.orgName || ''
              )
              .filter(Boolean)
              .join('、')
    }
    return patch
  },
  toSimple: (row) => ({ id: row.id, name: row.setName, code: row.setCode }),
  exportColumns: [
    { field: 'setCode', label: '报文集编码' },
    { field: 'setName', label: '报文集名称' },
    { field: 'freq', label: '数据频度' },
    { field: 'period', label: '适用期次' },
    { field: 'orgNames', label: '报送机构' },
    { field: 'messageCode', label: '关联报文' },
    { field: 'reportCount', label: '报表数量' },
    { field: 'status', label: '状态' }
  ]
})

/** 报文集下的报表明细 */
onGet('/cr/report-set/report-list', (ctx) => {
  const set = reportSetTable.get(Number(ctx.params.id))
  if (!set) throw new Error('报文集不存在')
  return set.reportIds.map((reportId, index) => {
    const report = reportTable.get(reportId)
    const tableId = Number(report?.tableId || 0)
    const table = metaTableTable.get(tableId)
    return {
      seq: index + 1,
      reportId,
      reportCode: report?.reportCode || '',
      reportName: report?.reportName || '',
      freq: report?.freq || 0,
      tableCode: table?.tableCode || '',
      tableName: table?.cnName || '',
      columnCount: columnsOfTable(tableId).length
    }
  })
})

/** 生成预览：本次会生成 / 覆盖 / 跳过多少个报文文件 */
onGet('/cr/report-set/generate-preview', (ctx) => {
  const set = reportSetTable.get(Number(ctx.params.id))
  if (!set) throw new Error('报文集不存在')
  const { orgs, reports, targets } = planOfSet(set)
  const skipped = targets.filter((item) => item.protectedRow)
  const pending = targets.filter((item) => !item.protectedRow)
  return {
    setId: set.id,
    setCode: set.setCode,
    setName: set.setName,
    period: set.period,
    orgCount: orgs.length,
    reportCount: reports.length,
    fileCount: pending.length,
    skipCount: skipped.length,
    createCount: pending.filter((item) => !item.exists).length,
    updateCount: pending.filter((item) => item.exists).length,
    estimateRows: pending.reduce((total, item) => total + item.dataRows, 0),
    estimateBytes: pending.reduce((total, item) => total + item.bytes, 0),
    orgNames: orgs.map((org) => org.orgName),
    reportNames: reports.map((report) => report.reportName),
    skipNames: skipped.slice(0, 5).map((item) => item.org.orgName + ' / ' + item.report.reportName)
  }
})

/**
 * 按报文集生成报文：写入 cr.submitStatus（= 一键报送 → 报文状态查询的数据源）。
 * 已上报 / 已回执的报文不会被覆盖，返回创建 / 覆盖 / 跳过三类计数。
 */
onPost('/cr/report-set/generate', (ctx) => {
  const set = reportSetTable.get(Number(ctx.body?.id))
  if (!set) throw new Error('报文集不存在')
  if (set.status !== 0) throw new Error('报文集「' + set.setName + '」已停用，请先启用后再生成报文')
  const { targets } = planOfSet(set)
  const generateTime = formatDateTime()
  let created = 0
  let updated = 0
  let skipped = 0

  targets.forEach((target) => {
    if (target.protectedRow) {
      skipped += 1
      return
    }
    const exist = crSubmitStatusTable.find(
      (row) =>
        row.orgId === target.org.id &&
        row.reportId === target.report.id &&
        row.period === set.period
    )[0]
    const reportType = target.org.id === 13 ? 'FTP' : 'SFTP'
    if (exist) {
      crSubmitStatusTable.update({
        id: exist.id,
        fileName: target.fileName,
        fileSize: planReportFile({
          orgId: target.org.id,
          orgCode: target.org.orgCode,
          orgName: target.org.orgName,
          reportCode: target.report.reportCode,
          reportName: target.report.reportName,
          period: set.period,
          dataRows: target.dataRows,
          generateTime,
          fileName: target.fileName
        }).bytes,
        dataRows: target.dataRows,
        submitStatus: SUBMIT_STATUS.GENERATED,
        generateTime,
        failReason: '',
        remark: '由报文集 ' + set.setCode + ' 生成'
      })
      updated += 1
      return
    }
    crSubmitStatusTable.insert({
      orgId: target.org.id,
      orgCode: target.org.orgCode,
      orgName: target.org.orgName,
      reportId: target.report.id,
      reportCode: target.report.reportCode,
      reportName: target.report.reportName,
      period: set.period,
      fileName: target.fileName,
      fileSize: planReportFile({
        orgId: target.org.id,
        orgCode: target.org.orgCode,
        orgName: target.org.orgName,
        reportCode: target.report.reportCode,
        reportName: target.report.reportName,
        period: set.period,
        dataRows: target.dataRows,
        generateTime,
        fileName: target.fileName
      }).bytes,
      reportType,
      submitStatus: SUBMIT_STATUS.GENERATED,
      generateTime,
      submitTime: '',
      receiptNo: '',
      failReason: '',
      batchNo: '',
      dataRows: target.dataRows,
      remark: '由报文集 ' + set.setCode + ' 生成'
    })
    created += 1
  })

  return {
    setCode: set.setCode,
    setName: set.setName,
    period: set.period,
    created,
    updated,
    skipped,
    fileCount: created + updated,
    messageCode: set.messageCode
  }
})

/* ==================================================================
 * 五、填报人管理
 * ================================================================== */
registerResource({
  prefix: '/cr/filler-assign',
  table: fillerAssignTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['orgName', 'reportCode', 'reportName', 'fillerName', 'reviewerName'],
      params.keyword || params.fillerName
    )
  },
  beforeCreate: (body) => {
    const org = reportOrgs().find((item) => item.id === Number(body.orgId))
    if (!org) throw new Error('请选择有效的报送机构')
    const reportId = Number(body.reportId) || 0
    const report = reportId ? reportTable.get(reportId) : undefined
    if (reportId && !report) throw new Error('请选择有效的报表')
    const filler = userTable.get(Number(body.fillerId))
    const reviewer = userTable.get(Number(body.reviewerId))
    if (!filler) throw new Error('请选择填报人')
    if (Number(body.fillerId) === Number(body.reviewerId)) {
      throw new Error('填报人与复核人不能为同一人')
    }
    const dup = fillerAssignTable
      .all()
      .find(
        (row) =>
          Number(row.orgId) === org.id &&
          Number(row.reportId) === reportId &&
          Number(row.freq) === (reportId ? Number(body.freq) || 0 : 0)
      )
    if (dup) {
      throw new Error(
        '该机构 + 报表的指派已存在（填报人：' + dup.fillerName + '），请直接编辑或使用批量分配覆盖'
      )
    }
    return {
      ...body,
      orgName: org.orgName,
      reportId,
      reportCode: report?.reportCode || '',
      reportName: report?.reportName || '',
      freq: reportId ? Number(body.freq) || 0 : 0,
      fillerName: filler.nickname,
      reviewerName: reviewer?.nickname || '',
      createTime: formatDateTime()
    }
  },
  beforeUpdate: (body) => {
    const patch: Record<string, any> = { ...body }
    if (body.orgId !== undefined) {
      const org = reportOrgs().find((item) => item.id === Number(body.orgId))
      if (!org) throw new Error('请选择有效的报送机构')
      patch.orgName = org.orgName
    }
    if (body.reportId !== undefined) {
      const reportId = Number(body.reportId) || 0
      const report = reportId ? reportTable.get(reportId) : undefined
      patch.reportId = reportId
      patch.reportCode = report?.reportCode || ''
      patch.reportName = report?.reportName || ''
      if (!reportId) patch.freq = 0
    }
    if (body.fillerId !== undefined) {
      const filler = userTable.get(Number(body.fillerId))
      if (!filler) throw new Error('请选择填报人')
      patch.fillerName = filler.nickname
    }
    if (body.reviewerId !== undefined) {
      if (Number(body.reviewerId) === Number(body.fillerId)) {
        throw new Error('填报人与复核人不能为同一人')
      }
      patch.reviewerName = userTable.get(Number(body.reviewerId))?.nickname || ''
    }
    return patch
  },
  exportColumns: [
    { field: 'orgName', label: '报送机构' },
    { field: 'reportName', label: '报表范围' },
    { field: 'freq', label: '数据频度' },
    { field: 'fillerName', label: '填报人' },
    { field: 'reviewerName', label: '复核人' },
    { field: 'effectiveDate', label: '生效日期' },
    { field: 'expireDate', label: '失效日期' },
    { field: 'status', label: '状态' }
  ]
})

/**
 * 批量分配：按「机构 × 报表范围」批量建立填报 / 复核指派。
 * overwrite = false 时，已存在的指派会被跳过并计入 conflicts。
 */
onPost('/cr/filler-assign/batch', (ctx) => {
  const body = ctx.body || {}
  const orgIds = parseIds(body.orgIds)
  if (!orgIds.length) throw new Error('请至少选择一个报送机构')
  const filler = userTable.get(Number(body.fillerId))
  if (!filler) throw new Error('请选择填报人')
  const reviewer = body.reviewerId ? userTable.get(Number(body.reviewerId)) : undefined
  if (Number(body.fillerId) === Number(body.reviewerId)) {
    throw new Error('填报人与复核人不能为同一人')
  }
  const reportIds = parseIds(body.reportIds)
  const freq = Number(body.freq) || 0
  if (reportIds.length) assertFreqMatched(freq, reportIds)

  const orgs = reportOrgs().filter((org) => orgIds.includes(org.id))
  if (!orgs.length) throw new Error('所选机构不存在')
  const reports = reportIds.length ? reportsOf(reportIds) : [undefined]
  const overwrite = body.overwrite === true || body.overwrite === 'true'
  const now = formatDateTime()
  let created = 0
  let updated = 0
  const conflicts: string[] = []

  orgs.forEach((org) => {
    reports.forEach((report) => {
      const reportId = report?.id || 0
      const exist = fillerAssignTable
        .all()
        .find((row) => Number(row.orgId) === org.id && Number(row.reportId) === reportId)
      const payload = {
        orgId: org.id,
        orgName: org.orgName,
        reportId,
        reportCode: report?.reportCode || '',
        reportName: report?.reportName || '',
        freq: report ? freq : 0,
        fillerId: filler.id,
        fillerName: filler.nickname,
        reviewerId: reviewer?.id || 0,
        reviewerName: reviewer?.nickname || '',
        effectiveDate: String(body.effectiveDate || ''),
        expireDate: String(body.expireDate || ''),
        status: 0,
        remark: String(body.remark || '批量分配'),
        createTime: now
      }
      if (exist) {
        if (!overwrite) {
          conflicts.push(org.orgName + ' / ' + (report ? report.reportName : '全部报表'))
          return
        }
        fillerAssignTable.update({ ...payload, id: exist.id })
        updated += 1
        return
      }
      fillerAssignTable.insert(payload)
      created += 1
    })
  })

  return {
    created,
    updated,
    conflictCount: conflicts.length,
    orgCount: orgs.length,
    reportCount: reportIds.length,
    conflicts: conflicts.slice(0, 5)
  }
})

/* ==================================================================
 * 六、公共下拉（本域联动的选项统一从这里取，避免各页面各写一套）
 * ================================================================== */
onGet('/cr/message-common/report-options', (ctx) => {
  const freq = Number(ctx.params.freq) || 0
  return reportOptions()
    .filter((report) => (freq ? Number(report.freq) === freq : true))
    .map((report) => {
      const table = metaTableTable.get(Number(reportTable.get(report.id)?.tableId || 0))
      return {
        id: report.id,
        name: report.reportName,
        code: report.reportCode,
        reportCode: report.reportCode,
        reportName: report.reportName,
        freq: report.freq,
        subjectName: report.subjectName,
        tableId: table?.id || 0,
        tableCode: table?.tableCode || '',
        tableName: table?.cnName || '',
        columnCount: columnsOfTable(Number(table?.id || 0)).length
      }
    })
})

onGet('/cr/message-common/org-options', (ctx) => {
  const keyword = ctx.params.keyword
  const all = reportOrgs()
  return all
    .filter((org) => (keyword ? org.orgName.includes(String(keyword)) : true))
    .map((org) => ({ id: org.id, name: org.orgName, code: org.orgCode }))
})

onGet('/cr/message-common/message-options', (ctx) => {
  const freq = Number(ctx.params.freq) || 0
  return messageInfoTable
    .all()
    .filter((row) => (freq ? Number(row.freq) === freq : true))
    .map((row) => ({
      id: row.id,
      name: row.messageName,
      code: row.messageCode,
      messageCode: row.messageCode,
      messageName: row.messageName,
      messageType: row.messageType,
      freq: row.freq
    }))
})

/* ==================================================================
 * 七、公式 SQL 定制（/cr/message-formula）
 *
 * 需求文档只有一句「用于定义 SQL」，字段与校验规则按通行做法提案 —— 页面上如实标注。
 * 「试运行」是**纯解析、不落库**的只读计算（已进 pnpm e2e:auth 的 COMPUTE 清单，
 * 门禁用整库行数快照证明它一行都没写）。
 * ================================================================== */
registerResource({
  prefix: '/cr/message-formula',
  table: sqlFormulaTable,
  filter: (row, params) =>
    matchStatus(row, params) &&
    (params.type === undefined || params.type === '' || Number(row.type) === Number(params.type)) &&
    likeAny(row as any, ['code', 'name', 'target', 'remark'], params.keyword),
  sort: (a, b) => Number(b.status) - Number(a.status) || b.id - a.id,
  guard: (ctx, action) => assertAdmin(ctx, '公式' + action),
  beforeCreate: (body, ctx) => {
    const code = String(body.code || '').trim()
    if (!FORMULA_CODE_PATTERN.test(code)) {
      throw new Error(
        '公式编码只能用大写字母、数字与下划线，且以字母开头（当前：' + (code || '空') + '）'
      )
    }
    if (sqlFormulaTable.all().some((row) => row.code === code)) {
      throw new Error('公式编码已存在：' + code)
    }
    const sqlText = String(body.sqlText || '').trim()
    if (!sqlText) throw new Error('SQL 正文不能为空')
    const now = formatDateTime()
    const actor = actorOf(ctx)
    return {
      ...body,
      code,
      name: String(body.name || '').trim(),
      type: Number(body.type) || 1,
      sqlText,
      target: String(body.target || ''),
      status: Number(body.status) === 0 ? 0 : 1,
      remark: String(body.remark || ''),
      createUser: actor,
      createTime: now,
      updateUser: actor,
      updateTime: now
    }
  },
  beforeUpdate: (body, ctx) => {
    const exist = sqlFormulaTable.get(Number(body.id))
    if (!exist) throw new Error('公式不存在')
    const code = body.code === undefined ? exist.code : String(body.code).trim()
    if (!FORMULA_CODE_PATTERN.test(code)) {
      throw new Error(
        '公式编码只能用大写字母、数字与下划线，且以字母开头（当前：' + (code || '空') + '）'
      )
    }
    if (code !== exist.code && sqlFormulaTable.all().some((row) => row.code === code)) {
      throw new Error('公式编码已存在：' + code)
    }
    const sqlText = body.sqlText === undefined ? exist.sqlText : String(body.sqlText).trim()
    if (!sqlText) throw new Error('SQL 正文不能为空')
    return {
      code,
      name: body.name === undefined ? exist.name : String(body.name).trim(),
      type: body.type === undefined ? exist.type : Number(body.type) || 1,
      sqlText,
      target: body.target === undefined ? exist.target : String(body.target),
      status: body.status === undefined ? exist.status : Number(body.status) === 0 ? 0 : 1,
      remark: body.remark === undefined ? exist.remark : String(body.remark),
      updateUser: currentUser(ctx)?.nickname || '系统管理员',
      updateTime: formatDateTime()
    }
  },
  exportColumns: [
    { field: 'code', label: '公式编码' },
    { field: 'name', label: '公式名称' },
    { field: 'type', label: '公式类型', formatter: (row) => FORMULA_TYPE_LABEL[row.type] || '' },
    { field: 'target', label: '应用对象' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'sqlText', label: 'SQL 正文' },
    { field: 'remark', label: '备注' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' }
  ]
})

/**
 * 试运行：传 id（用库里那条）或直接传 sqlText（页面上还没保存的草稿）。
 * 只解析不执行 —— 没有数据库，编一个"执行成功"比不给结论更糟。
 */
onPost('/cr/message-formula/try-run', (ctx) => {
  // 只读计算，不锁角色；但带 id 时等于按 id 读一条配置，所以至少要登录（匿名不放行）
  assertLogin(ctx, '公式试运行')
  const id = Number(ctx.body?.id)
  const draft = ctx.body?.sqlText
  if ((draft === undefined || draft === null) && !id) throw new Error('请提供公式 id 或 SQL 正文')
  const sqlText =
    draft !== undefined && draft !== null ? String(draft) : sqlFormulaTable.get(id)?.sqlText
  const result = tryRunFormula(String(sqlText || ''))
  const row = id ? sqlFormulaTable.get(id) : undefined
  return {
    ...result,
    formulaCode: row?.code || '（未保存的草稿）',
    formulaName: row?.name || '',
    checkedAt: formatDateTime()
  }
})
