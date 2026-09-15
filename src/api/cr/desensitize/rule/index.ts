import request from '@/config/axios'

/** 脱敏规则 VO */
export interface DesensRuleVO {
  id?: number
  ruleCode: string
  ruleName: string
  /** 见字典 cr_desensitize_type：MASK / HASH / REPLACE / TRUNCATE */
  ruleType: string
  ruleParam: string
  scope: string
  sampleFrom: string
  sampleTo?: string
  builtin?: boolean
  /** 见字典 cr_enable_status：1 启用 / 0 停用 */
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
}

// 分页查询脱敏规则
export const getRulePage = (params: any) => {
  return request.get({ url: '/cr/desens-rule/page', params })
}

// 查询脱敏规则详情
export const getRule = (id: number) => {
  return request.get({ url: '/cr/desens-rule/get?id=' + id })
}

// 新增脱敏规则
export const createRule = (data: DesensRuleVO) => {
  return request.post({ url: '/cr/desens-rule/create', data })
}

// 修改脱敏规则
export const updateRule = (data: DesensRuleVO) => {
  return request.put({ url: '/cr/desens-rule/update', data })
}

// 删除脱敏规则
export const deleteRule = (id: number) => {
  return request.delete({ url: '/cr/desens-rule/delete?id=' + id })
}

// 批量删除脱敏规则
export const deleteRuleList = (ids: number[]) => {
  return request.delete({ url: '/cr/desens-rule/delete-list', params: { ids: ids.join(',') } })
}

// 导出脱敏规则
export const exportRule = (params: any) => {
  return request.download({ url: '/cr/desens-rule/export-excel', params })
}

// 启用 / 停用规则
export const toggleRule = (id: number) => {
  return request.put({ url: '/cr/desens-rule/toggle', data: { id } })
}
