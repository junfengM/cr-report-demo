import request from '@/config/axios'

/** 主题域 VO */
export interface SubjectVO {
  id?: number
  /** 主题域编码，如 S01 */
  subjectCode: string
  /** 主题域名称 */
  subjectName: string
  /** 表数量（由表管理统计，页面只读展示） */
  tableCount: number
  remark: string
  /** 状态：见字典 common_status */
  status?: number
  createTime?: string
}

// 分页查询主题域
export const getSubjectPage = (params: any) => {
  return request.get({ url: '/cr/subject/page', params })
}

// 查询主题域详情
export const getSubject = (id: number) => {
  return request.get({ url: '/cr/subject/get?id=' + id })
}

// 新增主题域
export const createSubject = (data: SubjectVO) => {
  return request.post({ url: '/cr/subject/create', data })
}

// 修改主题域
export const updateSubject = (data: SubjectVO) => {
  return request.put({ url: '/cr/subject/update', data })
}

// 删除主题域
export const deleteSubject = (id: number) => {
  return request.delete({ url: '/cr/subject/delete?id=' + id })
}

// 批量删除主题域
export const deleteSubjectList = (ids: number[]) => {
  return request.delete({ url: '/cr/subject/delete-list', params: { ids: ids.join(',') } })
}

// 导出主题域
export const exportSubject = (params: any) => {
  return request.download({ url: '/cr/subject/export-excel', params })
}

// 主题域下拉列表
export const getSubjectSimpleList = () => {
  return request.get({ url: '/cr/subject/simple-list' })
}
