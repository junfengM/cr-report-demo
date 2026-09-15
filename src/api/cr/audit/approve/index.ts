import request from '@/config/axios'

/** 待审核批次 VO（机构 × 报表 × 期次） */
export interface AuditApproveVO {
  id?: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 数据行数 */
  rowCount: number
  /** 校验通过 / 警告 / 错误行数 */
  passCount: number
  warnCount: number
  errorCount: number
  /** 报送状态，见字典 cr_fill_status */
  submitStatus: number
  submitTime: string
  submitUser: string
  /** 审核结论，见字典 cr_audit_status */
  auditStatus: number
  auditor: string
  auditTime: string
  auditOpinion: string
  remark: string
  createTime?: string
}

/** 审核明细行（脱敏后的值） */
export interface AuditApproveDetailVO {
  id: number
  batchId: number
  rowNo: number
  policyNo: string
  holderName: string
  certNo: string
  mobile: string
  sumAssured: number
  premium: number
  effectDate: string
  /** 校验问题级别：0 无问题 / 1 警告 / 2 错误 */
  issueLevel: number
  issueMessage: string
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

/** 批量审核结果 */
export interface AuditBatchResultVO {
  successCount: number
  failCount: number
  messages: string[]
}

// 分页查询待审核批次
export const getAuditApprovePage = (params: any) => {
  return request.get({ url: '/cr/audit-approve/page', params })
}

// 查询批次详情
export const getAuditApprove = (id: number) => {
  return request.get({ url: '/cr/audit-approve/get?id=' + id })
}

// 查询批次明细（脱敏后的数据行）
export const getAuditApproveDetail = (batchId: number) => {
  return request.get({ url: '/cr/audit-approve/detail', params: { batchId } })
}

// 审核通过
export const passAuditApprove = (ids: number[], opinion?: string) => {
  return request.put({ url: '/cr/audit-approve/pass', data: { ids, opinion } })
}

// 审核不通过（意见必填）
export const rejectAuditApprove = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/audit-approve/reject', data: { ids, opinion } })
}

// 批量审核通过
export const batchPassAuditApprove = (ids: number[], opinion?: string) => {
  return request.put({ url: '/cr/audit-approve/batch-pass', data: { ids, opinion } })
}

// 导出待审核批次
export const exportAuditApprove = (params: any) => {
  return request.download({ url: '/cr/audit-approve/export-excel', params })
}

// 报送机构下拉选项
export const getAuditApproveOrgOptions = () => {
  return request.get({ url: '/cr/audit-approve/org-options' })
}

// 报表下拉选项
export const getAuditApproveReportOptions = () => {
  return request.get({ url: '/cr/audit-approve/report-options' })
}
