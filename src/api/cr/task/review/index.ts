import request from '@/config/axios'
import type { CrTaskVO, TaskTraceItemVO, TaskTraceVO } from '../manage'

export type { CrTaskVO, TaskTraceItemVO, TaskTraceVO }

// 分页查询待复核任务
export const getReviewPage = (params: any) => {
  return request.get({ url: '/cr/task-review/page', params })
}

// 查询任务详情
export const getReview = (id: number) => {
  return request.get({ url: '/cr/task-review/get?id=' + id })
}

// 新增
export const createReview = (data: CrTaskVO) => {
  return request.post({ url: '/cr/task-review/create', data })
}

// 修改
export const updateReview = (data: CrTaskVO) => {
  return request.put({ url: '/cr/task-review/update', data })
}

// 删除
export const deleteReview = (id: number) => {
  return request.delete({ url: '/cr/task-review/delete?id=' + id })
}

// 批量删除
export const deleteReviewList = (ids: number[]) => {
  return request.delete({ url: '/cr/task-review/delete-list', params: { ids: ids.join(',') } })
}

// 导出待复核任务
export const exportReview = (params: any) => {
  return request.download({ url: '/cr/task-review/export-excel', params })
}

// 复核通过
export const reviewPass = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-review/pass', data: { ids, opinion } })
}

// 复核不通过（必须填写意见）
export const reviewReject = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-review/reject', data: { ids, opinion } })
}

// 批量复核通过
export const reviewBatchPass = (ids: number[], opinion?: string) => {
  return request.put({ url: '/cr/task-review/batch-pass', data: { ids, opinion } })
}

// 查询任务流转轨迹
export const getReviewTrace = (id: number) => {
  return request.get({ url: '/cr/task/trace?id=' + id })
}
