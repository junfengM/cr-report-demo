/**
 * Mock Handler — 监管报送业务接口
 *
 * 命名约定：接口前缀统一为 `/cr/**`，一个业务模块一套标准 CRUD。
 */
import { onGet, onPost, onPut, type MockContext } from '../route'
import { byIds, parseIds, registerResource } from '../resource'
import { likeAny } from '../util'
import {
  metaColumnTable,
  metaTableTable,
  reportTable,
  subjectTable,
  taskTemplateTable
} from '../db/cr'

/* ==================================================================
 * 主题域
 * ================================================================== */
registerResource({
  prefix: '/cr/subject',
  table: subjectTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    likeAny(row, ['subjectCode', 'subjectName'], params.keyword || params.subjectName),
  toSimple: (row) => ({ id: row.id, name: row.subjectName, code: row.subjectCode }),
  exportColumns: [
    { field: 'id', label: '编号' },
    { field: 'subjectCode', label: '主题域编码' },
    { field: 'subjectName', label: '主题域名称' },
    { field: 'tableCount', label: '表数量' },
    { field: 'remark', label: '备注' }
  ]
})

/* ==================================================================
 * 表管理
 * ================================================================== */
registerResource({
  prefix: '/cr/meta-table',
  table: metaTableTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.subjectId && Number(row.subjectId) !== Number(params.subjectId)) return false
    if (
      params.reportFlag !== undefined &&
      params.reportFlag !== '' &&
      String(row.reportFlag) !== String(params.reportFlag)
    )
      return false
    if (
      params.status !== undefined &&
      params.status !== '' &&
      Number(row.status) !== Number(params.status)
    )
      return false
    return likeAny(row, ['tableCode', 'tableName', 'cnName'], params.keyword || params.tableName)
  },
  toSimple: (row) => ({ id: row.id, name: row.cnName, code: row.tableCode }),
  exportColumns: [
    { field: 'id', label: '编号' },
    { field: 'tableCode', label: '表编码' },
    { field: 'tableName', label: '表名称' },
    { field: 'cnName', label: '中文表名' },
    { field: 'subjectName', label: '所属主题域' }
  ]
})

/* ==================================================================
 * 列管理
 * ================================================================== */
registerResource({
  prefix: '/cr/meta-column',
  table: metaColumnTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.tableId && Number(row.tableId) !== Number(params.tableId)) return false
    if (params.desensitizeRule === 'NONE') {
      if (row.desensitizeRule) return false
    } else if (params.desensitizeRule && row.desensitizeRule !== params.desensitizeRule) {
      return false
    }
    return likeAny(row, ['columnCode', 'columnName', 'cnName'], params.keyword || params.columnName)
  },
  toSimple: (row) => ({ id: row.id, name: row.cnName, code: row.columnCode }),
  exportColumns: [
    { field: 'id', label: '编号' },
    { field: 'columnCode', label: '字段编码' },
    { field: 'columnName', label: '字段名称' },
    { field: 'cnName', label: '字段中文名' },
    { field: 'dataType', label: '数据类型' }
  ]
})

/* ==================================================================
 * 报表（表样）
 * ================================================================== */
registerResource({
  prefix: '/cr/report',
  table: reportTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.subjectId && Number(row.subjectId) !== Number(params.subjectId)) return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    return likeAny(row, ['reportCode', 'reportName'], params.keyword || params.reportName)
  },
  toSimple: (row) => ({
    id: row.id,
    name: row.reportName,
    code: row.reportCode,
    freq: row.freq,
    subjectId: row.subjectId,
    subjectName: row.subjectName
  }),
  exportColumns: [
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'subjectName', label: '所属主题域' },
    { field: 'tableName', label: '对应数据表' }
  ]
})

/* ==================================================================
 * 报表任务模板
 * ================================================================== */
registerResource({
  prefix: '/cr/task-template',
  table: taskTemplateTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (
      params.status !== undefined &&
      params.status !== '' &&
      Number(row.status) !== Number(params.status)
    )
      return false
    if (params.period && !String(row.period).includes(String(params.period))) return false
    return likeAny(row, ['templateCode', 'templateName'], params.keyword || params.templateName)
  },
  exportColumns: [
    { field: 'templateCode', label: '任务编码' },
    { field: 'templateName', label: '任务名称' },
    { field: 'period', label: '报送期次' },
    { field: 'reportCount', label: '报表数量' },
    { field: 'deadline', label: '截止日期' },
    { field: 'status', label: '状态' }
  ]
})

/** 任务模板下的报表明细 */
onGet('/cr/task-template/report-list', (ctx) => {
  const template = taskTemplateTable.get(Number(ctx.params.id))
  if (!template) throw new Error('任务模板不存在')
  return reportTable.all().filter((report) => template.reportIds.includes(report.id))
})

/** 模板已选报表 id（用于"添加报表"弹窗回显） */
onGet('/cr/task-template/report-ids', (ctx) => {
  const template = taskTemplateTable.get(Number(ctx.params.id))
  return template ? template.reportIds : []
})

/**
 * 保存模板下的报表。
 * 频度必须与报表频度一致，否则不允许添加 —— 对齐附件文档的功能约束。
 */
onPut('/cr/task-template/update-reports', (ctx) => {
  const { id, reportIds } = ctx.body || {}
  const template = taskTemplateTable.get(Number(id))
  if (!template) throw new Error('任务模板不存在')
  const ids = parseIds(reportIds)
  const reports = reportTable.all().filter((report) => ids.includes(report.id))
  const mismatch = reports.filter((report) => report.freq !== template.freq)
  if (mismatch.length) {
    throw new Error(
      `以下报表频度与任务频度不一致，无法添加：${mismatch.map((r) => r.reportName).join('、')}`
    )
  }
  taskTemplateTable.update({
    id: template.id,
    reportIds: ids,
    reportCount: ids.length
  })
  return true
})

/** 移除模板中的某张报表 */
onPut('/cr/task-template/remove-report', (ctx) => {
  const { id, reportId } = ctx.body || {}
  const template = taskTemplateTable.get(Number(id))
  if (!template) throw new Error('任务模板不存在')
  const reportIds = template.reportIds.filter((item) => item !== Number(reportId))
  taskTemplateTable.update({ id: template.id, reportIds, reportCount: reportIds.length })
  return true
})

/* ==================================================================
 * 通用辅助接口
 * ================================================================== */
onGet('/cr/common/subject-options', () =>
  subjectTable.all().map((row) => ({ id: row.id, name: row.subjectName }))
)

onGet('/cr/common/report-options', (ctx) => {
  const freq = ctx.params.freq
  return reportTable
    .all()
    .filter((row) => (freq ? row.freq === Number(freq) : true))
    .map((row) => ({
      id: row.id,
      name: row.reportName,
      code: row.reportCode,
      // 同时给出报表页惯用的字段名，避免下拉选项在表格里显示为空
      reportCode: row.reportCode,
      reportName: row.reportName,
      freq: row.freq,
      subjectId: row.subjectId,
      subjectName: row.subjectName
    }))
})

export { byIds, type MockContext }
