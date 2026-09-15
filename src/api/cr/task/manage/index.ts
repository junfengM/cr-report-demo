import request from '@/config/axios'

/** 报表任务实例 VO */
export interface CrTaskVO {
  id?: number
  /** 任务编号，如 RW202608001 */
  taskCode: string
  taskName: string
  templateId?: number
  templateName?: string
  orgId?: number
  orgName?: string
  reportId?: number
  reportName?: string
  reportCode?: string
  /** 报送期次，如 202608 */
  period: string
  /** 数据频度，见字典 cr_report_freq */
  freq?: number
  dispatchTime?: string
  deadline?: string
  /** 任务状态，见字典 cr_task_status */
  status: number
  fillUser?: string
  reviewUser?: string
  auditUser?: string
  remark?: string
  createTime?: string
}

/** 流转轨迹节点 */
export interface TaskTraceItemVO {
  id: number
  stage: string
  operator: string
  action: string
  result: number
  opinion: string
  operateTime: string
}

/** 流转轨迹（任务 + 流水） */
export interface TaskTraceVO {
  task: CrTaskVO
  currentStage: string
  list: TaskTraceItemVO[]
}

/** 任务下发参数 */
export interface TaskDispatchVO {
  templateId: number
  orgIds: number[]
  period: string
  deadline: string
}

// 分页查询报表任务
export const getTaskPage = (params: any) => {
  return request.get({ url: '/cr/task/page', params })
}

// 查询报表任务详情
export const getTask = (id: number) => {
  return request.get({ url: '/cr/task/get?id=' + id })
}

// 新增报表任务
export const createTask = (data: CrTaskVO) => {
  return request.post({ url: '/cr/task/create', data })
}

// 修改报表任务
export const updateTask = (data: CrTaskVO) => {
  return request.put({ url: '/cr/task/update', data })
}

// 删除报表任务
export const deleteTask = (id: number) => {
  return request.delete({ url: '/cr/task/delete?id=' + id })
}

// 批量删除报表任务
export const deleteTaskList = (ids: number[]) => {
  return request.delete({ url: '/cr/task/delete-list', params: { ids: ids.join(',') } })
}

// 导出报表任务
export const exportTask = (params: any) => {
  return request.download({ url: '/cr/task/export-excel', params })
}

// 任务下发：按模板 + 机构范围批量生成任务实例
export const dispatchTask = (data: TaskDispatchVO) => {
  return request.post({ url: '/cr/task/dispatch', data })
}

// 批量下发：勾选的任务按模板补发缺失的机构任务
export const dispatchTaskBatch = (ids: number[]) => {
  return request.post({ url: '/cr/task/dispatch-batch', data: { ids } })
}

// 任务初始化：按启用中的任务模板重建本期任务
export const initTask = (period?: string) => {
  return request.put({ url: '/cr/task/init', data: { period } })
}

// 查询任务流转轨迹
export const getTaskTrace = (id: number) => {
  return request.get({ url: '/cr/task/trace?id=' + id })
}

// 查询任务下的报表明细
export const getTaskReportList = (id: number) => {
  return request.get({ url: '/cr/task/report-list?id=' + id })
}

// 任务下拉选项（可按状态过滤）
export const getTaskOptions = (status?: number) => {
  return request.get({ url: '/cr/task/options', params: { status } })
}

// 可下发机构选项
export const getTaskOrgOptions = () => {
  return request.get({ url: '/cr/task/org-options' })
}

// 任务期次选项
export const getTaskPeriodOptions = () => {
  return request.get({ url: '/cr/task/period-options' })
}
