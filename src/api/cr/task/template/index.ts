import request from '@/config/axios'

/** 报表任务模板 VO */
export interface TaskTemplateVO {
  id?: number
  templateCode: string
  templateName: string
  /** 数据频度，见字典 cr_report_freq */
  freq: number
  /** 报送期次，如 202608 */
  period: string
  startDate: string
  deadline: string
  reportIds: number[]
  reportCount: number
  status: number
  remark: string
  createTime?: string
}

/** 报表（表样）简化 VO */
export interface ReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectId: number
  subjectName: string
}

// 分页查询报表任务模板
export const getTaskTemplatePage = (params: any) => {
  return request.get({ url: '/cr/task-template/page', params })
}

// 查询报表任务模板详情
export const getTaskTemplate = (id: number) => {
  return request.get({ url: '/cr/task-template/get?id=' + id })
}

// 新增报表任务模板
export const createTaskTemplate = (data: TaskTemplateVO) => {
  return request.post({ url: '/cr/task-template/create', data })
}

// 修改报表任务模板
export const updateTaskTemplate = (data: TaskTemplateVO) => {
  return request.put({ url: '/cr/task-template/update', data })
}

// 删除报表任务模板
export const deleteTaskTemplate = (id: number) => {
  return request.delete({ url: '/cr/task-template/delete?id=' + id })
}

// 批量删除报表任务模板
export const deleteTaskTemplateList = (ids: number[]) => {
  return request.delete({ url: '/cr/task-template/delete-list', params: { ids: ids.join(',') } })
}

// 导出报表任务模板
export const exportTaskTemplate = (params: any) => {
  return request.download({ url: '/cr/task-template/export-excel', params })
}

// 查询模板下的报表
export const getTemplateReportList = (id: number) => {
  return request.get({ url: '/cr/task-template/report-list?id=' + id })
}

// 查询模板已选报表 id
export const getTemplateReportIds = (id: number) => {
  return request.get({ url: '/cr/task-template/report-ids?id=' + id })
}

// 保存模板下的报表
export const updateTemplateReports = (id: number, reportIds: number[]) => {
  return request.put({ url: '/cr/task-template/update-reports', data: { id, reportIds } })
}

// 移除模板下的某张报表
export const removeTemplateReport = (id: number, reportId: number) => {
  return request.put({ url: '/cr/task-template/remove-report', data: { id, reportId } })
}

// 报表下拉选项（可按频度过滤）
export const getReportOptions = (freq?: number) => {
  return request.get({ url: '/cr/common/report-options', params: { freq } })
}

// 主题域下拉选项
export const getSubjectOptions = () => {
  return request.get({ url: '/cr/common/subject-options' })
}
