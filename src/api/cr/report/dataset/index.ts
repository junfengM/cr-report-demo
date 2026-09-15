import request from '@/config/axios'

/** 数据集 VO */
export interface ReportDatasetVO {
  id?: number
  datasetCode: string
  datasetName: string
  /** 1 数据表 / 2 SQL */
  sourceType: number
  datasourceId: number
  datasourceName?: string
  tableCode: string
  sqlText: string
  /** 取数来源标识：task / fillRecord / importTask / checkResult / submitStatus */
  previewSource: string
  fields: Array<{ name: string; label: string; type: string }>
  rowCount?: number
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询数据集
export const getPage = (params: any) => {
  return request.get({ url: '/cr/report-dataset/page', params })
}

// 查询数据集详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/report-dataset/get?id=' + id })
}

// 新增数据集
export const create = (data: ReportDatasetVO) => {
  return request.post({ url: '/cr/report-dataset/create', data })
}

// 修改数据集
export const update = (data: ReportDatasetVO) => {
  return request.put({ url: '/cr/report-dataset/update', data })
}

// 删除数据集
export const remove = (id: number) => {
  return request.delete({ url: '/cr/report-dataset/delete?id=' + id })
}

// 批量删除数据集
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/report-dataset/delete-list', params: { ids: ids.join(',') } })
}

// 导出数据集
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/report-dataset/export-excel', params })
}

/** 数据集预览结果 */
export interface DatasetPreviewVO {
  datasetId: number
  datasetName: string
  tableCode: string
  source: string
  total: number
  limit: number
  columns: Array<{ prop: string; label: string; type?: string }>
  rows: Array<Record<string, any>>
  note: string
}

// 数据预览（只读计算：真的去读业务表）
export const previewDataset = (id: number, limit = 20) => {
  return request.post({ url: '/cr/report-dataset/preview', data: { id, limit } })
}

// 数据集下拉（带字段清单，报表维护表单联动用）
export const getDatasetOptions = (datasourceId?: number) => {
  return request.get({ url: '/cr/report-dataset/simple-list-all', params: { datasourceId } })
}

// 取数来源 / 展示方式口径
export const getDatasetMeta = () => {
  return request.get({ url: '/cr/report-dataset/source-options' })
}
