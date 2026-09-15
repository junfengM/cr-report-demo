import request from '@/config/axios'

/** 报文上报状态 VO（机构 × 报表 × 期次） */
export interface SubmitStatusVO {
  id?: number
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
  /** 上报状态：0 待生成 / 1 已生成 / 2 上报中 / 3 上报成功 / 4 上报失败 / 5 已回执 */
  submitStatus: number
  generateTime: string
  submitTime: string
  /** 监管回执号 */
  receiptNo: string
  /** 失败原因 */
  failReason: string
  batchNo: string
  /** 报文数据行数 */
  dataRows: number
  remark: string
}

/** 监管回执详情 */
export interface SubmitReceiptVO {
  receiptNo: string
  orgName: string
  reportName: string
  reportCode: string
  period: string
  fileName: string
  fileSize: number
  reportType: string
  submitTime: string
  receiptTime: string
  receiver: string
  result: string
  records: number
  message: string
  items: Array<{ name: string; result: string; remark: string }>
}

/** 机构下拉选项 */
export interface SubmitOrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

/** 报表下拉选项 */
export interface SubmitReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

// 分页查询报文上报状态
export const getSubmitStatusPage = (params: any) => {
  return request.get({ url: '/cr/submit-status/page', params })
}

// 查询报文上报状态详情
export const getSubmitStatus = (id: number) => {
  return request.get({ url: '/cr/submit-status/get?id=' + id })
}

// 重新上报
export const reportSubmitStatus = (id: number) => {
  return request.put({ url: '/cr/submit-status/report', data: { id } })
}

// 下载报文文件
export const downloadSubmitFile = (id: number) => {
  return request.download({ url: '/cr/submit-status/download', params: { id } })
}

// 查看监管回执
export const getSubmitReceipt = (id: number) => {
  return request.get({ url: '/cr/submit-status/receipt', params: { id } })
}

// 报送机构下拉选项
export const getSubmitStatusOrgOptions = () => {
  return request.get({ url: '/cr/submit-status/org-options' })
}

// 报表下拉选项
export const getSubmitStatusReportOptions = () => {
  return request.get({ url: '/cr/submit-status/report-options' })
}

// 期次下拉选项
export const getSubmitStatusPeriodOptions = () => {
  return request.get({ url: '/cr/submit-status/period-options' })
}
