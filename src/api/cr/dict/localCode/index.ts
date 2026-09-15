import request from '@/config/axios'

/** 本地枚举（本地库码值）VO */
export interface LocalCodeVO {
  id?: number
  /** 所属本地字典编码，如 LOCAL_CHANNEL */
  localDict: string
  localDictName?: string
  localCode: string
  localName: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  remark: string
  createTime?: string
  /** 列表附带：被多少条映射引用 / 其中启用几条 / 最终生效的监管码值 */
  mappingCount?: number
  enabledMappingCount?: number
  effectiveRegCode?: string
}

// 分页查询本地枚举
export const getLocalCodePage = (params: any) => {
  return request.get({ url: '/cr/local-code/page', params })
}

// 查询本地枚举详情
export const getLocalCode = (id: number) => {
  return request.get({ url: '/cr/local-code/get?id=' + id })
}

// 新增本地枚举
export const createLocalCode = (data: LocalCodeVO) => {
  return request.post({ url: '/cr/local-code/create', data })
}

// 修改本地枚举
export const updateLocalCode = (data: LocalCodeVO) => {
  return request.put({ url: '/cr/local-code/update', data })
}

// 删除本地枚举（被映射引用时不允删除）
export const deleteLocalCode = (id: number) => {
  return request.delete({ url: '/cr/local-code/delete?id=' + id })
}

// 批量删除本地枚举
export const deleteLocalCodeList = (ids: number[]) => {
  return request.delete({ url: '/cr/local-code/delete-list', params: { ids: ids.join(',') } })
}

// 导出本地枚举
export const exportLocalCode = (params: any) => {
  return request.download({ url: '/cr/local-code/export-excel', params })
}
