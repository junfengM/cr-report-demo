import request from '@/config/axios'

/** 导入审核流水 VO */
export interface ImportAuditVO {
  id?: number
  taskId: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportName: string
  period: string
  totalRows: number
  successRows: number
  failRows: number
  submitUser: string
  submitTime: string
  /** 见字典 cr_audit_status：1 待审核 / 2 已通过 / 3 已驳回 */
  status: number
  auditor: string
  auditTime: string
  auditRemark: string
}

// 分页查询导入审核
export const getImportAuditPage = (params: any) => {
  return request.get({ url: '/cr/import-audit/page', params })
}

// 查询导入审核详情
export const getImportAudit = (id: number) => {
  return request.get({ url: '/cr/import-audit/get?id=' + id })
}

// 导出导入审核
export const exportImportAudit = (params: any) => {
  return request.download({ url: '/cr/import-audit/export-excel', params })
}

// 审核（通过 → 写填报数据；驳回 → 批次作废）
export const auditImport = (data: {
  id: number
  pass: boolean
  remark?: string
  operator?: string
}) => {
  return request.post({ url: '/cr/import-audit/audit', data })
}
