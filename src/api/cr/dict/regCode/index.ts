import request from '@/config/axios'

/** 监管码值 VO（码值管理页；监管方发布的码值清单） */
export interface RegCodeVO {
  id?: number
  /** 所属监管字典编码，如 REG_CHANNEL */
  regDict: string
  regDictName?: string
  /** 监管码值，如 A01 */
  regCode: string
  regName: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  remark: string
  createTime?: string
  /** 列表附带：被多少条映射引用 / 其中启用几条 / 引用它的本地码值 */
  mappingCount?: number
  enabledMappingCount?: number
  mappedLocal?: string
}

// 分页查询监管码值
export const getRegCodePage = (params: any) => {
  return request.get({ url: '/cr/reg-code/page', params })
}

// 查询监管码值详情
export const getRegCode = (id: number) => {
  return request.get({ url: '/cr/reg-code/get?id=' + id })
}

// 新增监管码值
export const createRegCode = (data: RegCodeVO) => {
  return request.post({ url: '/cr/reg-code/create', data })
}

// 修改监管码值
export const updateRegCode = (data: RegCodeVO) => {
  return request.put({ url: '/cr/reg-code/update', data })
}

// 删除监管码值（被映射引用时不允删除）
export const deleteRegCode = (id: number) => {
  return request.delete({ url: '/cr/reg-code/delete?id=' + id })
}

// 批量删除监管码值
export const deleteRegCodeList = (ids: number[]) => {
  return request.delete({ url: '/cr/reg-code/delete-list', params: { ids: ids.join(',') } })
}

// 导出监管码值
export const exportRegCode = (params: any) => {
  return request.download({ url: '/cr/reg-code/export-excel', params })
}
