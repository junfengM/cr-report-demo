import request from '@/config/axios'

/** 报文集 VO */
export interface ReportSetVO {
  id?: number
  setCode: string
  setName: string
  freq: number
  period: string
  /** 报送机构范围：ALL 或机构 id 逗号串 */
  orgScope: string
  orgNames: string
  messageId?: number
  messageCode: string
  reportIds: number[]
  reportCount: number
  compress: boolean
  status: number
  remark: string
  createTime?: string
}

/** 报文集内报表明细 VO */
export interface ReportSetItemVO {
  seq: number
  reportId: number
  reportCode: string
  reportName: string
  freq: number
  tableCode: string
  tableName: string
  columnCount: number
}

/** 报文集生成预览 VO */
export interface ReportSetPreviewVO {
  setId: number
  setCode: string
  setName: string
  period: string
  orgCount: number
  reportCount: number
  fileCount: number
  skipCount: number
  createCount: number
  updateCount: number
  estimateRows: number
  estimateBytes: number
  orgNames: string[]
  reportNames: string[]
  skipNames: string[]
}

/** 报文集生成结果 VO */
export interface ReportSetGenerateVO {
  setCode: string
  setName: string
  period: string
  created: number
  updated: number
  skipped: number
  fileCount: number
  messageCode: string
}

// 分页查询报文集
export const getReportSetPage = (params: any) => {
  return request.get({ url: '/cr/report-set/page', params })
}

// 查询报文集详情
export const getReportSet = (id: number) => {
  return request.get({ url: '/cr/report-set/get?id=' + id })
}

// 新增报文集
export const createReportSet = (data: ReportSetVO) => {
  return request.post({ url: '/cr/report-set/create', data })
}

// 修改报文集
export const updateReportSet = (data: ReportSetVO) => {
  return request.put({ url: '/cr/report-set/update', data })
}

// 删除报文集
export const deleteReportSet = (id: number) => {
  return request.delete({ url: '/cr/report-set/delete?id=' + id })
}

// 批量删除报文集
export const deleteReportSetList = (ids: number[]) => {
  return request.delete({ url: '/cr/report-set/delete-list', params: { ids: ids.join(',') } })
}

// 导出报文集
export const exportReportSet = (params: any) => {
  return request.download({ url: '/cr/report-set/export-excel', params })
}

// 查询报文集下的报表明细
export const getReportSetItems = (id: number) => {
  return request.get({ url: '/cr/report-set/report-list?id=' + id })
}

// 生成预览
export const getReportSetPreview = (id: number) => {
  return request.get({ url: '/cr/report-set/generate-preview?id=' + id })
}

// 按报文集生成报文（写入报文状态查询）
export const generateReportSet = (id: number) => {
  return request.post({ url: '/cr/report-set/generate', data: { id } })
}
