import request from '@/config/axios'

/** 数据校验状态 VO（机构 × 报表 × 期次） */
export interface CheckStatusVO {
  id?: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 校验状态，见字典 cr_check_status */
  checkStatus: number
  checkTime: string
  /** 耗时（秒） */
  costTime: number
  passCount: number
  warnCount: number
  errorCount: number
  taskNo: string
  remark: string
}

/** 机构下拉选项 */
export interface CheckOrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

/** 报表下拉选项 */
export interface CheckReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

// 分页查询数据校验状态
export const getCheckStatusPage = (params: any) => {
  return request.get({ url: '/cr/check-status/page', params })
}

// 查询数据校验状态详情
export const getCheckStatus = (id: number) => {
  return request.get({ url: '/cr/check-status/get?id=' + id })
}

// 重新校验
export const recheckCheckStatus = (id: number) => {
  return request.put({ url: '/cr/check-status/recheck', data: { id } })
}

// 重置数据
export const resetCheckStatus = (id: number) => {
  return request.put({ url: '/cr/check-status/reset', data: { id } })
}

// 导出数据校验状态
export const exportCheckStatus = (params: any) => {
  return request.download({ url: '/cr/check-status/export-excel', params })
}

// 报送机构下拉选项
export const getCheckStatusOrgOptions = () => {
  return request.get({ url: '/cr/check-status/org-options' })
}

// 报表下拉选项
export const getCheckStatusReportOptions = () => {
  return request.get({ url: '/cr/check-status/report-options' })
}
