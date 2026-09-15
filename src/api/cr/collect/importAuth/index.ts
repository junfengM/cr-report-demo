import request from '@/config/axios'

/** 导入权限 VO */
export interface ImportAuthVO {
  id?: number
  /** 见字典 cr_subject_type：1 角色 / 2 用户 */
  subjectType: number
  subjectId: number
  subjectName: string
  /** 0 表示全部机构 */
  orgId: number
  orgName: string
  /** 0 表示全部报表 */
  reportId: number
  reportCode: string
  reportName: string
  canImport: boolean
  canOverwrite: boolean
  needAudit: boolean
  maxRows: number
  status: number
  grantUser?: string
  grantTime?: string
  remark: string
}

// 分页查询导入权限
export const getImportAuthPage = (params: any) => {
  return request.get({ url: '/cr/import-auth/page', params })
}

// 查询导入权限详情
export const getImportAuth = (id: number) => {
  return request.get({ url: '/cr/import-auth/get?id=' + id })
}

// 新增导入权限
export const createImportAuth = (data: ImportAuthVO) => {
  return request.post({ url: '/cr/import-auth/create', data })
}

// 修改导入权限
export const updateImportAuth = (data: ImportAuthVO) => {
  return request.put({ url: '/cr/import-auth/update', data })
}

// 删除导入权限
export const deleteImportAuth = (id: number) => {
  return request.delete({ url: '/cr/import-auth/delete?id=' + id })
}

// 批量删除导入权限
export const deleteImportAuthList = (ids: number[]) => {
  return request.delete({ url: '/cr/import-auth/delete-list', params: { ids: ids.join(',') } })
}

// 导出导入权限
export const exportImportAuth = (params: any) => {
  return request.download({ url: '/cr/import-auth/export-excel', params })
}
