/**
 * Mock Handler — 自动提醒：提醒规则 / 提醒记录
 *
 * 会落库的接口（都判管理员，已列入写接口门禁清单）：
 *   POST /cr/remind-rule/run     立即执行一次（真扫业务数据 → 生成提醒记录，按「规则+单据+接收人」去重）
 *   POST /cr/remind-log/read     标记已读
 *   POST /cr/remind-log/resend   重发（追加一条新的已发送记录，不改历史）
 *   registerResource 的规则 CRUD 与记录删除
 * 只读：/cr/remind-common/meta、/cr/remind-log/stat
 */
import { onGet, onPost } from '../route'
import { registerResource } from '../resource'
import { assertAdmin, operatorOf } from './guards'
import { formatDate, formatDateTime, likeAny } from '../util'
import { roleTable, userTable, ROLE_CODE } from '../db/system'
import { crTaskTable, TASK_STATUS } from '../db/crTask'
import { crFillRecordTable } from '../db/crData'
import { collectPeriodTable } from '../db/crCollect'
import { crDesensTaskTable } from '../db/crDesensitize'
import {
  REMIND_CHANNEL_LABEL,
  REMIND_SCENE_LABEL,
  REMIND_STATUS_LABEL,
  remindLogTable,
  remindRuleTable,
  type RemindRuleRow
} from '../db/crRemind'
import { notifyMessageTable } from '../db/infra'

/** 距某日期还有几天（按系统当天算，负数 = 已过期） */
const daysUntil = (date: string): number => {
  if (!date) return 0
  const today = new Date(formatDate() + 'T00:00:00').getTime()
  return Math.round((new Date(date + 'T00:00:00').getTime() - today) / 86400000)
}

interface ScanItem {
  bizKey: string
  title: string
  /** 业务责任人（任务 / 填报记录上的人） */
  owner: string
  /** 模板变量（{orgName} 这类占位符的取值） */
  vars: Record<string, string | number>
}

interface ScanReceiver {
  /** 去重与站内信投递用的稳定标识：user:<id> / owner:<昵称> */
  key: string
  name: string
  userId: number
}

/** 模板渲染：把 {变量} 换成实际值；模板里写了但本次没有值的变量原样保留，便于发现拼写错误 */
const renderTemplate = (template: string, vars: Record<string, string | number>): string =>
  String(template || '').replace(/{(\w+)}/g, (raw, key) =>
    vars[key] === undefined || vars[key] === null || vars[key] === '' ? raw : String(vars[key])
  )

/** 各场景的默认模板（规则模板留空时兜底，变量与表单提示里的 7 个一致） */
const DEFAULT_TEMPLATE: Record<number, string> = {
  1: '【报送提醒】您有任务 {taskCode} 待填报，报表《{reportName}》，截止 {deadline}。',
  2: '【报送提醒】{orgName}的《{reportName}》（{period}）还有 {daysLeft} 天截止，尚未提交。',
  3: '【逾期预警】{orgName}的《{reportName}》（{period}）已逾期 {daysLeft} 天未提交，请立即处理。',
  4: '【校验提醒】{orgName}的《{reportName}》（{period}）校验不通过，请按错误原因整改后重新提交。',
  5: '【审批提醒】脱敏申请单 {applyNo} 待您放行，放行后系统会立即执行脱敏。',
  6: '【期次提醒】期次 {period} 还有 {daysLeft} 天关闭，请确认全部任务已完成。'
}

/** 按场景扫描当前业务数据 —— 这是"自动提醒"真正的数据来源，不是另一份种子 */
const scanScene = (rule: RemindRuleRow): ScanItem[] => {
  if (rule.scene === 1) {
    return crTaskTable
      .all()
      .filter((task) => task.status === TASK_STATUS.DISPATCHED)
      .map((task) => ({
        bizKey: task.taskCode,
        title: '【报送提醒】任务 ' + task.taskCode + ' 已下发待填报',
        owner: task.fillUser,
        vars: {
          taskCode: task.taskCode,
          reportName: task.reportName,
          deadline: task.deadline,
          orgName: task.orgName,
          period: task.period
        }
      }))
  }
  if (rule.scene === 2) {
    // 截止前 N 天：扫填报明细（明细的截止日期就是任务截止日期，且带填报人）
    return crFillRecordTable
      .all()
      .filter((record) => Number(record.fillStatus) !== 2)
      .map((record) => ({ record, daysLeft: daysUntil(record.deadline) }))
      .filter(({ daysLeft }) => daysLeft >= 0 && daysLeft <= rule.offsetDays)
      .map(({ record, daysLeft }) => ({
        bizKey: record.orgId + '-' + record.reportId + '-' + record.period,
        title:
          '【报送提醒】' +
          record.orgName +
          '《' +
          record.reportName +
          '》还有 ' +
          daysLeft +
          ' 天截止',
        owner: record.fillUser,
        vars: {
          orgName: record.orgName,
          orgId: record.orgId,
          reportName: record.reportName,
          reportId: record.reportId,
          period: record.period,
          deadline: record.deadline,
          daysLeft: Math.abs(daysLeft)
        }
      }))
  }
  if (rule.scene === 3) {
    // 逾期未报：扫**报表任务**（截止日期已过、且还没到「审核通过」90）。
    // 填报明细的截止日期种子统一是 2026-09-15，用明细扫逾期会恒为 0 —— 而种子里
    // 刻意播了 3 条逾期任务（docs/00 已知简化 11），逾期的载体是任务不是明细。
    return crTaskTable
      .all()
      .filter((task) => Number(task.status) !== TASK_STATUS.FINISHED)
      .map((task) => ({ task, daysLeft: daysUntil(task.deadline) }))
      .filter(({ daysLeft }) => daysLeft < 0)
      .map(({ task, daysLeft }) => ({
        bizKey: task.taskCode,
        title:
          '【逾期预警】' +
          task.orgName +
          '《' +
          task.reportName +
          '》已逾期 ' +
          Math.abs(daysLeft) +
          ' 天未提交',
        owner: task.fillUser,
        vars: {
          taskCode: task.taskCode,
          orgName: task.orgName,
          reportName: task.reportName,
          period: task.period,
          deadline: task.deadline,
          daysLeft: Math.abs(daysLeft)
        }
      }))
  }
  if (rule.scene === 4) {
    return crFillRecordTable
      .all()
      .filter((record) => Number(record.checkStatus) === 3)
      .map((record) => ({
        bizKey: record.orgId + '-' + record.reportId + '-' + record.period,
        title: '【校验提醒】' + record.orgName + '《' + record.reportName + '》校验不通过',
        owner: record.fillUser,
        vars: {
          orgName: record.orgName,
          orgId: record.orgId,
          reportName: record.reportName,
          reportId: record.reportId,
          period: record.period,
          deadline: record.deadline
        }
      }))
  }
  if (rule.scene === 5) {
    return crDesensTaskTable
      .all()
      .filter((task) => Number(task.status) === 6)
      .map((task) => ({
        bizKey: task.batchNo,
        title: '【审批提醒】脱敏申请单 ' + task.batchNo + ' 待放行',
        // 业务责任人取单据上真实的人（不再写死）
        owner: task.applyUser,
        vars: {
          applyNo: task.batchNo,
          batchNo: task.batchNo,
          orgName: task.orgName,
          period: task.period
        }
      }))
  }
  if (rule.scene === 6) {
    return collectPeriodTable
      .all()
      .filter((period) => Number(period.status) === 1)
      .map((period) => ({ period, daysLeft: daysUntil(period.deadline) }))
      .filter(({ daysLeft }) => daysLeft >= 0 && daysLeft <= rule.offsetDays)
      .map(({ period, daysLeft }) => ({
        bizKey: period.period,
        title: '【期次提醒】期次 ' + period.period + ' 还有 ' + daysLeft + ' 天关闭',
        owner: '',
        vars: { period: period.period, deadline: period.deadline, daysLeft }
      }))
  }
  return []
}

/** 接收人展开：业务责任人按单据上的人，角色按角色下全部用户，指定人按 id；停用账号（status=1）不投递 */
const receiversOf = (rule: RemindRuleRow, item: ScanItem): ScanReceiver[] => {
  const found: ScanReceiver[] = []
  ;(rule.receivers || []).forEach((receiver) => {
    if (receiver.type === 'owner') {
      if (!item.owner) return
      const user = userTable.all().find((row) => row.nickname === item.owner)
      found.push({ key: 'owner:' + item.owner, name: item.owner, userId: user ? user.id : 0 })
      return
    }
    if (receiver.type === 'user') {
      const user = userTable.get(Number(receiver.id))
      if (user && Number(user.status) === 0) {
        found.push({ key: 'user:' + user.id, name: user.nickname, userId: user.id })
      }
      return
    }
    const roleId = Number(receiver.id)
    userTable
      .all()
      .filter((user) => user.roleIds.indexOf(roleId) >= 0 && Number(user.status) === 0)
      .forEach((user) =>
        found.push({ key: 'user:' + user.id, name: user.nickname, userId: user.id })
      )
  })
  return found.filter(
    (item, index, list) => item.name && list.findIndex((other) => other.key === item.key) === index
  )
}

registerResource<RemindRuleRow>({
  prefix: '/cr/remind-rule',
  table: remindRuleTable,
  guard: (ctx, action) => assertAdmin(ctx, '提醒规则' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.scene === undefined ||
      params.scene === '' ||
      Number(row.scene) === Number(params.scene)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(
      row,
      ['ruleCode', 'ruleName', 'receiverText', 'templateText', 'remark'],
      params.keyword
    ),
  beforeCreate: (body, ctx) => ({ ...fillRule(body, ctx), createTime: formatDateTime() }),
  beforeUpdate: (body, ctx) => fillRule(body, ctx),
  exportColumns: [
    { field: 'ruleCode', label: '规则编码' },
    { field: 'ruleName', label: '规则名称' },
    {
      field: 'scene',
      label: '触发场景',
      formatter: (row) => REMIND_SCENE_LABEL[Number(row.scene)] || row.scene
    },
    {
      field: 'channels',
      label: '推送渠道',
      formatter: (row) =>
        (row.channels || []).map((code: string) => REMIND_CHANNEL_LABEL[code] || code).join('、')
    },
    { field: 'receiverText', label: '接收人' },
    { field: 'templateText', label: '提醒内容模板' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'remark', label: '备注' }
  ]
})

function fillRule(body: any, ctx?: any): Partial<RemindRuleRow> {
  const ruleCode = String(body.ruleCode || '').trim()
  const ruleName = String(body.ruleName || '').trim()
  if (!ruleCode) throw new Error('请填写规则编码')
  if (!ruleName) throw new Error('请填写规则名称')
  const scene = Number(body.scene || 0)
  if (!REMIND_SCENE_LABEL[scene]) throw new Error('触发场景非法')
  const offsetDays = Number(
    body.offsetDays === undefined || body.offsetDays === '' ? 0 : body.offsetDays
  )
  if (offsetDays < 0 || offsetDays > 30) throw new Error('提前天数必须在 0~30 之间')
  const receivers = Array.isArray(body.receivers) ? body.receivers : []
  if (!receivers.length) throw new Error('至少要选一个接收人（业务责任人 / 角色 / 指定人）')
  const channels = Array.isArray(body.channels)
    ? body.channels.map((item: any) => String(item))
    : []
  if (!channels.length) throw new Error('至少要选一个推送渠道')
  const invalidChannel = channels.find((channel) => !REMIND_CHANNEL_LABEL[channel])
  if (invalidChannel) throw new Error('推送渠道非法：' + invalidChannel)
  const templateText = String(body.templateText || '').trim()
  if (!templateText) throw new Error('请填写提醒内容模板')
  const duplicated = remindRuleTable
    .all()
    .some((row) => row.ruleCode === ruleCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('规则编码已存在：' + ruleCode)
  return {
    ruleCode,
    ruleName,
    scene,
    offsetDays,
    receivers,
    receiverText: receivers
      .map((receiver: any) =>
        receiver.type === 'owner' ? '业务责任人' : String(receiver.name || '')
      )
      .filter(Boolean)
      .join(' + '),
    channels,
    templateText,
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    updateUser: operatorOf(ctx),
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/**
 * 立即执行一次：真扫当前业务数据。
 * 去重键 = 规则 + 单据 + 接收人（同一条单据不会被同一条规则反复轰炸）。
 */
onPost('/cr/remind-rule/run', (ctx) => {
  assertAdmin(ctx, '提醒规则立即执行')
  const rawId = ctx.body?.id
  const onlyId = rawId === undefined || rawId === null || rawId === '' ? 0 : Number(rawId)
  if (rawId !== undefined && rawId !== null && rawId !== '' && !Number.isFinite(onlyId)) {
    throw new Error('规则 id 非法：' + String(rawId))
  }
  const rules = remindRuleTable
    .all()
    .filter((rule) => rule.status === 1)
    .filter((rule) => !onlyId || rule.id === onlyId)
  if (!rules.length) throw new Error('没有启用中的提醒规则可执行（停用的规则不会触发）')
  const scanned = rules.map((rule) => ({ rule, items: scanScene(rule) }))
  const totalItems = scanned.reduce((acc, group) => acc + group.items.length, 0)
  if (!totalItems) {
    return {
      generated: 0,
      skipped: 0,
      scanned: 0,
      message: '已扫描 ' + rules.length + ' 条启用规则，当前没有需要提醒的单据（数据都是最新的）',
      details: scanned.map((group) => ({
        rule: group.rule.ruleName,
        items: 0,
        generated: 0,
        skipped: 0
      }))
    }
  }
  const now = formatDateTime()
  let generated = 0
  let skipped = 0
  const details = scanned.map((group) => {
    let groupGenerated = 0
    let groupSkipped = 0
    group.items.forEach((item) => {
      const content = renderTemplate(
        group.rule.templateText || DEFAULT_TEMPLATE[group.rule.scene],
        item.vars
      )
      receiversOf(group.rule, item).forEach((receiver) => {
        ;(group.rule.channels || []).forEach((channel) => {
          const exists = remindLogTable
            .all()
            .some(
              (log) =>
                log.ruleId === group.rule.id &&
                log.bizKey === item.bizKey &&
                log.channel === channel &&
                (log.receiverKey
                  ? log.receiverKey === receiver.key
                  : log.receiverName === receiver.name)
            )
          if (exists) {
            skipped += 1
            groupSkipped += 1
            return
          }
          remindLogTable.insert({
            ruleId: group.rule.id,
            ruleCode: group.rule.ruleCode,
            ruleName: group.rule.ruleName,
            scene: group.rule.scene,
            sceneLabel: REMIND_SCENE_LABEL[group.rule.scene],
            title: item.title,
            content,
            receiverName: receiver.name,
            receiverKey: receiver.key,
            channel,
            sendTime: now,
            status: 1,
            bizKey: item.bizKey,
            seeded: false,
            source: 'run',
            remark:
              '由「立即执行一次」生成；本次推送渠道：' + (REMIND_CHANNEL_LABEL[channel] || channel)
          })
          // 「站内信一定可见」落地：真写进消息中心（右上角小铃铛能查到）
          if (channel === 'inner' && receiver.userId) {
            notifyMessageTable.insert({
              userId: receiver.userId,
              userType: 2,
              templateCode: 'cr_remind_' + group.rule.ruleCode,
              templateNickname: group.rule.ruleName,
              templateContent: content,
              templateType: 1,
              readStatus: false,
              readTime: '',
              createTime: now
            })
          }
          generated += 1
          groupGenerated += 1
        })
      })
    })
    return {
      rule: group.rule.ruleName,
      items: group.items.length,
      generated: groupGenerated,
      skipped: groupSkipped
    }
  })
  return {
    generated,
    skipped,
    scanned: totalItems,
    message:
      '扫描 ' +
      rules.length +
      ' 条启用规则、命中 ' +
      totalItems +
      ' 条待提醒单据：新生成 ' +
      generated +
      ' 条提醒，去重跳过 ' +
      skipped +
      ' 条（同一单据不会重复提醒）',
    details
  }
})

registerResource({
  prefix: '/cr/remind-log',
  table: remindLogTable,
  guard: (ctx, action) => assertAdmin(ctx, '提醒记录' + action),
  sort: (a, b) => (a.sendTime < b.sendTime ? 1 : -1),
  filter: (row, params) =>
    (params.scene === undefined ||
      params.scene === '' ||
      Number(row.scene) === Number(params.scene)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    (params.channel === undefined || params.channel === '' || row.channel === params.channel) &&
    likeAny(
      row,
      ['ruleName', 'title', 'content', 'receiverName', 'bizKey', 'remark'],
      params.keyword
    ),
  exportColumns: [
    { field: 'sendTime', label: '发送时间' },
    { field: 'ruleName', label: '提醒规则' },
    { field: 'title', label: '提醒标题' },
    { field: 'receiverName', label: '接收人' },
    {
      field: 'channel',
      label: '渠道',
      formatter: (row) => REMIND_CHANNEL_LABEL[row.channel] || row.channel
    },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => REMIND_STATUS_LABEL[Number(row.status)] || row.status
    },
    {
      field: 'source',
      label: '来源',
      formatter: (row) =>
        ({ seed: '历史留痕', run: '由立即执行生成', resend: '由重发生成' })[row.source] ||
        '历史留痕'
    },
    { field: 'content', label: '提醒内容' },
    { field: 'bizKey', label: '关联单据' }
  ]
})

/** 标记已读 */
onPost('/cr/remind-log/read', (ctx) => {
  assertAdmin(ctx, '提醒记录标记已读')
  const ids = Array.isArray(ctx.body?.ids) ? ctx.body.ids.map((id: any) => Number(id)) : []
  if (!ids.length) throw new Error('请至少勾选一条提醒记录')
  let updated = 0
  let failed = 0
  ids.forEach((id) => {
    const row = remindLogTable.get(id)
    if (!row || Number(row.status) === 2) return
    if (Number(row.status) === 3) {
      failed += 1
      return
    }
    remindLogTable.update({ id, status: 2 })
    updated += 1
  })
  return {
    updated,
    failed,
    message:
      '已把 ' +
      updated +
      ' 条提醒标记为已读' +
      (failed ? '；' + failed + ' 条发送失败，失败记录不能置为已读' : '')
  }
})

/** 重发：追加一条新的已发送记录，历史留痕不动 */
onPost('/cr/remind-log/resend', (ctx) => {
  assertAdmin(ctx, '提醒记录重发')
  const row = remindLogTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('提醒记录不存在：id=' + ctx.body?.id)
  const created = remindLogTable.insert({
    ruleId: row.ruleId,
    ruleCode: row.ruleCode,
    ruleName: row.ruleName,
    scene: row.scene,
    sceneLabel: row.sceneLabel,
    title: row.title,
    content: row.content,
    receiverName: row.receiverName,
    channel: row.channel,
    sendTime: formatDateTime(),
    status: 1,
    bizKey: row.bizKey,
    seeded: false,
    source: 'resend',
    receiverKey: row.receiverKey,
    remark:
      '由 ' + row.receiverName + ' 的提醒重发（原记录 id=' + row.id + '，渠道 ' + row.channel + '）'
  })
  return { id: created.id, message: '已重发，新增记录 id=' + created.id }
})

/** 提醒统计（只读） */
onGet('/cr/remind-log/stat', () => {
  const logs = remindLogTable.all()
  const scenes = Object.keys(REMIND_SCENE_LABEL).map((key) => {
    const scene = Number(key)
    const own = logs.filter((log) => Number(log.scene) === scene)
    return {
      scene,
      sceneLabel: REMIND_SCENE_LABEL[scene],
      total: own.length,
      read: own.filter((log) => Number(log.status) === 2).length,
      failed: own.filter((log) => Number(log.status) === 3).length,
      running: own.filter((log) => Number(log.status) === 1).length
    }
  })
  return {
    total: logs.length,
    read: logs.filter((log) => Number(log.status) === 2).length,
    failed: logs.filter((log) => Number(log.status) === 3).length,
    generatedByRun: logs.filter((log) => !log.seeded).length,
    scenes
  }
})

/** 场景 / 渠道 / 接收人下拉与中文名（页面直接用服务端口径） */
onGet('/cr/remind-common/meta', () => ({
  scenes: Object.keys(REMIND_SCENE_LABEL).map((key) => ({
    value: Number(key),
    label: REMIND_SCENE_LABEL[Number(key)]
  })),
  channels: Object.keys(REMIND_CHANNEL_LABEL).map((key) => ({
    value: key,
    label: REMIND_CHANNEL_LABEL[key]
  })),
  statuses: Object.keys(REMIND_STATUS_LABEL).map((key) => ({
    value: Number(key),
    label: REMIND_STATUS_LABEL[Number(key)]
  })),
  roles: roleTable
    .all()
    .filter((role) => role.code !== ROLE_CODE.ADMIN)
    .map((role) => ({ id: role.id, name: role.name, code: role.code })),
  users: userTable
    .all()
    .filter((user) => Number(user.status) === 0)
    .map((user) => ({ id: user.id, name: user.nickname, username: user.username })),
  today: formatDate()
}))
