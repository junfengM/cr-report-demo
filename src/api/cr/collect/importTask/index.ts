import request from '@/config/axios'

/** 导入任务（批次）VO */
export interface ImportTaskVO {
  id?: number
  batchNo?: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  fileName: string
  fileSize: number
  fileType: number
  totalRows: number
  successRows: number
  failRows: number
  /** 见字典 cr_import_status：1 解析中 / 2 解析失败 / 3 待审核 / 4 已入库 / 5 已驳回 */
  status: number
  sourceType: number
  importer: string
  importTime?: string
  importCost: number
  auditor: string
  auditTime: string
  auditRemark: string
  writtenRows: number
  remark: string
}

/** 导入明细行（暂存数据 / 错误行） */
export interface ImportRowVO {
  id: number
  rowNo: number
  policyNo?: string
  holderName?: string
  certNo?: string
  productName?: string
  premiumAmount?: number
  rate?: number
  sumAssured?: number
  effectDate?: string
  channel?: string
  dataStatus?: string
  content?: string
  errorField?: string
  errorMsg?: string
  level?: number
}

/** 批次详情 */
export interface ImportDetailVO {
  task: ImportTaskVO
  dataRows: ImportRowVO[]
  dataTotal: number
  errorRows: ImportRowVO[]
  logs: any[]
  stagingFieldOptions: Array<{ field: string; label: string }>
}

/** 页面解析完成后提交给后端的入参 */
export interface ImportParseVO {
  orgId: number
  reportId: number
  period: string
  fileName: string
  fileSize: number
  fileType: number
  totalRows: number
  cost: number
  validRows: Array<Record<string, any>>
  errorRows: Array<{
    rowNo: number
    content: string
    errorField: string
    errorMsg: string
    level: number
  }>
  operator?: string
  remark?: string
}

/** 导入权限（生效的那一条） */
export interface EffectiveImportAuthVO {
  matched: boolean
  superAdmin: boolean
  canImport: boolean
  canOverwrite: boolean
  needAudit: boolean
  /** 单批上限行数，0 = 不限制 */
  maxRows: number
  ruleId: number
  source: string
  userId: number
  userName: string
  roleNames: string[]
  rules: any[]
}

/** 我的导入权限（页面横幅读它，与后端拦截同源） */
export interface MyImportAuthVO {
  auth: EffectiveImportAuthVO
  orgId: number
  reportId: number
  existRows: number
  /** 生效策略 = 导入设置 且 导入权限 */
  allowOverwrite: boolean
  needAudit: boolean
  configAllowOverwrite: boolean
  configNeedAudit: boolean
  message: string
}

/** 解析入库结果 */
export interface ImportParseResultVO {
  id: number
  batchNo: string
  status: number
  totalRows: number
  successRows: number
  failRows: number
  writtenRows: number
  strictFailed: boolean
  needAudit: boolean
  overlay: boolean
  authSource?: string
  message: string
}

// 分页查询导入批次
export const getImportTaskPage = (params: any) => {
  return request.get({ url: '/cr/collect-import/page', params })
}

// 查询导入批次详情
export const getImportTask = (id: number) => {
  return request.get({ url: '/cr/collect-import/get?id=' + id })
}

// 查询导入批次明细（暂存数据 / 错误行 / 日志）
export const getImportDetail = (id: number) => {
  return request.get({ url: '/cr/collect-import/detail', params: { id } })
}

// 我的导入权限（当前登录人在这组「机构 × 报表」上生效的导入权限）
export const getMyImportAuth = (params: { orgId?: number; reportId?: number }) => {
  return request.get({ url: '/cr/collect-import/my-auth', params })
}

// 删除导入批次
export const deleteImportTask = (id: number) => {
  return request.delete({ url: '/cr/collect-import/delete?id=' + id })
}

// 删除批次（已入库的先回滚）
export const removeImportTask = (id: number) => {
  return request.delete({ url: '/cr/collect-import/remove?id=' + id })
}

// 批量删除导入批次
export const deleteImportTaskList = (ids: number[]) => {
  return request.delete({ url: '/cr/collect-import/delete-list', params: { ids: ids.join(',') } })
}

// 导出导入批次
export const exportImportTask = (params: any) => {
  return request.download({ url: '/cr/collect-import/export-excel', params })
}

// 提交解析结果（页面已按生效模板解析完文件）
export const parseImport = (data: ImportParseVO) => {
  return request.post({ url: '/cr/collect-import/parse', data })
}

// 审核批次（通过才写填报数据）
export const auditImportTask = (data: {
  id: number
  pass: boolean
  remark?: string
  operator?: string
}) => {
  return request.post({ url: '/cr/collect-import/audit', data })
}

// 回滚已入库批次
export const rollbackImportTask = (data: { id: number; operator?: string }) => {
  return request.post({ url: '/cr/collect-import/rollback', data })
}
