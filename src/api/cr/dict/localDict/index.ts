import request from '@/config/axios'

/** 本地字典 VO（本地库的字典分类，本地码值与映射都按 code 关联） */
export interface LocalDictVO {
  id?: number
  /** 字典编码，如 LOCAL_CHANNEL（大写字母/数字/下划线，创建后不建议改） */
  code: string
  name: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
  /** 列表附带：该字典下的码值条数 */
  codeCount?: number
}

// 分页查询本地字典
export const getLocalDictPage = (params: any) => {
  return request.get({ url: '/cr/local-dict/page', params })
}

// 查询本地字典详情
export const getLocalDict = (id: number) => {
  return request.get({ url: '/cr/local-dict/get?id=' + id })
}

// 新增本地字典
export const createLocalDict = (data: LocalDictVO) => {
  return request.post({ url: '/cr/local-dict/create', data })
}

// 修改本地字典（改名会同步码值与映射上的字典名称）
export const updateLocalDict = (data: LocalDictVO) => {
  return request.put({ url: '/cr/local-dict/update', data })
}

// 删除本地字典（字典下还有码值时不允删除）
export const deleteLocalDict = (id: number) => {
  return request.delete({ url: '/cr/local-dict/delete?id=' + id })
}

// 批量删除本地字典
export const deleteLocalDictList = (ids: number[]) => {
  return request.delete({ url: '/cr/local-dict/delete-list', params: { ids: ids.join(',') } })
}

// 导出本地字典
export const exportLocalDict = (params: any) => {
  return request.download({ url: '/cr/local-dict/export-excel', params })
}

// 本地字典下拉（供本地枚举页选所属字典）
export const getLocalDictOptions = () => {
  return request.get({ url: '/cr/local-dict/simple-list' })
}
