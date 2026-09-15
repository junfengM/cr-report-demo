import request from '@/config/axios'

/** 机构下拉 */
export interface DesensOrgOptionVO {
  id: number
  orgName: string
}

/** 报表下拉 */
export interface DesensReportOptionVO {
  id: number
  reportCode: string
  reportName: string
}

/** 可脱敏数据项（报表数据项 ↔ 填报字段） */
export interface DesensColumnOptionVO {
  fieldKey: string
  columnCode: string
  columnName: string
  sensitive: string
}

/** 规则下拉 */
export interface DesensRuleOptionVO {
  id: number
  ruleCode: string
  ruleName: string
  ruleType: string
  ruleParam: string
  scope: string
}

// 机构下拉（含「全部机构」）
export const getDesensOrgOptions = () => {
  return request.get({ url: '/cr/desens-common/org-options' })
}

// 报表下拉
export const getDesensReportOptions = () => {
  return request.get({ url: '/cr/desens-common/report-options' })
}

// 期次下拉
export const getDesensPeriodOptions = () => {
  return request.get({ url: '/cr/desens-common/period-options' })
}

// 可脱敏数据项下拉
export const getDesensColumnOptions = () => {
  return request.get({ url: '/cr/desens-common/column-options' })
}

/** 命中条件可用字段（页面表单的字段提示用） */
export interface DesensConditionFieldVO {
  field: string
  label: string
}

/** 命中条件的字段清单 + 写法说明 + 服务端"今天" */
export interface DesensConditionHelpVO {
  fields: DesensConditionFieldVO[]
  help: string
  today: string
}

// 脱敏规则下拉（只含启用中的）
export const getDesensRuleOptions = () => {
  return request.get({ url: '/cr/desens-common/rule-options' })
}

// 命中条件可用字段与写法说明（生效期也以它的 today 为准）
export const getDesensConditionMeta = () => {
  return request.get({ url: '/cr/desens-common/condition-fields' })
}
