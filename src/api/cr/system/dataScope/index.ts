import request from '@/config/axios'

/** 数据权限规则 VO：主体 × 报表范围 → 机构数据范围 */
export interface DataScopeVO {
  id?: number
  /** 1 角色 / 2 用户，见字典 cr_subject_type */
  subjectType: number
  subjectId: number
  subjectName?: string
  /** 0 = 全部报表 */
  reportId: number
  reportCode?: string
  reportName?: string
  /** 1 全部数据 / 2 本级及以下 / 3 仅本机构 / 4 指定机构，见字典 cr_scope_type */
  scopeType: number
  orgIds: number[]
  orgNames?: string
  /** 优先级 0~999，缺省 50 */
  priority: number
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

/** 生效判断结果 */
export interface DataScopeDecisionVO {
  user: { id: number; nickname: string; deptName: string; orgId: number; orgName: string }
  effective: {
    matched: boolean
    superAdmin: boolean
    ruleId: number
    scopeType: number
    scopeTypeLabel: string
    source: string
    orgIds: number[]
    orgNames: string[]
  }
  rows: Array<{
    id: number
    subjectType: number
    subjectName: string
    reportName: string
    scopeTypeLabel: string
    priority: number
    status: number
    state: string
    stateLabel: string
    reason: string
  }>
}

// 分页查询数据权限规则
export const getDataScopePage = (params: any) => {
  return request.get({ url: '/cr/data-scope/page', params })
}

// 查询规则详情
export const getDataScope = (id: number) => {
  return request.get({ url: '/cr/data-scope/get?id=' + id })
}

// 新增规则
export const createDataScope = (data: DataScopeVO) => {
  return request.post({ url: '/cr/data-scope/create', data })
}

// 修改规则
export const updateDataScope = (data: DataScopeVO) => {
  return request.put({ url: '/cr/data-scope/update', data })
}

// 删除规则
export const deleteDataScope = (id: number) => {
  return request.delete({ url: '/cr/data-scope/delete?id=' + id })
}

// 批量删除规则
export const deleteDataScopeList = (ids: number[]) => {
  return request.delete({ url: '/cr/data-scope/delete-list', params: { ids: ids.join(',') } })
}

// 导出规则
export const exportDataScope = (params: any) => {
  return request.download({ url: '/cr/data-scope/export-excel', params })
}

// 生效判断：这个用户在这张报表上到底命中哪条规则、可见哪些机构
export const getDataScopeDecisions = (userId: number, reportId?: number) => {
  return request.get({ url: '/cr/data-scope/decisions', params: { userId, reportId } })
}
