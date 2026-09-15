import request from '@/config/axios'

/** 机构上报配置 VO（各地监管局上报要求） */
export interface OrgReportVO {
  id?: number
  /** 报送机构 id */
  orgId: number
  /** 报送机构名称（冗余展示） */
  orgName: string
  /** 上报方式：FTP / SFTP / MANUAL，见字典 cr_report_type */
  reportType: string
  /** 监管局名称 */
  regulator: string
  /** 上报路径 */
  uploadPath: string
  /** 下载路径（反馈报文） */
  downloadPath: string
  /** 文件命名规则 */
  fileRule: string
  /** 是否压缩 */
  compress: boolean
  status: number
  createTime?: string
}

// 分页查询机构上报配置
export const getOrgReportPage = (params: any) => {
  return request.get({ url: '/cr/org-report/page', params })
}

// 查询机构上报配置详情
export const getOrgReport = (id: number) => {
  return request.get({ url: '/cr/org-report/get?id=' + id })
}

// 新增机构上报配置
export const createOrgReport = (data: OrgReportVO) => {
  return request.post({ url: '/cr/org-report/create', data })
}

// 修改机构上报配置
export const updateOrgReport = (data: OrgReportVO) => {
  return request.put({ url: '/cr/org-report/update', data })
}

// 删除机构上报配置
export const deleteOrgReport = (id: number) => {
  return request.delete({ url: '/cr/org-report/delete?id=' + id })
}

// 批量删除机构上报配置
export const deleteOrgReportList = (ids: number[]) => {
  return request.delete({ url: '/cr/org-report/delete-list', params: { ids: ids.join(',') } })
}

// 导出机构上报配置
export const exportOrgReport = (params: any) => {
  return request.download({ url: '/cr/org-report/export-excel', params })
}
