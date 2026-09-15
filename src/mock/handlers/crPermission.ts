/**
 * Mock Handler — 权限审批管理：数据权限配置 / 部门权限配置
 *
 * 分工（与脚手架自带的「角色管理 → 数据权限」互补，不重复）：
 *   data-scope   数据权限：主体（角色 / 用户）× 报表范围 → 机构数据范围
 *   dept-scope   部门权限：部门（含上级部门链）× 报表范围 → 允许的动作（填报 / 复核 / 审核 / 批量提交）
 *
 * 判定口径与"为什么这条没生效"的解释都在 src/mock/db/crPermission.ts 里，
 * 页面通过 /decisions 接口逐条展示：生效中 / 被覆盖 / 已停用 / 主体不匹配 / 报表不匹配。
 *
 * 真正的落点：数据权限落在「数据导入」批次列表（只看得见可见机构的数据），
 * 部门权限落在填报保存 / 批量提交 / 复核 / 审核这几个写接口上 —— 不是只藏按钮。
 */
import { onGet } from '../route'
import { registerResource } from '../resource'
import { formatDateTime, likeAny, paginate } from '../util'
import { deptTable, orgTable } from '../db/org'
import { reportOptions } from '../db/crCommon'
import { roleTable, userTable, ROLE_CODE } from '../db/system'
import {
  dataScopeDecisions,
  dataScopeTable,
  deptScopeDecisions,
  deptScopeTable,
  DEPT_ACTION_LABEL,
  effectiveDataScope,
  effectiveDeptScope,
  orgIdOfUser,
  SCOPE_TYPE,
  SCOPE_TYPE_LABEL,
  type DataScopeRow,
  type DeptScopeRow
} from '../db/crPermission'
import { assertAdmin, assertLogin } from './guards'

const orgs = () => orgTable.all()
const reports = () => reportOptions()

const subjectNameOf = (subjectType: number, subjectId: number): string => {
  if (subjectType === 2) {
    const user = userTable.get(Number(subjectId))
    if (!user) throw new Error('授权用户不存在：id=' + subjectId)
    return user.nickname
  }
  const role = roleTable.get(Number(subjectId))
  if (!role) throw new Error('授权角色不存在：id=' + subjectId)
  return role.name
}

const checkReport = (
  reportId: any
): { reportId: number; reportCode: string; reportName: string } => {
  const id = Number(reportId || 0)
  if (!id) return { reportId: 0, reportCode: '', reportName: '全部报表' }
  const report = reports().find((item) => Number(item.id) === id)
  if (!report) throw new Error('报表不存在：id=' + id)
  return { reportId: id, reportCode: report.reportCode, reportName: report.reportName }
}

const checkPriority = (value: any): number => {
  const priority = Number(value === undefined || value === '' ? 50 : value)
  if (!Number.isInteger(priority) || priority < 0 || priority > 999) {
    throw new Error('优先级必须是 0~999 之间的整数（数字小的先生效）')
  }
  return priority
}

const checkStatus = (value: any): number => {
  const status = Number(value === undefined || value === '' ? 1 : value)
  if (status !== 0 && status !== 1) throw new Error('状态只能是启用或停用')
  return status
}

/** 数据权限：建 / 改前把名称补齐并把非法取值拦下来 */
const fillDataScopeRow = (body: any): Partial<DataScopeRow> => {
  const subjectType = Number(body.subjectType)
  if (subjectType !== 1 && subjectType !== 2) throw new Error('主体类型只能是角色或用户')
  const subjectId = Number(body.subjectId)
  if (!subjectId) throw new Error('请选择授权主体（角色或用户）')
  const report = checkReport(body.reportId)
  const scopeType = Number(body.scopeType)
  if (
    ![SCOPE_TYPE.ALL, SCOPE_TYPE.SELF_AND_BELOW, SCOPE_TYPE.SELF_ONLY, SCOPE_TYPE.CUSTOM].includes(
      scopeType as never
    )
  ) {
    throw new Error('机构范围类型非法（应为 全部数据 / 本级及以下 / 仅本机构 / 指定机构）')
  }
  const orgIds = Array.isArray(body.orgIds)
    ? body.orgIds.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id))
    : []
  if (scopeType === SCOPE_TYPE.CUSTOM && !orgIds.length) {
    throw new Error('机构范围选了「指定机构」，至少要勾选一个机构')
  }
  const unknown = orgIds.find((id) => !orgs().some((org) => org.id === id))
  if (unknown) throw new Error('机构不存在：id=' + unknown)
  return {
    subjectType,
    subjectId,
    subjectName: subjectNameOf(subjectType, subjectId),
    ...report,
    scopeType,
    orgIds: scopeType === SCOPE_TYPE.CUSTOM ? orgIds : [],
    orgNames: orgIds
      .map((id) => orgs().find((org) => org.id === id)?.orgName || '')
      .filter(Boolean)
      .join('、'),
    priority: checkPriority(body.priority),
    status: checkStatus(body.status),
    remark: String(body.remark || '')
  }
}

/** 部门权限：建 / 改前校验部门与动作集合 */
const fillDeptScopeRow = (body: any): Partial<DeptScopeRow> => {
  const deptId = Number(body.deptId)
  if (!deptId) throw new Error('请选择部门（机构）')
  const dept = deptTable.get(deptId)
  if (!dept) throw new Error('部门不存在：id=' + deptId)
  // 去重：页面上的多选框产生不了重复值，但接口可以被直接调用，
  // 落库 ['fill','fill','submit'] 会让页面 v-for 渲染出两个「数据填报」标签。
  const actions = Array.from(
    new Set(Array.isArray(body.actions) ? body.actions.map((action: any) => String(action)) : [])
  )
  if (!actions.length) throw new Error('至少要勾选一个允许的动作')
  const invalid = actions.find((action) => !DEPT_ACTION_LABEL[action])
  if (invalid) throw new Error('动作标识非法：' + invalid)
  const report = checkReport(body.reportId)
  return {
    deptId,
    deptName: dept.name,
    ...report,
    actions,
    priority: checkPriority(body.priority),
    status: checkStatus(body.status),
    remark: String(body.remark || '')
  }
}

/* ==================================================================
 * 数据权限配置
 * ================================================================== */
/* ==================================================================
 * 列表口径（筛选 + 排序）—— 注册与「被覆盖的分页 / 列表入口」共用同一份，
 * 避免两处各写一遍导致筛选项静默失效（部门权限的「动作」筛选踩过这个坑）。
 * ================================================================== */
const scopeSort = (
  a: { reportId?: number; priority?: number; id: number },
  b: { reportId?: number; priority?: number; id: number }
): number =>
  (a.reportId === 0 ? 1 : 0) - (b.reportId === 0 ? 1 : 0) ||
  Number(a.priority || 50) - Number(b.priority || 50) ||
  b.id - a.id

const dataScopeFilter = (row: DataScopeRow, params: Record<string, any>): boolean =>
  (params.subjectType === undefined ||
    params.subjectType === '' ||
    Number(row.subjectType) === Number(params.subjectType)) &&
  (params.scopeType === undefined ||
    params.scopeType === '' ||
    Number(row.scopeType) === Number(params.scopeType)) &&
  (params.status === undefined ||
    params.status === '' ||
    Number(row.status) === Number(params.status)) &&
  (params.reportId === undefined ||
    params.reportId === '' ||
    Number(row.reportId) === Number(params.reportId)) &&
  likeAny(row, ['subjectName', 'reportName', 'reportCode', 'orgNames', 'remark'], params.keyword)

const deptScopeFilter = (row: DeptScopeRow, params: Record<string, any>): boolean =>
  (params.deptId === undefined ||
    params.deptId === '' ||
    Number(row.deptId) === Number(params.deptId)) &&
  (params.status === undefined ||
    params.status === '' ||
    Number(row.status) === Number(params.status)) &&
  (params.reportId === undefined ||
    params.reportId === '' ||
    Number(row.reportId) === Number(params.reportId)) &&
  (!params.action || (row.actions || []).indexOf(String(params.action)) >= 0) &&
  likeAny(row, ['deptName', 'reportName', 'reportCode', 'remark'], params.keyword)

registerResource<DataScopeRow>({
  prefix: '/cr/data-scope',
  table: dataScopeTable,
  // 权限配置决定"谁能看哪些数据"，写操作只允许系统管理员
  guard: (ctx, action) => assertAdmin(ctx, '数据权限规则' + action),
  sort: scopeSort,
  filter: dataScopeFilter,
  beforeCreate: (body) => ({
    ...fillDataScopeRow(body),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    createTime: formatDateTime()
  }),
  beforeUpdate: (body) => ({ ...fillDataScopeRow(body), updateTime: formatDateTime() }),
  exportColumns: [
    { field: 'subjectName', label: '授权主体' },
    {
      field: 'subjectType',
      label: '主体类型',
      formatter: (row) => (Number(row.subjectType) === 2 ? '角色' : '用户')
    },
    { field: 'reportName', label: '报表范围' },
    {
      field: 'scopeType',
      label: '机构范围类型',
      formatter: (row) => SCOPE_TYPE_LABEL[Number(row.scopeType)] || row.scopeType
    },
    { field: 'orgNames', label: '指定机构' },
    { field: 'priority', label: '优先级' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '备注' }
  ]
})

/* ==================================================================
 * 部门权限配置
 * ================================================================== */
registerResource<DeptScopeRow>({
  prefix: '/cr/dept-scope',
  table: deptScopeTable,
  guard: (ctx, action) => assertAdmin(ctx, '部门权限规则' + action),
  sort: scopeSort,
  filter: deptScopeFilter,
  beforeCreate: (body) => ({
    ...fillDeptScopeRow(body),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    createTime: formatDateTime()
  }),
  beforeUpdate: (body) => ({ ...fillDeptScopeRow(body), updateTime: formatDateTime() }),
  exportColumns: [
    { field: 'deptName', label: '部门（机构）' },
    { field: 'reportName', label: '报表范围' },
    {
      field: 'actions',
      label: '允许动作',
      formatter: (row) =>
        (row.actions || []).map((action: string) => DEPT_ACTION_LABEL[action] || action).join('、')
    },
    { field: 'priority', label: '优先级' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '备注' }
  ]
})

/**
 * 列表行补「动作中文名」：动作清单是服务端口径，页面不该再维护第二份映射。
 * registerResource 的返回是原样行，所以这里覆盖 /page 与 /list 两个只读入口。
 */
const withActionLabels = <T extends { actions?: string[] }>(row: T) => ({
  ...row,
  actionLabels: (row.actions || []).map((action) => DEPT_ACTION_LABEL[action] || action)
})

onGet('/cr/dept-scope/page', (ctx) => {
  const rows = deptScopeTable
    .all()
    .filter((row) => deptScopeFilter(row, ctx.params))
    .sort(scopeSort)
    .map(withActionLabels)
  return paginate(rows, ctx.params)
})

onGet('/cr/dept-scope/list', (ctx) =>
  deptScopeTable
    .all()
    .filter((row) => deptScopeFilter(row, ctx.params))
    .sort(scopeSort)
    .map(withActionLabels)
)

/* ==================================================================
 * 下拉与生效判断
 * ================================================================== */

/** 授权主体下拉：角色 + 用户（用户带部门，便于确认选对了人） */
onGet('/cr/permission-common/subject-options', () => ({
  roles: roleTable
    .all()
    .filter((role) => role.status === 0)
    .map((role) => ({ id: role.id, name: role.name, code: role.code })),
  users: userTable
    .all()
    .filter((user) => user.status === 0)
    .map((user) => ({
      id: user.id,
      name: user.nickname,
      username: user.username,
      deptName: (deptTable.get(user.deptId) || { name: '' }).name,
      roleNames: roleTable
        .all()
        .filter((role) => user.roleIds.includes(role.id))
        .map((role) => role.name)
        .join('、')
    }))
}))

/** 部门下拉（扁平 + parentId，页面用树选择器渲染） */
onGet('/cr/permission-common/dept-options', () =>
  deptTable
    .all()
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((dept) => ({
      id: dept.id,
      name: dept.name,
      parentId: dept.parentId,
      leaderUserId: dept.leaderUserId
    }))
)

/** 机构下拉（指定机构用） */
onGet('/cr/permission-common/org-options', () =>
  orgs()
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((org) => ({
      id: org.id,
      name: org.orgName,
      orgCode: org.orgCode,
      parentId: org.parentId,
      orgLevel: org.orgLevel
    }))
)

/** 口径说明：机构范围类型 + 动作清单（页面表单直接展示，避免前端再写一份文案） */
onGet('/cr/permission-common/meta', () => ({
  scopeTypes: [
    { value: SCOPE_TYPE.ALL, label: SCOPE_TYPE_LABEL[1], tip: '不限机构，仅超级管理员语境下使用' },
    {
      value: SCOPE_TYPE.SELF_AND_BELOW,
      label: SCOPE_TYPE_LABEL[2],
      tip: '用户归属机构 + 全部下级机构'
    },
    {
      value: SCOPE_TYPE.SELF_ONLY,
      label: SCOPE_TYPE_LABEL[3],
      tip: '只看到用户归属机构本身的数据'
    },
    {
      value: SCOPE_TYPE.CUSTOM,
      label: SCOPE_TYPE_LABEL[4],
      tip: '按勾选的机构清单放开（可跨分公司）'
    }
  ],
  actions: Object.keys(DEPT_ACTION_LABEL).map((action) => ({
    value: action,
    label: DEPT_ACTION_LABEL[action]
  }))
}))

/** 数据权限的生效判断（页面「生效判断」弹窗） */
onGet('/cr/data-scope/decisions', (ctx) => {
  assertLogin(ctx, '查看数据权限生效判断')
  const userId = Number(ctx.params.userId || 0)
  if (!userId) throw new Error('请先选择要判断的用户')
  return dataScopeDecisions(userId, Number(ctx.params.reportId || 0))
})

/** 部门权限的生效判断 */
onGet('/cr/dept-scope/decisions', (ctx) => {
  assertLogin(ctx, '查看部门权限生效判断')
  const userId = Number(ctx.params.userId || 0)
  if (!userId) throw new Error('请先选择要判断的用户')
  return deptScopeDecisions(userId, Number(ctx.params.reportId || 0))
})

/**
 * 我的数据范围 / 动作范围（当前登录人）。
 * 页面上的"我的权限"横幅必须读这个接口，不能在前端自己算一遍 ——
 * 否则会出现"横幅说能看、接口却过滤掉了"的自相矛盾。
 */
onGet('/cr/permission-common/my-scope', (ctx) => {
  const user = assertLogin(ctx, '查看我的数据权限')
  const reportId = Number(ctx.params.reportId || 0)
  const dataScope = effectiveDataScope(user.id, reportId)
  const deptScope = effectiveDeptScope(user.id, reportId)
  const org = orgs().find((item) => item.id === orgIdOfUser(user.id))
  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      deptName: (deptTable.get(user.deptId) || { name: '' }).name,
      orgId: org ? org.id : 0,
      orgName: org ? org.orgName : ''
    },
    dataScope: {
      superAdmin: dataScope.superAdmin,
      matched: dataScope.matched,
      scopeTypeLabel: dataScope.scopeTypeLabel,
      source: dataScope.source,
      orgIds: dataScope.orgIds,
      orgNames: dataScope.orgNames
    },
    deptScope: {
      superAdmin: deptScope.superAdmin,
      matched: deptScope.matched,
      source: deptScope.source,
      actions: deptScope.actions.map((action) => ({
        value: action,
        label: DEPT_ACTION_LABEL[action] || action
      }))
    }
  }
})

/** 角色列表（页面顶部提示"角色默认数据范围在角色管理里改"时用） */
onGet('/cr/permission-common/role-defaults', () =>
  roleTable.all().map((role) => ({
    id: role.id,
    name: role.name,
    code: role.code,
    dataScope: role.dataScope,
    dataScopeDeptIds: role.dataScopeDeptIds,
    isAdmin: role.code === ROLE_CODE.ADMIN
  }))
)
