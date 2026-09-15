import request from '@/config/axios'

/** 报送文件配置 VO */
export interface SubmitFileConfigVO {
  id?: number
  /** 配置名称 */
  configName: string
  /** 适用机构 */
  orgId?: number
  orgName: string
  /** 文件类型：TXT / XML / CSV */
  fileType: string
  /** 文件命名规则，支持 {orgCode} {reportCode} {tableCode} {period} {date} {seq} */
  fileNameRule: string
  /** 字段分隔符 */
  fieldSeparator: string
  /** 是否压缩 */
  compress: boolean
  /** 字符编码 */
  charset: string
  /** 表头行数 */
  headerRows: number
  status: number
  remark: string
  createTime?: string
}

// 分页查询报送文件配置
export const getSubmitFileConfigPage = (params: any) => {
  return request.get({ url: '/cr/submit-file-config/page', params })
}

// 查询报送文件配置详情
export const getSubmitFileConfig = (id: number) => {
  return request.get({ url: '/cr/submit-file-config/get?id=' + id })
}

// 新增报送文件配置
export const createSubmitFileConfig = (data: SubmitFileConfigVO) => {
  return request.post({ url: '/cr/submit-file-config/create', data })
}

// 修改报送文件配置
export const updateSubmitFileConfig = (data: SubmitFileConfigVO) => {
  return request.put({ url: '/cr/submit-file-config/update', data })
}

// 删除报送文件配置
export const deleteSubmitFileConfig = (id: number) => {
  return request.delete({ url: '/cr/submit-file-config/delete?id=' + id })
}

// 批量删除报送文件配置
export const deleteSubmitFileConfigList = (ids: number[]) => {
  return request.delete({
    url: '/cr/submit-file-config/delete-list',
    params: { ids: ids.join(',') }
  })
}

// 导出报送文件配置
export const exportSubmitFileConfig = (params: any) => {
  return request.download({ url: '/cr/submit-file-config/export-excel', params })
}
