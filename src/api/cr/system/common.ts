import request from '@/config/axios'

/** 权限审批管理 — 两个配置页共用的下拉与口径接口 */

export interface SubjectOptionVO {
  roles: Array<{ id: number; name: string; code: string }>
  users: Array<{
    id: number
    name: string
    username: string
    deptName: string
    roleNames: string
  }>
}

export interface DeptOptionVO {
  id: number
  name: string
  parentId: number
  leaderUserId: number
}

export interface OrgOptionVO {
  id: number
  name: string
  orgCode: string
  parentId: number
  orgLevel: number
}

export interface PermissionMetaVO {
  scopeTypes: Array<{ value: number; label: string; tip: string }>
  actions: Array<{ value: string; label: string }>
}

/** 我的数据范围 / 动作范围（当前登录人，与接口层过滤同源） */
export interface MyScopeVO {
  user: {
    id: number
    nickname: string
    deptName: string
    orgId: number
    orgName: string
  }
  dataScope: {
    superAdmin: boolean
    matched: boolean
    scopeTypeLabel: string
    source: string
    orgIds: number[]
    orgNames: string[]
  }
  deptScope: {
    superAdmin: boolean
    matched: boolean
    source: string
    actions: Array<{ value: string; label: string }>
  }
}

// 授权主体下拉（角色 + 用户）
export const getSubjectOptions = () => {
  return request.get({ url: '/cr/permission-common/subject-options' })
}

// 部门下拉（树）
export const getDeptOptions = () => {
  return request.get({ url: '/cr/permission-common/dept-options' })
}

// 机构下拉
export const getOrgOptions = () => {
  return request.get({ url: '/cr/permission-common/org-options' })
}

// 口径说明（机构范围类型 / 动作清单）
export const getPermissionMeta = () => {
  return request.get({ url: '/cr/permission-common/meta' })
}

// 我的数据范围
export const getMyScope = (reportId?: number) => {
  return request.get({ url: '/cr/permission-common/my-scope', params: { reportId } })
}

// 角色默认数据范围（角色管理页维护的那份）
export const getRoleDefaults = () => {
  return request.get({ url: '/cr/permission-common/role-defaults' })
}
