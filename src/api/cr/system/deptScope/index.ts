import request from '@/config/axios'

/** 部门权限规则 VO：部门 × 报表范围 → 允许的动作 */
export interface DeptScopeVO {
  id?: number
  deptId: number
  deptName?: string
  /** 0 = 全部报表 */
  reportId: number
  reportCode?: string
  reportName?: string
  /** fill 填报 / review 复核 / audit 审核 / submit 批量提交，见字典 cr_dept_action */
  actions: string[]
  priority: number
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

/** 生效判断结果 */
export interface DeptScopeDecisionVO {
  user: { id: number; nickname: string; deptId: number; deptName: string }
  effective: {
    matched: boolean
    superAdmin: boolean
    ruleId: number
    actions: string[]
    actionLabels: string[]
    source: string
  }
  rows: Array<{
    id: number
    deptName: string
    reportName: string
    actions: string[]
    actionLabels: string[]
    priority: number
    status: number
    state: string
    stateLabel: string
    reason: string
  }>
}

// 分页查询部门权限规则
export const getDeptScopePage = (params: any) => {
  return request.get({ url: '/cr/dept-scope/page', params })
}

// 查询规则详情
export const getDeptScope = (id: number) => {
  return request.get({ url: '/cr/dept-scope/get?id=' + id })
}

// 新增规则
export const createDeptScope = (data: DeptScopeVO) => {
  return request.post({ url: '/cr/dept-scope/create', data })
}

// 修改规则
export const updateDeptScope = (data: DeptScopeVO) => {
  return request.put({ url: '/cr/dept-scope/update', data })
}

// 删除规则
export const deleteDeptScope = (id: number) => {
  return request.delete({ url: '/cr/dept-scope/delete?id=' + id })
}

// 批量删除规则
export const deleteDeptScopeList = (ids: number[]) => {
  return request.delete({ url: '/cr/dept-scope/delete-list', params: { ids: ids.join(',') } })
}

// 导出规则
export const exportDeptScope = (params: any) => {
  return request.download({ url: '/cr/dept-scope/export-excel', params })
}

// 生效判断：这个用户在这张报表上有哪些动作
export const getDeptScopeDecisions = (userId: number, reportId?: number) => {
  return request.get({ url: '/cr/dept-scope/decisions', params: { userId, reportId } })
}
