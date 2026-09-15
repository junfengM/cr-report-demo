import request from '@/config/axios'

/** 列（监管数据项）VO */
export interface MetaColumnVO {
  id?: number
  /** 所属数据表 id */
  tableId: number
  /** 所属数据表物理表名（冗余展示） */
  tableName: string
  /** 所属数据表中文名（冗余展示） */
  cnTableName: string
  /** 字段编码（数据元编码），如 DE001 */
  columnCode: string
  /** 物理字段名 */
  columnName: string
  /** 字段中文名 */
  cnName: string
  /** 数据类型 */
  dataType: string
  /** 长度 */
  dataLength: number
  /** 是否必填 */
  required: boolean
  /** 是否主键 */
  primaryKey: boolean
  /** 脱敏规则：空 = 不脱敏；MASK / HASH / REPLACE / TRUNCATE，见字典 cr_desensitize_type */
  desensitizeRule: string
  /** 脱敏参数（如"前3后4"） */
  desensitizeParam: string
  status: number
  remark: string
  createTime?: string
}

/** 字段"不脱敏"在页面上的哨兵值（存库时落为空字符串） */
export const DESENSITIZE_NONE = 'NONE'

// 分页查询列（数据项）
export const getMetaColumnPage = (params: any) => {
  return request.get({ url: '/cr/meta-column/page', params })
}

// 查询列（数据项）详情
export const getMetaColumn = (id: number) => {
  return request.get({ url: '/cr/meta-column/get?id=' + id })
}

// 新增列（数据项）
export const createMetaColumn = (data: MetaColumnVO) => {
  return request.post({ url: '/cr/meta-column/create', data })
}

// 修改列（数据项）
export const updateMetaColumn = (data: MetaColumnVO) => {
  return request.put({ url: '/cr/meta-column/update', data })
}

// 删除列（数据项）
export const deleteMetaColumn = (id: number) => {
  return request.delete({ url: '/cr/meta-column/delete?id=' + id })
}

// 批量删除列（数据项）
export const deleteMetaColumnList = (ids: number[]) => {
  return request.delete({ url: '/cr/meta-column/delete-list', params: { ids: ids.join(',') } })
}

// 导出列（数据项）
export const exportMetaColumn = (params: any) => {
  return request.download({ url: '/cr/meta-column/export-excel', params })
}

// 数据表下拉选项（所属数据表）
export const getTableOptions = () => {
  return request.get({ url: '/cr/meta-table/simple-list' })
}
