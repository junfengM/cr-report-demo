import request from '@/config/axios'

/** 填报记录 VO（机构 × 报表 × 期次） */
export interface FillRecordVO {
  id?: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 数据行数 */
  rowCount: number
  /** 填报状态：见字典 cr_fill_status */
  fillStatus: number
  /** 校验状态：见字典 cr_check_status */
  checkStatus: number
  fillUser: string
  lastModifier: string
  lastModifyTime: string
  deadline: string
  submitTime: string
  remark: string
}

/** 可编辑表格列定义 */
export interface FillColumnVO {
  field: string
  label: string
  width?: number
  minWidth?: number
  align: string
  editor: 'input' | 'number' | 'date' | 'none'
  numeric?: boolean
  required?: boolean
}

/** 填报数据明细 VO（字段与列定义一一对应） */
export interface FillDataVO {
  id?: number
  rowNo?: number
  policyNo: string
  holderName: string
  certNo: string
  productName: string
  sumAssured: number
  premiumAmount: number
  rate: number
  effectDate: string
  channel: string
  dataStatus: string
  remark: string
  updateTime?: string
  orgId?: number
  orgName?: string
  reportId?: number
  reportName?: string
  period?: string
}

/** 填报表单加载结果 */
export interface FillFormVO {
  record: FillRecordVO
  columns: FillColumnVO[]
  rows: FillDataVO[]
}

/** 校验问题项 */
export interface FillCheckItemVO {
  rowIndex: number
  column: string
  columnLabel: string
  message: string
  /** 1 警告 / 2 错误（见字典 cr_error_level） */
  level: number
  value: string
}

/** 校验结果 */
export interface FillCheckResultVO {
  items: FillCheckItemVO[]
  total: number
  passCount: number
  warnCount: number
  errorCount: number
  checkTime: string
}

/** 修改历史 */
export interface FillHistoryVO {
  id: number
  recordId: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  action: string
  detail: string
  beforeValue: string
  afterValue: string
  operator: string
  operateTime: string
}

/** 机构下拉 */
export interface OrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

/** 报表下拉 */
export interface ReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

// 填报记录分页
export const getFillRecordPage = (params: any) => request.get({ url: '/cr/data-fill/page', params })

// 加载某「机构 × 报表 × 期次」的填报表单（记录 + 列定义 + 明细数据）
export const getFillData = (params: { orgId: number; reportId: number; period: string }) =>
  request.get({ url: '/cr/data-fill/get', params })

// 保存填报数据
export const saveFillData = (data: {
  orgId: number
  reportId: number
  period: string
  rows: FillDataVO[]
}) => request.put({ url: '/cr/data-fill/save', data })

// 数据校验（以页面当前数据为准）
export const checkFillData = (data: {
  orgId: number
  reportId: number
  period: string
  rows: FillDataVO[]
}) => request.post({ url: '/cr/data-fill/check', data })

// 修改历史
export const getFillHistory = (params: {
  orgId?: number
  reportId?: number
  period?: string
  recordId?: number
}) => request.get({ url: '/cr/data-fill/history', params })

// 数据恢复：回滚到上次保存版本
export const restoreFillData = (data: { orgId: number; reportId: number; period: string }) =>
  request.put({ url: '/cr/data-fill/restore', data })

// 计算：保险金额 = 保费金额 × 费率
export const calculateFillData = (data: {
  orgId: number
  reportId: number
  period: string
  rows: FillDataVO[]
}) => request.put({ url: '/cr/data-fill/calculate', data })

// 导出填报数据
export const exportFillData = (params: { orgId: number; reportId: number; period: string }) =>
  request.download({ url: '/cr/data-fill/export-excel', params })

// 机构下拉
export const getFillOrgOptions = () => request.get({ url: '/cr/data-fill/org-options' })

// 报表下拉
export const getFillReportOptions = () => request.get({ url: '/cr/data-fill/report-options' })

// 期次下拉
export const getFillPeriodOptions = () => request.get({ url: '/cr/data-fill/period-options' })
