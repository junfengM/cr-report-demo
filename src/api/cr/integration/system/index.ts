import request from '@/config/axios'

/** 接入系统 VO */
export interface IntegrationSystemVO {
  id?: number
  sysCode: string
  sysName: string
  /** 1 报送交换 / 2 数据采集 / 3 监管对接 */
  sysType: number
  owner: string
  contact: string
  callbackUrl: string
  secretMask: string
  status: number
  lastHeartbeat?: string
  heartbeatResult?: string
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询接入系统
export const getPage = (params: any) => {
  return request.get({ url: '/cr/integration-system/page', params })
}

// 查询接入系统详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/integration-system/get?id=' + id })
}

// 新增接入系统
export const create = (data: IntegrationSystemVO) => {
  return request.post({ url: '/cr/integration-system/create', data })
}

// 修改接入系统
export const update = (data: IntegrationSystemVO) => {
  return request.put({ url: '/cr/integration-system/update', data })
}

// 删除接入系统
export const remove = (id: number) => {
  return request.delete({ url: '/cr/integration-system/delete?id=' + id })
}

// 批量删除接入系统
export const removeList = (ids: number[]) => {
  return request.delete({
    url: '/cr/integration-system/delete-list',
    params: { ids: ids.join(',') }
  })
}

// 导出接入系统
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/integration-system/export-excel', params })
}

// 心跳检测（会写回最近心跳结论，属写操作，仅系统管理员）
export const heartbeatSystem = (id: number) => {
  return request.post({ url: '/cr/integration-system/heartbeat', data: { id } })
}

// 接入系统下拉
export const getSystemOptions = () => {
  return request.get({ url: '/cr/integration-system/simple-list-all' })
}
