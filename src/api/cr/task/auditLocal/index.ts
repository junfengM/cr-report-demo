import request from '@/config/axios'
import type { CrTaskVO, TaskTraceItemVO, TaskTraceVO } from '../manage'

export type { CrTaskVO, TaskTraceItemVO, TaskTraceVO }

// 分页查询待本级审核任务
export const getAuditLocalPage = (params: any) => {
  return request.get({ url: '/cr/task-audit-local/page', params })
}

// 查询任务详情
export const getAuditLocal = (id: number) => {
  return request.get({ url: '/cr/task-audit-local/get?id=' + id })
}

// 新增
export const createAuditLocal = (data: CrTaskVO) => {
  return request.post({ url: '/cr/task-audit-local/create', data })
}

// 修改
export const updateAuditLocal = (data: CrTaskVO) => {
  return request.put({ url: '/cr/task-audit-local/update', data })
}

// 删除
export const deleteAuditLocal = (id: number) => {
  return request.delete({ url: '/cr/task-audit-local/delete?id=' + id })
}

// 批量删除
export const deleteAuditLocalList = (ids: number[]) => {
  return request.delete({ url: '/cr/task-audit-local/delete-list', params: { ids: ids.join(',') } })
}

// 导出待本级审核任务
export const exportAuditLocal = (params: any) => {
  return request.download({ url: '/cr/task-audit-local/export-excel', params })
}

// 本级审核通过
export const auditLocalPass = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-audit-local/pass', data: { ids, opinion } })
}

// 本级审核不通过（退回复核，必须填写意见）
export const auditLocalReject = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-audit-local/reject', data: { ids, opinion } })
}

// 查询任务流转轨迹
export const getAuditLocalTrace = (id: number) => {
  return request.get({ url: '/cr/task/trace?id=' + id })
}

// 查询任务下的报表明细
export const getAuditLocalReportList = (id: number) => {
  return request.get({ url: '/cr/task/report-list?id=' + id })
}
