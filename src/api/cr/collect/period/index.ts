import request from '@/config/axios'

/** 报送期次 VO */
export interface CollectPeriodVO {
  id?: number
  period: string
  periodName: string
  /** 频度，见字典 cr_report_freq */
  freq: number
  collectStart: string
  collectEnd: string
  deadline: string
  allowSupplement: boolean
  /** 见字典 cr_period_status：0 未开始 / 1 进行中 / 2 已关闭 */
  status: number
  closeTime?: string
  closeUser?: string
  createTime?: string
  remark: string
}

/** 期次进度（按任务表与填报数据实时汇总） */
export interface CollectPeriodProgressVO {
  taskCount: number
  finishedCount: number
  submitRate: number
  fillCount: number
}

/** 关闭期次前的体检结果 */
export interface CloseCheckVO {
  period: string
  taskCount: number
  unfinished: number
  draftRecords: number
  canClose: boolean
  message: string
}

// 分页查询报送期次
export const getPeriodPage = (params: any) => {
  return request.get({ url: '/cr/collect-period/page', params })
}

// 查询报送期次详情
export const getPeriod = (id: number) => {
  return request.get({ url: '/cr/collect-period/get?id=' + id })
}

// 新增报送期次
export const createPeriod = (data: CollectPeriodVO) => {
  return request.post({ url: '/cr/collect-period/create', data })
}

// 修改报送期次
export const updatePeriod = (data: CollectPeriodVO) => {
  return request.put({ url: '/cr/collect-period/update', data })
}

// 删除报送期次
export const deletePeriod = (id: number) => {
  return request.delete({ url: '/cr/collect-period/delete?id=' + id })
}

// 批量删除报送期次
export const deletePeriodList = (ids: number[]) => {
  return request.delete({ url: '/cr/collect-period/delete-list', params: { ids: ids.join(',') } })
}

// 导出报送期次
export const exportPeriod = (params: any) => {
  return request.download({ url: '/cr/collect-period/export-excel', params })
}

// 期次进度（任务数 / 已完成 / 填报行数）
export const getPeriodProgress = () => {
  return request.get({ url: '/cr/collect-period/progress' })
}

// 关闭期次前的体检
export const getCloseCheck = (period: string) => {
  return request.get({ url: '/cr/collect-period/close-check', params: { period } })
}

// 开放 / 重新开放采集
export const openPeriod = (data: { period: string; remark?: string; operator?: string }) => {
  return request.post({ url: '/cr/collect-period/open', data })
}

// 关闭期次（force=true 为强制关闭）
export const closePeriod = (data: {
  period: string
  force?: boolean
  remark?: string
  operator?: string
}) => {
  return request.post({ url: '/cr/collect-period/close', data })
}
