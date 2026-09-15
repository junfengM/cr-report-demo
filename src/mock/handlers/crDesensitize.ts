/**
 * Mock 接口 — 数据脱敏域（P1）
 *
 * 四组接口（前缀 /cr/...）：
 *   desens-common    下拉：机构 / 报表 / 期次 / 可脱敏数据项 / 脱敏规则
 *   desens-rule      脱敏规则（掩码 / 哈希 / 替换 / 截断，支持启停）
 *   desens-field     脱敏字段配置（机构 × 报表 × 数据项 → 规则，机构级优先于全局兜底）
 *   desens-task      脱敏执行批次（脱敏日志页），含 /detail 明细
 *   desens-execute   预检 / 执行 / 还原（预检只看不动，执行真实改写 cr.fillData）
 *
 * 关键联动：执行 = runDesensitize()，改的是「数据填报」页的 cr.fillData，并把「前 → 后」写进
 * cr.desensitize（「脱敏结果查询」页），所以执行完切到数据填报页 / 结果查询页都能立刻看到结果。
 */
import { onGet, onPost, onPut } from '../route'
import { currentRoleCodes, currentUser } from './auth'
import { registerResource } from '../resource'
import { formatDateTime, likeAny } from '../util'
import { PERIODS, reportOptions, reportOrgs } from '../db/crCommon'
import { ROLE_CODE, roleTable } from '../db/system'
import {
  applyDesensRule,
  approveDesensTask,
  crDesensFieldTable,
  crDesensRuleTable,
  crDesensTaskTable,
  DESENS_CONDITION_HELP,
  DESENS_TASK_STATUS,
  desensConditionFieldOptions,
  desensFieldDecisions,
  desensToday,
  desensWindowText,
  fillRowsOfKey,
  matchDesensCondition,
  MASKABLE_COLUMNS,
  maskableColumnOf,
  isPendingReview,
  parseDesensCondition,
  precheckDesens,
  rejectDesensTask,
  restoreDesensTask,
  recheckDesensApply,
  runDesensitize,
  submitDesensApply,
  withdrawDesensApply,
  type DesensFieldRow,
  type DesensRuleRow
} from '../db/crDesensitize'
import { crDesensitizeTable } from '../db/crAudit'

/**
 * 操作人：优先取当前登录用户的昵称（审批流必须知道"是谁提交、是谁审核"），
 * 其次才用页面显式传的 operator，最后兜底成系统管理员。
 */
const operatorOf = (ctx: any): string => {
  const user = currentUser(ctx)
  return String(ctx.body?.operator || (user ? user.nickname : '') || '系统管理员')
}

const orgNameOf = (orgId: number): string => {
  const hit = reportOrgs().find((org) => Number(org.id) === Number(orgId))
  return orgId === 0 ? '全部机构' : hit ? hit.orgName : ''
}

const reportMetaOf = (reportId: number) =>
  reportOptions().find((report) => Number(report.id) === Number(reportId))

/* ==================================================================
 * 下拉接口
 * ================================================================== */
onGet('/cr/desens-common/org-options', () => [{ id: 0, orgName: '全部机构' }].concat(reportOrgs()))
onGet('/cr/desens-common/report-options', () => reportOptions())
/** 期次下拉：只给有填报数据的近几期（倒序，当前期在最前） */
onGet('/cr/desens-common/period-options', () => [...PERIODS].reverse())
/** 可脱敏数据项：报表数据项 ↔ 填报字段的对应关系，页面选择字段时用 */
onGet('/cr/desens-common/column-options', () => MASKABLE_COLUMNS.map((item) => ({ ...item })))
/** 命中条件可用字段与写法说明（页面表单直接展示，避免两边各写一份字段名） */
onGet('/cr/desens-common/condition-fields', () => ({
  fields: desensConditionFieldOptions(),
  help: DESENS_CONDITION_HELP,
  today: desensToday()
}))

/** 规则下拉：只给启用中的规则 */
onGet('/cr/desens-common/rule-options', () =>
  crDesensRuleTable
    .all()
    .filter((row) => row.status === 1)
    .map((row) => ({
      id: row.id,
      ruleCode: row.ruleCode,
      ruleName: row.ruleName,
      ruleType: row.ruleType,
      ruleParam: row.ruleParam,
      scope: row.scope
    }))
)

/* ==================================================================
 * 一、脱敏规则
 * ================================================================== */
const filterRule = (row: DesensRuleRow, params: any = {}) => {
  if (
    params.status !== undefined &&
    params.status !== null &&
    params.status !== '' &&
    Number(row.status) !== Number(params.status)
  )
    return false
  if (params.ruleType && row.ruleType !== params.ruleType) return false
  if (params.scope && row.scope !== params.scope) return false
  return likeAny(row, ['ruleCode', 'ruleName', 'scope', 'remark', 'ruleParam'], params.keyword)
}

/** 规则编码：DR + 三位序号 */
const nextRuleCode = (): string => {
  const max = crDesensRuleTable
    .all()
    .map((row) => Number(String(row.ruleCode).replace(/\D/g, '')) || 0)
    .reduce((a, b) => Math.max(a, b), 0)
  return 'DR' + String(max + 1).padStart(3, '0')
}

const withSample = (row: Partial<DesensRuleRow>): Partial<DesensRuleRow> => {
  const sampleFrom = String(row.sampleFrom || '示例')
  const ruleType = (row.ruleType || 'MASK') as DesensRuleRow['ruleType']
  const ruleParam = String(row.ruleParam || '')
  return {
    ...row,
    sampleTo: applyDesensRule(ruleType, ruleParam, sampleFrom, row.scope === '邮箱' ? 'email' : '')
  }
}

registerResource<DesensRuleRow>({
  prefix: '/cr/desens-rule',
  table: crDesensRuleTable,
  // 脱敏规则/字段配置决定"哪些数据会被改写"，写操作只允许管理员
  guard: (ctx, action) => assertRoles(ctx, [ROLE_CODE.ADMIN], '脱敏规则' + action),
  sort: (a, b) => a.ruleCode.localeCompare(b.ruleCode) || a.id - b.id,
  filter: filterRule,
  beforeCreate: (body) =>
    withSample({
      ...body,
      ruleCode: body.ruleCode || nextRuleCode(),
      ruleName: body.ruleName || '未命名规则',
      ruleType: body.ruleType || 'MASK',
      ruleParam: body.ruleParam || '',
      scope: body.scope || '姓名',
      sampleFrom: body.sampleFrom || '示例',
      builtin: false,
      status: body.status === undefined ? 1 : body.status
    }),
  beforeUpdate: (body) => {
    const existing = body.id ? crDesensRuleTable.get(Number(body.id)) : undefined
    const merged = { ...(existing || {}), ...body } as Partial<DesensRuleRow>
    return withSample(merged)
  },
  exportColumns: [
    { field: 'ruleCode', label: '规则编码' },
    { field: 'ruleName', label: '规则名称' },
    { field: 'ruleType', label: '规则类型' },
    { field: 'ruleParam', label: '规则参数' },
    { field: 'scope', label: '适用数据项' },
    { field: 'sampleFrom', label: '示例原文' },
    { field: 'sampleTo', label: '示例结果' },
    { field: 'status', label: '状态' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '说明' }
  ]
})

/** 规则启停：内置规则也允许停用（停用后引用它的字段配置不生效） */
onPut('/cr/desens-rule/toggle', (ctx) => {
  // 这是个"静默取消脱敏"的开关：停用后预检直接少一批字段值。谁都能按就等于脱敏能被关掉
  assertRoles(ctx, [ROLE_CODE.ADMIN], '脱敏规则启停')
  const id = Number(ctx.body?.id)
  const row = crDesensRuleTable.get(id)
  if (!row) throw new Error('脱敏规则不存在：id=' + id)
  const status = row.status === 1 ? 0 : 1
  const updated = crDesensRuleTable.update({
    id,
    status,
    updateUser: operatorOf(ctx),
    updateTime: formatDateTime()
  })
  return { ...(updated || row), tip: status === 1 ? '规则已启用' : '规则已停用' }
})

/* ==================================================================
 * 二、脱敏字段配置
 * ================================================================== */
const filterField = (row: DesensFieldRow, params: any = {}) => {
  if (
    params.orgId !== undefined &&
    params.orgId !== null &&
    params.orgId !== '' &&
    Number(row.orgId) !== Number(params.orgId)
  )
    return false
  if (
    params.reportId !== undefined &&
    params.reportId !== null &&
    params.reportId !== '' &&
    Number(row.reportId) !== Number(params.reportId)
  )
    return false
  if (
    params.status !== undefined &&
    params.status !== null &&
    params.status !== '' &&
    Number(row.status) !== Number(params.status)
  )
    return false
  return likeAny(
    row,
    [
      'orgName',
      'reportName',
      'columnName',
      'columnCode',
      'ruleName',
      'ruleCode',
      'ruleParam',
      'remark'
    ],
    params.keyword
  )
}

/**
 * 角色断言：不能只靠"页面上没有按钮 / 侧边栏没有菜单"。
 * 直接拿接口地址就能绕过审批流去改写填报数据（独立审核实测过：填报岗与未登录都能放行），
 * 所以执行/审批/配置这些"会动数据"的入口必须在 handler 里再判一次角色。
 */
const assertRoles = (ctx: any, allow: string[], action: string) => {
  const user = currentUser(ctx)
  const codes = user ? currentRoleCodes(ctx) : []
  const ok = allow.some((code) => codes.indexOf(code) >= 0)
  if (!ok) {
    // 报错给中文角色名（角色表里就是中文），不要把 super_admin / cr_auditor 这种代码甩给用户
    const names = allow
      .map((code) => roleTable.all().find((role) => role.code === code)?.name || code)
      .join(' / ')
    throw new Error(
      '「' +
        action +
        '」仅 ' +
        names +
        ' 可操作（当前账号：' +
        (user ? user.nickname : '未登录') +
        '）'
    )
  }
}

/** 建/改配置时把「机构名 / 报表编码名 / 数据项编码名 / 规则快照」一次补齐，避免页面上出现空列 */
const fillFieldRow = (body: any): Partial<DesensFieldRow> => {
  // 命中条件与生效期在这里就校验掉：写错的配置一旦落库，执行时才发现代价更大
  const condition = String(body.condition || '').trim()
  const parsedCondition = parseDesensCondition(condition)
  if (!parsedCondition.ok) throw new Error('命中条件无法解析：' + parsedCondition.error)
  const effectiveFrom = String(body.effectiveFrom || '').trim()
  const effectiveTo = String(body.effectiveTo || '').trim()
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    throw new Error(
      '生效期的开始日期不能晚于结束日期（' + effectiveFrom + ' > ' + effectiveTo + '）'
    )
  }
  // 适用期次：只接受「报送期次」里存在的期次，空数组 = 全部期次
  const rawPeriods = Array.isArray(body.periods) ? body.periods : body.periods ? [body.periods] : []
  const periods = rawPeriods
    .map((item: any) => String(item).trim())
    .filter((item: string) => !!item)
  const badPeriod = periods.find((item: string) => PERIODS.indexOf(item) < 0)
  if (badPeriod) {
    throw new Error('适用期次「' + badPeriod + '」不在可选期次里（' + PERIODS.join('、') + '）')
  }
  const orgId = Number(body.orgId || 0)
  const reportId = Number(body.reportId || 0)
  const fieldKey = String(body.fieldKey || maskableColumnOf('').fieldKey)
  const column = maskableColumnOf(fieldKey)
  // 解析规则：先按 ruleId，再按 ruleCode；两者都没给则沿用原值。
  // 注意不能写成 `get(ruleId) || find(ruleCode)` —— update 只传 ruleCode 时，
  // body.ruleId 是空的但合并进来的 current.ruleId 还在，会解析成旧规则、把新规则静默丢掉
  const rule =
    crDesensRuleTable.get(Number(body.ruleId)) ||
    crDesensRuleTable.all().find((row) => row.ruleCode === String(body.ruleCode || '').trim())
  // 兜底：调用方既没给 ruleId 也没给 ruleCode（例如 ruleId: null）时，沿用这条配置原来的规则快照，
  // 不能把 ruleId 写成 0 —— 那会落一条"没有规则"的配置，预检时才发现
  const previous = !rule && body.id ? crDesensFieldTable.get(Number(body.id)) : undefined
  const ruleId = rule ? rule.id : previous ? Number(previous.ruleId || 0) : 0
  const ruleCode = rule ? rule.ruleCode : previous ? previous.ruleCode : ''
  const ruleName = rule ? rule.ruleName : previous ? previous.ruleName : ''
  const ruleType = rule ? rule.ruleType : previous ? previous.ruleType || 'MASK' : 'MASK'
  const ruleParam = rule ? rule.ruleParam : previous ? previous.ruleParam : ''
  const report = reportMetaOf(reportId)
  return {
    ...body,
    orgId,
    orgName: orgNameOf(orgId),
    reportId,
    reportCode: report ? report.reportCode : '',
    reportName: report ? report.reportName : '',
    fieldKey: column.fieldKey,
    columnCode: column.columnCode,
    columnName: column.columnName,
    ruleId,
    ruleCode,
    ruleName,
    ruleType,
    ruleParam,
    priority:
      body.priority === undefined || body.priority === null || body.priority === ''
        ? 10
        : Number(body.priority),
    condition: condition,
    effectiveFrom: String(body.effectiveFrom || ''),
    effectiveTo: String(body.effectiveTo || ''),
    periods: [...new Set(periods)].sort(),
    status: body.status === undefined ? 1 : body.status
  }
}

registerResource<DesensFieldRow>({
  prefix: '/cr/desens-field',
  table: crDesensFieldTable,
  guard: (ctx, action) => assertRoles(ctx, [ROLE_CODE.ADMIN], '脱敏字段配置' + action),
  sort: (a, b) =>
    (a.orgId === 0 ? 1 : 0) - (b.orgId === 0 ? 1 : 0) ||
    a.orgId - b.orgId ||
    a.reportId - b.reportId ||
    a.priority - b.priority ||
    a.id - b.id,
  filter: filterField,
  beforeCreate: fillFieldRow,
  beforeUpdate: (body) => {
    const current = (crDesensFieldTable.get(Number(body.id)) || {}) as DesensFieldRow
    // 调用方只传 ruleCode（没传 ruleId）时，按 ruleCode 反查 ruleId：
    // 否则合并 current 后 ruleId 仍是旧规则，新规则会被静默丢掉（接口调用方以为改了，其实没改）
    if (body.ruleId === undefined && body.ruleCode !== undefined) {
      const byCode = crDesensRuleTable
        .all()
        .find((row) => row.ruleCode === String(body.ruleCode).trim())
      if (!byCode) throw new Error('脱敏规则不存在：' + body.ruleCode)
      return fillFieldRow({ ...current, ...body, ruleId: byCode.id })
    }
    return fillFieldRow({ ...current, ...body })
  },
  exportColumns: [
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'columnCode', label: '数据项编码' },
    { field: 'columnName', label: '数据项名称' },
    { field: 'ruleCode', label: '规则编码' },
    { field: 'ruleName', label: '规则名称' },
    { field: 'ruleType', label: '规则类型' },
    { field: 'ruleParam', label: '规则参数' },
    { field: 'priority', label: '优先级' },
    { field: 'condition', label: '命中条件' },
    { field: 'effectiveFrom', label: '生效开始' },
    { field: 'effectiveTo', label: '生效结束' },
    { field: 'periods', label: '适用期次' },
    { field: 'status', label: '状态' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' }
  ]
})

/**
 * 校验命中条件：解析语法 + 可选地按「机构 × 报表 × 期次」试算命中行数。
 * 表单上的「校验条件」按钮调它 —— 让用户在保存前就知道条件能不能用、会影响多少行。
 */
onPost('/cr/desens-field/check-condition', (ctx) => {
  const condition = String(ctx.body?.condition || '').trim()
  const parsed = parseDesensCondition(condition)
  const result: Record<string, any> = {
    condition,
    ok: parsed.ok,
    error: parsed.error,
    items: parsed.groups.flat().map((item) => ({ ...item })),
    fieldOptions: desensConditionFieldOptions()
  }
  const reportId = Number(ctx.body?.reportId || 0)
  const period = String(ctx.body?.period || '')
  if (parsed.ok && reportId) {
    const orgId = Number(ctx.body?.orgId || 0)
    const rows = period ? fillRowsOfKey(orgId, reportId, period) : []
    result.totalRows = rows.length
    result.matched = parsed.groups.length
      ? rows.filter((row) => matchDesensCondition(row, parsed)).length
      : rows.length
    result.skipped = rows.length - Number(result.matched || 0)
  }
  return result
})

/**
 * 字段配置的生效判定：列表上标「生效中 / 被覆盖 / 不在生效期 / 已停用」，
 * 免得用户新增一条配置后以为生效了，其实被同范围的老配置盖住。
 */
onGet('/cr/desens-field/decisions', () => ({
  today: desensToday(),
  decisions: desensFieldDecisions(),
  windowText: crDesensFieldTable.all().reduce((acc: Record<number, string>, row) => {
    acc[row.id] = desensWindowText(row)
    return acc
  }, {})
}))

onPut('/cr/desens-field/toggle', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN], '脱敏字段配置启停')
  const id = Number(ctx.body?.id)
  const row = crDesensFieldTable.get(id)
  if (!row) throw new Error('字段配置不存在：id=' + id)
  const status = row.status === 1 ? 0 : 1
  const updated = crDesensFieldTable.update({
    id,
    status,
    updateUser: operatorOf(ctx),
    updateTime: formatDateTime()
  })
  return { ...(updated || row) }
})
/* ==================================================================
 * 三、脱敏执行批次（脱敏日志）
 * ================================================================== */
const filterTask = (row: any, params: any = {}) => {
  if (
    params.orgId !== undefined &&
    params.orgId !== null &&
    params.orgId !== '' &&
    Number(row.orgId) !== Number(params.orgId)
  )
    return false
  if (
    params.reportId !== undefined &&
    params.reportId !== null &&
    params.reportId !== '' &&
    Number(row.reportId) !== Number(params.reportId)
  )
    return false
  if (
    params.status !== undefined &&
    params.status !== null &&
    params.status !== '' &&
    Number(row.status) !== Number(params.status)
  )
    return false
  if (params.period && row.period !== params.period) return false
  return likeAny(
    row,
    [
      'batchNo',
      'orgName',
      'reportName',
      'period',
      'operator',
      'message',
      'applyUser',
      'auditUser',
      'auditRemark'
    ],
    params.keyword
  )
}

registerResource<any>({
  prefix: '/cr/desens-task',
  table: crDesensTaskTable,
  // 批次只能由执行/审批/还原接口产生与推进，不允许直接增删改
  guard: (ctx, action) => assertRoles(ctx, [ROLE_CODE.ADMIN], '脱敏批次' + action),
  // startTime 兜底成字符串：直接调 /cr/desens-task/create 塞进来的行没有这个字段，
  // 一次 undefined.localeCompare 就会让整个列表接口 500（门禁脚本探接口时真踩到过）
  sort: (a, b) => String(b.startTime || '').localeCompare(String(a.startTime || '')) || b.id - a.id,
  filter: filterTask,
  exportColumns: [
    { field: 'batchNo', label: '批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '期次' },
    { field: 'fieldCount', label: '字段数' },
    { field: 'ruleCount', label: '规则数' },
    { field: 'totalRows', label: '涉及行数' },
    { field: 'maskedRows', label: '脱敏字段值' },
    { field: 'skipRows', label: '跳过' },
    { field: 'status', label: '执行状态' },
    { field: 'startTime', label: '开始时间' },
    { field: 'endTime', label: '结束时间' },
    { field: 'cost', label: '耗时(ms)' },
    { field: 'operator', label: '操作人' },
    { field: 'applyUser', label: '申请人' },
    { field: 'applyTime', label: '申请时间' },
    { field: 'auditUser', label: '审核人' },
    { field: 'auditTime', label: '审核时间' },
    { field: 'auditRemark', label: '审核意见' },
    { field: 'message', label: '执行结果' }
  ]
})

/** 批次详情：字段明细 + 本批次写进「脱敏结果查询」的对照样例 */
onGet('/cr/desens-task/detail', (ctx) => {
  const id = Number(ctx.params.id)
  const task = crDesensTaskTable.get(id)
  if (!task) throw new Error('脱敏批次不存在：id=' + id)
  const contrasts = crDesensitizeTable.all().filter((row) => Number(row.taskId) === id)
  const byColumn = new Map<string, { columnName: string; rows: number }>()
  contrasts.forEach((row) => {
    const hit = byColumn.get(row.columnCode)
    if (hit) hit.rows += 1
    else byColumn.set(row.columnCode, { columnName: row.columnName, rows: 1 })
  })
  return {
    ...task,
    contrastCount: contrasts.length,
    contrastColumns: [...byColumn.entries()].map(([columnCode, item]) => ({ columnCode, ...item })),
    samples: contrasts.slice(0, 10).map((row) => ({
      rowNo: row.rowNo,
      policyNo: row.policyNo,
      columnName: row.columnName,
      originalValue: row.originalValue,
      maskedValue: row.maskedValue
    }))
  }
})

/** 日志页头部统计卡片 */
onGet('/cr/desens-task/stats', () => {
  const all = crDesensTaskTable.all()
  const count = (status: number) => all.filter((row) => row.status === status).length
  return {
    total: all.length,
    success: count(DESENS_TASK_STATUS.SUCCESS),
    partial: count(DESENS_TASK_STATUS.PARTIAL),
    failed: count(DESENS_TASK_STATUS.FAILED),
    restored: count(DESENS_TASK_STATUS.RESTORED),
    pending: count(DESENS_TASK_STATUS.PENDING_REVIEW),
    rejected: count(DESENS_TASK_STATUS.REJECTED),
    maskedRows: all.reduce((sum, row) => sum + row.maskedRows, 0),
    fieldCount: crDesensFieldTable.all().length,
    ruleCount: crDesensRuleTable.all().filter((row) => row.status === 1).length
  }
})

/* ==================================================================
 * 四、预检 / 执行 / 还原
 * ================================================================== */
const requireScope = (ctx: any) => {
  const body = ctx.body || {}
  const orgId = Number(body.orgId)
  const reportId = Number(body.reportId)
  const period = String(body.period || '')
  if (!orgId) throw new Error('请先选择报送机构')
  if (!reportId) throw new Error('请先选择报表')
  if (!period) throw new Error('请先选择报送期次')
  return { orgId, reportId, period }
}

/** 预检：只看不动，返回「将要动哪些字段、影响多少行、有什么风险」 */
onPost('/cr/desens-execute/precheck', (ctx) => {
  const scope = requireScope(ctx)
  return precheckDesens(scope.orgId, scope.reportId, scope.period)
})

/**
 * 提交执行申请（审批流入口）：只落一条「待审核」的申请单，不改任何数据。
 * 审核岗在「脱敏审批」页通过之后才真正执行。
 */
onPost('/cr/desens-execute/apply', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN], '提交脱敏执行申请')
  const body = ctx.body || {}
  return submitDesensApply({
    orgId: Number(body.orgId),
    reportId: Number(body.reportId),
    period: String(body.period || ''),
    operator: operatorOf(ctx),
    remark: String(body.remark || '')
  })
})

/** 审核通过：这一刻才真正改写数据（执行结果写回同一张申请单） */
/**
 * 放行前复算：申请后如果填报数据被改过，审核岗要看到"申请时预计 N / 现在预计 M"。
 * 只读接口，审批页打开弹窗时调它。
 */
onGet('/cr/desens-execute/recheck', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR], '脱敏申请复算')
  return recheckDesensApply(Number(ctx.params.id))
})

onPost('/cr/desens-execute/approve', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR], '脱敏申请审核')
  const body = ctx.body || {}
  return approveDesensTask(Number(body.id), operatorOf(ctx), String(body.remark || ''))
})

/** 审核驳回：不执行，留下原因 */
onPost('/cr/desens-execute/reject', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR], '脱敏申请审核')
  const body = ctx.body || {}
  return rejectDesensTask(Number(body.id), operatorOf(ctx), String(body.remark || ''))
})

/**
 * 撤回申请：作废待审核的申请单（还没动过数据，所以直接删掉）。
 * 只允许申请人本人或系统管理员撤回 —— 审批岗可以驳回，但不该替别人撤单。
 */
onPost('/cr/desens-execute/withdraw', (ctx) => {
  const id = Number(ctx.body?.id)
  const task = crDesensTaskTable.get(id)
  if (!task) throw new Error('脱敏申请不存在：id=' + id)
  const user = currentUser(ctx)
  const isAdmin = currentRoleCodes(ctx).indexOf(ROLE_CODE.ADMIN) >= 0
  if (!isAdmin && (!user || user.nickname !== task.applyUser)) {
    throw new Error('只有申请人本人（' + task.applyUser + '）或系统管理员可以撤回申请')
  }
  return withdrawDesensApply(id, operatorOf(ctx))
})

/** 审批页头部统计：待审核 / 今日已审 / 驳回 各多少条 */
onGet('/cr/desens-task/approval-stats', () => {
  const all = crDesensTaskTable.all()
  const pending = all.filter((row) => isPendingReview(row))
  const rejected = all.filter((row) => Number(row.status) === DESENS_TASK_STATUS.REJECTED)
  // 「累计放行」= 审核岗放行过的（不含驳回）；但放行后仍可能执行失败(4)或事后被还原(5)，
  // 所以另外给出 executionSucceeded / executionFailed / restored，别把"放行"讲成"已执行成功"
  const approved = all.filter(
    (row) => !!row.auditUser && Number(row.status) !== DESENS_TASK_STATUS.REJECTED
  )
  const succeeded = approved.filter(
    (row) =>
      Number(row.status) === DESENS_TASK_STATUS.SUCCESS ||
      Number(row.status) === DESENS_TASK_STATUS.PARTIAL
  )
  const failed = approved.filter((row) => Number(row.status) === DESENS_TASK_STATUS.FAILED)
  const restored = approved.filter((row) => Number(row.status) === DESENS_TASK_STATUS.RESTORED)
  return {
    pending: pending.length,
    pendingRows: pending.reduce((sum, row) => sum + Number(row.totalRows || 0), 0),
    approved: approved.length,
    executionSucceeded: succeeded.length,
    executionFailed: failed.length,
    restored: restored.length,
    rejected: rejected.length,
    longestWaitHours: pending.length
      ? Math.max(
          ...pending.map((row) => {
            const start = new Date(
              String(row.applyTime || row.startTime).replace(/-/g, '/')
            ).getTime()
            return Number.isFinite(start)
              ? Math.max(0, Math.round((Date.now() - start) / 3600000))
              : 0
          })
        )
      : 0
  }
})

/** 执行：真实改写填报数据 + 写对照 + 落批次日志；没有可处理的值时直接拦住，不落一条「执行失败」的脏批次 */
onPost('/cr/desens-execute/run', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN], '直接执行脱敏')
  const scope = requireScope(ctx)
  const plan = precheckDesens(scope.orgId, scope.reportId, scope.period)
  if (!plan.totalRows) throw new Error('该「机构 × 报表 × 期次」下还没有填报数据，无法执行脱敏')
  if (!plan.fieldCount)
    throw new Error('该报表没有生效的脱敏字段配置，请先到「脱敏字段配置」里配置')
  // 条件写错要先报条件错：先判 willMask 会把"条件解析不了"误报成"都已脱敏或为空"，把排查方向带偏
  const badCondition = plan.plan.find((item) => !!item.conditionError)
  if (badCondition) {
    throw new Error(
      '「' +
        badCondition.columnName +
        '」的命中条件无法解析：' +
        badCondition.conditionError +
        '，请先修正「脱敏字段配置」再执行'
    )
  }
  if (!plan.willMask) throw new Error('所有字段的值都已脱敏或为空，本次执行不会产生变更，已跳过')
  return runDesensitize({ ...scope, operator: operatorOf(ctx) })
})

/** 还原：把这一批次脱敏掉的字段值倒回原文（对照行同时清理） */
onPost('/cr/desens-execute/restore', (ctx) => {
  assertRoles(ctx, [ROLE_CODE.ADMIN], '还原脱敏批次')
  const id = Number(ctx.body?.id)
  if (!id) throw new Error('缺少脱敏批次 id')
  return restoreDesensTask(id, operatorOf(ctx))
})
