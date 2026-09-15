import request from '@/config/axios'

/** 调度配置 VO */
export interface ScheduleVO {
  id?: number
  taskId: number
  /** 任务名称（冗余，服务端按 taskId 回填） */
  taskName?: string
  /** Cron 表达式（Quartz 六段：秒 分 时 日 月 周） */
  cron: string
  /** 调度状态：0 已关闭 / 1 已开启 */
  enabled: number
  /** 是否有状态：有状态任务串行执行 */
  stateful: boolean
  remark: string
  createUser?: string
  createTime?: string
  updateUser?: string
  updateTime?: string
  /** 列表附带 */
  taskCode?: string
  implType?: number
}

// 分页查询调度配置
export const getSchedulePage = (params: any) => request.get({ url: '/cr/schedule/page', params })

// 查询调度配置详情
export const getSchedule = (id: number) => request.get({ url: '/cr/schedule/get?id=' + id })

// 新增调度配置
export const createSchedule = (data: ScheduleVO) =>
  request.post({ url: '/cr/schedule/create', data })

// 修改调度配置
export const updateSchedule = (data: ScheduleVO) =>
  request.put({ url: '/cr/schedule/update', data })

// 删除调度配置
export const deleteSchedule = (id: number) =>
  request.delete({ url: '/cr/schedule/delete?id=' + id })

// 批量删除调度配置
export const deleteScheduleList = (ids: number[]) =>
  request.delete({ url: '/cr/schedule/delete-list', params: { ids: ids.join(',') } })

// 导出调度配置
export const exportSchedule = (params: any) =>
  request.download({ url: '/cr/schedule/export-excel', params })

// 开启 / 关闭某个任务的调度
export const toggleSchedule = (id: number, enabled: number) =>
  request.post({ url: '/cr/schedule/toggle', data: { id, enabled } })
