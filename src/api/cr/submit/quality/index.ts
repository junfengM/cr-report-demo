import request from '@/config/axios'

/** 质量检核结果 VO（监管侧反馈） */
export interface SubmitQualityVO {
  id?: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 检核项目 */
  checkItem: string
  /** 检核结论：1 通过 / 0 不通过 */
  result: number
  /** 问题数量 */
  problemCount: number
  /** 问题描述 */
  problemDesc: string
  /** 监管反馈时间 */
  feedbackTime: string
}

/** 质量检核小结 */
export interface SubmitQualitySummaryVO {
  /** 总检核项 */
  total: number
  passCount: number
  failCount: number
  /** 问题总数 */
  problemCount: number
  /** 通过率（%） */
  passRate: number
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

// 分页查询质量检核结果
export const getSubmitQualityPage = (params: any) => {
  return request.get({ url: '/cr/submit-quality/page', params })
}

// 质量检核小结
export const getSubmitQualitySummary = (params: any) => {
  return request.get({ url: '/cr/submit-quality/summary', params })
}

// 导出质量检核结果
export const exportSubmitQuality = (params: any) => {
  return request.download({ url: '/cr/submit-quality/export-excel', params })
}

// 报送机构下拉选项
export const getSubmitQualityOrgOptions = () => {
  return request.get({ url: '/cr/submit-quality/org-options' })
}

// 报表下拉选项
export const getSubmitQualityReportOptions = () => {
  return request.get({ url: '/cr/submit-quality/report-options' })
}

// 期次下拉选项
export const getSubmitQualityPeriodOptions = () => {
  return request.get({ url: '/cr/submit-quality/period-options' })
}
