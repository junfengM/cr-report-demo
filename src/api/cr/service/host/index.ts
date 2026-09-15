import request from '@/config/axios'

/** 服务主机 VO */
export interface ServiceHostVO {
  id?: number
  hostCode: string
  hostName: string
  /** 1 SFTP / 2 FTP / 3 HTTP */
  hostType: number
  address: string
  port: number
  username: string
  /** 1 密码 / 2 密钥 */
  authType: number
  secretId: number
  secretName?: string
  protocol: string
  status: number
  lastCheckTime?: string
  checkResult?: string
  checkCost?: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询服务主机
export const getPage = (params: any) => {
  return request.get({ url: '/cr/service-host/page', params })
}

// 查询服务主机详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/service-host/get?id=' + id })
}

// 新增服务主机
export const create = (data: ServiceHostVO) => {
  return request.post({ url: '/cr/service-host/create', data })
}

// 修改服务主机
export const update = (data: ServiceHostVO) => {
  return request.put({ url: '/cr/service-host/update', data })
}

// 删除服务主机
export const remove = (id: number) => {
  return request.delete({ url: '/cr/service-host/delete?id=' + id })
}

// 批量删除服务主机
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/service-host/delete-list', params: { ids: ids.join(',') } })
}

// 导出服务主机
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/service-host/export-excel', params })
}

// 连接测试（会写回最近检查结论，属写操作，仅系统管理员）
export const testHost = (id: number) => {
  return request.post({ url: '/cr/service-host/test', data: { id } })
}

/** 服务管理口径（主机类型 / 认证方式 / 密钥类型） */
export interface ServiceMetaVO {
  hostTypes: Array<{ value: number; label: string }>
  authTypes: Array<{ value: number; label: string }>
  secretTypes: Array<{ value: number; label: string }>
}

// 口径下拉
export const getServiceMeta = () => {
  return request.get({ url: '/cr/service-common/meta' })
}

// 密钥下拉（主机表单绑定）
export const getSecretOptions = () => {
  return request.get({ url: '/cr/service-secret/simple-list-all' })
}
