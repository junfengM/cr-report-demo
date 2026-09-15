import request from '@/config/axios'

/** 机构主机配置 VO（FTP 目标服务器） */
export interface OrgHostVO {
  id?: number
  /** 机构 / 监管局名称 */
  orgName: string
  /** 目标主机地址 */
  remoteHost: string
  /** 端口 */
  port: number
  /** 协议：FTP / SFTP */
  protocol: string
  /** 上报规则说明 */
  reportRule: string
  /** 上传路径 */
  uploadPath: string
  /** 下载路径 */
  downloadPath: string
  /** 登录用户名 */
  username: string
  status: number
  createTime?: string
}

// 分页查询机构主机配置
export const getOrgHostPage = (params: any) => {
  return request.get({ url: '/cr/org-host/page', params })
}

// 查询机构主机配置详情
export const getOrgHost = (id: number) => {
  return request.get({ url: '/cr/org-host/get?id=' + id })
}

// 新增机构主机配置
export const createOrgHost = (data: OrgHostVO) => {
  return request.post({ url: '/cr/org-host/create', data })
}

// 修改机构主机配置
export const updateOrgHost = (data: OrgHostVO) => {
  return request.put({ url: '/cr/org-host/update', data })
}

// 删除机构主机配置
export const deleteOrgHost = (id: number) => {
  return request.delete({ url: '/cr/org-host/delete?id=' + id })
}

// 批量删除机构主机配置
export const deleteOrgHostList = (ids: number[]) => {
  return request.delete({ url: '/cr/org-host/delete-list', params: { ids: ids.join(',') } })
}

// 导出机构主机配置
export const exportOrgHost = (params: any) => {
  return request.download({ url: '/cr/org-host/export-excel', params })
}
