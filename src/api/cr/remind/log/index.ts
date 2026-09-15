import request from '@/config/axios'

/** 提醒记录 VO */
export interface RemindLogVO {
  id?: number
  ruleId: number
  ruleCode: string
  ruleName: string
  scene: number
  sceneLabel?: string
  title: string
  content: string
  receiverName: string
  channel: string
  sendTime: string
  /** 1 已发送 / 2 已读 / 3 发送失败 */
  status: number
  bizKey: string
  /** true = 历史留痕（种子数据），false = 跑批生成 */
  seeded?: boolean
  remark: string
}

// 分页查询提醒记录
export const getPage = (params: any) => {
  return request.get({ url: '/cr/remind-log/page', params })
}

// 查询提醒记录详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/remind-log/get?id=' + id })
}

// 新增提醒记录
export const create = (data: RemindLogVO) => {
  return request.post({ url: '/cr/remind-log/create', data })
}

// 修改提醒记录
export const update = (data: RemindLogVO) => {
  return request.put({ url: '/cr/remind-log/update', data })
}

// 删除提醒记录
export const remove = (id: number) => {
  return request.delete({ url: '/cr/remind-log/delete?id=' + id })
}

// 批量删除提醒记录
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/remind-log/delete-list', params: { ids: ids.join(',') } })
}

// 导出提醒记录
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/remind-log/export-excel', params })
}

/** 提醒统计 */
export interface RemindLogStatVO {
  total: number
  read: number
  failed: number
  generatedByRun: number
  scenes: Array<{
    scene: number
    sceneLabel: string
    total: number
    read: number
    failed: number
    running: number
  }>
}

// 标记已读（写操作，仅系统管理员）
export const readRemindLogs = (ids: number[]) => {
  return request.post({ url: '/cr/remind-log/read', data: { ids } })
}

// 重发（追加新记录，写操作，仅系统管理员）
export const resendRemindLog = (id: number) => {
  return request.post({ url: '/cr/remind-log/resend', data: { id } })
}

// 提醒统计（只读）
export const getRemindLogStat = () => {
  return request.get({ url: '/cr/remind-log/stat' })
}
