import request from '@/config/axios'

/** 预检计划：一个字段一行 */
export interface DesensPlanItemVO {
  columnCode: string
  columnName: string
  fieldKey: string
  ruleCode: string
  ruleName: string
  ruleType: string
  ruleParam: string
  rows: number
  alreadyMasked: number
  empty: number
  /** 配置的命中条件（空 = 全量脱敏） */
  condition: string
  /** 条件解析失败的原因（非空表示这条配置会被执行拦下） */
  conditionError: string
  /** 命中条件的行数 */
  matched: number
  /** 因不满足命中条件而跳过的行数 */
  conditionSkipped: number
}

/** 被生效期 / 规则状态挡在门外的配置 */
export interface DesensExcludedFieldVO {
  columnCode: string
  columnName: string
  ruleCode: string
  ruleName: string
  /** 未生效 / 已过期 / 规则已停用 */
  reason: string
  window: string
  /** 该字段是否还有别的生效配置兜住 */
  covered: boolean
}

/** 预检结果 */
export interface DesensPrecheckVO {
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 服务端判断生效期用的"今天" */
  today: string
  totalRows: number
  willMask: number
  fieldCount: number
  ruleCount: number
  /** 因为不在生效期（或规则停用）而没有参与本次执行的配置 */
  excluded: DesensExcludedFieldVO[]
  /** 因不满足命中条件而跳过的行数（各字段取最大值） */
  conditionSkipped: number
  plan: DesensPlanItemVO[]
  warnings: string[]
}

/** 执行结果 */
export interface DesensRunResultVO {
  id: number
  batchNo: string
  status: number
  maskedRows: number
  skipRows: number
  /** 因不满足命中条件而跳过的行数 */
  conditionSkipped: number
  fieldCount: number
  cost: number
  message: string
  details: Array<{
    columnCode: string
    columnName: string
    ruleName: string
    ruleParam: string
    rows: number
    condition: string
    conditionSkipped: number
    sampleFrom: string
    sampleTo: string
  }>
}

/** 执行范围 */
export interface DesensScopeVO {
  orgId: number
  reportId: number
  period: string
  operator?: string
}

/** 审批申请摘要（审批页头部统计） */
export interface DesensApprovalStatsVO {
  pending: number
  pendingRows: number
  /** 累计放行（审核岗通过过的，含事后执行失败/被还原的） */
  approved: number
  /** 其中执行成功 / 部分失败 */
  executionSucceeded: number
  /** 其中执行失败（如放行时数据已全部脱敏或为空） */
  executionFailed: number
  /** 其中事后被还原 */
  restored: number
  rejected: number
  /** 最久的一条已经等了多久（小时） */
  longestWaitHours: number
}

// 执行前预检（不写数据）
export const precheckDesens = (data: DesensScopeVO) => {
  return request.post({ url: '/cr/desens-execute/precheck', data })
}

/**
 * 执行脱敏（真实改写填报数据）。
 * 注意：页面已经改为「提交执行申请 → 审核岗放行」，这个直通入口只作为执行内核保留
 * （审批通过后服务端走的就是同一套逻辑），正常的演示流程不要用它。
 */
export const runDesens = (data: DesensScopeVO) => {
  return request.post({ url: '/cr/desens-execute/run', data })
}

// 提交执行申请（审批流入口）：只落一条待审核申请，不改数据
export const applyDesens = (data: DesensScopeVO & { remark?: string }) => {
  return request.post({ url: '/cr/desens-execute/apply', data })
}

// 审核通过：这一刻才真正执行
export const approveDesens = (data: { id: number; remark?: string }) => {
  return request.post({ url: '/cr/desens-execute/approve', data })
}

// 审核驳回：不执行，留下原因
export const rejectDesens = (data: { id: number; remark: string }) => {
  return request.post({ url: '/cr/desens-execute/reject', data })
}

// 撤回申请：作废待审核的申请单
export const withdrawDesens = (data: { id: number }) => {
  return request.post({ url: '/cr/desens-execute/withdraw', data })
}

// 审批页头部统计
export const getApprovalStats = () => {
  return request.get({ url: '/cr/desens-task/approval-stats' })
}

// 还原某一批次（把脱敏值倒回原文）
export const restoreDesens = (data: { id: number; operator?: string }) => {
  return request.post({ url: '/cr/desens-execute/restore', data })
}

/** 放行前复算结果：申请时预计 vs 现在预计（数据在申请后被改过时 changed=true） */
export interface DesensRecheckVO {
  id: number
  batchNo: string
  storedExpected: number
  currentExpected: number
  storedTotalRows: number
  currentTotalRows: number
  changed: boolean
  /** 三条轴分开给：数量变 / 生效口径变 / 只是原文内容变（页面标题据此换说法） */
  countChanged: boolean
  scopeChanged: boolean
  contentChanged: boolean
  /** 变了什么（逐字段：规则 / 命中条件 / 新增或不再参与），数量没变但口径变了也在这里说明 */
  diff: string[]
  error: string
}

/** 放行前复算：审批弹窗打开时调，只读不写 */
export const recheckDesensApply = (id: number) => {
  return request.get({ url: '/cr/desens-execute/recheck', params: { id } })
}
