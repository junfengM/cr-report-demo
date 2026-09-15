import request from '@/config/axios'

/** 接入附件 VO */
export interface IntegrationAttachmentVO {
  id?: number
  sysCode: string
  sysName?: string
  fileName: string
  fileExt?: string
  fileSize: number
  /** 1 报送报文 / 2 监管回执 / 3 校验报告 / 4 其他 */
  bizType: number
  uploadUser?: string
  uploadTime?: string
  /** 内容指纹（轻量哈希，页面已如实标注） */
  contentHash?: string
  /** 1 已接收 / 2 校验通过 / 3 校验失败 */
  status: number
  checkMessage?: string
  content?: string
  remark: string
}

// 分页查询接入附件
export const getPage = (params: any) => {
  return request.get({ url: '/cr/integration-attachment/page', params })
}

// 查询接入附件详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/integration-attachment/get?id=' + id })
}

// 新增接入附件
export const create = (data: IntegrationAttachmentVO) => {
  return request.post({ url: '/cr/integration-attachment/create', data })
}

// 修改接入附件
export const update = (data: IntegrationAttachmentVO) => {
  return request.put({ url: '/cr/integration-attachment/update', data })
}

// 删除接入附件
export const remove = (id: number) => {
  return request.delete({ url: '/cr/integration-attachment/delete?id=' + id })
}

// 批量删除接入附件
export const removeList = (ids: number[]) => {
  return request.delete({
    url: '/cr/integration-attachment/delete-list',
    params: { ids: ids.join(',') }
  })
}

// 导出接入附件
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/integration-attachment/export-excel', params })
}

/** 附件口径（业务类型 / 扩展名白名单 / 大小上限） */
export interface AttachmentMetaVO {
  bizTypes: Array<{ value: number; label: string }>
  exts: string[]
  maxSize: number
  sysTypes: Array<{ value: number; label: string }>
}

/** 接收附件结果 */
export interface AttachmentUploadVO {
  id: number
  status: number
  statusLabel: string
  checkMessage: string
  contentHash: string
}

// 接收附件（真存内容，能下载；仅系统管理员）
export const uploadAttachment = (data: {
  sysCode: string
  fileName: string
  bizType: number
  content: string
  fileSize?: number
  remark?: string
}) => {
  return request.post({ url: '/cr/integration-attachment/upload', data })
}

// 重新校验（改写校验状态，仅系统管理员）
export const recheckAttachment = (id: number) => {
  return request.post({ url: '/cr/integration-attachment/recheck', data: { id } })
}

// 下载附件内容（只读）
export const getAttachmentContent = (id: number) => {
  return request.get({ url: '/cr/integration-attachment/content', params: { id } })
}

// 附件口径
export const getAttachmentMeta = () => {
  return request.get({ url: '/cr/integration-attachment/meta' })
}
