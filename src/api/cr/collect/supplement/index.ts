import request from '@/config/axios'

/** 数据补录申请 VO */
export interface SupplementVO {
  id?: number
  applyNo?: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 1 整表补录 / 2 指定行补录 */
  scopeType: number
  rowCount: number
  reason: string
  applyUser: string
  applyTime?: string
  /** 见字典 cr_supplement_status：1 待审核 / 2 已通过 / 3 已驳回 / 4 已补录 */
  status: number
  auditor?: string
  auditTime?: string
  auditRemark?: string
  finishTime?: string
  attachment: string
  remark: string
}

/** 补录申请附件 VO（file-list 不返回 content，只有 file-content 才带 data URL） */
export interface SupplementFileVO {
  id: number
  supplementId?: number
  applyNo?: string
  fileName: string
  /** 扩展名，服务端按文件名后缀小写化 */
  fileExt: string
  fileSize: number
  uploadUser?: string
  uploadTime?: string
  /** 仅 file-content 返回：data URL（data:xxx;base64,...），可直接给 img 用 */
  content?: string
}

/** 附件相关接口的权限标识见 mock/db/menu.ts：cr:collect-supplement:query / upload-file / download-file / delete-file */

// 分页查询补录申请
export const getSupplementPage = (params: any) => {
  return request.get({ url: '/cr/collect-supplement/page', params })
}

// 查询补录申请详情
export const getSupplement = (id: number) => {
  return request.get({ url: '/cr/collect-supplement/get?id=' + id })
}

// 新增补录申请
export const createSupplement = (data: SupplementVO) => {
  return request.post({ url: '/cr/collect-supplement/create', data })
}

// 修改补录申请
export const updateSupplement = (data: SupplementVO) => {
  return request.put({ url: '/cr/collect-supplement/update', data })
}

// 删除补录申请
export const deleteSupplement = (id: number) => {
  return request.delete({ url: '/cr/collect-supplement/delete?id=' + id })
}

// 批量删除补录申请
export const deleteSupplementList = (ids: number[]) => {
  return request.delete({
    url: '/cr/collect-supplement/delete-list',
    params: { ids: ids.join(',') }
  })
}

// 导出补录申请
export const exportSupplement = (params: any) => {
  return request.download({ url: '/cr/collect-supplement/export-excel', params })
}

// 补录申请审核
export const auditSupplement = (data: {
  id: number
  pass: boolean
  remark?: string
  operator?: string
}) => {
  return request.post({ url: '/cr/collect-supplement/audit', data })
}

// 执行补录（打开补录通道，返回数据填报页深链）
export const executeSupplement = (data: { id: number; operator?: string }) => {
  return request.post({ url: '/cr/collect-supplement/execute', data })
}

// 上传补录附件：content 传 data URL（页面用 FileReader.readAsDataURL 读出来）
export const uploadSupplementFile = (data: {
  supplementId: number
  fileName: string
  fileSize: number
  content: string
}) => {
  return request.post({ url: '/cr/collect-supplement/upload-file', data })
}

// 补录附件列表（不含 content，可放心在列表页批量拉）
export const getSupplementFileList = (supplementId: number) => {
  return request.get({ url: '/cr/collect-supplement/file-list', params: { supplementId } })
}

// 补录附件内容（含 base64 data URL，下载与预览都读它）
export const getSupplementFileContent = (id: number) => {
  return request.get({ url: '/cr/collect-supplement/file-content', params: { id } })
}

// 删除补录附件
export const deleteSupplementFile = (id: number) => {
  return request.delete({ url: '/cr/collect-supplement/file', params: { id } })
}

// 补录上下文（该机构该报表本期已有多少数据 / 导入批次 / 是否允许补录）
export const getSupplementContext = (params: {
  orgId: number
  reportId: number
  period: string
}) => {
  return request.get({ url: '/cr/collect-supplement/context', params })
}
