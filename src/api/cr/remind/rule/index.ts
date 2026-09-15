import request from '@/config/axios'

/** 提醒规则 VO */
export interface RemindRuleVO {
  id?: number
  ruleCode: string
  ruleName: string
  /** 1 任务已下发 / 2 截止前 N 天未提交 / 3 逾期未报 / 4 校验不通过 / 5 脱敏审批待处理 / 6 期次即将关闭 */
  scene: number
  offsetDays: number
  receivers: Array<{ type: 'owner' | 'role' | 'user'; id?: number; name: string }>
  receiverText?: string
  channels: string[]
  templateText: string
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询提醒规则
export const getPage = (params: any) => {
  return request.get({ url: '/cr/remind-rule/page', params })
}

// 查询提醒规则详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/remind-rule/get?id=' + id })
}

// 新增提醒规则
export const create = (data: RemindRuleVO) => {
  return request.post({ url: '/cr/remind-rule/create', data })
}

// 修改提醒规则
export const update = (data: RemindRuleVO) => {
  return request.put({ url: '/cr/remind-rule/update', data })
}

// 删除提醒规则
export const remove = (id: number) => {
  return request.delete({ url: '/cr/remind-rule/delete?id=' + id })
}

// 批量删除提醒规则
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/remind-rule/delete-list', params: { ids: ids.join(',') } })
}

// 导出提醒规则
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/remind-rule/export-excel', params })
}

/** 立即执行结果 */
export interface RemindRunResultVO {
  generated: number
  skipped: number
  scanned: number
  message: string
  details: Array<{ rule: string; items: number; generated: number; skipped: number }>
}

/** 提醒口径（场景 / 渠道 / 状态 / 接收人候选） */
export interface RemindMetaVO {
  scenes: Array<{ value: number; label: string }>
  channels: Array<{ value: string; label: string }>
  statuses: Array<{ value: number; label: string }>
  roles: Array<{ id: number; name: string; code: string }>
  users: Array<{ id: number; name: string; username: string }>
  today: string
}

// 立即执行一次（真扫业务数据生成提醒，仅系统管理员）
export const runRemindRule = (id?: number) => {
  return request.post({ url: '/cr/remind-rule/run', data: { id } })
}

// 提醒口径与接收人候选
export const getRemindMeta = () => {
  return request.get({ url: '/cr/remind-common/meta' })
}
