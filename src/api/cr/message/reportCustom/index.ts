import request from '@/config/axios'

/** 报表定制 VO */
export interface ReportCustomVO {
  id?: number
  /** 定制编码 */
  customCode: string
  /** 定制名称 */
  customName: string
  reportId?: number
  reportCode: string
  reportName: string
  /** 数据频度，见字典 cr_report_freq */
  freq: number
  /** 取数数据表 */
  dataTableId?: number
  dataTableCode: string
  dataTableName: string
  /** 定制字段数 */
  columnCount: number
  /** 取数范围说明 */
  dataScope: string
  version: string
  effectDate: string
  status: number
  remark: string
  createTime?: string
}

/** 定制字段明细 VO */
export interface ReportCustomItemVO {
  id?: number
  customId?: number
  columnCode: string
  columnName: string
  cnName: string
  dataType: string
  required: boolean
  /** 加工方式：DIRECT 直接取值 / SUM 汇总 / COUNT 计数 / CODE 码值转换 */
  transform: string
  sortNo?: number
  remark: string
}

/** 可定制字段（含已选标识） */
export interface ColumnOptionVO {
  columnCode: string
  columnName: string
  cnName: string
  dataType: string
  required: boolean
  selected: boolean
  transform: string
  sortNo: number
  remark: string
}

export interface ColumnOptionResultVO {
  customId: number
  dataTableId: number
  dataTableCode: string
  dataTableName: string
  options: ColumnOptionVO[]
}

// 分页查询报表定制
export const getReportCustomPage = (params: any) => {
  return request.get({ url: '/cr/report-custom/page', params })
}

// 查询报表定制详情
export const getReportCustom = (id: number) => {
  return request.get({ url: '/cr/report-custom/get?id=' + id })
}

// 新增报表定制
export const createReportCustom = (data: ReportCustomVO) => {
  return request.post({ url: '/cr/report-custom/create', data })
}

// 修改报表定制
export const updateReportCustom = (data: ReportCustomVO) => {
  return request.put({ url: '/cr/report-custom/update', data })
}

// 删除报表定制
export const deleteReportCustom = (id: number) => {
  return request.delete({ url: '/cr/report-custom/delete?id=' + id })
}

// 批量删除报表定制
export const deleteReportCustomList = (ids: number[]) => {
  return request.delete({ url: '/cr/report-custom/delete-list', params: { ids: ids.join(',') } })
}

// 导出报表定制
export const exportReportCustom = (params: any) => {
  return request.download({ url: '/cr/report-custom/export-excel', params })
}

// 查询定制字段明细
export const getReportCustomItems = (id: number) => {
  return request.get({ url: '/cr/report-custom/items?id=' + id })
}

// 查询可定制字段（含是否已选）
export const getColumnOptions = (id: number) => {
  return request.get({ url: '/cr/report-custom/column-options?id=' + id })
}

// 保存定制字段
export const updateReportCustomItems = (id: number, items: ReportCustomItemVO[]) => {
  return request.put({ url: '/cr/report-custom/update-items', data: { id, items } })
}
