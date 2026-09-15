import request from '@/config/axios'

/** 采集方式 VO */
export interface CollectChannelVO {
  id?: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  /** 见字典 cr_collect_channel：1 系统直连 / 2 文件导入 / 3 接口推送 / 4 手工录入 */
  channelType: number
  dataSource: string
  endpoint: string
  protocol: string
  cronText: string
  lastCollectTime?: string
  lastStatus?: number
  lastMessage?: string
  /** 见字典 cr_enable_status */
  status: number
  owner: string
  remark: string
}

/** 立即采集的返回 */
export interface CollectResultVO {
  taskId: number
  batchNo: string
  status: number
  rows: number
  writtenRows: number
  needAudit: boolean
  jobNo: string
  traceId: string
}

/** 连接测试结果 */
export interface ConnectionTestVO {
  id: number
  jobNo: string
  traceId: string
  reachable: boolean
  handshake: number
  endpoint: string
  protocol: string
  dataSource: string
  expectRows: number
  cost: number
  message: string
}

/** 取数任务记录（系统直连 / 接口推送的每一次调用，含连接测试） */
export interface CollectJobVO {
  id: number
  jobNo: string
  /** 1 取数任务 / 2 连接测试 */
  jobType: number
  channelId: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  channelType: number
  dataSource: string
  endpoint: string
  protocol: string
  mode: string
  requestParams: string
  traceId: string
  startTime: string
  endTime: string
  cost: number
  rowCount: number
  status: number
  message: string
  taskId: number
  batchNo: string
  operator: string
}

// 分页查询采集方式
export const getChannelPage = (params: any) => {
  return request.get({ url: '/cr/collect-channel/page', params })
}

// 查询采集方式详情
export const getChannel = (id: number) => {
  return request.get({ url: '/cr/collect-channel/get?id=' + id })
}

// 新增采集方式
export const createChannel = (data: CollectChannelVO) => {
  return request.post({ url: '/cr/collect-channel/create', data })
}

// 修改采集方式
export const updateChannel = (data: CollectChannelVO) => {
  return request.put({ url: '/cr/collect-channel/update', data })
}

// 删除采集方式
export const deleteChannel = (id: number) => {
  return request.delete({ url: '/cr/collect-channel/delete?id=' + id })
}

// 批量删除采集方式
export const deleteChannelList = (ids: number[]) => {
  return request.delete({ url: '/cr/collect-channel/delete-list', params: { ids: ids.join(',') } })
}

// 导出采集方式
export const exportChannel = (params: any) => {
  return request.download({ url: '/cr/collect-channel/export-excel', params })
}

// 启用 / 停用采集方式
export const toggleChannel = (data: { id: number; status: number }) => {
  return request.post({ url: '/cr/collect-channel/toggle', data })
}

// 立即采集（系统直连 / 接口推送）
export const collectNow = (data: { id: number; operator?: string }) => {
  return request.post({ url: '/cr/collect-channel/collect', data })
}

// 连接测试（探一次源系统，真实系统里会真的握手）
export const testConnection = (data: { id: number; operator?: string }) => {
  return request.post({ url: '/cr/collect-channel/test-connection', data })
}

// 取数记录（取数任务 + 连接测试，按时间倒序分页）
export const getCollectJobPage = (params: any) => {
  return request.get({ url: '/cr/collect-job/page', params })
}
