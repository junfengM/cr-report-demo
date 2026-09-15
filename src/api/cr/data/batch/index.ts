import request from '@/config/axios'
import type { FillRecordVO } from '@/api/cr/data/fill'

/** 批量操作动作 */
export type BatchAction = 'clear' | 'copyPrev' | 'calculate' | 'delete'

/** 单条记录的执行结果 */
export interface BatchResultVO {
  id: number
  orgName: string
  reportName: string
  period: string
  success: boolean
  message: string
}

/** 批量执行结果 */
export interface BatchExecuteResultVO {
  action: BatchAction
  label: string
  successCount: number
  failCount: number
  results: BatchResultVO[]
  executeTime: string
}

// 填报记录分页（手工批量操作的候选记录）
export const getBatchRecordPage = (params: any) =>
  request.get({ url: '/cr/data-batch/page', params })

// 执行批量操作
export const executeBatch = (data: { ids: number[]; action: BatchAction }) =>
  request.put({ url: '/cr/data-batch/execute', data })

// 机构下拉
export const getBatchOrgOptions = () => request.get({ url: '/cr/data-batch/org-options' })

// 报表下拉
export const getBatchReportOptions = () => request.get({ url: '/cr/data-batch/report-options' })

// 期次下拉
export const getBatchPeriodOptions = () => request.get({ url: '/cr/data-batch/period-options' })

export type { FillRecordVO }
