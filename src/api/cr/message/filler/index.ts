import request from '@/config/axios'

/** 填报人指派 VO */
export interface FillerAssignVO {
  id?: number
  orgId?: number
  orgName: string
  /** 报表 id；0 表示该机构全部报表 */
  reportId: number
  reportCode: string
  reportName: string
  /** 数据频度；0 表示不限频度 */
  freq: number
  fillerId?: number
  fillerName: string
  reviewerId?: number
  reviewerName: string
  effectiveDate: string
  expireDate: string
  status: number
  remark: string
  createTime?: string
}

/** 批量分配入参 */
export interface FillerBatchVO {
  orgIds: number[]
  reportIds: number[]
  freq: number
  fillerId?: number
  reviewerId?: number
  effectiveDate: string
  expireDate: string
  overwrite: boolean
  remark: string
}

/** 批量分配结果 */
export interface FillerBatchResultVO {
  created: number
  updated: number
  conflictCount: number
  orgCount: number
  reportCount: number
  conflicts: string[]
}

// 分页查询填报人指派
export const getFillerAssignPage = (params: any) => {
  return request.get({ url: '/cr/filler-assign/page', params })
}

// 查询填报人指派详情
export const getFillerAssign = (id: number) => {
  return request.get({ url: '/cr/filler-assign/get?id=' + id })
}

// 新增填报人指派
export const createFillerAssign = (data: FillerAssignVO) => {
  return request.post({ url: '/cr/filler-assign/create', data })
}

// 修改填报人指派
export const updateFillerAssign = (data: FillerAssignVO) => {
  return request.put({ url: '/cr/filler-assign/update', data })
}

// 删除填报人指派
export const deleteFillerAssign = (id: number) => {
  return request.delete({ url: '/cr/filler-assign/delete?id=' + id })
}

// 批量删除填报人指派
export const deleteFillerAssignList = (ids: number[]) => {
  return request.delete({ url: '/cr/filler-assign/delete-list', params: { ids: ids.join(',') } })
}

// 导出填报人指派
export const exportFillerAssign = (params: any) => {
  return request.download({ url: '/cr/filler-assign/export-excel', params })
}

// 批量分配填报人 / 复核人
export const batchFillerAssign = (data: FillerBatchVO) => {
  return request.post({ url: '/cr/filler-assign/batch', data })
}
