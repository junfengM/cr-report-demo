import request from '@/config/axios'

/** 口径信息 VO */
export interface CaliberVO {
  id?: number
  caliberCode: string
  caliberName: string
  /** 1 取数口径 / 2 计算口径 / 3 汇总口径 / 4 折算口径，见字典 cr_caliber_type */
  caliberType: number
  reportId?: number
  reportCode: string
  reportName: string
  targetCode: string
  targetName: string
  sourceTable: string
  sourceField: string
  /** 取数规则 / 计算公式 */
  formula: string
  owner: string
  version: string
  effectDate: string
  status: number
  remark: string
  createTime?: string
}

// 分页查询口径信息
export const getCaliberPage = (params: any) => {
  return request.get({ url: '/cr/message-caliber/page', params })
}

// 查询口径信息详情
export const getCaliber = (id: number) => {
  return request.get({ url: '/cr/message-caliber/get?id=' + id })
}

// 新增口径信息
export const createCaliber = (data: CaliberVO) => {
  return request.post({ url: '/cr/message-caliber/create', data })
}

// 修改口径信息
export const updateCaliber = (data: CaliberVO) => {
  return request.put({ url: '/cr/message-caliber/update', data })
}

// 删除口径信息
export const deleteCaliber = (id: number) => {
  return request.delete({ url: '/cr/message-caliber/delete?id=' + id })
}

// 批量删除口径信息
export const deleteCaliberList = (ids: number[]) => {
  return request.delete({ url: '/cr/message-caliber/delete-list', params: { ids: ids.join(',') } })
}

// 导出口径信息
export const exportCaliber = (params: any) => {
  return request.download({ url: '/cr/message-caliber/export-excel', params })
}
