/**
 * Mock Handler — 系统集成：接入系统 / 接入权限 / 接入附件
 *
 * 会落库的接口（都要判管理员，已列入 scripts/e2e/auth.mjs 的写接口清单）：
 *   POST /cr/integration-system/heartbeat   心跳检测（写回最近心跳结论）
 *   POST /cr/integration-attachment/upload  附件接收（真存内容，能下载）
 *   POST /cr/integration-attachment/recheck 重新校验（改写校验状态）
 *   registerResource 的三组 CRUD
 * 只读：/cr/integration-auth/decisions（生效判断）、/cr/integration-attachment/content（下载）
 */
import { onGet, onPost } from '../route'
import { registerResource } from '../resource'
import { assertAdmin, operatorOf } from './guards'
import { formatDateTime, likeAny } from '../util'
import { orgTable } from '../db/org'
import { reportOptions } from '../db/crCommon'
import {
  ATTACH_STATUS_LABEL,
  BIZ_TYPE_LABEL,
  INTEGRATION_ATTACH_EXTS,
  INTEGRATION_ATTACH_MAX,
  SYS_TYPE_LABEL,
  contentHashOf,
  integrationAttachmentTable,
  integrationAuthTable,
  integrationSystemTable,
  type IntegrationAttachmentRow,
  type IntegrationAuthRow,
  type IntegrationSystemRow
} from '../db/crIntegration'

const orgNameOf = (orgId: number) => (orgTable.get(Number(orgId)) || { orgName: '' }).orgName

const reportLabelOf = (reportId: number) => {
  const report = reportOptions().find((item) => Number(item.id) === Number(reportId))
  return report ? report.reportCode + ' ' + report.reportName : ''
}

const systemOf = (sysCode: string) =>
  integrationSystemTable.all().find((row) => row.sysCode === sysCode)

/* ==================================================================
 * 接入系统
 * ================================================================== */
registerResource<IntegrationSystemRow>({
  prefix: '/cr/integration-system',
  table: integrationSystemTable,
  guard: (ctx, action) => assertAdmin(ctx, '接入系统' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.sysType === undefined ||
      params.sysType === '' ||
      Number(row.sysType) === Number(params.sysType)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(
      row,
      ['sysCode', 'sysName', 'owner', 'contact', 'callbackUrl', 'remark'],
      params.keyword
    ),
  beforeCreate: (body) => fillSystem(body),
  beforeUpdate: (body) => fillSystem(body),
  exportColumns: [
    { field: 'sysCode', label: '系统编码' },
    { field: 'sysName', label: '系统名称' },
    {
      field: 'sysType',
      label: '系统类型',
      formatter: (row) => SYS_TYPE_LABEL[Number(row.sysType)] || row.sysType
    },
    { field: 'owner', label: '归口部门' },
    { field: 'callbackUrl', label: '回调地址' },
    { field: 'contact', label: '联系人' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'lastHeartbeat', label: '最近心跳' },
    { field: 'heartbeatResult', label: '心跳结论' },
    { field: 'remark', label: '备注' }
  ]
})

function fillSystem(body: any): Partial<IntegrationSystemRow> {
  const sysCode = String(body.sysCode || '').trim()
  const sysName = String(body.sysName || '').trim()
  if (!sysCode) throw new Error('请填写系统编码')
  if (!sysName) throw new Error('请填写系统名称')
  const sysType = Number(body.sysType || 1)
  if (!SYS_TYPE_LABEL[sysType])
    throw new Error('系统类型非法（应为 报送交换 / 数据采集 / 监管对接）')
  const callbackUrl = String(body.callbackUrl || '').trim()
  if (!/^https?:\/\//.test(callbackUrl)) throw new Error('回调地址必须以 http:// 或 https:// 开头')
  const duplicated = integrationSystemTable
    .all()
    .some((row) => row.sysCode === sysCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('系统编码已存在：' + sysCode)
  return {
    sysCode,
    sysName,
    sysType,
    owner: String(body.owner || ''),
    contact: String(body.contact || ''),
    callbackUrl,
    secretMask: String(body.secretMask || '') || 'sk-****（未登记）',
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 心跳检测：确定性模拟（同一系统每次结论一致；停用的系统必失败） */
onPost('/cr/integration-system/heartbeat', (ctx) => {
  assertAdmin(ctx, '接入系统心跳检测')
  const row = integrationSystemTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('接入系统不存在：id=' + ctx.body?.id)
  const cost = 30 + ((row.id * 13) % 90)
  // 注意顺序：id=3 的样本系统本身是停用状态，先判 502，否则「对端 502」这个演示分支永远走不到
  const result =
    row.id === 3
      ? '心跳失败：对端 502（监管侧维护窗口）'
      : row.status === 0
        ? '心跳失败：系统已停用，未发起真实请求'
        : '心跳正常，平均往返 ' + cost + ' ms'
  const updated = { lastHeartbeat: formatDateTime(), heartbeatResult: result }
  integrationSystemTable.update({ id: row.id, ...updated })
  return { ...updated, sysName: row.sysName, cost }
})

/* ==================================================================
 * 接入权限
 * ================================================================== */
registerResource<IntegrationAuthRow>({
  prefix: '/cr/integration-auth',
  table: integrationAuthTable,
  guard: (ctx, action) => assertAdmin(ctx, '接入权限' + action),
  sort: (a, b) =>
    a.sysCode.localeCompare(b.sysCode) ||
    Number(a.priority || 50) - Number(b.priority || 50) ||
    a.id - b.id,
  filter: (row, params) =>
    (params.sysCode === undefined || params.sysCode === '' || row.sysCode === params.sysCode) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(
      row,
      ['sysCode', 'sysName', 'apiScope', 'orgNames', 'reportNames', 'remark'],
      params.keyword
    ),
  beforeCreate: (body) => fillAuth(body),
  beforeUpdate: (body) => fillAuth(body),
  exportColumns: [
    { field: 'sysName', label: '接入系统' },
    { field: 'apiScope', label: '接口范围' },
    { field: 'orgNames', label: '机构范围' },
    { field: 'reportNames', label: '报表范围' },
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

function fillAuth(body: any): Partial<IntegrationAuthRow> {
  const system = systemOf(String(body.sysCode || ''))
  if (!system) throw new Error('请选择有效的接入系统')
  if (Number(system.status) !== 1 && !body.id) {
    throw new Error('接入系统「' + system.sysName + '」已停用，不能新建授权（请先启用该系统）')
  }
  const apiScope = String(body.apiScope || '').trim()
  if (!apiScope) throw new Error('请填写接口范围（如 /cr/collect-import/*）')
  const priority = Number(body.priority === undefined || body.priority === '' ? 50 : body.priority)
  if (!Number.isInteger(priority) || priority < 0 || priority > 999) {
    throw new Error('优先级必须是 0~999 之间的整数（数字小的先生效）')
  }
  const orgIds = Array.isArray(body.orgIds) ? body.orgIds.map((id: any) => Number(id)) : []
  const reportIds = Array.isArray(body.reportIds) ? body.reportIds.map((id: any) => Number(id)) : []
  const unknownOrg = orgIds.find((id) => !orgTable.get(id))
  if (unknownOrg) throw new Error('机构不存在：id=' + unknownOrg)
  const unknownReport = reportIds.find((id) => !reportLabelOf(id))
  if (unknownReport) throw new Error('报表不存在：id=' + unknownReport)
  return {
    sysCode: system.sysCode,
    sysName: system.sysName,
    apiScope,
    orgIds,
    orgNames: orgIds.length ? orgIds.map(orgNameOf).join('、') : '全部机构',
    reportIds,
    reportNames: reportIds.length ? reportIds.map(reportLabelOf).join('、') : '全部报表',
    priority,
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/**
 * 接口范围精确度，按 [通配个数, 首个通配位置取负] 逐级比较（小的更精确）：
 * 无通配最精确；通配越少越精确；同样的通配数，字面前缀越长（首个 * 越靠后）越精确。
 * 之前的实现用 apiScope.indexOf('*') 直接当精确度，导致范围最宽的「*」被判成最精确、压过所有更窄的授权。
 */
const scopeRank = (apiScope: string): [number, number] => {
  const text = String(apiScope || '')
  const stars = (text.match(/\*/g) || []).length
  return stars ? [stars, -text.indexOf('*')] : [0, 0]
}

/** 授权排序口径：接口范围精确 > 通配 → 优先级小的 → 后建的 */
const scopeCompare = (
  a: { apiScope: string; priority?: number; id: number },
  b: { apiScope: string; priority?: number; id: number }
): number => {
  const [aStars, aPrefix] = scopeRank(a.apiScope)
  const [bStars, bPrefix] = scopeRank(b.apiScope)
  return (
    aStars - bStars ||
    aPrefix - bPrefix ||
    Number(a.priority || 50) - Number(b.priority || 50) ||
    b.id - a.id
  )
}

/**
 * other 的接口范围能否覆盖 target：把 target 里自己的 * 换成一个不可能出现在真实路径里的哨兵串，
 * 再看 other 的正则能否匹配——这样「*」不会被认为是「/cr/a/*」的子集（只认方向正确的包含关系）。
 */
const WILDCARD_SENTINEL = '__CR_WILDCARD__'
const scopeCovers = (other: string, target: string): boolean => {
  const escaped = String(other || '').replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const sample = String(target || '').replace(/\*/g, WILDCARD_SENTINEL)
  try {
    return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$').test(sample)
  } catch (e) {
    return false
  }
}

/** 生效判断：同一接入系统的多条授权，按「接口范围精确 > 通配 → 优先级小的 → 后建的」逐条给结论 */
onGet('/cr/integration-auth/decisions', (ctx) => {
  const sysCode = String(ctx.params.sysCode || '')
  if (!sysCode) throw new Error('请先选择接入系统')
  const system = systemOf(sysCode)
  if (!system) throw new Error('接入系统不存在：' + sysCode)
  const all = integrationAuthTable.all().filter((row) => row.sysCode === sysCode)
  const enabled = all
    .filter((row) => row.status === 1)
    .slice()
    .sort(scopeCompare)
  const winner = enabled[0]
  const rows = all
    .slice()
    .sort((a, b) => Number(a.priority || 50) - Number(b.priority || 50) || b.id - a.id)
    .map((row) => {
      let state = '生效中'
      let reason = '本条是该系统下最精确 / 优先级最小的授权'
      if (row.status !== 1) {
        state = '已停用'
        reason = '授权已停用，不参与判定'
      } else {
        // 只有「接口范围能覆盖本条」的授权才谈得上盖住；范围不重叠的授权各自生效，互不覆盖
        const covering = enabled.filter(
          (other) => other.id !== row.id && scopeCovers(other.apiScope, row.apiScope)
        )
        const better = covering
          .filter((other) => scopeCompare(other, row) < 0)
          .sort(scopeCompare)[0]
        if (better) {
          state = '被覆盖'
          reason =
            '被第 ' +
            better.id +
            ' 条盖住（接口范围 ' +
            better.apiScope +
            ' 能覆盖本条 ' +
            row.apiScope +
            '，优先级 ' +
            better.priority +
            '）'
        } else {
          // 覆盖不到本条、但范围有交集的授权：说明本条是那部分范围的兜底（例如「*」）
          const overlapped = enabled.filter(
            (other) =>
              other.id !== row.id &&
              (scopeCovers(other.apiScope, row.apiScope) ||
                scopeCovers(row.apiScope, other.apiScope))
          )
          reason = overlapped.length
            ? '与第 ' +
              overlapped.map((other) => other.id).join('、') +
              ' 条范围重叠，但没有比本条更精确 / 优先级更小的授权，本条在未被覆盖的范围内继续生效'
            : '本条接口范围与其它授权不重叠，按本条执行'
        }
      }
      return {
        id: row.id,
        apiScope: row.apiScope,
        orgNames: row.orgNames,
        reportNames: row.reportNames,
        priority: row.priority,
        status: row.status,
        state,
        reason
      }
    })
  return {
    system: {
      sysCode: system.sysCode,
      sysName: system.sysName,
      sysTypeLabel: SYS_TYPE_LABEL[system.sysType],
      status: system.status
    },
    effective: winner
      ? {
          matched: true,
          ruleId: winner.id,
          apiScope: winner.apiScope,
          orgNames: winner.orgNames,
          reportNames: winner.reportNames,
          source: '命中「接入权限」第 ' + winner.id + ' 条：' + winner.apiScope
        }
      : {
          matched: false,
          ruleId: 0,
          apiScope: '',
          orgNames: '',
          reportNames: '',
          source: '未命中任何启用授权 → 默认拒绝（可在本页为该系统授权）'
        },
    rows
  }
})

/* ==================================================================
 * 接入附件
 * ================================================================== */
registerResource<IntegrationAttachmentRow>({
  prefix: '/cr/integration-attachment',
  table: integrationAttachmentTable,
  guard: (ctx, action) => assertAdmin(ctx, '接入附件' + action),
  sort: (a, b) => (a.uploadTime < b.uploadTime ? 1 : -1),
  filter: (row, params) =>
    (params.sysCode === undefined || params.sysCode === '' || row.sysCode === params.sysCode) &&
    (params.bizType === undefined ||
      params.bizType === '' ||
      Number(row.bizType) === Number(params.bizType)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['fileName', 'sysName', 'uploadUser', 'checkMessage', 'remark'], params.keyword),
  // 列表里不带 base64 内容（内容只有「下载」接口按需取），避免一页把几百 KB 传回浏览器
  toListRow: (row) => ({ ...row, content: '' }),
  // 登记接口不接收内容：内容只能走 /upload（那里才有白名单与 1MB 校验），避免绕过校验写库
  beforeCreate: (body) => {
    if (String(body.content || '')) {
      throw new Error('登记接口不接收文件内容，请走「接收附件」（会做扩展名与大小校验）')
    }
    const sysCode = String(body.sysCode || '')
    const system = systemOf(sysCode)
    if (!system) throw new Error('请选择有效的接入系统（来源系统）')
    if (Number(system.status) !== 1) {
      throw new Error('接入系统「' + system.sysName + '」已停用，不能接收数据')
    }
    const fileName = String(body.fileName || '').trim()
    if (!fileName) throw new Error('缺少文件名')
    const dot = fileName.lastIndexOf('.')
    const fileExt = (dot >= 0 ? fileName.slice(dot + 1) : '').toLowerCase()
    if (INTEGRATION_ATTACH_EXTS.indexOf(fileExt) < 0) {
      throw new Error(
        '扩展名 ' +
          (fileExt || '(空)') +
          ' 不在白名单（' +
          INTEGRATION_ATTACH_EXTS.join(' / ') +
          '）内，不能登记'
      )
    }
    return {
      sysCode,
      sysName: system.sysName,
      fileName,
      fileExt,
      fileSize: Number(body.fileSize || 0),
      bizType: Number(body.bizType || 4),
      uploadUser: String(body.uploadUser || '系统管理员'),
      uploadTime: formatDateTime(),
      contentHash: '',
      status: Number(body.status || 1),
      checkMessage: String(body.checkMessage || '已登记，尚未收到文件内容'),
      content: '',
      remark: String(body.remark || '')
    }
  },
  // 只允许改备注这类描述字段：内容、校验结论、指纹、来源都不能通过通用 update 被改写
  beforeUpdate: (body) => ({ remark: String(body.remark || '') }),
  exportColumns: [
    { field: 'fileName', label: '文件名' },
    { field: 'sysName', label: '来源系统' },
    {
      field: 'bizType',
      label: '业务类型',
      formatter: (row) => BIZ_TYPE_LABEL[Number(row.bizType)] || row.bizType
    },
    { field: 'fileSize', label: '大小(字节)' },
    { field: 'uploadUser', label: '接收人' },
    { field: 'uploadTime', label: '接收时间' },
    {
      field: 'status',
      label: '校验状态',
      formatter: (row) => ATTACH_STATUS_LABEL[Number(row.status)] || row.status
    },
    { field: 'checkMessage', label: '校验结论' },
    { field: 'remark', label: '备注' }
  ]
})

/** 附件校验口径（上传与重新校验共用一份实现，避免两处判定不一致） */
const checkAttachment = (fileExt: string, fileSize: number, content: string) => {
  if (INTEGRATION_ATTACH_EXTS.indexOf(fileExt) < 0) {
    return {
      ok: false,
      message:
        '校验失败：扩展名 ' +
        (fileExt || '(空)') +
        ' 不在白名单（' +
        INTEGRATION_ATTACH_EXTS.join(' / ') +
        '）内，已拒绝入库'
    }
  }
  if (fileSize > INTEGRATION_ATTACH_MAX) {
    return { ok: false, message: '校验失败：文件 ' + fileSize + ' 字节，超过单文件上限 1MB' }
  }
  if (!content) {
    return { ok: false, message: '校验失败：没有拿到文件内容，无法登记内容指纹' }
  }
  return {
    ok: true,
    message: '校验通过：扩展名 ' + fileExt + ' 在白名单内，大小未超限，内容指纹已登记'
  }
}

/** 接收附件：真存内容（base64），校验不通过时**不保存内容**，只留登记信息与原因 */
onPost('/cr/integration-attachment/upload', (ctx) => {
  assertAdmin(ctx, '接入附件接收')
  const body = ctx.body || {}
  const sysCode = String(body.sysCode || '')
  const system = systemOf(sysCode)
  if (!system) throw new Error('请选择有效的接入系统（来源系统）')
  const fileName = String(body.fileName || '').trim()
  if (!fileName) throw new Error('缺少文件名')
  const dot = fileName.lastIndexOf('.')
  const fileExt = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
  if (Number(system.status) !== 1) {
    throw new Error('接入系统「' + system.sysName + '」已停用，不能接收数据')
  }
  const content = String(body.content || '')
  // 大小以真实内容为准：base64 正文按 4 字符 3 字节折算，声明的 fileSize 只作为没有正文时的兜底
  const payload = content.startsWith('data:') ? content.slice(content.indexOf(',') + 1) : content
  const realSize = payload ? Math.round(payload.length * 0.75) : 0
  const fileSize = realSize || Number(body.fileSize || 0)
  if (fileSize > INTEGRATION_ATTACH_MAX) {
    throw new Error(
      '单文件不能超过 1MB（当前 ' + fileSize + ' 字节）；真实系统请走文件服务分片上传'
    )
  }
  const check = checkAttachment(fileExt, fileSize, content)
  const created = integrationAttachmentTable.insert({
    sysCode,
    sysName: system.sysName,
    fileName,
    fileExt,
    fileSize,
    bizType: Number(body.bizType || 4),
    uploadUser: operatorOf(ctx),
    uploadTime: formatDateTime(),
    // 指纹只在真正入库时登记；校验失败不留指纹（否则等于给被拒的文件发了「已登记」凭证）
    contentHash: check.ok && content ? contentHashOf(content) : '',
    status: check.ok ? 2 : 3,
    checkMessage: check.message,
    content: check.ok ? content : '',
    remark: String(body.remark || '')
  })
  return {
    id: created.id,
    status: created.status,
    statusLabel: ATTACH_STATUS_LABEL[created.status],
    checkMessage: created.checkMessage,
    contentHash: created.contentHash
  }
})

/** 重新校验：拿已存的内容重算一遍（校验口径同上），并把结论写回 */
onPost('/cr/integration-attachment/recheck', (ctx) => {
  assertAdmin(ctx, '接入附件重新校验')
  const row = integrationAttachmentTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('附件不存在：id=' + ctx.body?.id)
  const check = checkAttachment(row.fileExt, row.fileSize, row.content)
  const updated = {
    status: check.ok ? 2 : 3,
    checkMessage: check.message,
    // 与上传保持同一口径：不通过就不留内容、也不留指纹
    contentHash: check.ok && row.content ? contentHashOf(row.content) : '',
    content: check.ok ? row.content : ''
  }
  integrationAttachmentTable.update({ id: row.id, ...updated })
  return { ...updated, statusLabel: ATTACH_STATUS_LABEL[updated.status] }
})

/** 下载附件内容（只读）：返回 data URL，前端用 download.base64 落盘 */
onGet('/cr/integration-attachment/content', (ctx) => {
  const row = integrationAttachmentTable.get(Number(ctx.params.id))
  if (!row) throw new Error('附件不存在：id=' + ctx.params.id)
  if (Number(row.status) !== 2) {
    throw new Error(
      '附件当前状态是「' +
        (ATTACH_STATUS_LABEL[Number(row.status)] || row.status) +
        '」，不能下载内容：' +
        row.fileName
    )
  }
  if (!row.content)
    throw new Error('该附件只登记了信息、没有保存内容（校验失败或历史记录）：' + row.fileName)
  return { id: row.id, fileName: row.fileName, content: row.content, fileSize: row.fileSize }
})

/** 附件业务类型 / 白名单口径（页面表单直接用，不写第二份） */
onGet('/cr/integration-attachment/meta', () => ({
  bizTypes: Object.keys(BIZ_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: BIZ_TYPE_LABEL[Number(key)]
  })),
  exts: INTEGRATION_ATTACH_EXTS,
  maxSize: INTEGRATION_ATTACH_MAX,
  sysTypes: Object.keys(SYS_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: SYS_TYPE_LABEL[Number(key)]
  }))
}))

/** 接入系统下拉（权限页 / 附件页共用） */
onGet('/cr/integration-system/simple-list-all', () =>
  integrationSystemTable.all().map((row) => ({
    id: row.id,
    name: row.sysName,
    sysCode: row.sysCode,
    sysName: row.sysName,
    status: row.status
  }))
)
