import request from '@/config/axios'

/** 错误原因填报 VO */
export interface AuditReasonVO {
  id?: number
  /** 关联审核批次 */
  batchId: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  rowNo: number
  policyNo: string
  /** 数据定位，如「第 128 行 / 保单号 P2026080012」 */
  location: string
  columnCode: string
  columnName: string
  /** 原值 */
  originalValue: string
  /** 问题类型，见字典 cr_rule_type */
  issueType: number
  /** 错误级别，见字典 cr_error_level */
  errorLevel: number
  /** 审核意见 */
  auditOpinion: string
  auditUser: string
  auditTime: string
  /** 要求回复期限 */
  deadline: string
  /** 处理状态：0 待填报 / 1 已填报 / 2 已确认 */
  status: number
  /** 错误原因说明（至少 10 个字） */
  reason: string
  fillUser: string
  fillTime: string
  confirmUser: string
  confirmTime: string
  createTime?: string
}

/** 机构下拉选项 */
export interface AuditOrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

/** 报表下拉选项 */
export interface AuditReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

/** 处理状态计数（tabs 徽标） */
export interface AuditReasonStatusCountVO {
  status: number | ''
  count: number
}

// 分页查询错误原因填报任务
export const getAuditReasonPage = (params: any) => {
  return request.get({ url: '/cr/audit-reason/page', params })
}

// 查询错误原因填报详情
export const getAuditReason = (id: number) => {
  return request.get({ url: '/cr/audit-reason/get?id=' + id })
}

// 提交错误原因（填报人，原因少于 10 个字会被 mock 拒绝）
export const submitAuditReason = (data: { id: number; reason: string }) => {
  return request.put({ url: '/cr/audit-reason/submit', data })
}

// 确认错误原因（审核人，可批量）
export const confirmAuditReason = (ids: number[]) => {
  return request.put({ url: '/cr/audit-reason/confirm', data: { ids } })
}

// 处理状态计数
export const getAuditReasonStatusCount = (params: any) => {
  return request.get({ url: '/cr/audit-reason/status-count', params })
}

// 导出错误原因填报任务
export const exportAuditReason = (params: any) => {
  return request.download({ url: '/cr/audit-reason/export-excel', params })
}

// 报送机构下拉选项
export const getAuditReasonOrgOptions = () => {
  return request.get({ url: '/cr/audit-reason/org-options' })
}

// 报表下拉选项
export const getAuditReasonReportOptions = () => {
  return request.get({ url: '/cr/audit-reason/report-options' })
}
