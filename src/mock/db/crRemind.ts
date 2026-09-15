/**
 * Mock 种子数据 — 自动提醒（提醒规则 / 提醒记录）
 *
 * 附件文档第 16 章的「自动提醒」在工程内没有可对照字段说明，按通行做法提案：
 *   提醒规则 = 触发场景（任务下发 / 截止前 N 天 / 逾期 / 校验不通过 / 待审批 / 期次关闭）
 *              × 接收人（业务责任人 / 角色 / 指定人）× 渠道（站内信 / 邮件 / 短信）；
 *   提醒记录 = 规则跑出来的每一条提醒，谁、什么时候、因为哪张单据。
 *
 * 关键约定：**「立即执行一次」是真扫真发** —— 遍历启用规则去读当前的业务数据
 * （任务 / 填报记录 / 脱敏审批单 / 期次），按「规则 + 单据 + 接收人」去重后落提醒记录。
 * 种子里的记录是历史留痕（页面标注"历史记录"），不是"跑一次就出来的假数据"。
 */
import { defineTable } from '../store'

/** 提醒规则 */
export interface RemindRuleRow {
  id: number
  ruleCode: string
  ruleName: string
  /** 1 任务已下发待填报 / 2 截止前 N 天未提交 / 3 逾期未报 / 4 校验不通过 / 5 脱敏审批待处理 / 6 期次即将关闭 */
  scene: number
  /** 场景 2 / 6 用：提前几天提醒 */
  offsetDays: number
  /** 接收人：业务责任人（按单据上的人） / 角色 / 指定人 */
  receivers: Array<{ type: 'owner' | 'role' | 'user'; id?: number; name: string }>
  receiverText: string
  /** 推送渠道：inner 站内信 / email 邮件 / sms 短信 */
  channels: string[]
  templateText: string
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 提醒记录 */
export interface RemindLogRow {
  id: number
  ruleId: number
  ruleCode: string
  ruleName: string
  scene: number
  sceneLabel: string
  title: string
  content: string
  receiverName: string
  /** 接收人标识（user:<id> / owner:<昵称>），去重按它而不是姓名 */
  receiverKey?: string
  channel: string
  sendTime: string
  /** 1 已发送 / 2 已读 / 3 发送失败 */
  status: number
  /** 业务单据标识（任务编号 / 机构-报表-期次 / 审批单号），用于同一条单据不重复提醒 */
  bizKey: string
  /** 历史留痕（种子数据）标记：跑批生成的记录为 false */
  seeded: boolean
  /** 记录来源：seed 历史留痕 / run 立即执行 / resend 重发 */
  source?: string
  remark: string
}

export const REMIND_SCENE_LABEL: Record<number, string> = {
  1: '任务已下发待填报',
  2: '截止前未提交',
  3: '逾期未报',
  4: '校验不通过',
  5: '脱敏审批待处理',
  6: '期次即将关闭'
}

export const REMIND_CHANNEL_LABEL: Record<string, string> = {
  inner: '站内信',
  email: '邮件',
  sms: '短信'
}

export const REMIND_STATUS_LABEL: Record<number, string> = {
  1: '已发送',
  2: '已读',
  3: '发送失败'
}

const ruleSeed: RemindRuleRow[] = [
  {
    id: 1,
    ruleCode: 'RM_DISPATCH',
    ruleName: '任务下发后提醒填报人',
    scene: 1,
    offsetDays: 0,
    receivers: [{ type: 'owner', name: '业务责任人' }],
    receiverText: '业务责任人（任务上的填报人）',
    channels: ['inner', 'email'],
    templateText: '【报送提醒】您有任务 {taskCode} 待填报，报表《{reportName}》，截止 {deadline}。',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-07 09:00:00',
    remark: '任务下发当天提醒一次',
    createTime: '2026-08-10 09:00:00'
  },
  {
    id: 2,
    ruleCode: 'RM_DEADLINE_3D',
    ruleName: '截止前 3 天提醒未提交',
    scene: 2,
    offsetDays: 3,
    receivers: [
      { type: 'owner', name: '业务责任人' },
      { type: 'role', id: 2, name: '报送填报岗' }
    ],
    receiverText: '业务责任人 + 报送填报岗',
    channels: ['inner', 'email', 'sms'],
    templateText:
      '【报送提醒】{orgName} 的《{reportName}》（{period}）还有 {daysLeft} 天截止，尚未提交。',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-07 09:05:00',
    remark: '多渠道提醒',
    createTime: '2026-08-10 09:05:00'
  },
  {
    id: 3,
    ruleCode: 'RM_OVERDUE',
    ruleName: '逾期未报提醒',
    scene: 3,
    offsetDays: 0,
    receivers: [
      { type: 'owner', name: '业务责任人' },
      { type: 'role', id: 3, name: '报送复核岗' }
    ],
    receiverText: '业务责任人 + 报送复核岗',
    channels: ['inner', 'sms'],
    templateText:
      '【逾期预警】{orgName} 的《{reportName}》（{period}）已逾期 {daysLeft} 天未提交，请立即处理。',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-07 09:10:00',
    remark: '扫描截止日期已过、任务状态还没到「审核通过」的报表任务，逾期天数按截止日期算',
    createTime: '2026-08-10 09:10:00'
  },
  {
    id: 4,
    ruleCode: 'RM_CHECK_FAIL',
    ruleName: '校验不通过提醒',
    scene: 4,
    offsetDays: 0,
    receivers: [{ type: 'owner', name: '业务责任人' }],
    receiverText: '业务责任人（填报记录上的填报人）',
    channels: ['inner'],
    templateText:
      '【校验提醒】{orgName} 的《{reportName}》（{period}）校验不通过，请按错误原因整改后重新提交。',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-07 09:15:00',
    remark: '',
    createTime: '2026-08-10 09:15:00'
  },
  {
    id: 5,
    ruleCode: 'RM_DESENS_APPROVAL',
    ruleName: '脱敏审批待处理提醒',
    scene: 5,
    offsetDays: 0,
    receivers: [{ type: 'role', id: 4, name: '报送审核岗' }],
    receiverText: '报送审核岗',
    channels: ['inner', 'email'],
    templateText: '【审批提醒】脱敏申请单 {applyNo} 待您放行，放行后系统会立即执行脱敏。',
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-07 09:20:00',
    remark: '放行即执行，必须提醒到位',
    createTime: '2026-08-10 09:20:00'
  },
  {
    id: 6,
    ruleCode: 'RM_PERIOD_CLOSE',
    ruleName: '期次即将关闭提醒',
    scene: 6,
    offsetDays: 5,
    receivers: [{ type: 'role', id: 1, name: '系统管理员' }],
    receiverText: '系统管理员',
    channels: ['inner'],
    templateText: '【期次提醒】期次 {period} 还有 {daysLeft} 天关闭，请确认全部任务已完成。',
    status: 0,
    updateUser: '系统管理员',
    updateTime: '2026-09-07 09:25:00',
    remark: '已停用示例：期次关闭由人工确认，暂时不自动提醒',
    createTime: '2026-08-10 09:25:00'
  }
]

const logSeed: RemindLogRow[] = [
  {
    id: 1,
    ruleId: 3,
    ruleCode: 'RM_OVERDUE',
    ruleName: '逾期未报提醒',
    scene: 3,
    sceneLabel: REMIND_SCENE_LABEL[3],
    title: '【逾期预警】上海分公司《人身险公司商保年金业务统计表》已逾期 3 天未提交',
    content:
      '【逾期预警】上海分公司的《人身险公司商保年金业务统计表》（202608）已逾期 3 天未提交，请立即处理。',
    receiverName: '王雅琴',
    channel: 'inner',
    sendTime: '2026-09-11 08:00:00',
    status: 2,
    bizKey: 'RW202608006',
    seeded: true,
    remark:
      '历史留痕：2026-09-11 由「逾期未报提醒」扫任务 RW202608006（截止 09-08）生成，当天逾期 3 天；同一提醒同时推送：站内信、短信'
  },
  {
    id: 2,
    ruleId: 3,
    ruleCode: 'RM_OVERDUE',
    ruleName: '逾期未报提醒',
    scene: 3,
    sceneLabel: REMIND_SCENE_LABEL[3],
    title: '【逾期预警】江苏分公司《保单贷款业务统计表》已逾期 1 天未提交',
    content:
      '【逾期预警】江苏分公司的《保单贷款业务统计表》（202608）已逾期 1 天未提交，请立即处理。',
    receiverName: '张明浩',
    channel: 'inner',
    sendTime: '2026-09-11 08:00:00',
    status: 1,
    bizKey: 'RW202608011',
    seeded: true,
    remark:
      '历史留痕：2026-09-11 由「逾期未报提醒」扫任务 RW202608011（截止 09-10）生成，当天逾期 1 天'
  },
  {
    id: 3,
    ruleId: 4,
    ruleCode: 'RM_CHECK_FAIL',
    ruleName: '校验不通过提醒',
    scene: 4,
    sceneLabel: REMIND_SCENE_LABEL[4],
    title: '【校验提醒】广东分公司《缴费信息表》校验不通过',
    content:
      '【校验提醒】广东分公司的《缴费信息表》（202608）校验不通过，请按错误原因整改后重新提交。',
    receiverName: '黄粤生',
    channel: 'inner',
    sendTime: '2026-09-09 17:30:00',
    status: 2,
    bizKey: '14-12-202608',
    seeded: true,
    remark: '历史留痕（种子数据）'
  },
  {
    id: 4,
    ruleId: 5,
    ruleCode: 'RM_DESENS_APPROVAL',
    ruleName: '脱敏审批待处理提醒',
    scene: 5,
    sceneLabel: REMIND_SCENE_LABEL[5],
    title: '【审批提醒】脱敏申请单 DS2026080003 待放行',
    content: '【审批提醒】脱敏申请单 DS2026080003 待您放行，放行后系统会立即执行脱敏。',
    receiverName: '孙建国',
    channel: 'inner',
    sendTime: '2026-09-10 10:05:00',
    status: 1,
    bizKey: 'DS2026080003',
    seeded: true,
    remark: '历史留痕（种子数据）'
  },
  {
    id: 5,
    ruleId: 1,
    ruleCode: 'RM_DISPATCH',
    ruleName: '任务下发后提醒填报人',
    scene: 1,
    sceneLabel: REMIND_SCENE_LABEL[1],
    title: '【报送提醒】任务 T2026080012 已下发待填报',
    content:
      '【报送提醒】您有任务 T2026080012 待填报，报表《人身险公司商保年金业务统计表》，截止 2026-09-15。',
    receiverName: '周北京',
    channel: 'inner',
    sendTime: '2026-09-03 09:00:00',
    status: 2,
    bizKey: 'T2026080012',
    seeded: true,
    remark: '历史留痕（种子数据）'
  },
  {
    id: 6,
    ruleId: 2,
    ruleCode: 'RM_DEADLINE_3D',
    ruleName: '截止前 3 天提醒未提交',
    scene: 2,
    sceneLabel: REMIND_SCENE_LABEL[2],
    title: '【报送提醒】北京分公司《保费收入统计表》还有 2 天截止',
    content: '【报送提醒】北京分公司的《保费收入统计表》（202608）还有 2 天截止，尚未提交。',
    receiverName: '周北京',
    channel: 'email',
    sendTime: '2026-09-12 08:00:00',
    status: 3,
    bizKey: '11-11-202608',
    seeded: true,
    remark: '历史留痕（种子数据）；发送失败示例：邮箱服务返回 550'
  }
]

export const remindRuleTable = defineTable<RemindRuleRow>('cr.remindRule', ruleSeed)
export const remindLogTable = defineTable<RemindLogRow>('cr.remindLog', logSeed)
