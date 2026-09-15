/**
 * Mock Handler — 报表任务流转（任务管理 / 复核 / 本级审核 / 上级审核 / 打回）
 *
 * 流转链路：任务模板 → 任务下发 → 填报 → 复核 → 本级审核 → 上级审核 → 报文生成
 * 任何一环都可以打回上一环节。
 *
 * 状态机（取值见 src/mock/db/crTask.ts 的 TASK_STATUS，与字典 cr_task_status 对齐）：
 *   10 待下发 --下发--> 20 已下发 --填报--> 30 填报中 --提交--> 40 待复核
 *   40 --复核通过--> 70 本级审核中 --通过--> 80 上级审核中 --通过--> 90 审核通过
 *   任一环节不通过 / 打回 → 100 已打回，再按打回目标环节回到 30 / 40 / 70 / 80
 *
 * 非法流转统一 `throw new Error('中文提示')`，adapter 会包成 400 由拦截器原样提示。
 */
import { onGet, onPost, onPut } from '../route'
import { parseIds, registerResource } from '../resource'
import { formatDateTime, likeAny } from '../util'
import { taskTemplateTable } from '../db/cr'
import {
  AUDIT_RESULT,
  FLOW_STAGE,
  RETURN_STAGE,
  RETURN_STAGE_STATUS,
  STATUS_STAGE,
  TASK_STATUS,
  buildTaskCode,
  crTaskReturnTable,
  crTaskReviewTable,
  crTaskTable,
  taskOrgOptions,
  taskReportOptions,
  type CrTaskRow
} from '../db/crTask'
import { FILL_USERS, PERIOD } from '../db/crCommon'
import { currentUser } from './auth'
import { assertDeptAction, DEPT_ACTION } from '../db/crPermission'

/**
 * 部门权限落点：复核 / 审核 / 打回都是"业务动作"，按「部门 × 报表」授权判定。
 * 管理员不受限；未命中任何规则 = 默认拒绝（与导入权限同一约定）。
 * 一次批量里只要有任务被拦，就把那条的中文原因原样抛出去，不做"部分成功"。
 */
const assertTasksDeptAction = (
  ctx: any,
  tasks: CrTaskRow[],
  action: string,
  actionLabel: string
) => {
  const userId = currentUser(ctx)?.id
  const blocked = tasks.find((task) => {
    try {
      assertDeptAction(
        userId,
        task.reportId,
        action,
        actionLabel,
        '报表《' + task.reportName + '》'
      )
      return false
    } catch {
      return true
    }
  })
  if (blocked) {
    assertDeptAction(
      userId,
      blocked.reportId,
      action,
      actionLabel,
      '报表《' + blocked.reportName + '》'
    )
  }
}

/** 当前操作人（Demo 无后端，取演示用户：总公司审核人） */
const CURRENT_USER = '孙建国'

/** 填报人 → 机构名，任务下发时按机构匹配填报人 */
const fillUserOf = (orgName: string): string =>
  FILL_USERS.find((user) => user.orgName === orgName)?.name || '待分配'

/** 任务下发的默认截止日期（模板有截止日期则跟随模板） */
const DEFAULT_DEADLINE = '2026-09-15'

/** 期次 → 中文描述，如 202608 → 2026年8月 */
const periodLabel = (period: string): string => {
  const month = Number(period.slice(4, 6))
  return Number.isNaN(month) ? `${period}期` : `${period.slice(0, 4)}年${month}月`
}

/* ==================================================================
 * 状态机
 * ================================================================== */

/** 批量操作结果 */
interface BatchResult {
  successCount: number
  failCount: number
  messages: string[]
}

const emptyResult = (): BatchResult => ({ successCount: 0, failCount: 0, messages: [] })

const requireTasks = (ids: number[]): CrTaskRow[] => {
  if (!ids.length) throw new Error('请先选择需要操作的任务')
  return ids.map((id) => {
    const task = crTaskTable.get(id)
    if (!task) throw new Error(`任务不存在：id=${id}`)
    return task
  })
}

/** 记录一条流转流水 */
const appendTrail = (
  task: CrTaskRow,
  stage: string,
  action: string,
  result: number,
  opinion: string,
  operator = CURRENT_USER
) => {
  crTaskReviewTable.insert({
    stage,
    taskId: task.id,
    taskCode: task.taskCode,
    taskName: task.taskName,
    orgName: task.orgName,
    operator,
    action,
    result,
    opinion,
    operateTime: formatDateTime()
  })
}

/** 更新任务状态 */
const moveTo = (task: CrTaskRow, status: number, patch: Partial<CrTaskRow> = {}) => {
  crTaskTable.update({ id: task.id, status, ...patch })
}

/** 打回时写打回记录，并把该任务的待处理打回置为已处理 */
const appendReturn = (task: CrTaskRow, stage: string, reason: string) => {
  crTaskReturnTable.insert({
    taskId: task.id,
    taskCode: task.taskCode,
    taskName: task.taskName,
    orgName: task.orgName,
    stage,
    reason,
    returnUser: CURRENT_USER,
    returnTime: formatDateTime(),
    processed: false,
    handleRemark: '',
    handleTime: ''
  })
}

/** 状态推进到下游后，把该任务此前的待处理打回记录标记为已处理 */
const closeReturn = (taskId: number, remark: string) => {
  crTaskReturnTable
    .all()
    .filter((row) => row.taskId === taskId && !row.processed)
    .forEach((row) =>
      crTaskReturnTable.update({
        id: row.id,
        processed: true,
        handleRemark: remark,
        handleTime: formatDateTime()
      })
    )
}

/** 复核通过：待复核(40) → 本级审核中(70) */
const reviewPass = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_REVIEW) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待复核状态的任务可以复核`
    )
  }
  appendTrail(task, FLOW_STAGE.REVIEW, '复核通过', AUDIT_RESULT.PASS, opinion || '复核通过')
  moveTo(task, TASK_STATUS.WAIT_LOCAL_AUDIT)
  closeReturn(task.id, '复核已通过，打回事项处理完毕')
}

/** 复核不通过：待复核(40) → 已打回(100)，并回退到填报(30)等待重新提交 */
const reviewReject = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_REVIEW) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待复核状态的任务可以复核`
    )
  }
  if (!opinion) throw new Error('复核不通过时必须填写意见')
  appendTrail(task, FLOW_STAGE.REVIEW, '复核不通过', AUDIT_RESULT.REJECT, opinion)
  appendReturn(task, RETURN_STAGE.FILL, opinion)
  moveTo(task, TASK_STATUS.FILLING, { remark: `复核不通过：${opinion}` })
}

/** 本级审核通过：本级审核中(70) → 上级审核中(80) */
const localAuditPass = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_LOCAL_AUDIT) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待本级审核状态的任务可以审核`
    )
  }
  appendTrail(
    task,
    FLOW_STAGE.LOCAL_AUDIT,
    '本级审核通过',
    AUDIT_RESULT.PASS,
    opinion || '本级审核通过，提交上级审核'
  )
  moveTo(task, TASK_STATUS.WAIT_UPPER_AUDIT)
  closeReturn(task.id, '本级审核已通过，打回事项处理完毕')
}

/** 本级审核不通过：本级审核中(70) → 退回复核(40) */
const localAuditReject = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_LOCAL_AUDIT) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待本级审核状态的任务可以审核`
    )
  }
  if (!opinion) throw new Error('审核不通过时必须填写意见')
  appendTrail(task, FLOW_STAGE.LOCAL_AUDIT, '本级审核不通过', AUDIT_RESULT.REJECT, opinion)
  appendReturn(task, RETURN_STAGE.REVIEW, opinion)
  moveTo(task, TASK_STATUS.WAIT_REVIEW, { remark: `本级审核不通过：${opinion}` })
}

/** 上级审核通过：上级审核中(80) → 审核通过(90) */
const upperAuditPass = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_UPPER_AUDIT) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待上级审核状态的任务可以审核`
    )
  }
  appendTrail(
    task,
    FLOW_STAGE.UPPER_AUDIT,
    '上级审核通过',
    AUDIT_RESULT.PASS,
    opinion || '上级审核通过，报文生成条件已满足'
  )
  moveTo(task, TASK_STATUS.FINISHED)
  closeReturn(task.id, '上级审核已通过，打回事项处理完毕')
}

/** 上级审核不通过：上级审核中(80) → 已打回(100)，并回退到本级审核(70) */
const upperAuditReject = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_UPPER_AUDIT) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待上级审核状态的任务可以审核`
    )
  }
  if (!opinion) throw new Error('审核不通过时必须填写意见')
  appendTrail(task, FLOW_STAGE.UPPER_AUDIT, '上级审核不通过', AUDIT_RESULT.REJECT, opinion)
  appendReturn(task, RETURN_STAGE.LOCAL_AUDIT, opinion)
  moveTo(task, TASK_STATUS.WAIT_LOCAL_AUDIT, { remark: `上级审核不通过：${opinion}` })
}

/** 上级审核退回至本级审核：上级审核中(80) → 本级审核中(70) */
const upperAuditBack = (task: CrTaskRow, opinion: string): void => {
  if (task.status !== TASK_STATUS.WAIT_UPPER_AUDIT) {
    throw new Error(
      `任务「${task.taskCode}」当前状态为${STATUS_STAGE[task.status] || '未知'}，只有待上级审核状态的任务可以退回本级审核`
    )
  }
  const reason = opinion || '上级审核退回至本级审核'
  appendTrail(task, FLOW_STAGE.UPPER_AUDIT, '退回至本级审核', AUDIT_RESULT.REJECT, reason)
  appendReturn(task, RETURN_STAGE.LOCAL_AUDIT, reason)
  moveTo(task, TASK_STATUS.WAIT_LOCAL_AUDIT, { remark: `退回本级审核：${reason}` })
}

/** 通用打回：把流转中的任务打回到指定环节 */
const returnBack = (task: CrTaskRow, stage: string, reason: string): void => {
  if (!reason) throw new Error('打回原因不能为空')
  const target = RETURN_STAGE_STATUS[stage]
  if (!target) throw new Error('请选择正确的打回环节')
  if (task.status === TASK_STATUS.FINISHED) {
    throw new Error(`任务「${task.taskCode}」已审核通过，不能打回`)
  }
  if (task.status === TASK_STATUS.PENDING_DISPATCH) {
    throw new Error(`任务「${task.taskCode}」尚未下发，不能打回`)
  }
  const currentStage = STATUS_STAGE[task.status]
  if (currentStage === stage) {
    throw new Error(`任务「${task.taskCode}」当前已在${stage}环节，无需打回`)
  }
  appendTrail(
    task,
    currentStage || FLOW_STAGE.REVIEW,
    `打回至${stage}`,
    AUDIT_RESULT.REJECT,
    reason
  )
  appendReturn(task, stage, reason)
  moveTo(task, target, { remark: `打回至${stage}：${reason}` })
}

/** 顺序处理批量操作，遇错记录但不中断 */
const runBatch = (tasks: CrTaskRow[], action: (task: CrTaskRow) => void): BatchResult => {
  const result = emptyResult()
  tasks.forEach((task) => {
    try {
      action(task)
      result.successCount += 1
    } catch (error: any) {
      result.failCount += 1
      result.messages.push(error?.message || '处理失败')
    }
  })
  return result
}

/* ==================================================================
 * 任务管理：标准 CRUD + 下发 / 初始化
 * ================================================================== */
registerResource({
  prefix: '/cr/task',
  table: crTaskTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (params.templateId && Number(row.templateId) !== Number(params.templateId)) return false
    if (
      params.status !== undefined &&
      params.status !== '' &&
      Number(row.status) !== Number(params.status)
    )
      return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.period && !String(row.period).includes(String(params.period))) return false
    return likeAny(row, ['taskCode', 'taskName', 'reportName'], params.keyword || params.taskName)
  },
  beforeCreate: (body) => ({
    ...body,
    status: body.status ?? TASK_STATUS.DISPATCHED,
    dispatchTime: body.dispatchTime || formatDateTime(),
    fillUser: body.fillUser || '待分配'
  }),
  exportColumns: [
    { field: 'taskCode', label: '任务编号' },
    { field: 'taskName', label: '任务名称' },
    { field: 'orgName', label: '填报机构' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'deadline', label: '截止日期' },
    { field: 'status', label: '任务状态' },
    { field: 'fillUser', label: '填报人' },
    { field: 'reviewUser', label: '复核人' },
    { field: 'auditUser', label: '审核人' }
  ]
})

/**
 * 批量下发：按任务模板 + 机构范围生成各机构的填报任务。
 * 同一模板 / 机构 / 报表 / 期次已下发过的不再重复生成。
 */
onPost('/cr/task/dispatch', (ctx) => {
  const { templateId, orgIds, period, deadline } = ctx.body || {}
  const template = taskTemplateTable.get(Number(templateId))
  if (!template) throw new Error('请选择需要下发的任务模板')
  const ids = parseIds(orgIds)
  if (!ids.length) throw new Error('请至少选择一个下发机构')
  const reportIds = template.reportIds || []
  if (!reportIds.length)
    throw new Error(`任务模板「${template.templateName}」下还没有报表，请先在任务模板中添加报表`)
  const usePeriod = String(period || template.period || PERIOD)
  const useDeadline = String(deadline || template.deadline || DEFAULT_DEADLINE)
  if (useDeadline < (template.startDate || '')) {
    throw new Error('截止日期不能早于任务模板的起始日期')
  }

  const existing = crTaskTable.all()
  const created: CrTaskRow[] = []
  let skipped = 0
  let seq =
    existing.reduce((max, row) => {
      const hit = /^RW\d{6}(\d{3})$/.exec(row.taskCode)
      return hit ? Math.max(max, Number(hit[1])) : max
    }, 0) + 1

  ids.forEach((orgId) => {
    const org = taskOrgOptions().find((item) => item.id === orgId)
    if (!org) throw new Error(`机构不存在：id=${orgId}`)
    const orgName = org.name
    reportIds.forEach((reportId) => {
      const report = taskReportOptions().find((item) => item.id === reportId)
      if (!report) return
      const duplicated = existing.some(
        (row) =>
          row.templateId === template.id &&
          row.orgId === orgId &&
          row.reportId === reportId &&
          String(row.period) === usePeriod
      )
      if (duplicated) {
        skipped += 1
        return
      }
      created.push(
        crTaskTable.insert({
          taskCode: buildTaskCode(usePeriod, seq++),
          taskName: `${periodLabel(usePeriod)}${report.reportName}报送任务（${orgName}）`,
          templateId: template.id,
          templateName: template.templateName,
          orgId,
          orgName,
          reportId,
          reportName: report.reportName,
          reportCode: report.code,
          period: usePeriod,
          freq: template.freq,
          dispatchTime: formatDateTime(),
          deadline: useDeadline,
          status: TASK_STATUS.DISPATCHED,
          fillUser: fillUserOf(orgName),
          reviewUser: '',
          auditUser: '',
          remark: '',
          createTime: formatDateTime()
        })
      )
    })
  })

  if (!created.length) {
    throw new Error(`所选机构在本期次已全部下发过，无需重复下发（跳过 ${skipped} 条）`)
  }
  return { count: created.length, skipped, period: usePeriod }
})

/** 批量下发：未完成的任务按模板重新生成缺失的机构任务 */
onPost('/cr/task/dispatch-batch', (ctx) => {
  const ids = parseIds(ctx.body?.ids)
  if (!ids.length) throw new Error('请先勾选需要批量下发的任务')
  const templateIds = Array.from(
    new Set(
      ids.map((id) => crTaskTable.get(id)?.templateId).filter((item): item is number => !!item)
    )
  )
  if (!templateIds.length) throw new Error('勾选的任务缺少任务模板，无法批量下发')

  const orgIds = Array.from(
    new Set(ids.map((id) => crTaskTable.get(id)?.orgId).filter((item): item is number => !!item))
  )
  const existing = crTaskTable.all()
  let count = 0
  let skipped = 0
  let seq =
    existing.reduce((max, row) => {
      const hit = /^RW\d{6}(\d{3})$/.exec(row.taskCode)
      return hit ? Math.max(max, Number(hit[1])) : max
    }, 0) + 1

  templateIds.forEach((templateId) => {
    const template = taskTemplateTable.get(templateId)
    if (!template) return
    orgIds.forEach((orgId) => {
      const org = taskOrgOptions().find((item) => item.id === orgId)
      if (!org) return
      const orgName = org.name
      ;(template.reportIds || []).forEach((reportId) => {
        const report = taskReportOptions().find((item) => item.id === reportId)
        if (!report) return
        const duplicated = existing.some(
          (row) =>
            row.templateId === templateId &&
            row.orgId === orgId &&
            row.reportId === reportId &&
            String(row.period) === String(template.period)
        )
        if (duplicated) {
          skipped += 1
          return
        }
        crTaskTable.insert({
          taskCode: buildTaskCode(template.period, seq++),
          taskName: `${periodLabel(template.period)}${report.reportName}报送任务（${orgName}）`,
          templateId,
          templateName: template.templateName,
          orgId,
          orgName,
          reportId,
          reportName: report.reportName,
          reportCode: report.code,
          period: template.period,
          freq: template.freq,
          dispatchTime: formatDateTime(),
          deadline: template.deadline || DEFAULT_DEADLINE,
          status: TASK_STATUS.DISPATCHED,
          fillUser: fillUserOf(orgName),
          reviewUser: '',
          auditUser: '',
          remark: '批量下发',
          createTime: formatDateTime()
        })
        count += 1
      })
    })
  })

  if (!count) throw new Error(`勾选任务所属模板在本期次已全部下发（跳过 ${skipped} 条）`)
  return { count, skipped }
})

/** 任务初始化：按启用中的任务模板为 4 家分公司重建本期任务 */
onPut('/cr/task/init', (ctx) => {
  const period = String(ctx.body?.period || PERIOD)
  const templates = taskTemplateTable.all().filter((template) => template.status === 0)
  const orgs = taskOrgOptions().filter((org) => org.level === 2)
  if (!templates.length) throw new Error('没有启用中的任务模板，无法初始化任务')
  if (!orgs.length) throw new Error('没有可用的分公司机构，无法初始化任务')

  const existing = crTaskTable.all()
  let count = 0
  let skipped = 0
  let seq =
    existing.reduce((max, row) => {
      const hit = /^RW\d{6}(\d{3})$/.exec(row.taskCode)
      return hit ? Math.max(max, Number(hit[1])) : max
    }, 0) + 1

  templates.forEach((template) => {
    orgs.forEach((org) => {
      const orgName = org.name
      ;(template.reportIds || []).forEach((reportId) => {
        const report = taskReportOptions().find((item) => item.id === reportId)
        if (!report) return
        const duplicated = existing.some(
          (row) =>
            row.templateId === template.id &&
            row.orgId === org.id &&
            row.reportId === reportId &&
            String(row.period) === period
        )
        if (duplicated) {
          skipped += 1
          return
        }
        crTaskTable.insert({
          taskCode: buildTaskCode(period, seq++),
          taskName: `${periodLabel(period)}${report.reportName}报送任务（${orgName}）`,
          templateId: template.id,
          templateName: template.templateName,
          orgId: org.id,
          orgName,
          reportId,
          reportName: report.reportName,
          reportCode: report.code,
          period,
          freq: template.freq,
          dispatchTime: formatDateTime(),
          deadline: template.deadline || DEFAULT_DEADLINE,
          status: TASK_STATUS.DISPATCHED,
          fillUser: fillUserOf(orgName),
          reviewUser: '',
          auditUser: '',
          remark: '任务初始化生成',
          createTime: formatDateTime()
        })
        count += 1
      })
    })
  })

  return { count, skipped, period, templateCount: templates.length, orgCount: orgs.length }
})

/** 流转轨迹：该任务的复核 / 审核流水 */
onGet('/cr/task/trace', (ctx) => {
  const id = Number(ctx.params.id)
  const task = crTaskTable.get(id)
  if (!task) throw new Error(`任务不存在：id=${ctx.params.id}`)
  const list = crTaskReviewTable
    .all()
    .filter((row) => row.taskId === id)
    .sort((a, b) => (a.operateTime < b.operateTime ? -1 : 1))
  return {
    task,
    currentStage: STATUS_STAGE[task.status] || '',
    list
  }
})

/** 任务下的报表明细（本级 / 上级审核查看报表清单用） */
onGet('/cr/task/report-list', (ctx) => {
  const id = Number(ctx.params.id)
  const task = crTaskTable.get(id)
  if (!task) throw new Error(`任务不存在：id=${ctx.params.id}`)
  const hit = taskReportOptions().find((item) => item.id === task.reportId)
  const rows = hit
    ? [hit]
    : [{ id: task.reportId, code: task.reportCode, name: task.reportName, freq: task.freq }]
  // 报表明细行带上任务上下文，审核弹窗可直接展示，不需要二次请求
  return rows.map((item) => ({
    id: item.id,
    reportCode: item.code,
    reportName: item.name,
    freq: item.freq,
    period: task.period,
    orgName: task.orgName,
    taskCode: task.taskCode,
    taskName: task.taskName,
    fillUser: task.fillUser,
    reviewUser: task.reviewUser || '待复核',
    auditUser: task.auditUser || '待审核',
    status: task.status,
    deadline: task.deadline,
    dispatchTime: task.dispatchTime,
    errorCount: task.status === TASK_STATUS.RETURNED ? 1 : 0
  }))
})

/** 任务下拉选项（复核 / 审核页面切换任务用） */
onGet('/cr/task/options', (ctx) => {
  const status = ctx.params.status
  return crTaskTable
    .all()
    .filter((row) => (status ? Number(row.status) === Number(status) : true))
    .map((row) => ({ id: row.id, name: `${row.taskCode} ${row.reportName}`, code: row.taskCode }))
})

/** 可下发机构（总公司 + 分公司），任务下发弹窗用 */
onGet('/cr/task/org-options', () => taskOrgOptions())

/** 任务期次选项（当前 mock 里出现过的期次） */
onGet('/cr/task/period-options', () => {
  const periods = Array.from(new Set(crTaskTable.all().map((row) => row.period)))
  if (!periods.includes(PERIOD)) periods.unshift(PERIOD)
  return periods
    .sort()
    .reverse()
    .map((period) => ({ label: period, value: period }))
})

/* ==================================================================
 * 复核操作
 * ================================================================== */
registerResource({
  prefix: '/cr/task-review',
  table: crTaskTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    // 复核页面只显示处于"待复核"环节的任务
    if (row.status !== TASK_STATUS.WAIT_REVIEW) return false
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.period && !String(row.period).includes(String(params.period))) return false
    return likeAny(row, ['taskCode', 'taskName', 'reportName'], params.keyword || params.taskName)
  },
  exportColumns: [
    { field: 'taskCode', label: '任务编号' },
    { field: 'taskName', label: '任务名称' },
    { field: 'orgName', label: '填报机构' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'fillUser', label: '填报人' },
    { field: 'deadline', label: '截止日期' }
  ]
})

onPut('/cr/task-review/pass', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.REVIEW, '复核')
  const result = runBatch(tasks, (task) => reviewPass(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '复核失败')
  return result
})

onPut('/cr/task-review/reject', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.REVIEW, '复核')
  const result = runBatch(tasks, (task) => reviewReject(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '复核不通过操作失败')
  return result
})

onPut('/cr/task-review/batch-pass', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.REVIEW, '批量复核')
  // 批量复核要求整批都能通过：任一任务不满足状态机就整批拒绝，避免半成功
  const invalid = tasks.find((task) => task.status !== TASK_STATUS.WAIT_REVIEW)
  if (invalid) {
    throw new Error(
      `任务「${invalid.taskCode}」当前状态为${STATUS_STAGE[invalid.status] || '未知'}，只有待复核状态的任务可以批量复核`
    )
  }
  const result = runBatch(tasks, (task) => reviewPass(task, opinion || '批量复核通过'))
  if (result.failCount) throw new Error(result.messages[0] || '批量复核失败')
  return { ...result, total: tasks.length }
})

/* ==================================================================
 * 本级审核
 * ================================================================== */
registerResource({
  prefix: '/cr/task-audit-local',
  table: crTaskTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (row.status !== TASK_STATUS.WAIT_LOCAL_AUDIT) return false
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.period && !String(row.period).includes(String(params.period))) return false
    return likeAny(row, ['taskCode', 'taskName', 'reportName'], params.keyword || params.taskName)
  },
  exportColumns: [
    { field: 'taskCode', label: '任务编号' },
    { field: 'taskName', label: '任务名称' },
    { field: 'orgName', label: '填报机构' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'reviewUser', label: '复核人' },
    { field: 'deadline', label: '截止日期' }
  ]
})

onPut('/cr/task-audit-local/pass', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.AUDIT, '本级审核')
  const result = runBatch(tasks, (task) => localAuditPass(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '本级审核失败')
  return result
})

onPut('/cr/task-audit-local/reject', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.AUDIT, '本级审核')
  const result = runBatch(tasks, (task) => localAuditReject(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '本级审核不通过操作失败')
  return result
})

/* ==================================================================
 * 上级审核
 * ================================================================== */
registerResource({
  prefix: '/cr/task-audit-upper',
  table: crTaskTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    if (row.status !== TASK_STATUS.WAIT_UPPER_AUDIT) return false
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.period && !String(params.period).includes(String(params.period))) return false
    return likeAny(row, ['taskCode', 'taskName', 'reportName'], params.keyword || params.taskName)
  },
  exportColumns: [
    { field: 'taskCode', label: '任务编号' },
    { field: 'taskName', label: '任务名称' },
    { field: 'orgName', label: '填报机构' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'reviewUser', label: '复核人' },
    { field: 'auditUser', label: '本级审核人' },
    { field: 'deadline', label: '截止日期' }
  ]
})

onPut('/cr/task-audit-upper/pass', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.AUDIT, '上级审核')
  const result = runBatch(tasks, (task) => upperAuditPass(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '上级审核失败')
  return result
})

onPut('/cr/task-audit-upper/reject', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.AUDIT, '上级审核')
  const result = runBatch(tasks, (task) => upperAuditReject(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '上级审核不通过操作失败')
  return result
})

/** 退回至本级审核：不动填报数据，只把任务退回本级重新把关 */
onPut('/cr/task-audit-upper/back', (ctx) => {
  const { ids, opinion } = ctx.body || {}
  const tasks = requireTasks(parseIds(ids))
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.AUDIT, '退回本级审核')
  const result = runBatch(tasks, (task) => upperAuditBack(task, opinion))
  if (!result.successCount) throw new Error(result.messages[0] || '退回本级审核失败')
  return result
})

/* ==================================================================
 * 打回操作
 * ================================================================== */
registerResource({
  prefix: '/cr/task-return',
  table: crTaskTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => {
    // 只列流转中的任务（已完成 / 待下发的任务不在打回范围）
    if (row.status === TASK_STATUS.FINISHED || row.status === TASK_STATUS.PENDING_DISPATCH)
      return false
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (
      params.status !== undefined &&
      params.status !== '' &&
      Number(row.status) !== Number(params.status)
    )
      return false
    if (params.freq && Number(row.freq) !== Number(params.freq)) return false
    if (params.period && !String(row.period).includes(String(params.period))) return false
    return likeAny(row, ['taskCode', 'taskName', 'reportName'], params.keyword || params.taskName)
  },
  exportColumns: [
    { field: 'taskCode', label: '任务编号' },
    { field: 'taskName', label: '任务名称' },
    { field: 'orgName', label: '填报机构' },
    { field: 'reportName', label: '报表名称' },
    { field: 'period', label: '报送期次' },
    { field: 'deadline', label: '截止日期' }
  ]
})

/** 打回：把流转中的任务打回到指定环节 */
onPut('/cr/task-return/back', (ctx) => {
  const { taskId, ids, stage, reason } = ctx.body || {}
  const targetIds = parseIds(ids && parseIds(ids).length ? ids : taskId)
  const tasks = requireTasks(targetIds)
  assertTasksDeptAction(ctx, tasks, DEPT_ACTION.REVIEW, '打回')
  if (!stage) throw new Error('请选择打回环节')
  const result = runBatch(tasks, (task) => returnBack(task, stage, reason))
  if (!result.successCount) throw new Error(result.messages[0] || '打回失败')
  return result
})

/** 打回记录分页：待处理 / 已处理 */
onGet('/cr/task-return/record-page', (ctx) => {
  const { processed, pageNo, pageSize } = ctx.params
  let rows = crTaskReturnTable.all().sort((a, b) => (a.returnTime < b.returnTime ? 1 : -1))
  if (processed !== undefined && processed !== '') {
    rows = rows.filter((row) => String(row.processed) === String(processed))
  }
  if (ctx.params.keyword) {
    rows = rows.filter((row) =>
      likeAny(row, ['taskCode', 'taskName', 'reason'], ctx.params.keyword)
    )
  }
  const size = Math.max(1, Number(pageSize) || 10)
  const page = Math.max(1, Number(pageNo) || 1)
  return { list: rows.slice((page - 1) * size, page * size), total: rows.length }
})

/** 打回记录处理：标记已处理 */
onPut('/cr/task-return/handle', (ctx) => {
  const ids = parseIds(ctx.body?.ids)
  if (!ids.length) throw new Error('请先选择需要处理的打回记录')
  const remark = ctx.body?.handleRemark || '已确认打回事项'
  ids.forEach((id) => {
    const row = crTaskReturnTable.get(id)
    if (!row) throw new Error(`打回记录不存在：id=${id}`)
    if (row.processed) throw new Error(`打回记录「${row.taskCode}」已处理，请勿重复处理`)
    crTaskReturnTable.update({
      id,
      processed: true,
      handleRemark: remark,
      handleTime: formatDateTime()
    })
  })
  return true
})

/** 打回记录统计：待处理 / 已处理数量 */
onGet('/cr/task-return/record-stat', () => {
  const rows = crTaskReturnTable.all()
  return {
    pending: rows.filter((row) => !row.processed).length,
    processed: rows.filter((row) => row.processed).length
  }
})

/** 打回环节选项 */
onGet('/cr/task-return/stage-options', () =>
  Object.values(RETURN_STAGE).map((stage) => ({ label: stage, value: stage }))
)
