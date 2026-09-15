import request from '@/config/axios'

/** 校验结果 VO（仅不通过的明细） */
export interface CheckResultVO {
  id?: number
  taskNo: string
  period: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  ruleId: number
  ruleCode: string
  ruleName: string
  /** 规则类型，见字典 cr_rule_type */
  ruleType: number
  /** 错误级别，见字典 cr_error_level */
  errorLevel: number
  leftExpression: string
  operator: string
  rightExpression: string
  errorMessage: string
  /** 错误数据定位，如「第 128 行 / 保单号 P2026080012」 */
  location: string
  actualValue: string
  expectValue: string
  handled: boolean
  handler: string
  handleTime: string
  handleRemark: string
  createTime: string
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

// 分页查询校验结果
export const getCheckResultPage = (params: any) => {
  return request.get({ url: '/cr/check-result/page', params })
}

// 查询校验结果详情
export const getCheckResult = (id: number) => {
  return request.get({ url: '/cr/check-result/get?id=' + id })
}

// 标记已处理
export const handleCheckResult = (data: {
  id: number
  handler?: string
  handleRemark?: string
}) => {
  return request.put({ url: '/cr/check-result/handle', data })
}

// 导出校验结果
export const exportCheckResult = (params: any) => {
  return request.download({ url: '/cr/check-result/export-excel', params })
}

// 报送机构下拉选项
export const getCheckResultOrgOptions = () => {
  return request.get({ url: '/cr/check-result/org-options' })
}

// 报表下拉选项
export const getCheckResultReportOptions = () => {
  return request.get({ url: '/cr/check-result/report-options' })
}
