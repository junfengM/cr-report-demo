import request from '@/config/axios'

/** 规则类型：与字典 cr_rule_type 一致 */
export const CheckRuleType = {
  NOT_NULL: 1,
  LENGTH: 2,
  RANGE: 3,
  LOGIC: 4,
  INTER_TABLE: 5,
  ENUM: 6
} as const

/** 错误级别：与字典 cr_error_level 一致 */
export const CheckErrorLevel = {
  WARN: 1,
  ERROR: 2
} as const

/** 比较符 */
export const CHECK_OPERATORS = [
  { label: '=', value: '=' },
  { label: '≠', value: '!=' },
  { label: '>', value: '>' },
  { label: '≥', value: '>=' },
  { label: '<', value: '<' },
  { label: '≤', value: '<=' }
]

/** 校验规则 VO */
export interface CheckRuleVO {
  id?: number
  ruleCode: string
  ruleName: string
  /** 规则类型，见字典 cr_rule_type */
  ruleType: number
  /** 错误级别，见字典 cr_error_level */
  errorLevel: number
  /** 适用报表 id 列表 */
  reportIds: number[]
  /** 适用报表名称（后端冗余返回，列表直接展示） */
  reportNames?: string[]
  leftExpression: string
  operator: string
  rightExpression: string
  errorMessage: string
  status: number
  remark: string
  createTime?: string
}

/** 报表下拉选项 */
export interface CheckReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

// 分页查询校验规则
export const getCheckRulePage = (params: any) => {
  return request.get({ url: '/cr/check-rule/page', params })
}

// 查询校验规则详情
export const getCheckRule = (id: number) => {
  return request.get({ url: '/cr/check-rule/get?id=' + id })
}

// 新增校验规则
export const createCheckRule = (data: CheckRuleVO) => {
  return request.post({ url: '/cr/check-rule/create', data })
}

// 修改校验规则
export const updateCheckRule = (data: CheckRuleVO) => {
  return request.put({ url: '/cr/check-rule/update', data })
}

// 删除校验规则
export const deleteCheckRule = (id: number) => {
  return request.delete({ url: '/cr/check-rule/delete?id=' + id })
}

// 批量删除校验规则
export const deleteCheckRuleList = (ids: number[]) => {
  return request.delete({ url: '/cr/check-rule/delete-list', params: { ids: ids.join(',') } })
}

// 导出校验规则
export const exportCheckRule = (params: any) => {
  return request.download({ url: '/cr/check-rule/export-excel', params })
}

// 适用报表下拉选项
export const getCheckRuleReportOptions = () => {
  return request.get({ url: '/cr/check-rule/report-options' })
}
