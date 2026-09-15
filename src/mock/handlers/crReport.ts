/**
 * Mock Handler — 报表功能：数据源 / 数据集 / 报表维护
 *
 * 三组标准 CRUD（写操作仅系统管理员）+ 三个"真干活"的接口：
 *   POST /cr/report-datasource/test    连接测试：确定性模拟握手，把结论写回数据源行（会落库 → 判管理员）
 *   POST /cr/report-dataset/preview    数据集预览：**真的从业务表取数**，按登记的字段清单裁剪
 *   POST /cr/report-design/preview     报表预览：拿数据集的行按维度分组、对度量求和，产出表格 + 图表数据
 *
 * 后两个是只读计算（POST 只是因为要传对象），不写任何数据，因此不列入写接口门禁清单。
 */
import { onGet, onPost } from '../route'
import { registerResource } from '../resource'
import { assertAdmin } from './guards'
import { formatDateTime, likeAny } from '../util'
import { reportOptions } from '../db/crCommon'
import { crTaskTable } from '../db/crTask'
import { crFillRecordTable } from '../db/crData'
import { importTaskTable } from '../db/crCollect'
import { crCheckResultTable } from '../db/crCheck'
import { crSubmitStatusTable } from '../db/crSubmit'
import {
  CHART_TYPE_LABEL,
  DB_TYPE_LABEL,
  DIMENSION_VALUE_LABEL,
  DS_TYPE_LABEL,
  PREVIEW_SOURCE_LABEL,
  SOURCE_TYPE_LABEL,
  reportDatasetTable,
  reportDatasourceTable,
  reportDesignTable,
  type ReportDatasetRow,
  type ReportDatasourceRow,
  type ReportDesignRow
} from '../db/crReport'

const PREVIEW_SOURCES: Record<string, () => Array<Record<string, any>>> = {
  task: () => crTaskTable.all(),
  fillRecord: () => crFillRecordTable.all(),
  importTask: () => importTaskTable.all(),
  checkResult: () => crCheckResultTable.all(),
  submitStatus: () => crSubmitStatusTable.all()
}

const sourceRows = (dataset: ReportDatasetRow): Array<Record<string, any>> => {
  const loader = PREVIEW_SOURCES[dataset.previewSource]
  if (!loader) throw new Error('数据集的取数来源未登记或不支持：' + dataset.previewSource)
  return loader()
}

const requireDataset = (id: any): ReportDatasetRow => {
  const dataset = reportDatasetTable.get(Number(id))
  if (!dataset) throw new Error('数据集不存在：id=' + id)
  return dataset
}

/* ==================================================================
 * 数据源
 * ================================================================== */
registerResource<ReportDatasourceRow>({
  prefix: '/cr/report-datasource',
  table: reportDatasourceTable,
  guard: (ctx, action) => assertAdmin(ctx, '数据源' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.dsType === undefined ||
      params.dsType === '' ||
      Number(row.dsType) === Number(params.dsType)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['dsCode', 'dsName', 'connText', 'owner', 'remark'], params.keyword),
  beforeCreate: (body) => fillDatasource(body),
  beforeUpdate: (body) => fillDatasource(body),
  exportColumns: [
    { field: 'dsCode', label: '数据源代码' },
    { field: 'dsName', label: '数据源名称' },
    { field: 'connText', label: '连接信息（脱敏）' },
    { field: 'lastTestResult', label: '最近测试结论' },
    { field: 'lastTestTime', label: '最近测试时间' },
    { field: 'remark', label: '备注' }
  ]
})

function fillDatasource(body: any): Partial<ReportDatasourceRow> {
  const dsCode = String(body.dsCode || '').trim()
  const dsName = String(body.dsName || '').trim()
  if (!dsCode) throw new Error('请填写数据源代码')
  if (!dsName) throw new Error('请填写数据源名称')
  const dsType = Number(body.dsType || 1)
  if (!DS_TYPE_LABEL[dsType]) throw new Error('数据源类型非法（应为 数据库 / 文件目录 / 接口）')
  const dbType = Number(body.dbType === undefined || body.dbType === '' ? 0 : body.dbType)
  if (!(dbType in DB_TYPE_LABEL)) throw new Error('数据库类型非法')
  const connText = String(body.connText || '').trim()
  if (!connText) throw new Error('请填写连接信息')
  const duplicated = reportDatasourceTable
    .all()
    .some((row) => row.dsCode === dsCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('数据源代码已存在：' + dsCode)
  return {
    dsCode,
    dsName,
    dsType,
    dbType,
    connText,
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    owner: String(body.owner || '信息技术部'),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 连接测试：确定性模拟（同一个数据源每次结果一致），失败分支留给"监管回执接口"那条 */
onPost('/cr/report-datasource/test', (ctx) => {
  assertAdmin(ctx, '数据源连接测试')
  const row = reportDatasourceTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('数据源不存在：id=' + ctx.body?.id)
  const failed = row.dsType === 3 && row.status === 0
  const cost = failed ? 3000 : 40 + ((row.id * 17) % 80)
  const rows = failed ? 0 : row.dsType === 1 ? 1200 + row.id * 86 : 0
  const result = failed
    ? '连接超时（演示分支：对端接口不可达，请确认监管侧窗口期与白名单）'
    : '连接成功：' +
      DS_TYPE_LABEL[row.dsType] +
      (row.dbType ? ' / ' + DB_TYPE_LABEL[row.dbType] : '') +
      '，握手耗时 ' +
      cost +
      ' ms' +
      (rows ? '，预计可抽取 ' + rows + ' 行' : '')
  const updated = {
    lastTestTime: formatDateTime(),
    lastTestResult: result,
    lastTestRows: rows,
    lastTestCost: cost
  }
  reportDatasourceTable.update({ id: row.id, ...updated })
  return { ...updated, dsName: row.dsName }
})

/* ==================================================================
 * 数据集
 * ================================================================== */
registerResource<ReportDatasetRow>({
  prefix: '/cr/report-dataset',
  table: reportDatasetTable,
  guard: (ctx, action) => assertAdmin(ctx, '数据集' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.datasourceId === undefined ||
      params.datasourceId === '' ||
      Number(row.datasourceId) === Number(params.datasourceId)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['datasetCode', 'datasetName', 'tableCode', 'sqlText', 'remark'], params.keyword),
  beforeCreate: (body) => fillDataset(body),
  beforeUpdate: (body) => fillDataset(body),
  // 参考行数当场现算：它表示「按当前业务表取数会有多少行」，存快照会随业务数据增长变成假的
  toListRow: (row) => ({ ...row, rowCount: sourceRows(row).length }),
  exportColumns: [
    { field: 'datasetCode', label: '数据集编码' },
    { field: 'datasetName', label: '数据集名称' },
    { field: 'datasourceName', label: '数据源' },
    {
      field: 'sourceType',
      label: '取数方式',
      formatter: (row) => SOURCE_TYPE_LABEL[Number(row.sourceType)] || row.sourceType
    },
    {
      field: 'previewSource',
      label: '取数来源',
      formatter: (row) => PREVIEW_SOURCE_LABEL[row.previewSource] || row.previewSource
    },
    {
      field: 'rowCount',
      label: '参考行数',
      formatter: (row) => sourceRows(row).length
    },
    { field: 'remark', label: '备注' }
  ]
})

function fillDataset(body: any): Partial<ReportDatasetRow> {
  const datasetCode = String(body.datasetCode || '').trim()
  const datasetName = String(body.datasetName || '').trim()
  if (!datasetCode) throw new Error('请填写数据集编码')
  if (!datasetName) throw new Error('请填写数据集名称')
  const datasource = reportDatasourceTable.get(Number(body.datasourceId))
  if (!datasource) throw new Error('请选择有效的数据源')
  const sourceType = Number(body.sourceType || 1)
  if (!SOURCE_TYPE_LABEL[sourceType]) throw new Error('取数方式非法（应为 数据表 / SQL）')
  const tableCode = String(body.tableCode || '').trim()
  if (!tableCode) throw new Error('请填写取数来源（表名）')
  const sqlText = String(body.sqlText || '').trim()
  if (sourceType === 2 && !sqlText) throw new Error('取数方式为 SQL 时必须填写 SQL')
  const previewSource = String(body.previewSource || '').trim()
  if (!PREVIEW_SOURCES[previewSource]) {
    throw new Error('取数来源标识非法（可选：' + Object.keys(PREVIEW_SOURCES).join(' / ') + '）')
  }
  const fields = Array.isArray(body.fields) ? body.fields : []
  if (!fields.length) throw new Error('字段清单不能为空，至少要登记一个字段')
  const duplicated = reportDatasetTable
    .all()
    .some((row) => row.datasetCode === datasetCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('数据集编码已存在：' + datasetCode)
  return {
    datasetCode,
    datasetName,
    sourceType,
    datasourceId: datasource.id,
    datasourceName: datasource.dsName,
    tableCode,
    sqlText,
    previewSource,
    fields: fields.map((field: any) => ({
      name: String(field.name || ''),
      label: String(field.label || field.name || ''),
      type: String(field.type || 'string')
    })),
    rowCount: sourceRows({ previewSource } as ReportDatasetRow).length,
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/**
 * 数据集预览：真的去读业务表。
 * limit 缺省 20 行；**显式传 0 表示不限制**（仍受 200 行上限保护）；
 * 非法值直接报错 —— 以前 `limit || 20` 会把 0 当成没传，调用方以为自己拿了全部数据。
 */
onPost('/cr/report-dataset/preview', (ctx) => {
  const dataset = requireDataset(ctx.body?.id)
  const rawLimit = ctx.body?.limit
  const asked =
    rawLimit === undefined || rawLimit === null || rawLimit === '' ? 20 : Number(rawLimit)
  if (Number.isNaN(asked) || asked < 0) {
    throw new Error('预览行数非法（应为 0~200 的整数，0 表示不限制）')
  }
  const limit = Math.min(asked, 200)
  const all = sourceRows(dataset)
  const columns = dataset.fields.map((field) => ({
    prop: field.name,
    label: field.label,
    type: field.type
  }))
  const rows = (limit === 0 ? all : all.slice(0, limit)).map((row) => {
    const picked: Record<string, any> = {}
    dataset.fields.forEach((field) => (picked[field.name] = row[field.name]))
    return picked
  })
  return {
    datasetId: dataset.id,
    datasetName: dataset.datasetName,
    tableCode: dataset.tableCode,
    source: dataset.sourceType === 2 ? 'SQL：' + dataset.sqlText : '数据表：' + dataset.tableCode,
    total: all.length,
    limit,
    columns,
    rows,
    note:
      '预览取的是当前系统里的真实数据（共 ' +
      all.length +
      ' 行，这里展示' +
      (limit === 0 ? '全部 ' : '前 ') +
      rows.length +
      ' 行）'
  }
})

/* ==================================================================
 * 报表维护
 * ================================================================== */
registerResource<ReportDesignRow>({
  prefix: '/cr/report-design',
  table: reportDesignTable,
  guard: (ctx, action) => assertAdmin(ctx, '报表' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.chartType === undefined ||
      params.chartType === '' ||
      Number(row.chartType) === Number(params.chartType)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['reportCode', 'reportName', 'datasetName', 'remark'], params.keyword),
  beforeCreate: (body) => fillDesign(body),
  beforeUpdate: (body) => fillDesign(body),
  exportColumns: [
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'datasetName', label: '数据集' },
    {
      field: 'chartType',
      label: '展示方式',
      formatter: (row) => CHART_TYPE_LABEL[Number(row.chartType)] || row.chartType
    },
    { field: 'dimensionField', label: '维度字段' },
    {
      field: 'measureFields',
      label: '度量字段',
      formatter: (row) =>
        (row.measureFields || []).length ? row.measureFields.join('、') : '记录数'
    },
    { field: 'filterText', label: '筛选条件' },
    { field: 'remark', label: '备注' }
  ]
})

function fillDesign(body: any): Partial<ReportDesignRow> {
  const reportCode = String(body.reportCode || '').trim()
  const reportName = String(body.reportName || '').trim()
  if (!reportCode) throw new Error('请填写报表编码')
  if (!reportName) throw new Error('请填写报表名称')
  const dataset = requireDataset(body.datasetId)
  const chartType = Number(body.chartType || 1)
  if (!CHART_TYPE_LABEL[chartType]) throw new Error('展示方式非法（表格 / 柱状图 / 折线图 / 饼图）')
  const dimensionField = String(body.dimensionField || '').trim()
  if (!dimensionField) throw new Error('请选择维度字段')
  const known = dataset.fields.map((field) => field.name)
  if (known.indexOf(dimensionField) < 0) {
    throw new Error(
      '维度字段「' + dimensionField + '」不在数据集「' + dataset.datasetName + '」的字段清单里'
    )
  }
  const measureFields = Array.isArray(body.measureFields)
    ? body.measureFields.map((name: any) => String(name))
    : []
  const unknown = measureFields.find((name) => known.indexOf(name) < 0)
  if (unknown) throw new Error('度量字段「' + unknown + '」不在数据集的字段清单里')
  const duplicated = reportDesignTable
    .all()
    .some((row) => row.reportCode === reportCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('报表编码已存在：' + reportCode)
  return {
    reportCode,
    reportName,
    datasetId: dataset.id,
    datasetName: dataset.datasetName,
    chartType,
    dimensionField,
    measureFields,
    filterText: String(body.filterText || ''),
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 报表预览：按维度分组、对度量求和（没有度量时按条数计数）—— 真算，不是写死的示例 */
onPost('/cr/report-design/preview', (ctx) => {
  const design = reportDesignTable.get(Number(ctx.body?.id))
  if (!design) throw new Error('报表不存在：id=' + ctx.body?.id)
  const dataset = requireDataset(design.datasetId)
  const all = sourceRows(dataset)
  const labelMap = DIMENSION_VALUE_LABEL[design.dimensionField] || {}
  const dimensionField = dataset.fields.find((field) => field.name === design.dimensionField)
  // 防御：设计里的维度 / 度量必须属于该数据集的字段清单。
  // 以前不校验就直接 Number(row[name]) || 0 求和，字段名对不上会静默出一张全 0 的表（种子 1 踩过：任务明细没有 rowCount）。
  if (!dimensionField) {
    throw new Error(
      '维度字段「' +
        design.dimensionField +
        '」不在数据集「' +
        dataset.datasetName +
        '」的字段清单里，请重新选择维度'
    )
  }
  const unknownMeasure = design.measureFields.find(
    (name) => !dataset.fields.some((field) => field.name === name)
  )
  if (unknownMeasure) {
    throw new Error(
      '度量字段「' +
        unknownMeasure +
        '」不在数据集「' +
        dataset.datasetName +
        '」的字段清单里，请重新选择度量'
    )
  }
  const measures = design.measureFields.length ? design.measureFields : ['__count__']
  const groups = new Map<string, { label: string; values: Record<string, number>; count: number }>()
  all.forEach((row) => {
    const raw = String(row[design.dimensionField] ?? '（空）')
    const label = labelMap[raw] || raw
    if (!groups.has(raw)) {
      groups.set(raw, {
        label,
        values: measures.reduce(
          (acc, name) => ({ ...acc, [name]: 0 }),
          {} as Record<string, number>
        ),
        count: 0
      })
    }
    const group = groups.get(raw)!
    group.count += 1
    design.measureFields.forEach((name) => {
      group.values[name] = (group.values[name] || 0) + (Number(row[name]) || 0)
    })
  })
  const columnLabels: Record<string, string> = {}
  dataset.fields.forEach((field) => (columnLabels[field.name] = field.label))
  const measureColumns = measures.map((name) => ({
    prop: name,
    label: name === '__count__' ? '记录数' : '合计 ' + (columnLabels[name] || name)
  }))
  const rows = Array.from(groups.values())
    .map((group) => ({
      dimension: group.label,
      ...measures.reduce(
        (acc, name) => ({
          ...acc,
          [name]: name === '__count__' ? group.count : group.values[name]
        }),
        {}
      )
    }))
    .sort((a, b) => {
      const first = measures[0]
      return Number(b[first] || 0) - Number(a[first] || 0)
    })
  return {
    reportId: design.id,
    reportName: design.reportName,
    chartType: design.chartType,
    chartTypeLabel: CHART_TYPE_LABEL[design.chartType],
    datasetName: dataset.datasetName,
    dimensionLabel: dimensionField ? dimensionField.label : design.dimensionField,
    columns: [
      { prop: 'dimension', label: dimensionField ? dimensionField.label : '维度' },
      ...measureColumns
    ],
    rows,
    chart: {
      categories: rows.map((row) => row.dimension),
      series: measures.map((name) => ({
        name: name === '__count__' ? '记录数' : columnLabels[name] || name,
        data: rows.map((row) => Number(row[name] || 0))
      }))
    },
    sourceRows: all.length,
    generatedAt: formatDateTime(),
    note:
      '口径：取数据集「' +
      dataset.datasetName +
      '」当前全部 ' +
      all.length +
      ' 行，按「' +
      (dimensionField ? dimensionField.label : design.dimensionField) +
      '」分组，' +
      (design.measureFields.length
        ? '对 ' + design.measureFields.join('、') + ' 求和'
        : '按条数计数') +
      (design.filterText ? '；登记过滤条件：' + design.filterText + '（仅登记，未解析）' : '')
  }
})

/** 下拉：数据源 / 数据集（表单联动用） */
onGet('/cr/report-datasource/simple-list-all', () =>
  reportDatasourceTable
    .all()
    .filter((row) => row.status === 1)
    .map((row) => ({ id: row.id, name: row.dsName, dsCode: row.dsCode }))
)

onGet('/cr/report-dataset/simple-list-all', (ctx) =>
  reportDatasetTable
    .all()
    .filter((row) => row.status === 1)
    .filter(
      (row) =>
        !ctx.params.datasourceId || Number(row.datasourceId) === Number(ctx.params.datasourceId)
    )
    .map((row) => ({
      id: row.id,
      name: row.datasetName,
      datasetCode: row.datasetCode,
      fields: row.fields
    }))
)

/** 取数来源选项（新建数据集时选，中文名由服务端给） */
onGet('/cr/report-dataset/source-options', () => ({
  sources: Object.keys(PREVIEW_SOURCES).map((key) => ({
    value: key,
    label: PREVIEW_SOURCE_LABEL[key] || key
  })),
  chartTypes: Object.keys(CHART_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: CHART_TYPE_LABEL[Number(key)]
  })),
  reports: reportOptions().map((report) => ({ id: report.id, name: report.reportName }))
}))
