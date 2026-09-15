import request from '@/config/axios'

/** 单个字段的处理明细 */
export interface DesensTaskDetailVO {
  columnCode: string
  columnName: string
  ruleCode: string
  ruleName: string
  ruleType: string
  ruleParam: string
  rows: number
  /** 该字段的命中条件（空 = 全量脱敏） */
  condition: string
  /** 因不满足命中条件而跳过的行数 */
  conditionSkipped: number
  sampleFrom: string
  sampleTo: string
}

/** 脱敏执行批次 VO */
export interface DesensTaskVO {
  id?: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  scopeName: string
  fieldCount: number
  ruleCount: number
  totalRows: number
  maskedRows: number
  skipRows: number
  /** 因不满足命中条件而跳过的行数 */
  conditionSkipped: number
  /** 见字典 cr_desens_status：1 执行中 / 2 执行成功 / 3 部分失败 / 4 执行失败 / 5 已还原 */
  status: number
  startTime: string
  endTime: string
  cost: number
  operator: string
  details?: DesensTaskDetailVO[]
  message: string
  remark: string
  /** 申请人 / 申请时间（提交执行申请时写入） */
  applyUser?: string
  applyTime?: string
  /** 审核人 / 审核时间 / 审核意见（审核岗放行或驳回时写入） */
  auditUser?: string
  auditTime?: string
  auditRemark?: string
  /** 审批与执行留痕：提交 → 审核 → 执行 →（必要时）还原，逐条追加 */
  auditTrail?: DesensTrailVO[]
}

/** 一次动作留痕（服务端已经给好中文动作名，页面不再自己写映射） */
export interface DesensTrailVO {
  action: 'submit' | 'approve' | 'reject' | 'withdraw' | 'execute' | 'restore'
  actionLabel: string
  user: string
  time: string
  remark: string
}

/** 批次详情（含对照样例） */
export interface DesensTaskDetailResultVO extends DesensTaskVO {
  contrastCount: number
  contrastColumns: Array<{ columnCode: string; columnName: string; rows: number }>
  samples: Array<{
    rowNo: number
    policyNo: string
    columnName: string
    originalValue: string
    maskedValue: string
  }>
}

/** 日志页头部统计 */
export interface DesensTaskStatsVO {
  total: number
  success: number
  partial: number
  failed: number
  restored: number
  /** 待审核（提交了执行申请还没放行） */
  pending: number
  /** 审核驳回 */
  rejected: number
  maskedRows: number
  fieldCount: number
  ruleCount: number
}

// 分页查询脱敏执行批次
export const getTaskPage = (params: any) => {
  return request.get({ url: '/cr/desens-task/page', params })
}

// 查询批次详情（含字段明细与对照样例）
export const getTaskDetail = (id: number) => {
  return request.get({ url: '/cr/desens-task/detail?id=' + id })
}

// 导出脱敏执行批次
export const exportTask = (params: any) => {
  return request.download({ url: '/cr/desens-task/export-excel', params })
}

// 日志页统计卡片
export const getTaskStats = () => {
  return request.get({ url: '/cr/desens-task/stats' })
}
