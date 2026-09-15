import request from '@/config/axios'

/** 脱敏字段配置 VO */
export interface DesensFieldVO {
  id?: number
  /** 0 = 全部机构（兜底配置） */
  orgId: number
  orgName?: string
  reportId: number
  reportCode?: string
  reportName?: string
  columnCode?: string
  columnName?: string
  /** 填报数据上的字段名，如 holderName / certNo / policyNo */
  fieldKey: string
  ruleId: number
  ruleCode?: string
  ruleName?: string
  ruleType?: string
  ruleParam?: string
  priority: number
  /** 命中条件：`字段 运算符 值`，多条件 && / || 连接；空 = 全量脱敏 */
  condition?: string
  /** 生效期开始（YYYY-MM-DD，空 = 不限） */
  effectiveFrom?: string
  /** 生效期结束（YYYY-MM-DD，空 = 不限） */
  effectiveTo?: string
  /** 适用期次（空 = 全部期次）：只在该期次的脱敏执行中参与 */
  periods?: string[]
  /** 见字典 cr_enable_status */
  status: number
  updateUser?: string
  updateTime?: string
  remark?: string
}

// 分页查询脱敏字段配置
export const getFieldPage = (params: any) => {
  return request.get({ url: '/cr/desens-field/page', params })
}

// 查询脱敏字段配置详情
export const getField = (id: number) => {
  return request.get({ url: '/cr/desens-field/get?id=' + id })
}

// 新增脱敏字段配置
export const createField = (data: DesensFieldVO) => {
  return request.post({ url: '/cr/desens-field/create', data })
}

// 修改脱敏字段配置
export const updateField = (data: DesensFieldVO) => {
  return request.put({ url: '/cr/desens-field/update', data })
}

// 删除脱敏字段配置
export const deleteField = (id: number) => {
  return request.delete({ url: '/cr/desens-field/delete?id=' + id })
}

// 批量删除脱敏字段配置
export const deleteFieldList = (ids: number[]) => {
  return request.delete({ url: '/cr/desens-field/delete-list', params: { ids: ids.join(',') } })
}

// 导出脱敏字段配置
export const exportField = (params: any) => {
  return request.download({ url: '/cr/desens-field/export-excel', params })
}

// 启用 / 停用字段配置
export const toggleField = (id: number) => {
  return request.put({ url: '/cr/desens-field/toggle', data: { id } })
}

/** 条件校验结果：ok=false 时 error 是中文原因；给了机构/报表/期次还会试算命中行数 */
export interface DesensConditionCheckVO {
  condition: string
  ok: boolean
  error: string
  items: Array<{ field: string; fieldKey: string; op: string; value: string; text: string }>
  fieldOptions: Array<{ field: string; label: string }>
  totalRows?: number
  matched?: number
  skipped?: number
}

/** 字段配置的生效判定：列表上标「生效中 / 被覆盖 / 不在生效期 / 已停用」 */
export interface DesensFieldDecisionVO {
  id: number
  /** active 生效中 / shadowed 被同范围其它配置覆盖 / window 不在生效期 / disabled 配置或规则已停用 */
  state: 'active' | 'shadowed' | 'window' | 'disabled'
  reason: string
  winnerId: number
  winnerRule: string
  winnerPriority: number
}

// 字段配置的生效判定（含每条配置的生效期文本）
export const getFieldDecisions = () => {
  return request.get({ url: '/cr/desens-field/decisions' })
}

// 校验命中条件（保存前先验一下语法，可选地按机构 × 报表 × 期次试算命中行数）
export const checkFieldCondition = (data: {
  condition: string
  orgId?: number
  reportId?: number
  period?: string
}) => {
  return request.post({ url: '/cr/desens-field/check-condition', data })
}
