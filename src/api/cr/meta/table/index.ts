import request from '@/config/axios'

/** 数据表 VO（监管数据表） */
export interface MetaTableVO {
  id?: number
  /** 所属主题域 id */
  subjectId: number
  /** 所属主题域名称（冗余展示） */
  subjectName: string
  /** 表编码，如 T01 */
  tableCode: string
  /** 表名称（英文物理表名） */
  tableName: string
  /** 中文表名 */
  cnName: string
  /** 是否上报 */
  reportFlag: boolean
  /** 是否采集 */
  collectFlag: boolean
  /** 是否校验 */
  checkFlag: boolean
  /** 是否审核 */
  auditFlag: boolean
  /** 是否拆分报送 */
  splitFlag: boolean
  /** 增量方式：FULL 全量 / INC 增量 / DELTA 变化量 */
  incrementType: string
  /** 采集方式：AUTO 数据加工 / MANUAL 手工采集 */
  collectType: string
  status: number
  remark: string
  createTime?: string
}

/** 数据表下拉选项 VO */
export interface MetaTableOptionVO {
  id: number
  name: string
  code: string
}

// 分页查询数据表
export const getMetaTablePage = (params: any) => {
  return request.get({ url: '/cr/meta-table/page', params })
}

// 查询数据表下拉列表（扁平：id / name / code）
export const getMetaTableSimpleList = () => {
  return request.get({ url: '/cr/meta-table/simple-list' })
}

// 查询数据表详情
export const getMetaTable = (id: number) => {
  return request.get({ url: '/cr/meta-table/get?id=' + id })
}

// 新增数据表
export const createMetaTable = (data: MetaTableVO) => {
  return request.post({ url: '/cr/meta-table/create', data })
}

// 修改数据表
export const updateMetaTable = (data: MetaTableVO) => {
  return request.put({ url: '/cr/meta-table/update', data })
}

// 删除数据表
export const deleteMetaTable = (id: number) => {
  return request.delete({ url: '/cr/meta-table/delete?id=' + id })
}

// 批量删除数据表
export const deleteMetaTableList = (ids: number[]) => {
  return request.delete({ url: '/cr/meta-table/delete-list', params: { ids: ids.join(',') } })
}

// 导出数据表
export const exportMetaTable = (params: any) => {
  return request.download({ url: '/cr/meta-table/export-excel', params })
}

// 主题域下拉选项（数据表的所属主题域）
export const getSubjectOptions = () => {
  return request.get({ url: '/cr/common/subject-options' })
}
