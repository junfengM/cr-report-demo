/**
 * Mock Handler — 服务管理：服务主机 / 密钥
 *
 * 会落库的接口（都判管理员，已列入写接口门禁清单）：
 *   POST /cr/service-host/test        连接测试（写回最近检查结论）
 *   POST /cr/service-secret/rotate    密钥轮换（生成新指纹 + 追加留痕 + 轮换次数 +1）
 *   registerResource 的两组 CRUD
 * 只读：/cr/service-secret/trail（留痕）、/cr/service-secret/expiring（即将过期）
 */
import { onDelete, onGet, onPost, onPut } from '../route'
import { registerResource } from '../resource'
import { assertAdmin, operatorOf } from './guards'
import { formatDateTime, likeAny } from '../util'
import {
  AUTH_TYPE_LABEL,
  HOST_TYPE_LABEL,
  SECRET_TYPE_LABEL,
  daysUntil,
  fingerprintOf,
  secretTrailTable,
  serviceHostTable,
  serviceSecretTable,
  type ServiceHostRow,
  type ServiceSecretRow
} from '../db/crService'

const secretOf = (id: any) => serviceSecretTable.get(Number(id))

/* ==================================================================
 * 服务主机
 * ================================================================== */
registerResource<ServiceHostRow>({
  prefix: '/cr/service-host',
  table: serviceHostTable,
  guard: (ctx, action) => assertAdmin(ctx, '服务主机' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.hostType === undefined ||
      params.hostType === '' ||
      Number(row.hostType) === Number(params.hostType)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(
      row,
      ['hostCode', 'hostName', 'address', 'username', 'protocol', 'remark'],
      params.keyword
    ),
  beforeCreate: (body, ctx) => fillHost(body, ctx),
  beforeUpdate: (body, ctx) => fillHost(body, ctx),
  exportColumns: [
    { field: 'hostCode', label: '主机编码' },
    { field: 'hostName', label: '主机名称' },
    {
      field: 'hostType',
      label: '主机类型',
      formatter: (row) => HOST_TYPE_LABEL[Number(row.hostType)] || row.hostType
    },
    { field: 'address', label: '地址' },
    { field: 'port', label: '端口' },
    { field: 'protocol', label: '协议' },
    { field: 'username', label: '账号' },
    {
      field: 'authType',
      label: '认证方式',
      formatter: (row) => AUTH_TYPE_LABEL[Number(row.authType)] || row.authType
    },
    { field: 'secretName', label: '使用密钥' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'lastCheckTime', label: '最近检查' },
    { field: 'checkResult', label: '检查结论' },
    { field: 'remark', label: '备注' }
  ]
})

/** 0 是合法取值（如 hostType/authType 的枚举从 1 开始，但传 0 应报错而不是被 || 悄悄改成默认值） */
const pickInt = (raw: any, fallback: number): number =>
  raw === undefined || raw === null || raw === '' ? fallback : Number(raw)

function fillHost(body: any, ctx?: any): Partial<ServiceHostRow> {
  const hostCode = String(body.hostCode || '').trim()
  const hostName = String(body.hostName || '').trim()
  if (!hostCode) throw new Error('请填写主机编码')
  if (!hostName) throw new Error('请填写主机名称')
  const hostType = pickInt(body.hostType, 1)
  if (!HOST_TYPE_LABEL[hostType]) throw new Error('主机类型非法（应为 SFTP / FTP / HTTP）')
  const address = String(body.address || '').trim()
  if (!address) throw new Error('请填写主机地址')
  const port = Number(body.port || 0)
  if (!port || port < 1 || port > 65535) throw new Error('端口必须是 1~65535 之间的整数')
  const authType = pickInt(body.authType, 1)
  if (!AUTH_TYPE_LABEL[authType]) throw new Error('认证方式非法（应为 密码 / 密钥）')
  const secret = body.secretId ? secretOf(body.secretId) : undefined
  if (body.secretId && !secret) throw new Error('密钥不存在：id=' + body.secretId)
  if (authType === 2 && !secret) throw new Error('认证方式选了「密钥」时必须绑定一个密钥')
  const duplicated = serviceHostTable
    .all()
    .some((row) => row.hostCode === hostCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('主机编码已存在：' + hostCode)
  const existing = body.id ? serviceHostTable.get(Number(body.id)) : undefined
  const protocol = String(body.protocol || HOST_TYPE_LABEL[hostType].toLowerCase())
  // 连接参数一改，上一次的检查结论就过期了：留着会让页面显示一个「昨天检查成功」的假结论
  const paramsChanged =
    !!existing &&
    (existing.address !== address ||
      Number(existing.port) !== port ||
      existing.protocol !== protocol ||
      Number(existing.authType) !== authType ||
      Number(existing.secretId) !== (secret ? secret.id : 0))
  return {
    hostCode,
    hostName,
    hostType,
    address,
    port,
    username: String(body.username || ''),
    authType,
    secretId: secret ? secret.id : 0,
    secretName: secret ? secret.secretName : '',
    protocol,
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    lastCheckTime: paramsChanged ? '' : existing?.lastCheckTime || '',
    checkResult: paramsChanged ? '连接参数已变更，结论待重新检查' : existing?.checkResult || '',
    createTime: existing ? existing.createTime : formatDateTime(),
    updateUser: operatorOf(ctx),
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 连接测试：确定性模拟（同一主机每次结论一致；停用主机必失败，用于演示失败分支） */
onPost('/cr/service-host/test', (ctx) => {
  assertAdmin(ctx, '服务主机连接测试')
  const row = serviceHostTable.get(Number(ctx.body?.id))
  if (!row) throw new Error('服务主机不存在：id=' + ctx.body?.id)
  const failed = row.status === 0
  const cost = failed ? 3000 : 40 + ((row.id * 29) % 100)
  const result = failed
    ? '连接失败：主机已停用（未发起真实连接）'
    : '连接成功：' +
      row.protocol +
      ' ' +
      row.address +
      ':' +
      row.port +
      '，账号 ' +
      row.username +
      '，握手 ' +
      cost +
      ' ms' +
      (row.secretName ? '，使用密钥「' + row.secretName + '」' : '')
  const updated = { lastCheckTime: formatDateTime(), checkResult: result, checkCost: cost }
  serviceHostTable.update({ id: row.id, ...updated })
  return { ...updated, hostName: row.hostName }
})

/* ==================================================================
 * 密钥
 * ================================================================== */
registerResource<ServiceSecretRow>({
  prefix: '/cr/service-secret',
  table: serviceSecretTable,
  guard: (ctx, action) => assertAdmin(ctx, '密钥' + action),
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    (params.secretType === undefined ||
      params.secretType === '' ||
      Number(row.secretType) === Number(params.secretType)) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(
      row,
      ['secretCode', 'secretName', 'algorithm', 'fingerprint', 'remark'],
      params.keyword
    ),
  beforeCreate: (body, ctx) => fillSecret(body, ctx),
  beforeUpdate: (body, ctx) => fillSecret(body, ctx),
  // 列表里的「到期」列要有值：口径与 /expiring 一致（同一份 daysUntil）
  toListRow: (row) => ({ ...row, daysLeft: daysUntil(row.effectiveTo) }),
  exportColumns: [
    { field: 'secretCode', label: '密钥编码' },
    { field: 'secretName', label: '密钥名称' },
    {
      field: 'secretType',
      label: '密钥类型',
      formatter: (row) => SECRET_TYPE_LABEL[Number(row.secretType)] || row.secretType
    },
    { field: 'algorithm', label: '算法' },
    { field: 'fingerprint', label: '内容指纹（FNV32，Demo）' },
    { field: 'effectiveFrom', label: '生效日期' },
    { field: 'effectiveTo', label: '到期日期' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    { field: 'rotateCount', label: '轮换次数' },
    { field: 'rotateTime', label: '最近轮换' },
    { field: 'remark', label: '备注' }
  ]
})

function fillSecret(body: any, ctx?: any): Partial<ServiceSecretRow> {
  const secretCode = String(body.secretCode || '').trim()
  const secretName = String(body.secretName || '').trim()
  if (!secretCode) throw new Error('请填写密钥编码')
  if (!secretName) throw new Error('请填写密钥名称')
  const secretType = pickInt(body.secretType, 1)
  if (!SECRET_TYPE_LABEL[secretType])
    throw new Error('密钥类型非法（SSH 密钥 / SFTP 口令 / API 密钥 / 证书）')
  const effectiveFrom = String(body.effectiveFrom || '')
  const effectiveTo = String(body.effectiveTo || '')
  if (!effectiveFrom || !effectiveTo) throw new Error('请填写生效期（起止日期）')
  if (effectiveFrom > effectiveTo) throw new Error('生效期的开始日期不能晚于到期日期')
  const duplicated = serviceSecretTable
    .all()
    .some((row) => row.secretCode === secretCode && row.id !== Number(body.id || 0))
  if (duplicated) throw new Error('密钥编码已存在：' + secretCode)
  const existing = body.id ? secretOf(body.id) : undefined
  return {
    secretCode,
    secretName,
    secretType,
    algorithm: String(body.algorithm || ''),
    // 指纹不让页面随便填：新建按第 1 轮生成，修改保持原指纹
    fingerprint: existing ? existing.fingerprint : fingerprintOf(secretCode, 1),
    effectiveFrom,
    effectiveTo,
    status: Number(body.status === undefined || body.status === '' ? 1 : body.status),
    rotateUser: existing ? existing.rotateUser : operatorOf(ctx),
    rotateTime: existing ? existing.rotateTime : formatDateTime(),
    rotateCount: existing ? existing.rotateCount : 1,
    createTime: existing ? existing.createTime : formatDateTime(),
    updateUser: operatorOf(ctx),
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 密钥留痕：新建 / 修改 / 启用 / 停用 / 轮换 / 删除 都落一条，供「留痕」弹窗查看 */
const recordSecretTrail = (row: ServiceSecretRow, action: string, remark: string) => {
  secretTrailTable.insert({
    secretId: row.id,
    secretCode: row.secretCode,
    action,
    user: row.updateUser || row.rotateUser || '系统管理员',
    time: formatDateTime(),
    fingerprint: row.fingerprint,
    remark
  })
}

/* ------------------------------------------------------------------
 * 覆盖 registerResource 生成的写接口（同路径后注册的生效）：
 * 目的只有一个 —— 让「新建 / 修改 / 启用 / 停用 / 删除」也进留痕表。
 * 之前只有「轮换」有留痕，页面上的「留痕」弹窗看不到密钥是怎么建的、什么时候被停用的。
 * 另外补一条引用检查：被主机绑定的密钥不能直接删（否则主机的 secretId 会变成悬空引用）。
 * ------------------------------------------------------------------ */
onPost('/cr/service-secret/create', (ctx) => {
  assertAdmin(ctx, '密钥新建')
  const created = serviceSecretTable.insert(fillSecret({ ...(ctx.body || {}) }, ctx))
  recordSecretTrail(created, '新建', '新建密钥并登记第 1 轮指纹')
  return created.id
})

onPut('/cr/service-secret/update', (ctx) => {
  assertAdmin(ctx, '密钥修改')
  const body = { ...(ctx.body || {}) }
  if (body.id === undefined || body.id === null) throw new Error('缺少 id')
  const existing = secretOf(body.id)
  if (!existing) throw new Error('记录不存在：id=' + body.id)
  const payload = { ...fillSecret(body, ctx), id: Number(body.id) }
  serviceSecretTable.update(payload)
  const statusChanged = Number(existing.status) !== Number(payload.status)
  const contentChanged =
    existing.secretName !== payload.secretName ||
    existing.algorithm !== payload.algorithm ||
    existing.effectiveFrom !== payload.effectiveFrom ||
    existing.effectiveTo !== payload.effectiveTo ||
    existing.remark !== payload.remark
  if (statusChanged) {
    recordSecretTrail(
      { ...existing, ...payload },
      Number(payload.status) === 1 ? '启用' : '停用',
      '状态由「' +
        (Number(existing.status) === 1 ? '启用' : '停用') +
        '」改为「' +
        (Number(payload.status) === 1 ? '启用' : '停用') +
        '」'
    )
  } else if (contentChanged) {
    recordSecretTrail({ ...existing, ...payload }, '修改', '修改密钥信息（指纹不变）')
  }
  return true
})

onDelete('/cr/service-secret/delete', (ctx) => {
  assertAdmin(ctx, '密钥删除')
  const id = Number(ctx.params.id)
  if (Number.isNaN(id)) throw new Error('缺少 id')
  const row = secretOf(id)
  const used = serviceHostTable.all().filter((host) => Number(host.secretId) === id)
  if (used.length) {
    throw new Error(
      '密钥「' +
        (row?.secretName || id) +
        '」已被 ' +
        used.length +
        ' 台主机使用（如「' +
        used[0].hostName +
        '」），不能删除：请先给这些主机改绑其它密钥或停用主机'
    )
  }
  serviceSecretTable.remove(id)
  if (row) recordSecretTrail(row, '删除', '删除密钥（留痕保留）')
  return true
})

/** 密钥轮换：生成新指纹 + 追加留痕 + 轮换次数 +1（明文永远不落库） */
onPost('/cr/service-secret/rotate', (ctx) => {
  assertAdmin(ctx, '密钥轮换')
  const row = secretOf(ctx.body?.id)
  if (!row) throw new Error('密钥不存在：id=' + ctx.body?.id)
  if (row.status !== 1)
    throw new Error('密钥「' + row.secretName + '」已停用，停用状态不能轮换（请先启用）')
  const nextRound = Number(row.rotateCount || 0) + 1
  const fingerprint = fingerprintOf(row.secretCode, nextRound)
  const time = formatDateTime()
  const remark = String(ctx.body?.remark || '手动轮换')
  const operator = operatorOf(ctx)
  serviceSecretTable.update({
    id: row.id,
    fingerprint,
    rotateCount: nextRound,
    rotateUser: operator,
    rotateTime: time,
    updateUser: operator,
    updateTime: time
  })
  secretTrailTable.insert({
    secretId: row.id,
    secretCode: row.secretCode,
    action: '轮换',
    user: operator,
    time,
    fingerprint,
    remark
  })
  return {
    id: row.id,
    fingerprint,
    rotateCount: nextRound,
    rotateTime: time,
    oldFingerprint: row.fingerprint
  }
})

/** 密钥留痕（只读） */
onGet('/cr/service-secret/trail', (ctx) => {
  const secretId = Number(ctx.params.secretId || 0)
  return (
    secretTrailTable
      .all()
      .filter((row) => !secretId || Number(row.secretId) === secretId)
      // 时间倒序；同一秒的两条按 id 倒序，保证顺序稳定（比较器相等时必须返回 0）
      .sort((a, b) => (a.time === b.time ? b.id - a.id : a.time < b.time ? 1 : -1))
  )
})

/**
 * 即将过期（只读）：按系统当天算剩余天数，默认 90 天内。
 * 已过期的也要列出来 —— "过期了但页面看不到"是这类管理最容易踩的坑。
 */
onGet('/cr/service-secret/expiring', (ctx) => {
  const rawWithin = ctx.params.withinDays
  const within = rawWithin === undefined || rawWithin === '' ? 90 : Number(rawWithin)
  return serviceSecretTable
    .all()
    .map((row) => ({ ...row, daysLeft: daysUntil(row.effectiveTo) }))
    .filter((row) => row.daysLeft <= within)
    .sort((a, b) => a.daysLeft - b.daysLeft)
})

/** 口径与下拉（页面直接用，不写第二份中文名） */
onGet('/cr/service-common/meta', () => ({
  hostTypes: Object.keys(HOST_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: HOST_TYPE_LABEL[Number(key)]
  })),
  authTypes: Object.keys(AUTH_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: AUTH_TYPE_LABEL[Number(key)]
  })),
  secretTypes: Object.keys(SECRET_TYPE_LABEL).map((key) => ({
    value: Number(key),
    label: SECRET_TYPE_LABEL[Number(key)]
  }))
}))

/** 密钥下拉（主机表单绑定用） */
onGet('/cr/service-secret/simple-list-all', () =>
  serviceSecretTable.all().map((row) => ({
    id: row.id,
    name: row.secretName,
    secretCode: row.secretCode,
    status: row.status,
    secretType: row.secretType
  }))
)
