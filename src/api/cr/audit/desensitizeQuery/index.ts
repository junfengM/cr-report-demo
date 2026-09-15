import request from '@/config/axios'

/** 脱敏结果 VO（脱敏前后对照） */
export interface DesensitizeQueryVO {
  id?: number
  /** 业务数据标识（投保人编号），同一条数据的多个字段按它归集 */
  dataKey: string
  policyNo: string
  rowNo: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  columnCode: string
  /** 数据项（字段）名称 */
  columnName: string
  /** 脱敏前原文 */
  originalValue: string
  /** 脱敏后结果 */
  maskedValue: string
  /** 脱敏规则，见字典 cr_desensitize_type */
  ruleType: string
  /** 脱敏参数 */
  ruleParam: string
  processTime: string
  /** 详情接口返回：规则中文名 */
  ruleTypeName?: string
  /** 详情接口返回：同一条数据在其它字段上的脱敏情况 */
  siblings?: DesensitizeQueryVO[]
}

/** 数据项（字段）下拉选项 */
export interface DesensitizeColumnOptionVO {
  columnCode: string
  columnName: string
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

// 分页查询脱敏结果
export const getDesensitizeQueryPage = (params: any) => {
  return request.get({ url: '/cr/audit-desensitize/page', params })
}

// 查询脱敏详情（含同一条数据在多个字段上的脱敏情况）
export const getDesensitizeQuery = (id: number) => {
  return request.get({ url: '/cr/audit-desensitize/get?id=' + id })
}

// 导出脱敏结果
export const exportDesensitizeQuery = (params: any) => {
  return request.download({ url: '/cr/audit-desensitize/export-excel', params })
}

// 数据项（字段）下拉选项
export const getDesensitizeColumnOptions = () => {
  return request.get({ url: '/cr/audit-desensitize/column-options' })
}

// 报送机构下拉选项
export const getDesensitizeOrgOptions = () => {
  return request.get({ url: '/cr/audit-desensitize/org-options' })
}

// 报表下拉选项
export const getDesensitizeReportOptions = () => {
  return request.get({ url: '/cr/audit-desensitize/report-options' })
}
