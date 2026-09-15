import request from '@/config/axios'

/** 监管字典 VO（码值字典维护页；监管侧标准字典，映射页的监管码值下拉按它过滤） */
export interface RegDictVO {
  id?: number
  /** 字典编码，如 REG_CHANNEL（大写字母/数字/下划线） */
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

// 分页查询监管字典
export const getRegDictPage = (params: any) => {
  return request.get({ url: '/cr/reg-dict/page', params })
}

// 查询监管字典详情
export const getRegDict = (id: number) => {
  return request.get({ url: '/cr/reg-dict/get?id=' + id })
}

// 新增监管字典
export const createRegDict = (data: RegDictVO) => {
  return request.post({ url: '/cr/reg-dict/create', data })
}

// 修改监管字典（改名会同步监管码值与映射上的字典名称）
export const updateRegDict = (data: RegDictVO) => {
  return request.put({ url: '/cr/reg-dict/update', data })
}

// 删除监管字典（字典下还有码值时不允删除）
export const deleteRegDict = (id: number) => {
  return request.delete({ url: '/cr/reg-dict/delete?id=' + id })
}

// 批量删除监管字典
export const deleteRegDictList = (ids: number[]) => {
  return request.delete({ url: '/cr/reg-dict/delete-list', params: { ids: ids.join(',') } })
}

// 导出监管字典
export const exportRegDict = (params: any) => {
  return request.download({ url: '/cr/reg-dict/export-excel', params })
}

// 监管字典下拉（供码值管理页选所属字典）
export const getRegDictOptions = () => {
  return request.get({ url: '/cr/reg-dict/simple-list' })
}
