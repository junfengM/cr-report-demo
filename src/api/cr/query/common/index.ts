import request from '@/config/axios'

/** 查询类页面共用的下拉数据（机构 / 期次 / 报表） */

/** 报送机构（分公司） */
export interface OrgOptionVO {
  id: number
  orgCode: string
  orgName: string
}

/** 报表下拉项 */
export interface ReportOptionVO {
  id: number
  name: string
  freq: number
}

/** 机构下拉 */
export const getQueryOrgOptions = () => {
  return request.get({ url: '/cr/query-common/org-options' })
}

/** 报送期次下拉（与任务模板等模块同一口径） */
export const getQueryPeriodOptions = () => {
  return request.get({ url: '/cr/query-common/period-options' })
}

/** 报表下拉（可按频度过滤） */
export const getQueryReportOptions = (freq?: number) => {
  return request.get({ url: '/cr/common/report-options', params: { freq } })
}
