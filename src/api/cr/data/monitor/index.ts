import request from '@/config/axios'

/** 批处理任务 VO */
export interface BatchTaskVO {
  id: number
  /** 任务号，如 PC2026080013 */
  taskNo: string
  /** 任务类型：1 数据校验 / 2 数据计算 / 3 数据汇总 / 4 报文生成 / 5 批量提交 */
  taskType: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 1 运行中 / 2 成功 / 3 失败 */
  status: number
  percent: number
  startTime: string
  endTime: string
  costTime: number
  rowCount: number
  resultMessage: string
  errorMessage: string
}

/** 分页结果（附带各状态计数） */
export interface BatchTaskPageVO {
  list: BatchTaskVO[]
  total: number
  runningCount: number
  successCount: number
  failCount: number
}

/** 任务日志行 */
export interface BatchLogVO {
  time: string
  text: string
  level: string
}

/** 任务日志详情 */
export interface BatchTaskLogVO {
  id: number
  taskNo: string
  taskType: number
  taskTypeName: string
  status: number
  statusName: string
  percent: number
  orgName: string
  reportName: string
  period: string
  startTime: string
  endTime: string
  costTime: number
  logs: BatchLogVO[]
}

// 批处理任务分页（每次查询会推进一次运行中任务的进度）
export const getMonitorPage = (params: any) => request.get({ url: '/cr/data-monitor/page', params })

// 任务日志
export const getMonitorLog = (id: number) => request.get({ url: '/cr/data-monitor/log?id=' + id })

// 机构下拉
export const getMonitorOrgOptions = () => request.get({ url: '/cr/data-monitor/org-options' })

// 报表下拉
export const getMonitorReportOptions = () => request.get({ url: '/cr/data-monitor/report-options' })

// 期次下拉
export const getMonitorPeriodOptions = () => request.get({ url: '/cr/data-monitor/period-options' })
