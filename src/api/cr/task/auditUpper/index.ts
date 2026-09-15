import request from '@/config/axios'
import type { CrTaskVO, TaskTraceItemVO, TaskTraceVO } from '../manage'

export type { CrTaskVO, TaskTraceItemVO, TaskTraceVO }

// 分页查询待上级审核任务
export const getAuditUpperPage = (params: any) => {
  return request.get({ url: '/cr/task-audit-upper/page', params })
}

// 查询任务详情
export const getAuditUpper = (id: number) => {
  return request.get({ url: '/cr/task-audit-upper/get?id=' + id })
}

// 新增
export const createAuditUpper = (data: CrTaskVO) => {
  return request.post({ url: '/cr/task-audit-upper/create', data })
}

// 修改
export const updateAuditUpper = (data: CrTaskVO) => {
  return request.put({ url: '/cr/task-audit-upper/update', data })
}

// 删除
export const deleteAuditUpper = (id: number) => {
  return request.delete({ url: '/cr/task-audit-upper/delete?id=' + id })
}

// 批量删除
export const deleteAuditUpperList = (ids: number[]) => {
  return request.delete({ url: '/cr/task-audit-upper/delete-list', params: { ids: ids.join(',') } })
}

// 导出待上级审核任务
export const exportAuditUpper = (params: any) => {
  return request.download({ url: '/cr/task-audit-upper/export-excel', params })
}

// 上级审核通过
export const auditUpperPass = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-audit-upper/pass', data: { ids, opinion } })
}

// 上级审核不通过（退回本级审核，必须填写意见）
export const auditUpperReject = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-audit-upper/reject', data: { ids, opinion } })
}

// 退回至本级审核
export const auditUpperBack = (ids: number[], opinion: string) => {
  return request.put({ url: '/cr/task-audit-upper/back', data: { ids, opinion } })
}

// 查询任务流转轨迹
export const getAuditUpperTrace = (id: number) => {
  return request.get({ url: '/cr/task/trace?id=' + id })
}

// 查询任务下的报表明细
export const getAuditUpperReportList = (id: number) => {
  return request.get({ url: '/cr/task/report-list?id=' + id })
}
