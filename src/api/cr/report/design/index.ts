import request from '@/config/axios'

/** 报表 VO */
export interface ReportDesignVO {
  id?: number
  reportCode: string
  reportName: string
  datasetId: number
  datasetName?: string
  /** 1 表格 / 2 柱状图 / 3 折线图 / 4 饼图 */
  chartType: number
  dimensionField: string
  measureFields: string[]
  filterText: string
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询报表
export const getPage = (params: any) => {
  return request.get({ url: '/cr/report-design/page', params })
}

// 查询报表详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/report-design/get?id=' + id })
}

// 新增报表
export const create = (data: ReportDesignVO) => {
  return request.post({ url: '/cr/report-design/create', data })
}

// 修改报表
export const update = (data: ReportDesignVO) => {
  return request.put({ url: '/cr/report-design/update', data })
}

// 删除报表
export const remove = (id: number) => {
  return request.delete({ url: '/cr/report-design/delete?id=' + id })
}

// 批量删除报表
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/report-design/delete-list', params: { ids: ids.join(',') } })
}

// 导出报表
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/report-design/export-excel', params })
}

/** 报表预览结果 */
export interface ReportPreviewVO {
  reportId: number
  reportName: string
  chartType: number
  chartTypeLabel: string
  datasetName: string
  dimensionLabel: string
  columns: Array<{ prop: string; label: string }>
  rows: Array<Record<string, any>>
  chart: { categories: string[]; series: Array<{ name: string; data: number[] }> }
  sourceRows: number
  generatedAt: string
  note: string
}

// 报表预览（只读计算：拿数据集的行按维度分组、对度量求和）
export const previewReport = (id: number) => {
  return request.post({ url: '/cr/report-design/preview', data: { id } })
}
