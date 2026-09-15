import request from '@/config/axios'

/** 接入权限 VO */
export interface IntegrationAuthVO {
  id?: number
  sysCode: string
  sysName?: string
  apiScope: string
  orgIds: number[]
  orgNames?: string
  reportIds: number[]
  reportNames?: string
  priority: number
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询接入权限
export const getPage = (params: any) => {
  return request.get({ url: '/cr/integration-auth/page', params })
}

// 查询接入权限详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/integration-auth/get?id=' + id })
}

// 新增接入权限
export const create = (data: IntegrationAuthVO) => {
  return request.post({ url: '/cr/integration-auth/create', data })
}

// 修改接入权限
export const update = (data: IntegrationAuthVO) => {
  return request.put({ url: '/cr/integration-auth/update', data })
}

// 删除接入权限
export const remove = (id: number) => {
  return request.delete({ url: '/cr/integration-auth/delete?id=' + id })
}

// 批量删除接入权限
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/integration-auth/delete-list', params: { ids: ids.join(',') } })
}

// 导出接入权限
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/integration-auth/export-excel', params })
}

/** 接入权限生效判断 */
export interface IntegrationAuthDecisionVO {
  system: { sysCode: string; sysName: string; sysTypeLabel: string; status: number }
  effective: {
    matched: boolean
    ruleId: number
    apiScope: string
    orgNames: string
    reportNames: string
    source: string
  }
  rows: Array<{
    id: number
    apiScope: string
    orgNames: string
    reportNames: string
    priority: number
    status: number
    state: string
    reason: string
  }>
}

// 生效判断（只读）：同一系统的多条授权到底哪条生效
export const getAuthDecisions = (sysCode: string) => {
  return request.get({ url: '/cr/integration-auth/decisions', params: { sysCode } })
}
