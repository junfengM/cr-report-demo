/**
 * Mock 种子数据 — 权限审批管理（数据权限配置 / 部门权限配置）
 *
 * 与脚手架自带「角色管理 → 分配权限 / 数据权限」的分工：
 *   - 角色管理页维护的是**角色默认数据范围**（roleTable.dataScope，脚手架原生口径）；
 *   - 本模块维护的是业务侧细化规则：**谁能看哪些机构的报送数据**（数据权限）、
 *     **哪个部门能对哪些报表做哪些动作**（部门权限，填报 / 复核 / 审核 / 批量提交）。
 *   未命中业务侧规则时**回落到角色默认数据范围**（数据权限），部门权限未命中则**默认拒绝**。
 *
 * 判定顺序照搬仓库既有约定（拆分规则那一轮定下来的）：
 *   范围（用户 > 角色、指定报表 > 全部报表）→ 显式优先级小的 → 后建的。
 * 不发明第四种隐式规则；被覆盖的规则在页面上必须能看出"为什么没生效"。
 */
import { defineTable } from '../store'
import { collectTreeIds } from '../util'
import { allOrgs, reportOptions } from './crCommon'
import { deptTable, orgTable } from './org'
import { ROLE_CODE, roleTable, userTable } from './system'

/** 数据权限规则：主体 ×（报表范围）→ 机构范围 */
export interface DataScopeRow {
  id: number
  /** 1 角色 / 2 用户，见字典 cr_subject_type */
  subjectType: number
  subjectId: number
  subjectName: string
  /** 0 = 全部报表；否则为指定报表 */
  reportId: number
  reportCode: string
  reportName: string
  /** 1 全部数据 / 2 本级及以下 / 3 仅本机构 / 4 指定机构，见字典 cr_scope_type */
  scopeType: number
  /** scopeType = 4 时生效的机构清单 */
  orgIds: number[]
  orgNames: string
  /** 优先级 0~999，缺省 50 */
  priority: number
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 部门权限规则：部门 ×（报表范围）→ 允许的动作集合 */
export interface DeptScopeRow {
  id: number
  deptId: number
  deptName: string
  reportId: number
  reportCode: string
  reportName: string
  /** 允许的动作：fill 填报 / review 复核 / audit 审核 / submit 批量提交，见字典 cr_dept_action */
  actions: string[]
  priority: number
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

const scopeTime = '2026-09-06 10:'

const dataScopeSeed: DataScopeRow[] = [
  {
    id: 1,
    subjectType: 1,
    subjectId: 2,
    subjectName: '报送填报岗',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    scopeType: 2,
    orgIds: [],
    orgNames: '',
    priority: 50,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '12:00',
    remark: '填报岗可见总公司本级及以下机构（含各分公司与中心支公司），否则分公司数据看不到',
    createTime: scopeTime + '12:00'
  },
  {
    id: 2,
    subjectType: 2,
    subjectId: 9,
    subjectName: '周北京',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    scopeType: 4,
    orgIds: [11],
    orgNames: '北京分公司',
    priority: 20,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '18:30',
    remark:
      '用户级覆盖角色级：北京分公司填报人只允许看本机构数据（用 zhoubj 登录，数据导入页只剩北京分公司的批次）',
    createTime: scopeTime + '18:30'
  },
  {
    id: 3,
    subjectType: 1,
    subjectId: 4,
    subjectName: '报送审核岗',
    reportId: 11,
    reportCode: 'BX011',
    reportName: '保费收入统计表',
    scopeType: 2,
    orgIds: [],
    orgNames: '',
    priority: 30,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '20:05',
    remark: '指定报表 + 本级及以下：审核岗在「保费收入统计表」上要看全部下级机构的数据',
    createTime: scopeTime + '20:05'
  },
  {
    id: 4,
    subjectType: 1,
    subjectId: 3,
    subjectName: '报送复核岗',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    scopeType: 1,
    orgIds: [],
    orgNames: '',
    priority: 50,
    status: 0,
    updateUser: '系统管理员',
    updateTime: scopeTime + '22:40',
    remark: '已停用示例：停用后回落到角色管理页配的默认数据范围（本部门）',
    createTime: scopeTime + '22:40'
  }
]

const deptScopeSeed: DeptScopeRow[] = [
  {
    id: 1,
    deptId: 101,
    deptName: '总公司',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    actions: ['fill', 'review', 'audit', 'submit'],
    priority: 50,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '30:00',
    remark: '兜底：总公司各部门默认四类动作全开',
    createTime: scopeTime + '30:00'
  },
  {
    id: 2,
    deptId: 103,
    deptName: '上海分公司',
    reportId: 11,
    reportCode: 'BX011',
    reportName: '保费收入统计表',
    actions: ['fill'],
    priority: 30,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '36:10',
    remark: '指定报表规则优先：上海分公司在该报表上只能填报，不能批量提交（演示用 wush 登录）',
    createTime: scopeTime + '36:10'
  },
  {
    id: 3,
    deptId: 102,
    deptName: '北京分公司',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    actions: ['fill', 'submit'],
    priority: 50,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '41:20',
    remark: '分公司只填报与提交，复核 / 审核由总公司承担',
    createTime: scopeTime + '41:20'
  },
  {
    id: 4,
    deptId: 104,
    deptName: '江苏分公司',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    actions: ['fill', 'submit'],
    priority: 50,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '45:00',
    remark: '',
    createTime: scopeTime + '45:00'
  },
  {
    id: 5,
    deptId: 105,
    deptName: '广东分公司',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    actions: ['fill', 'submit'],
    priority: 50,
    status: 1,
    updateUser: '系统管理员',
    updateTime: scopeTime + '48:30',
    remark: '',
    createTime: scopeTime + '48:30'
  },
  {
    id: 6,
    deptId: 10106,
    deptName: '风险管理部',
    reportId: 0,
    reportCode: '',
    reportName: '全部报表',
    actions: ['review'],
    priority: 50,
    status: 0,
    updateUser: '系统管理员',
    updateTime: scopeTime + '52:15',
    remark: '已停用示例：风险管理部的复核动作已冻结，停用后该部门不再匹配本规则',
    createTime: scopeTime + '52:15'
  }
]

export const dataScopeTable = defineTable<DataScopeRow>('cr.dataScope', dataScopeSeed)
export const deptScopeTable = defineTable<DeptScopeRow>('cr.deptScope', deptScopeSeed)

/* ==================================================================
 * 口径常量（中文名由服务端给，页面不再维护第二套映射）
 * ================================================================== */

export const SCOPE_TYPE = {
  ALL: 1,
  SELF_AND_BELOW: 2,
  SELF_ONLY: 3,
  CUSTOM: 4
} as const

export const SCOPE_TYPE_LABEL: Record<number, string> = {
  1: '全部数据',
  2: '本级及以下',
  3: '仅本机构',
  4: '指定机构'
}

export const DEPT_ACTION = {
  FILL: 'fill',
  REVIEW: 'review',
  AUDIT: 'audit',
  SUBMIT: 'submit'
} as const

export const DEPT_ACTION_LABEL: Record<string, string> = {
  fill: '数据填报',
  review: '复核',
  audit: '审核',
  submit: '批量提交'
}

export const SCOPE_STATE_LABEL = {
  EFFECTIVE: '生效中',
  COVERED: '被覆盖',
  DISABLED: '已停用',
  SUBJECT_MISMATCH: '主体不匹配',
  REPORT_MISMATCH: '报表不匹配',
  DEPT_MISMATCH: '部门不匹配'
} as const

/* ==================================================================
 * 用户 → 部门链 / 机构
 * ================================================================== */

/** 部门及其全部上级（部门 → … → 根） */
export const deptChainOf = (deptId?: number): number[] => {
  const chain: number[] = []
  let current = deptId ? deptTable.get(Number(deptId)) : undefined
  let guard = 0
  while (current && guard < 10) {
    chain.push(current.id)
    current = current.parentId ? deptTable.get(current.parentId) : undefined
    guard += 1
  }
  return chain
}

/** 用户所在部门及其全部上级（用户部门 → … → 根） */
export const deptChainOfUser = (userId?: number): number[] => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  return user ? deptChainOf(user.deptId) : []
}

/** 用户归属的报送机构：沿部门树向上找同名机构；「总公司」按机构层级 1 兜底 */
export const orgIdOfUser = (userId?: number): number => {
  const orgs = orgTable.all()
  const chain = deptChainOfUser(userId)
  for (const deptId of chain) {
    const dept = deptTable.get(deptId)
    if (!dept) continue
    const hit =
      orgs.find((org) => org.orgName === dept.name) ||
      (dept.name === '总公司' ? orgs.find((org) => org.orgLevel === 1) : undefined)
    if (hit) return hit.id
  }
  return 0
}

/* ==================================================================
 * 数据权限（机构数据范围）
 * ================================================================== */

const dataScopeCandidates = (userId?: number, reportId?: number) => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  const roleIds = user ? user.roleIds.map(Number) : []
  return dataScopeTable.all().map((row) => {
    const subjectHit =
      row.subjectType === 2
        ? Number(row.subjectId) === Number(userId)
        : roleIds.includes(Number(row.subjectId))
    const reportHit = !row.reportId || Number(row.reportId) === Number(reportId || 0)
    let state: string = 'EFFECTIVE'
    let reason = '主体与报表范围都命中，且优先级最小（相同则后建的）'
    if (!subjectHit) {
      state = 'SUBJECT_MISMATCH'
      reason = '规则授权给「' + row.subjectName + '」，当前用户不在其中'
    } else if (!reportHit) {
      state = 'REPORT_MISMATCH'
      reason = '规则只适用于「' + row.reportName + '」，与本次报表不符'
    } else if (row.status !== 1) {
      state = 'DISABLED'
      reason = '规则已停用'
    }
    return {
      row,
      subjectHit,
      reportHit,
      state,
      stateLabel: SCOPE_STATE_LABEL[state as never] || state,
      reason
    }
  })
}

/** 机构范围展开 */
const resolveOrgIds = (scopeType: number, orgIds: number[], userOrgId: number): number[] => {
  const orgs = orgTable.all()
  if (scopeType === SCOPE_TYPE.ALL) return orgs.map((org) => org.id)
  if (!userOrgId) return []
  if (scopeType === SCOPE_TYPE.SELF_AND_BELOW) {
    return collectTreeIds(orgs, userOrgId).map((id) => Number(id))
  }
  if (scopeType === SCOPE_TYPE.SELF_ONLY) return [userOrgId]
  return (orgIds || []).map((id) => Number(id)).filter((id) => orgs.some((org) => org.id === id))
}

/**
 * 把「角色管理 → 数据权限」里选的部门 id 展开成报送机构 id。
 * 口径与 orgIdOfUser 完全一致（部门名 ↔ 机构名；「总公司」按机构层级 1 兜底），
 * 否则部门 id（10104 这类）会被当成机构 id 去 orgTable 里查，一条都命中不了 → 静默变成"看不到任何机构"。
 */
const orgIdsOfDeptIds = (deptIds: number[]): number[] => {
  const orgs = orgTable.all()
  const ids: number[] = []
  for (const deptId of deptIds || []) {
    // 沿部门树向上找同名机构：精算部 → 总公司 → 机构「华信人寿」，与 orgIdOfUser 同一口径
    let hit: (typeof orgs)[number] | undefined
    for (const chainId of deptChainOf(Number(deptId))) {
      const dept = deptTable.get(chainId)
      if (!dept) continue
      hit =
        orgs.find((org) => org.orgName === dept.name) ||
        (dept.name === '总公司' ? orgs.find((org) => org.orgLevel === 1) : undefined)
      if (hit) break
    }
    if (hit && !ids.includes(hit.id)) ids.push(hit.id)
  }
  return ids
}

const roleDefaultScope = (userId?: number) => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  const roles = user ? roleTable.all().filter((role) => user.roleIds.includes(role.id)) : []
  if (!roles.length) return undefined
  // 多个角色取"最宽"的那条：dataScope 数字越小范围越大（1 全部数据 … 5 仅本人）
  const widest = roles.slice().sort((a, b) => Number(a.dataScope) - Number(b.dataScope))[0]
  const map: Record<number, number> = { 1: 1, 2: 4, 3: 3, 4: 2, 5: 3 }
  const deptNames = (widest.dataScopeDeptIds || [])
    .map((id: number) => deptTable.get(Number(id)))
    .filter((dept): dept is NonNullable<typeof dept> => !!dept)
    .map((dept) => dept.name)
  return {
    role: widest,
    scopeType: map[Number(widest.dataScope)] || 3,
    orgIds: orgIdsOfDeptIds(widest.dataScopeDeptIds || []),
    scopeLabel: SCOPE_TYPE_LABEL[map[Number(widest.dataScope)] || 3],
    deptNames
  }
}

export interface EffectiveDataScope {
  superAdmin: boolean
  matched: boolean
  scopeType: number
  scopeTypeLabel: string
  orgIds: number[]
  orgNames: string[]
  source: string
  ruleId: number
  rulePriority: number
  userOrgId: number
  userOrgName: string
}

/** 生效的数据权限：业务侧规则优先，未命中回落到角色默认数据范围；管理员不受限 */
export const effectiveDataScope = (userId?: number, reportId?: number): EffectiveDataScope => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  const roles = user ? roleTable.all().filter((role) => user.roleIds.includes(role.id)) : []
  const orgs = orgTable.all()
  const userOrgId = orgIdOfUser(userId)
  const userOrgName = (orgs.find((org) => org.id === userOrgId) || { orgName: '' }).orgName

  if (roles.some((role) => role.code === ROLE_CODE.ADMIN)) {
    return {
      superAdmin: true,
      matched: true,
      scopeType: SCOPE_TYPE.ALL,
      scopeTypeLabel: '全部数据（系统管理员不受限）',
      orgIds: orgs.map((org) => org.id),
      orgNames: orgs.map((org) => org.orgName),
      source: '系统管理员不受限',
      ruleId: 0,
      rulePriority: 0,
      userOrgId,
      userOrgName
    }
  }

  const winner = dataScopeCandidates(userId, reportId)
    .filter((item) => item.state === 'EFFECTIVE')
    .sort(
      (a, b) =>
        Number(b.row.subjectType) - Number(a.row.subjectType) ||
        (a.row.reportId === 0 ? 1 : 0) - (b.row.reportId === 0 ? 1 : 0) ||
        Number(a.row.priority || 50) - Number(b.row.priority || 50) ||
        b.row.id - a.row.id
    )[0]

  if (winner) {
    const orgIds = resolveOrgIds(winner.row.scopeType, winner.row.orgIds, userOrgId)
    if (winner.row.scopeType === SCOPE_TYPE.CUSTOM) {
      return {
        superAdmin: false,
        matched: true,
        scopeType: winner.row.scopeType,
        scopeTypeLabel: SCOPE_TYPE_LABEL[winner.row.scopeType],
        orgIds,
        orgNames: orgs.filter((org) => orgIds.includes(org.id)).map((org) => org.orgName),
        source:
          '命中「数据权限配置」第 ' +
          winner.row.id +
          ' 条：' +
          winner.row.subjectName +
          ' → ' +
          SCOPE_TYPE_LABEL[winner.row.scopeType],
        ruleId: winner.row.id,
        rulePriority: Number(winner.row.priority || 50),
        userOrgId,
        userOrgName
      }
    }
    return {
      superAdmin: false,
      matched: true,
      scopeType: winner.row.scopeType,
      scopeTypeLabel: SCOPE_TYPE_LABEL[winner.row.scopeType],
      orgIds,
      orgNames: orgs.filter((org) => orgIds.includes(org.id)).map((org) => org.orgName),
      source:
        '命中「数据权限配置」第 ' +
        winner.row.id +
        ' 条：' +
        winner.row.subjectName +
        ' → ' +
        SCOPE_TYPE_LABEL[winner.row.scopeType] +
        '（' +
        (userOrgName || '未归属机构') +
        '）',
      ruleId: winner.row.id,
      rulePriority: Number(winner.row.priority || 50),
      userOrgId,
      userOrgName
    }
  }

  const fallback = roleDefaultScope(userId)
  const scopeType = fallback ? fallback.scopeType : SCOPE_TYPE.SELF_ONLY
  const orgIds = resolveOrgIds(scopeType, fallback ? fallback.orgIds : [], userOrgId)
  return {
    superAdmin: false,
    matched: false,
    scopeType,
    scopeTypeLabel: SCOPE_TYPE_LABEL[scopeType],
    orgIds,
    orgNames: orgs.filter((org) => orgIds.includes(org.id)).map((org) => org.orgName),
    source: fallback
      ? '未命中「数据权限配置」规则，回落到角色默认数据范围：' +
        fallback.role.name +
        '（' +
        fallback.scopeLabel +
        '，在「角色管理」里维护）' +
        (fallback.deptNames.length
          ? '（角色里配的部门：' + fallback.deptNames.join('/') + '）'
          : '') +
        (orgIds.length ? '' : ' —— 但该范围展开后在本机构表里没有对应机构，看不到任何机构的数据')
      : '未命中规则且无角色，按「仅本机构」处理',
    ruleId: 0,
    rulePriority: 0,
    userOrgId,
    userOrgName
  }
}

/** 可见机构 id；null = 不受限（管理员） */
export const visibleOrgIdsOf = (userId?: number, reportId?: number): number[] | null => {
  const effective = effectiveDataScope(userId, reportId)
  return effective.superAdmin ? null : effective.orgIds
}

/** 数据权限的"生效判断"：逐条给出 生效中 / 被覆盖 / 已停用 / 报表不匹配 */
export const dataScopeDecisions = (userId?: number, reportId?: number) => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  const effective = effectiveDataScope(userId, reportId)
  const winnerId = effective.ruleId
  const rows = dataScopeCandidates(userId, reportId).map((item) => {
    let state = item.state
    let stateLabel = item.stateLabel
    let reason = item.reason
    if (state === 'EFFECTIVE' && winnerId && item.row.id !== winnerId) {
      state = 'COVERED'
      stateLabel = SCOPE_STATE_LABEL.COVERED
      reason = '同范围有优先级更小（相同则后建的）规则（第 ' + winnerId + ' 条）先生效'
    }
    return {
      id: item.row.id,
      subjectType: item.row.subjectType,
      subjectName: item.row.subjectName,
      reportName: item.row.reportName,
      scopeTypeLabel: SCOPE_TYPE_LABEL[item.row.scopeType],
      priority: item.row.priority,
      status: item.row.status,
      state,
      stateLabel,
      reason
    }
  })
  return {
    user: {
      id: user ? user.id : 0,
      nickname: user ? user.nickname : '',
      deptName: user ? (deptTable.get(user.deptId) || { name: '' }).name : '',
      orgId: effective.userOrgId,
      orgName: effective.userOrgName
    },
    effective: {
      matched: effective.matched,
      superAdmin: effective.superAdmin,
      ruleId: effective.ruleId,
      scopeType: effective.scopeType,
      scopeTypeLabel: effective.scopeTypeLabel,
      source: effective.source,
      orgIds: effective.orgIds,
      orgNames: effective.orgNames
    },
    rows
  }
}

/* ==================================================================
 * 部门权限（部门 × 报表 → 动作）
 * ================================================================== */

const deptScopeCandidates = (userId?: number, reportId?: number) => {
  const chain = deptChainOfUser(userId)
  return deptScopeTable.all().map((row) => {
    const deptHit = chain.includes(Number(row.deptId))
    const reportHit = !row.reportId || Number(row.reportId) === Number(reportId || 0)
    let state: string = 'EFFECTIVE'
    let reason = '部门与报表范围都命中，且优先级最小（相同则后建的）'
    if (!deptHit) {
      state = 'DEPT_MISMATCH'
      reason = '规则授权给「' + row.deptName + '」，当前用户所在部门不在其中'
    } else if (!reportHit) {
      state = 'REPORT_MISMATCH'
      reason = '规则只适用于「' + row.reportName + '」，与本次报表不符'
    } else if (row.status !== 1) {
      state = 'DISABLED'
      reason = '规则已停用'
    }
    return {
      row,
      deptHit,
      reportHit,
      state,
      stateLabel: SCOPE_STATE_LABEL[state as never] || state,
      reason
    }
  })
}

export interface EffectiveDeptScope {
  superAdmin: boolean
  matched: boolean
  actions: string[]
  source: string
  ruleId: number
  deptId: number
  deptName: string
}

/** 生效的部门权限：命中规则 = 规则里的动作集合；未命中 = 默认拒绝（与导入权限同一约定） */
export const effectiveDeptScope = (userId?: number, reportId?: number): EffectiveDeptScope => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  const roles = user ? roleTable.all().filter((role) => user.roleIds.includes(role.id)) : []
  const dept = user ? deptTable.get(user.deptId) : undefined
  const deptName = dept ? dept.name : ''

  if (roles.some((role) => role.code === ROLE_CODE.ADMIN)) {
    return {
      superAdmin: true,
      matched: true,
      actions: Object.keys(DEPT_ACTION_LABEL),
      source: '系统管理员不受限',
      ruleId: 0,
      deptId: dept ? dept.id : 0,
      deptName
    }
  }

  const winner = deptScopeCandidates(userId, reportId)
    .filter((item) => item.state === 'EFFECTIVE')
    .sort(
      (a, b) =>
        (a.row.reportId === 0 ? 1 : 0) - (b.row.reportId === 0 ? 1 : 0) ||
        Number(a.row.priority || 50) - Number(b.row.priority || 50) ||
        b.row.id - a.row.id
    )[0]

  if (!winner) {
    return {
      superAdmin: false,
      matched: false,
      actions: [],
      source:
        '未命中任何「部门权限配置」规则 → 默认拒绝（可在本页为「' +
        (deptName || '未归属部门') +
        '」授权）',
      ruleId: 0,
      deptId: dept ? dept.id : 0,
      deptName
    }
  }
  return {
    superAdmin: false,
    matched: true,
    actions: winner.row.actions || [],
    source:
      '命中「部门权限配置」第 ' +
      winner.row.id +
      ' 条：' +
      winner.row.deptName +
      ' × ' +
      winner.row.reportName,
    ruleId: winner.row.id,
    deptId: dept ? dept.id : 0,
    deptName
  }
}

/** 部门权限的"生效判断" */
export const deptScopeDecisions = (userId?: number, reportId?: number) => {
  const user = userId ? userTable.get(Number(userId)) : undefined
  const effective = effectiveDeptScope(userId, reportId)
  const winnerId = effective.ruleId
  const rows = deptScopeCandidates(userId, reportId).map((item) => {
    let state = item.state
    let stateLabel = item.stateLabel
    let reason = item.reason
    if (state === 'EFFECTIVE' && winnerId && item.row.id !== winnerId) {
      state = 'COVERED'
      stateLabel = SCOPE_STATE_LABEL.COVERED
      reason = '同部门还有优先级更小（相同则后建的）规则（第 ' + winnerId + ' 条）先生效'
    }
    return {
      id: item.row.id,
      deptName: item.row.deptName,
      reportName: item.row.reportName,
      actions: item.row.actions,
      actionLabels: (item.row.actions || []).map((action) => DEPT_ACTION_LABEL[action] || action),
      priority: item.row.priority,
      status: item.row.status,
      state,
      stateLabel,
      reason
    }
  })
  return {
    user: {
      id: user ? user.id : 0,
      nickname: user ? user.nickname : '',
      deptId: effective.deptId,
      deptName: effective.deptName
    },
    effective: {
      matched: effective.matched,
      superAdmin: effective.superAdmin,
      ruleId: effective.ruleId,
      actions: effective.actions,
      actionLabels: effective.actions.map((action) => DEPT_ACTION_LABEL[action] || action),
      source: effective.source
    },
    rows
  }
}

/**
 * 接口层的部门权限校验（写动作落点）。
 *
 * 只在拿到确定的报表上下文时判定：报表未知（reportId 为 0）时不拦，
 * 因为"不知道是哪张报表"就没法判"这个部门在这张报表上能不能做这个动作"。
 */
export const assertDeptAction = (
  userId: number | undefined,
  reportId: number,
  action: string,
  actionLabel: string,
  context: string
): void => {
  if (!reportId) return
  const effective = effectiveDeptScope(userId, reportId)
  if (effective.superAdmin) return
  if (effective.actions.indexOf(action) >= 0) return
  throw new Error(
    '「' +
      actionLabel +
      '」被部门权限拦住：' +
      (effective.deptName || '当前账号') +
      ' 在' +
      context +
      '上没有该动作权限（来源：' +
      effective.source +
      '）'
  )
}

/** 报表中文名（拼错误提示用） */
export const reportNameOf = (reportId: number): string => {
  const hit = reportOptions().find((report) => Number(report.id) === Number(reportId))
  return hit ? '《' + hit.reportName + '》' : '该报表'
}

/** 机构 id → 名称 */
export const orgNameOf = (orgId: number): string => {
  const hit = allOrgs().find((org) => Number(org.id) === Number(orgId))
  return hit ? hit.orgName : ''
}
