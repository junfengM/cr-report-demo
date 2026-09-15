import request from '@/config/axios'
import type { CrTaskVO, TaskTraceItemVO, TaskTraceVO } from '../manage'

export type { CrTaskVO, TaskTraceItemVO, TaskTraceVO }

/** 打回记录 VO */
export interface TaskReturnRecordVO {
  id: number
  taskId: number
  taskCode: string
  taskName: string
  orgName: string
  /** 打回环节：填报 / 复核 / 本级审核 / 上级审核 */
  stage: string
  reason: string
  returnUser: string
  returnTime: string
  /** 处理状态：false 待处理 / true 已处理 */
  processed: boolean
  handleRemark: string
  handleTime: string
}

// 分页查询流转中的任务（可打回）
export const getReturnPage = (params: any) => {
  return request.get({ url: '/cr/task-return/page', params })
}

// 查询任务详情
export const getReturn = (id: number) => {
  return request.get({ url: '/cr/task-return/get?id=' + id })
}

// 新增
export const createReturn = (data: CrTaskVO) => {
  return request.post({ url: '/cr/task-return/create', data })
}

// 修改
export const updateReturn = (data: CrTaskVO) => {
  return request.put({ url: '/cr/task-return/update', data })
}

// 删除
export const deleteReturn = (id: number) => {
  return request.delete({ url: '/cr/task-return/delete?id=' + id })
}

// 批量删除
export const deleteReturnList = (ids: number[]) => {
  return request.delete({ url: '/cr/task-return/delete-list', params: { ids: ids.join(',') } })
}

// 导出流转中的任务
export const exportReturn = (params: any) => {
  return request.download({ url: '/cr/task-return/export-excel', params })
}

// 打回：把任务打回到指定环节
export const returnBack = (taskId: number, stage: string, reason: string) => {
  return request.put({ url: '/cr/task-return/back', data: { taskId, stage, reason } })
}

// 打回记录分页（processed：false 待处理 / true 已处理）
export const getReturnRecordPage = (params: any) => {
  return request.get({ url: '/cr/task-return/record-page', params })
}

// 处理打回记录
export const handleReturnRecord = (ids: number[], handleRemark: string) => {
  return request.put({ url: '/cr/task-return/handle', data: { ids, handleRemark } })
}

// 打回记录统计
export const getReturnRecordStat = () => {
  return request.get({ url: '/cr/task-return/record-stat' })
}

// 打回环节选项
export const getReturnStageOptions = () => {
  return request.get({ url: '/cr/task-return/stage-options' })
}

// 查询任务流转轨迹
export const getReturnTrace = (id: number) => {
  return request.get({ url: '/cr/task/trace?id=' + id })
}
