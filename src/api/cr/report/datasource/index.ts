import request from '@/config/axios'

/** 数据源 VO */
export interface ReportDatasourceVO {
  id?: number
  dsCode: string
  dsName: string
  /** 1 数据库 / 2 文件目录 / 3 接口 */
  dsType: number
  /** 1 MySQL / 2 Oracle / 3 达梦 / 0 不适用 */
  dbType: number
  connText: string
  status: number
  lastTestTime?: string
  lastTestResult?: string
  lastTestRows?: number
  lastTestCost?: number
  owner: string
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询数据源
export const getPage = (params: any) => {
  return request.get({ url: '/cr/report-datasource/page', params })
}

// 查询数据源详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/report-datasource/get?id=' + id })
}

// 新增数据源
export const create = (data: ReportDatasourceVO) => {
  return request.post({ url: '/cr/report-datasource/create', data })
}

// 修改数据源
export const update = (data: ReportDatasourceVO) => {
  return request.put({ url: '/cr/report-datasource/update', data })
}

// 删除数据源
export const remove = (id: number) => {
  return request.delete({ url: '/cr/report-datasource/delete?id=' + id })
}

// 批量删除数据源
export const removeList = (ids: number[]) => {
  return request.delete({
    url: '/cr/report-datasource/delete-list',
    params: { ids: ids.join(',') }
  })
}

// 导出数据源
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/report-datasource/export-excel', params })
}

// 连接测试（会写回最近测试结论，属写操作，仅系统管理员）
export const testDatasource = (id: number) => {
  return request.post({ url: '/cr/report-datasource/test', data: { id } })
}

// 数据源下拉
export const getDatasourceOptions = () => {
  return request.get({ url: '/cr/report-datasource/simple-list-all' })
}
