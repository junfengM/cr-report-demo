import request from '@/config/axios'

/** 拆分规则 VO */
export interface SplitRuleVO {
  id?: number
  /** 规则编码：SR + 三位序号（留空由服务端生成） */
  ruleCode?: string
  ruleName: string
  /** 0 = 全部机构 */
  orgId: number
  orgName?: string
  /** 0 = 全部报表 */
  reportId: number
  reportCode?: string
  reportName?: string
  /** 1 按行数均分 / 2 按字段值分组 / 3 不拆分，见字典 cr_split_mode */
  mode: number
  /** 按行数均分时每包最多多少行 */
  rowsPerPackage: number
  /** 按字段值分组时的拆分字段（cr.fillData 字段名） */
  splitField: string
  splitFieldLabel?: string
  /** 包名前缀，如 BJ-BX011 → BJ-BX011-P01 */
  pkgPrefix: string
  /** 优先级：数字小的先生效（同范围多条规则时用，缺省 50） */
  priority?: number
  status: number
  updateUser?: string
  updateTime?: string
  remark?: string
}

// 分页查询拆分规则
export const getSplitRulePage = (params: any) => {
  return request.get({ url: '/cr/split-rule/page', params })
}

// 查询拆分规则详情
export const getSplitRule = (id: number) => {
  return request.get({ url: '/cr/split-rule/get?id=' + id })
}

// 新增拆分规则
export const createSplitRule = (data: SplitRuleVO) => {
  return request.post({ url: '/cr/split-rule/create', data })
}

// 修改拆分规则
export const updateSplitRule = (data: SplitRuleVO) => {
  return request.put({ url: '/cr/split-rule/update', data })
}

// 删除拆分规则
export const deleteSplitRule = (id: number) => {
  return request.delete({ url: '/cr/split-rule/delete?id=' + id })
}

// 启用 / 停用拆分规则
export const toggleSplitRule = (id: number) => {
  return request.put({ url: '/cr/split-rule/toggle', data: { id } })
}

// 导出拆分规则
export const exportSplitRule = (params: any) => {
  return request.download({ url: '/cr/split-rule/export-excel', params })
}
