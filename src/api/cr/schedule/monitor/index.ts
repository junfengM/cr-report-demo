import request from '@/config/axios'

/** 跑批日志 VO（批量监控页） */
export interface CollectTaskLogVO {
  id: number
  /** 数据日期 */
  dataDate: string
  /** 报送期次 */
  period: string
  groupId: number
  groupName: string
  taskId: number
  /** 存储过程英文名 */
  taskCode: string
  /** 存储过程中文名 */
  taskName: string
  /** 执行方式：1 自动调度 / 2 手工调度 */
  runType: number
  /** 运行状态，见字典 cr_task_run_status */
  status: number
  startTime: string
  endTime: string
  /** 执行时长（秒） */
  duration: number
  /** 新增数据量 */
  rowsAdded: number
  /** SQL 执行返回值 */
  sqlReturn: string
  /** SQL 执行错误信息 */
  errorMsg: string
  operator: string
  statusLabel?: string
}

export interface CollectTaskLogStatsVO {
  total: number
  success: number
  failed: number
  waiting: number
  running: number
  rowsAdded: number
}

// 分页查询跑批日志（返回 list / total / stats，统计与列表同源）
export const getCollectTaskLogPage = (params: any) =>
  request.get({ url: '/cr/collect-task-log/page', params })

// 导出跑批日志
export const exportCollectTaskLog = (params: any) =>
  request.download({ url: '/cr/collect-task-log/export-excel', params })

// 立即执行（按这条日志的任务 / 期次 / 数据日期重跑一次）
export const runCollectTaskLog = (id: number) =>
  request.post({ url: '/cr/collect-task-log/run', data: { id } })
