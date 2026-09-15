/**
 * 数据拆分（报送数据分包）—— mock 接口
 *
 * 页面：数据脱敏 → 数据拆分（拆分规则 + 拆分执行 + 拆分记录在同一页）
 * 数据：cr.splitRule（拆分规则）/ cr.splitTask（拆分批次与包清单）
 *
 * 业务口径：拆分只对 cr.fillData 做**分组与清单**，不复制行、不改写任何字段值；
 * 「按行数均分 / 按字段值分组 / 不拆分」三种方式见字典 cr_split_mode。
 * 需求附件不在工程里，这一块是按通行做法提案的实现，细节口径待业务确认。
 */
import { onGet, onPost, onPut } from '../route'
import { registerResource } from '../resource'
import { formatDateTime, likeAny } from '../util'
import { currentUser, currentRoleCodes } from './auth'
import { ROLE_CODE, roleTable } from '../db/system'
import { PERIODS, reportOptions, reportOrgs } from '../db/crCommon'
import {
  buildSplitPackageFile,
  crSplitRuleTable,
  crSplitTaskTable,
  nextSplitRuleCode,
  precheckSplit,
  runSplit,
  SPLIT_FIELDS,
  SPLIT_MAX_PACKAGES,
  SPLIT_MODE,
  SPLIT_MODE_LABEL,
  splitFieldLabel,
  type SplitRuleRow
} from '../db/crSplit'

/** 操作人：优先当前登录用户（拆分批次要能追溯到人），其次页面传值，最后兜底 */
const operatorOf = (ctx: any): string => {
  const user = currentUser(ctx)
  return String(ctx.body?.operator || (user ? user.nickname : '') || '系统管理员')
}

const orgNameOf = (orgId: number): string => {
  if (Number(orgId) === 0) return '全部机构'
  const hit = reportOrgs().find((org) => Number(org.id) === Number(orgId))
  return hit ? hit.orgName : ''
}

/* ==================================================================
 * 一、下拉与选项
 * ================================================================== */
onGet('/cr/split-common/org-options', () => [{ id: 0, orgName: '全部机构' }].concat(reportOrgs()))
onGet('/cr/split-common/report-options', () =>
  [{ id: 0, reportCode: '', reportName: '全部报表' }].concat(reportOptions())
)
onGet('/cr/split-common/period-options', () => [...PERIODS].reverse())
/** 拆分方式与可选拆分字段（页面上直接展示，避免前后端各写一套枚举） */
onGet('/cr/split-common/meta', () => ({
  modes: Object.keys(SPLIT_MODE_LABEL).map((key) => ({
    value: Number(key),
    label: SPLIT_MODE_LABEL[Number(key)]
  })),
  fields: SPLIT_FIELDS.map((item) => ({ ...item })),
  maxPackages: SPLIT_MAX_PACKAGES
}))

/* ==================================================================
 * 二、拆分规则
 * ================================================================== */
/** 建/改规则时校验并补齐「机构名 / 报表编码名 / 字段中文名」，避免列表出现空列 */
const fillRuleRow = (body: any): Partial<SplitRuleRow> => {
  const mode = Number(body.mode || SPLIT_MODE.BY_ROWS)
  if (!SPLIT_MODE_LABEL[mode]) throw new Error('拆分方式不合法：' + body.mode)
  const orgId = Number(body.orgId || 0)
  const reportId = Number(body.reportId || 0)
  const rowsPerPackage = Number(body.rowsPerPackage || 0)
  if (mode === SPLIT_MODE.BY_ROWS && (!rowsPerPackage || rowsPerPackage < 1)) {
    throw new Error('「按行数均分」必须填写每包行数（至少 1 行）')
  }
  if (mode === SPLIT_MODE.BY_ROWS && rowsPerPackage > 5000) {
    throw new Error('每包行数不能超过 5000（当前 ' + rowsPerPackage + '），请确认是否填错')
  }
  const splitField = mode === SPLIT_MODE.BY_FIELD ? String(body.splitField || '') : ''
  if (mode === SPLIT_MODE.BY_FIELD && !splitField) {
    throw new Error('「按字段值分组」必须选择拆分字段')
  }
  if (splitField && !SPLIT_FIELDS.some((item) => item.field === splitField)) {
    throw new Error('拆分字段不可用：' + splitField)
  }
  const pkgPrefix = String(body.pkgPrefix || '').trim()
  if (!pkgPrefix) throw new Error('包名前缀不能为空（包名形如 BJ-BX011-P01）')
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(pkgPrefix)) {
    throw new Error('包名前缀只能用字母/数字/下划线/短横线，长度 2~20：' + pkgPrefix)
  }
  const priority =
    body.priority === undefined || body.priority === '' || body.priority === null
      ? 50
      : Number(body.priority)
  if (!Number.isFinite(priority) || priority < 0 || priority > 999) {
    throw new Error('优先级必须是 0~999 的数字（数字小的先生效，缺省 50）：' + body.priority)
  }
  const report = reportOptions().find((item) => Number(item.id) === reportId)
  return {
    ...body,
    ruleCode: String(body.ruleCode || '').trim() || nextSplitRuleCode(),
    ruleName: String(body.ruleName || '').trim() || '未命名拆分规则',
    orgId,
    orgName: orgNameOf(orgId),
    reportId,
    reportCode: report ? report.reportCode : '',
    reportName: report ? report.reportName : '全部报表',
    mode,
    rowsPerPackage: mode === SPLIT_MODE.BY_ROWS ? rowsPerPackage : 0,
    splitField,
    splitFieldLabel: splitField ? splitFieldLabel(splitField) : '',
    pkgPrefix,
    priority,
    status: body.status === undefined ? 1 : body.status
  }
}

const filterRule = (row: any, params: any = {}) => {
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
  if (
    params.mode !== undefined &&
    params.mode !== null &&
    params.mode !== '' &&
    Number(row.mode) !== Number(params.mode)
  )
    return false
  return likeAny(
    row,
    ['ruleCode', 'ruleName', 'orgName', 'reportCode', 'reportName', 'pkgPrefix', 'remark'],
    params.keyword
  )
}

/**
 * 角色断言：拆分规则与拆分执行都是管理员专属（页面对填报/复核/审核岗不可见）。
 * 不能只靠菜单与按钮隐藏 —— 直接拿接口地址也要拦住（独立审核实测过：原来谁都能建规则、执行拆分）。
 */
const assertAdmin = (ctx: any, action: string) => {
  const user = currentUser(ctx)
  const codes = user ? currentRoleCodes(ctx) : []
  if (codes.indexOf(ROLE_CODE.ADMIN) < 0) {
    const adminName =
      roleTable.all().find((role) => role.code === ROLE_CODE.ADMIN)?.name || '系统管理员'
    throw new Error(
      '「' +
        action +
        '」仅' +
        adminName +
        '可操作（当前账号：' +
        (user ? user.nickname : '未登录') +
        '）'
    )
  }
}

registerResource<SplitRuleRow>({
  prefix: '/cr/split-rule',
  table: crSplitRuleTable,
  guard: (ctx, action) => assertAdmin(ctx, '拆分规则' + action),
  // 与 effectiveSplitRule 同一口径：机构级在前，同范围优先级小的在前，再按后建的在前
  sort: (a, b) =>
    (a.orgId === 0 ? 1 : 0) - (b.orgId === 0 ? 1 : 0) ||
    a.orgId - b.orgId ||
    Number(a.priority || 50) - Number(b.priority || 50) ||
    b.id - a.id,
  filter: filterRule,
  // 操作人沿用仓库既有约定：页面传当前登录用户，缺省按系统管理员记录
  beforeCreate: (body) => ({
    ...fillRuleRow(body),
    updateUser: operatorOf({ body }),
    updateTime: formatDateTime()
  }),
  beforeUpdate: (body) => {
    const current = crSplitRuleTable.get(Number(body.id)) || ({} as SplitRuleRow)
    return {
      ...fillRuleRow({ ...current, ...body }),
      updateUser: operatorOf({ body }),
      updateTime: formatDateTime()
    }
  },
  exportColumns: [
    { field: 'ruleCode', label: '规则编码' },
    { field: 'ruleName', label: '规则名称' },
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'mode', label: '拆分方式' },
    { field: 'rowsPerPackage', label: '每包行数' },
    { field: 'splitFieldLabel', label: '拆分字段' },
    { field: 'pkgPrefix', label: '包名前缀' },
    { field: 'priority', label: '优先级' },
    { field: 'status', label: '状态' },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '备注' }
  ]
})

/** 规则启停：停用后该「机构 × 报表」会回落到下一条可用规则（没有就提示"无可用规则"） */
onPut('/cr/split-rule/toggle', (ctx) => {
  assertAdmin(ctx, '拆分规则启停')
  const id = Number(ctx.body?.id)
  const row = crSplitRuleTable.get(id)
  if (!row) throw new Error('拆分规则不存在：id=' + id)
  const status = row.status === 1 ? 0 : 1
  const updated = crSplitRuleTable.update({
    id,
    status,
    updateUser: operatorOf(ctx),
    updateTime: formatDateTime()
  })
  return { ...(updated || row), tip: status === 1 ? '规则已启用' : '规则已停用' }
})

/* ==================================================================
 * 三、拆分执行与拆分记录
 * ================================================================== */
const requireScope = (ctx: any) => {
  const orgId = Number(ctx.body?.orgId)
  const reportId = Number(ctx.body?.reportId)
  const period = String(ctx.body?.period || '')
  if (!orgId) throw new Error('缺少机构')
  if (!reportId) throw new Error('缺少报表')
  if (!period) throw new Error('缺少期次')
  return { orgId, reportId, period }
}

/** 预检：只算不动，返回将会拆出几个包、每包多少行 */
onPost('/cr/split-execute/precheck', (ctx) => {
  assertAdmin(ctx, '拆分预检')
  const scope = requireScope(ctx)
  return precheckSplit(scope.orgId, scope.reportId, scope.period)
})

/** 执行拆分：落批次 + 每包清单（只读填报数据，不复制也不改写） */
onPost('/cr/split-execute/run', (ctx) => {
  assertAdmin(ctx, '执行拆分')
  const scope = requireScope(ctx)
  const plan = precheckSplit(scope.orgId, scope.reportId, scope.period)
  if (!plan.rule) throw new Error('该「机构 × 报表」没有启用的拆分规则，请先到「拆分规则」里配置')
  if (!plan.totalRows) throw new Error('该「机构 × 报表 × 期次」下没有可拆分的填报数据')
  if (plan.pkgCount > SPLIT_MAX_PACKAGES) {
    throw new Error(
      '本次会拆出 ' + plan.pkgCount + ' 个包，超过上限 ' + SPLIT_MAX_PACKAGES + '，请调整拆分规则'
    )
  }
  return runSplit({ ...scope, operator: operatorOf(ctx) })
})

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
  if (
    params.mode !== undefined &&
    params.mode !== null &&
    params.mode !== '' &&
    Number(row.mode) !== Number(params.mode)
  )
    return false
  if (params.period && row.period !== params.period) return false
  return likeAny(
    row,
    ['batchNo', 'orgName', 'reportName', 'period', 'ruleName', 'operator', 'message'],
    params.keyword
  )
}

registerResource<any>({
  prefix: '/cr/split-task',
  table: crSplitTaskTable,
  // 批次只能由「执行拆分」产生，不允许直接增删改
  guard: (ctx, action) => assertAdmin(ctx, '拆分批次' + action),
  sort: (a, b) => String(b.startTime).localeCompare(String(a.startTime)) || b.id - a.id,
  filter: filterTask,
  exportColumns: [
    { field: 'batchNo', label: '拆分批次号' },
    { field: 'orgName', label: '机构' },
    { field: 'reportCode', label: '报表编码' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '期次' },
    { field: 'ruleCode', label: '拆分规则' },
    { field: 'ruleName', label: '规则名称' },
    { field: 'totalRows', label: '拆分行数' },
    { field: 'pkgCount', label: '包数' },
    { field: 'status', label: '状态' },
    { field: 'startTime', label: '执行时间' },
    { field: 'cost', label: '耗时(ms)' },
    { field: 'operator', label: '操作人' },
    { field: 'message', label: '执行结果' }
  ]
})

/** 拆分详情：包清单 + 每包样例行（3 条） */
onGet('/cr/split-task/detail', (ctx) => {
  const id = Number(ctx.params.id)
  const task = crSplitTaskTable.get(id)
  if (!task) throw new Error('拆分批次不存在：id=' + id)
  const packages = (task.packages || []).map((item) => ({ ...item }))
  const maxRows = Math.max(0, ...packages.map((item) => item.rows))
  const minRows = packages.length ? Math.min(...packages.map((item) => item.rows)) : 0
  const totalRows = packages.reduce((sum, item) => sum + item.rows, 0)
  return {
    ...task,
    packages,
    stats: {
      pkgCount: packages.length,
      totalRows,
      maxRows,
      minRows,
      avgRows: packages.length ? Number((totalRows / packages.length).toFixed(1)) : 0,
      /** 行数与拆分前是否一致（一致性校验：拆分不能丢行也不能多行） */
      consistent: totalRows === Number(task.totalRows)
    }
  }
})

/**
 * 下载某个包的报文文件（真实文件，不是假链接）。
 * 与「一键报送」共用同一个生成器：格式 / 分隔符 / 表头行数取机构《报送文件配置》，
 * 行数与字节数就是包清单上显示的那两个数字。
 */
onGet('/cr/split-task/package-file', (ctx) => {
  const taskId = Number(ctx.params.taskId)
  const pkgNo = Number(ctx.params.pkgNo)
  if (!taskId) throw new Error('缺少拆分批次 id')
  if (!pkgNo) throw new Error('缺少包号')
  return buildSplitPackageFile(taskId, pkgNo).blob
})

/** 拆分页头部统计：规则数 / 批次总数 / 累计包数 / 最近一次拆分时间 */
onGet('/cr/split-task/stats', () => {
  const tasks = crSplitTaskTable.all()
  const success = tasks.filter((row) => Number(row.status) === 2)
  return {
    ruleCount: crSplitRuleTable.all().filter((row) => row.status === 1).length,
    taskCount: tasks.length,
    successCount: success.length,
    failedCount: tasks.filter((row) => Number(row.status) === 3).length,
    pkgCount: success.reduce((sum, row) => sum + Number(row.pkgCount || 0), 0),
    splitRows: success.reduce((sum, row) => sum + Number(row.totalRows || 0), 0),
    lastTime: tasks.length ? String(tasks[0].startTime || '') : ''
  }
})
