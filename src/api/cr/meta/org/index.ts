import request from '@/config/axios'

/** 报送机构 VO（机构树节点） */
export interface OrgVO {
  id?: number
  /** 机构编码（监管口径） */
  orgCode: string
  /** 机构名称 */
  orgName: string
  parentId: number
  /** 层级：1 总公司 / 2 分公司 / 3 中心支公司 */
  orgLevel: number
  /** 机构类型：1 总公司 / 2 省级分公司 / 3 中心支公司 */
  orgType: number
  /** 所属监管局 */
  regulator: string
  /** 负责人 */
  leader: string
  phone: string
  /** 状态：见字典 common_status */
  status: number
  sort: number
  remark: string
  createTime?: string
  children?: OrgVO[]
}

/** 机构下拉选项 VO */
export interface OrgOptionVO {
  id: number
  name: string
  code: string
}

// 查询机构树（返回树形结构，节点含 children）
export const getOrganizationTree = (params?: any) => {
  return request.get({ url: '/cr/organization/list', params })
}

// 查询机构下拉列表（扁平：id / name / code）
export const getOrganizationSimpleList = () => {
  return request.get({ url: '/cr/organization/simple-list' })
}

// 查询机构详情
export const getOrganization = (id: number) => {
  return request.get({ url: '/cr/organization/get?id=' + id })
}

// 新增机构
export const createOrganization = (data: OrgVO) => {
  return request.post({ url: '/cr/organization/create', data })
}

// 修改机构
export const updateOrganization = (data: OrgVO) => {
  return request.put({ url: '/cr/organization/update', data })
}

// 删除机构
export const deleteOrganization = (id: number) => {
  return request.delete({ url: '/cr/organization/delete?id=' + id })
}

// 批量删除机构
export const deleteOrganizationList = (ids: number[]) => {
  return request.delete({ url: '/cr/organization/delete-list', params: { ids: ids.join(',') } })
}

// 导出机构
export const exportOrganization = (params: any) => {
  return request.download({ url: '/cr/organization/export-excel', params })
}
