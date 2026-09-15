import request from '@/config/axios'

/** 报送总体概况 */
export interface DashboardOverviewVO {
  period: string
  shouldReport: number
  filled: number
  checked: number
  submitted: number
  overdue: number
  fillRate: number
  checkRate: number
  submitRate: number
  orgCount: number
  doneOrgCount: number
}

/** 报送节点 */
export interface DashboardNodeVO {
  name: string
  done: number
  total: number
  percent: number
  status: 'success' | 'process' | 'wait'
}

/** 趋势 */
export interface DashboardTrendVO {
  period: string
  fillRate: number
  checkRate: number
  submitRate: number
}

/** 机构进度 */
export interface DashboardOrgProgressVO {
  orgId: number
  orgName: string
  shouldReport: number
  filled: number
  submitted: number
  overdue: number
  submitRate: number
}

/** 待办 */
export interface DashboardTodoVO {
  id: number
  taskNo: string
  title: string
  orgName: string
  period: string
  stage: string
  deadline: string
  urgency: number
}

/** 动态 */
export interface DashboardActivityVO {
  id: number
  time: string
  operator: string
  orgName: string
  action: string
  target: string
  type: string
}

export const getOverview = (period?: string) =>
  request.get({ url: '/cr/dashboard/overview', params: { period } })

export const getNodes = (period?: string) =>
  request.get({ url: '/cr/dashboard/nodes', params: { period } })

export const getTrend = () => request.get({ url: '/cr/dashboard/trend' })

export const getOrgProgress = (period?: string) =>
  request.get({ url: '/cr/dashboard/org-progress', params: { period } })

export const getTodo = () => request.get({ url: '/cr/dashboard/todo' })

export const getActivity = () => request.get({ url: '/cr/dashboard/activity' })
