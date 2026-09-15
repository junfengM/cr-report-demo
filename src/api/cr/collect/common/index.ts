import request from '@/config/axios'

/** 数据采集域公共下拉：机构 / 报表 / 期次 / 授权主体 / 用户 */

export interface CollectOrgOptionVO {
  id: number
  orgCode: string
  orgName: string
  orgLevel: number
}

export interface CollectReportOptionVO {
  id: number
  reportCode: string
  reportName: string
  freq: number
}

export interface CollectPeriodOptionVO {
  period: string
  periodName: string
  status: number
  deadline: string
  allowSupplement: boolean
}

export interface CollectUserOptionVO {
  id: number
  nickname: string
  deptId: number
}

/** 报送机构下拉 */
export const getCollectOrgOptions = () => {
  return request.get({ url: '/cr/collect-common/org-options' })
}

/** 报表下拉（可按关键字过滤） */
export const getCollectReportOptions = (keyword?: string) => {
  return request.get({ url: '/cr/collect-common/report-options', params: { keyword } })
}

/** 期次下拉 */
export const getCollectPeriodOptions = () => {
  return request.get({ url: '/cr/collect-common/period-options' })
}

/** 授权主体下拉（角色 + 用户） */
export const getCollectSubjectOptions = () => {
  return request.get({ url: '/cr/collect-common/subject-options' })
}

/** 用户下拉 */
export const getCollectUserOptions = (keyword?: string) => {
  return request.get({ url: '/cr/collect-common/user-options', params: { keyword } })
}
