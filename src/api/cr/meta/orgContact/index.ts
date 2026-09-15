import request from '@/config/axios'

/** 机构联系人配置 VO */
export interface OrgContactVO {
  id?: number
  /** 所属机构名称 */
  orgName: string
  /** 联系人姓名 */
  contactName: string
  /** 联系电话 */
  contactPhone: string
  /** 联系邮箱 */
  contactEmail: string
  /** 职责：报送负责人 / 数据填报人 / 复核人 / 审核人 */
  duty: string
  status: number
  createTime?: string
}

// 分页查询机构联系人配置
export const getOrgContactPage = (params: any) => {
  return request.get({ url: '/cr/org-contact/page', params })
}

// 查询机构联系人配置详情
export const getOrgContact = (id: number) => {
  return request.get({ url: '/cr/org-contact/get?id=' + id })
}

// 新增机构联系人配置
export const createOrgContact = (data: OrgContactVO) => {
  return request.post({ url: '/cr/org-contact/create', data })
}

// 修改机构联系人配置
export const updateOrgContact = (data: OrgContactVO) => {
  return request.put({ url: '/cr/org-contact/update', data })
}

// 删除机构联系人配置
export const deleteOrgContact = (id: number) => {
  return request.delete({ url: '/cr/org-contact/delete?id=' + id })
}

// 批量删除机构联系人配置
export const deleteOrgContactList = (ids: number[]) => {
  return request.delete({ url: '/cr/org-contact/delete-list', params: { ids: ids.join(',') } })
}

// 导出机构联系人配置
export const exportOrgContact = (params: any) => {
  return request.download({ url: '/cr/org-contact/export-excel', params })
}
