import request from '@/config/axios'
import type { FillRecordVO } from '@/api/cr/data/fill'

/** 批量提交结果 */
export interface SubmitResultVO {
  successCount: number
  failCount: number
  submitTime: string
  recordIds: number[]
}

// 待提交填报记录分页（默认只返回未提交的记录）
export const getSubmitRecordPage = (params: any) =>
  request.get({ url: '/cr/data-submit/page', params })

// 批量提交（校验不通过会抛出中文提示）
export const submitFillRecords = (ids: number[]) =>
  request.put({ url: '/cr/data-submit/submit', data: { ids } })

// 机构下拉
export const getSubmitOrgOptions = () => request.get({ url: '/cr/data-submit/org-options' })

// 报表下拉
export const getSubmitReportOptions = () => request.get({ url: '/cr/data-submit/report-options' })

// 期次下拉
export const getSubmitPeriodOptions = () => request.get({ url: '/cr/data-submit/period-options' })

export type { FillRecordVO }
