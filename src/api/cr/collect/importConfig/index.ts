import request from '@/config/axios'

/** 字段映射项：文件第 column 列 → 系统字段 field */
export interface ImportMappingItemVO {
  column: number
  field: string
  label: string
}

/** 导入设置 VO */
export interface ImportConfigVO {
  id?: number
  /** 0 表示全部机构 / 全部报表 */
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  /** 见字典 cr_file_type：1 CSV / 2 TXT / 3 XLSX */
  fileType: number
  separator: string
  charset: string
  headerRows: number
  startRow: number
  dateFormat: string
  mapping: ImportMappingItemVO[]
  strictCheck: boolean
  allowOverwrite: boolean
  needAudit: boolean
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
}

// 分页查询导入设置
export const getImportConfigPage = (params: any) => {
  return request.get({ url: '/cr/import-config/page', params })
}

// 查询导入设置详情
export const getImportConfig = (id: number) => {
  return request.get({ url: '/cr/import-config/get?id=' + id })
}

// 新增导入设置
export const createImportConfig = (data: ImportConfigVO) => {
  return request.post({ url: '/cr/import-config/create', data })
}

// 修改导入设置
export const updateImportConfig = (data: ImportConfigVO) => {
  return request.put({ url: '/cr/import-config/update', data })
}

// 删除导入设置
export const deleteImportConfig = (id: number) => {
  return request.delete({ url: '/cr/import-config/delete?id=' + id })
}

// 批量删除导入设置
export const deleteImportConfigList = (ids: number[]) => {
  return request.delete({ url: '/cr/import-config/delete-list', params: { ids: ids.join(',') } })
}

// 导出导入设置
export const exportImportConfig = (params: any) => {
  return request.download({ url: '/cr/import-config/export-excel', params })
}

// 取生效的导入设置（机构 + 报表 → 报表默认 → 机构默认 → 全局默认）
export const getEffectiveConfig = (orgId: number, reportId: number) => {
  return request.get({ url: '/cr/import-config/effective', params: { orgId, reportId } })
}

// 可映射的系统字段
export const getFieldOptions = () => {
  return request.get({ url: '/cr/import-config/field-options' })
}
