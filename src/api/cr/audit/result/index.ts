import request from '@/config/axios'

/** 关联问题清单条目 */
export interface AuditResultProblemVO {
  /** 数据定位 */
  location: string
  /** 字段名称 */
  columnName: string
  originalValue: string
  /** 问题类型，见字典 cr_rule_type */
  issueType: number
  issueTypeName: string
  /** 错误级别，见字典 cr_error_level */
  errorLevel: number
  errorLevelName: string
  auditOpinion: string
  /** 错误原因填报状态：0 待填报 / 1 已填报 / 2 已确认 */
  status: number
  statusName: string
  reason: string
}

/** 审核结果 VO */
export interface AuditResultVO {
  id?: number
  batchId: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 审核结论，见字典 cr_audit_status */
  auditStatus: number
  auditor: string
  auditTime: string
  auditOpinion: string
  /** 问题数量（错误 + 警告） */
  issueCount: number
  warnCount: number
  errorCount: number
  rowCount: number
  /** 审核轮次 */
  auditRound: number
  submitTime: string
  createTime?: string
  /** 详情接口返回：关联问题清单 */
  problems?: AuditResultProblemVO[]
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

// 分页查询审核结果
export const getAuditResultPage = (params: any) => {
  return request.get({ url: '/cr/audit-result/page', params })
}

// 查询审核结果详情（含关联问题清单）
export const getAuditResult = (id: number) => {
  return request.get({ url: '/cr/audit-result/get?id=' + id })
}

// 导出审核结果
export const exportAuditResult = (params: any) => {
  return request.download({ url: '/cr/audit-result/export-excel', params })
}

// 报送机构下拉选项
export const getAuditResultOrgOptions = () => {
  return request.get({ url: '/cr/audit-result/org-options' })
}

// 报表下拉选项
export const getAuditResultReportOptions = () => {
  return request.get({ url: '/cr/audit-result/report-options' })
}
