// 接口层鉴权门禁：写接口不能只靠"页面上没有按钮"
// 背景：第三轮独立对抗式审核发现脱敏的 /run、/approve、/reject 零鉴权，填报岗与匿名请求都能直接放行并改写数据。
// 本脚本用"冒充别人"的方式逐个探写接口：非管理员必须被中文原因拒绝，管理员必须能用，只读接口不能被误伤。
//
// 依赖：本机无头浏览器（CHROME_BIN 可覆盖）+ 已启动的 dev server（APP_URL，默认 http://localhost:5173）
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveChrome } from './chrome.mjs'

const CHROME = resolveChrome()
const PORT = Number(process.env.CDP_PORT || 9339)
const BASE = process.env.APP_URL || 'http://localhost:5173'
const profile = mkdtempSync(join(tmpdir(), 'cdp-auth-'))
const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank'
  ],
  { stdio: 'ignore' }
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
let msgId = 0
const pending = new Map()
const logs = []

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++msgId
    pending.set(id, { res, rej })
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        rej(new Error('CDP 超时 ' + method))
      }
    }, 30000)
  })

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true
  })
  if (r.exceptionDetails) {
    return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text }
  }
  return r.result?.value
}

const waitFor = async (fn, timeout = 20000, label = '') => {
  const t = Date.now()
  while (Date.now() - t < timeout) {
    try {
      const v = await fn()
      if (v) return v
    } catch {}
    await sleep(250)
  }
  throw new Error('waitFor 超时 ' + label)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`)
}

// 各角色的 mock 令牌（与 src/mock/handlers/auth.ts 的 mock-token.<userId>.x 约定一致）
const ROLES = {
  admin: { label: '系统管理员', token: 'Bearer mock-token.1.x' },
  filler: { label: '报送填报岗', token: 'Bearer mock-token.2.x' },
  // 注意 token 里的数字是 user.id，不是 role.id：3=李复华(复核岗)、4=王审核(审核岗)
  reviewer: { label: '报送复核岗', token: 'Bearer mock-token.3.x' },
  auditor: { label: '报送审核岗', token: 'Bearer mock-token.4.x' },
  anon: { label: '未登录', token: '' }
}

/** 一个探针：返回 { ok, msg }；ok=true 表示接口放行了 */
const PROBE = `(async (url, method, data, token) => {
  const m = (await import('/src/config/axios/index.ts')).default
  const headers = token ? { isToken: false, Authorization: token } : { isToken: false }
  try {
    const r = method === 'get'
      ? await m.get({ url, params: data, headers })
      : await m[method]({ url, data, headers })
    return { ok: true, msg: '' }
  } catch (e) {
    return { ok: false, msg: String((window.__lastMockError || '')) }
  }
})`

// 被拒绝时 axios 只 reject 一个字符串（脚手架拦截器把中文原因交给全局提示），
// 所以直接读用户能看到的那条提示 —— 这也正是要验的东西：拒绝原因得是人话。
// 每次探针前先把旧提示关干净，避免读到上一条接口的文案。
const clearNotes = async () => {
  await evaluate(
    `(document.querySelectorAll('.el-notification__closeBtn') || []).forEach(b => b.click()); 'ok'`
  )
  for (let i = 0; i < 10; i++) {
    const left = await evaluate(`document.querySelectorAll('.el-notification').length`)
    if (!left) return
    await sleep(150)
  }
}
const firstNote = () =>
  evaluate(`((document.querySelector('.el-notification__title') || {}).innerText || '').trim()`)

const probeAs = async (role, url, method, data = {}) => {
  await clearNotes()

  const r = await evaluate(
    `${PROBE}(${JSON.stringify(url)}, ${JSON.stringify(method)}, ${JSON.stringify(data)}, ${JSON.stringify(ROLES[role].token)})`
  )
  let msg = ''
  for (let i = 0; i < 15 && !msg; i++) {
    await sleep(150)
    msg = String((await firstNote()) || '')
  }
  return { ok: !!r?.ok, msg }
}

// 写接口清单：[方法, 路径, 说明, 允许的角色]
// 维护约定：脱敏 / 拆分 / 填报域每新增一个写接口，必须补进这张表 ——
// 只加 assertRoles 而不进清单，下一次"漏一个 toggle"还是没人发现（复验时就漏过两个 toggle）
const ALL_LOGIN = ['admin', 'filler', 'reviewer', 'auditor']
const WRITES = [
  ['post', '/cr/desens-execute/apply', '提交脱敏执行申请', ['admin']],
  ['post', '/cr/desens-execute/run', '直接执行脱敏', ['admin']],
  ['post', '/cr/desens-execute/approve', '脱敏申请审核', ['admin', 'auditor']],
  ['post', '/cr/desens-execute/reject', '脱敏申请审核', ['admin', 'auditor']],
  ['post', '/cr/desens-execute/restore', '还原脱敏批次', ['admin']],
  // 监管码值配置章节的四张表（码值字典维护 / 码值管理 / 本地字典 / 本地枚举）：写操作仅系统管理员
  ['post', '/cr/reg-dict/create', '监管字典新建', ['admin']],
  ['put', '/cr/reg-dict/update', '监管字典修改', ['admin']],
  ['delete', '/cr/reg-dict/delete?id=999999', '监管字典删除', ['admin']],
  ['delete', '/cr/reg-dict/delete-list?ids=999998,999999', '监管字典批量删除', ['admin']],
  ['post', '/cr/reg-code/create', '监管码值新建', ['admin']],
  ['put', '/cr/reg-code/update', '监管码值修改', ['admin']],
  ['delete', '/cr/reg-code/delete?id=999999', '监管码值删除', ['admin']],
  ['delete', '/cr/reg-code/delete-list?ids=999998,999999', '监管码值批量删除', ['admin']],
  ['post', '/cr/local-dict/create', '本地字典新建', ['admin']],
  ['put', '/cr/local-dict/update', '本地字典修改', ['admin']],
  ['delete', '/cr/local-dict/delete?id=999999', '本地字典删除', ['admin']],
  ['delete', '/cr/local-dict/delete-list?ids=999998,999999', '本地字典批量删除', ['admin']],
  ['post', '/cr/local-code/create', '本地枚举新建', ['admin']],
  ['put', '/cr/local-code/update', '本地枚举修改', ['admin']],
  ['delete', '/cr/local-code/delete?id=999999', '本地枚举删除', ['admin']],
  ['delete', '/cr/local-code/delete-list?ids=999998,999999', '本地枚举批量删除', ['admin']],
  ['put', '/cr/desens-rule/toggle', '脱敏规则启停', ['admin']],
  ['post', '/cr/desens-rule/create', '脱敏规则新建', ['admin']],
  ['put', '/cr/desens-rule/update', '脱敏规则修改', ['admin']],
  ['delete', '/cr/desens-rule/delete?id=999999', '脱敏规则删除', ['admin']],
  ['delete', '/cr/desens-rule/delete-list?ids=999998,999999', '脱敏规则批量删除', ['admin']],
  ['put', '/cr/desens-field/toggle', '脱敏字段配置启停', ['admin']],
  ['post', '/cr/desens-field/create', '脱敏字段配置新建', ['admin']],
  ['put', '/cr/desens-field/update', '脱敏字段配置修改', ['admin']],
  ['delete', '/cr/desens-field/delete?id=999999', '脱敏字段配置删除', ['admin']],
  ['post', '/cr/desens-task/create', '脱敏批次新建', ['admin']],
  ['delete', '/cr/desens-task/delete?id=999999', '脱敏批次删除', ['admin']],
  ['put', '/cr/split-rule/toggle', '拆分规则启停', ['admin']],
  ['post', '/cr/split-rule/create', '拆分规则新建', ['admin']],
  ['put', '/cr/split-rule/update', '拆分规则修改', ['admin']],
  ['delete', '/cr/split-rule/delete?id=999999', '拆分规则删除', ['admin']],
  ['delete', '/cr/split-rule/delete-list?ids=999998,999999', '拆分规则批量删除', ['admin']],
  ['post', '/cr/split-execute/precheck', '拆分预检', ['admin']],
  ['post', '/cr/split-execute/run', '执行拆分', ['admin']],
  ['post', '/cr/split-task/create', '拆分批次新建', ['admin']],
  ['delete', '/cr/split-task/delete?id=999999', '拆分批次删除', ['admin']],
  ['delete', '/cr/desens-field/delete-list?ids=999998,999999', '脱敏字段配置批量删除', ['admin']],
  ['delete', '/cr/desens-task/delete-list?ids=999998,999999', '脱敏批次批量删除', ['admin']],
  ['put', '/cr/desens-task/update', '脱敏批次修改', ['admin']],
  ['post', '/cr/desens-execute/withdraw', '撤回脱敏申请', ['admin']],
  ['delete', '/cr/audit-desensitize/delete-list?ids=999998,999999', '对照表批量删除', []],
  ['put', '/cr/split-task/update', '拆分批次修改', ['admin']],
  ['delete', '/cr/split-task/delete-list?ids=999998,999999', '拆分批次批量删除', ['admin']],
  // 填报数据本体：只要求登录（机构数据范围不在本轮口径内），未登录必须被拒
  ['put', '/cr/data-fill/save', '保存填报数据', ALL_LOGIN],
  ['put', '/cr/data-fill/restore', '填报数据恢复', ALL_LOGIN],
  // 这两个看着像"查询"，其实会写填报记录的校验状态 + 追加修改历史（门禁的行数快照就是这么抓出来的）
  ['post', '/cr/data-fill/check', '填报数据校验', ALL_LOGIN],
  ['put', '/cr/data-fill/calculate', '填报数据计算', ALL_LOGIN],

  // ===== 监管码值配置：本地标准映射 =====
  ['post', '/cr/local-map/create', '本地映射新增', ['admin']],
  ['put', '/cr/local-map/update', '本地映射修改', ['admin']],
  ['delete', '/cr/local-map/delete?id=999999', '本地映射删除', ['admin']],
  ['delete', '/cr/local-map/delete-list?ids=999998,999999', '本地映射批量删除', ['admin']],

  // ===== 权限审批管理：数据权限 / 部门权限配置 =====
  ['post', '/cr/data-scope/create', '数据权限新增', ['admin']],
  ['put', '/cr/data-scope/update', '数据权限修改', ['admin']],
  ['delete', '/cr/data-scope/delete?id=999999', '数据权限删除', ['admin']],
  ['delete', '/cr/data-scope/delete-list?ids=999998,999999', '数据权限批量删除', ['admin']],
  ['post', '/cr/dept-scope/create', '部门权限新增', ['admin']],
  ['put', '/cr/dept-scope/update', '部门权限修改', ['admin']],
  ['delete', '/cr/dept-scope/delete?id=999999', '部门权限删除', ['admin']],
  ['delete', '/cr/dept-scope/delete-list?ids=999998,999999', '部门权限批量删除', ['admin']],

  // ===== 报表功能：数据源 / 数据集 / 报表维护 =====
  ['post', '/cr/report-datasource/create', '数据源新增', ['admin']],
  ['put', '/cr/report-datasource/update', '数据源修改', ['admin']],
  ['delete', '/cr/report-datasource/delete?id=999999', '数据源删除', ['admin']],
  ['delete', '/cr/report-datasource/delete-list?ids=999998,999999', '数据源批量删除', ['admin']],
  // 连接测试会把最近测试结论写回数据源行 —— 是写接口，不是查询
  ['post', '/cr/report-datasource/test', '数据源连接测试', ['admin']],
  ['post', '/cr/report-dataset/create', '数据集新增', ['admin']],
  ['put', '/cr/report-dataset/update', '数据集修改', ['admin']],
  ['delete', '/cr/report-dataset/delete?id=999999', '数据集删除', ['admin']],
  ['delete', '/cr/report-dataset/delete-list?ids=999998,999999', '数据集批量删除', ['admin']],
  ['post', '/cr/report-design/create', '报表新增', ['admin']],
  ['put', '/cr/report-design/update', '报表修改', ['admin']],
  ['delete', '/cr/report-design/delete?id=999999', '报表删除', ['admin']],
  ['delete', '/cr/report-design/delete-list?ids=999998,999999', '报表批量删除', ['admin']],

  // ===== 系统集成：接入系统 / 接入权限 / 接入附件 =====
  ['post', '/cr/integration-system/create', '接入系统新增', ['admin']],
  ['put', '/cr/integration-system/update', '接入系统修改', ['admin']],
  ['delete', '/cr/integration-system/delete?id=999999', '接入系统删除', ['admin']],
  ['delete', '/cr/integration-system/delete-list?ids=999998,999999', '接入系统批量删除', ['admin']],
  // 心跳检测会写回最近心跳结论
  ['post', '/cr/integration-system/heartbeat', '接入系统心跳检测', ['admin']],
  ['post', '/cr/integration-auth/create', '接入权限新增', ['admin']],
  ['put', '/cr/integration-auth/update', '接入权限修改', ['admin']],
  ['delete', '/cr/integration-auth/delete?id=999999', '接入权限删除', ['admin']],
  ['delete', '/cr/integration-auth/delete-list?ids=999998,999999', '接入权限批量删除', ['admin']],
  ['post', '/cr/integration-attachment/create', '接入附件登记', ['admin']],
  ['put', '/cr/integration-attachment/update', '接入附件修改', ['admin']],
  ['post', '/cr/integration-attachment/upload', '接入附件接收', ['admin']],
  ['post', '/cr/integration-attachment/recheck', '接入附件重新校验', ['admin']],
  ['delete', '/cr/integration-attachment/delete?id=999999', '接入附件删除', ['admin']],
  [
    'delete',
    '/cr/integration-attachment/delete-list?ids=999998,999999',
    '接入附件批量删除',
    ['admin']
  ],

  // ===== 服务管理：主机 / 密钥 =====
  ['post', '/cr/service-host/create', '服务主机新增', ['admin']],
  ['put', '/cr/service-host/update', '服务主机修改', ['admin']],
  ['delete', '/cr/service-host/delete?id=999999', '服务主机删除', ['admin']],
  ['delete', '/cr/service-host/delete-list?ids=999998,999999', '服务主机批量删除', ['admin']],
  // 连接测试会写回最近检查结论与耗时
  ['post', '/cr/service-host/test', '服务主机连接测试', ['admin']],
  ['post', '/cr/service-secret/create', '密钥新增', ['admin']],
  ['put', '/cr/service-secret/update', '密钥修改', ['admin']],
  ['delete', '/cr/service-secret/delete?id=999999', '密钥删除', ['admin']],
  ['delete', '/cr/service-secret/delete-list?ids=999998,999999', '密钥批量删除', ['admin']],
  // 轮换会改指纹、加轮换次数并追加留痕
  ['post', '/cr/service-secret/rotate', '密钥轮换', ['admin']],

  // ===== 自动提醒：规则 / 记录 =====
  ['post', '/cr/remind-rule/create', '提醒规则新增', ['admin']],
  ['put', '/cr/remind-rule/update', '提醒规则修改', ['admin']],
  ['delete', '/cr/remind-rule/delete?id=999999', '提醒规则删除', ['admin']],
  ['delete', '/cr/remind-rule/delete-list?ids=999998,999999', '提醒规则批量删除', ['admin']],
  // 立即执行会把扫出来的提醒落成记录
  ['post', '/cr/remind-rule/run', '提醒规则立即执行', ['admin']],
  ['post', '/cr/remind-log/create', '提醒记录新增', ['admin']],
  ['put', '/cr/remind-log/update', '提醒记录修改', ['admin']],
  ['delete', '/cr/remind-log/delete?id=999999', '提醒记录删除', ['admin']],
  ['delete', '/cr/remind-log/delete-list?ids=999998,999999', '提醒记录批量删除', ['admin']],
  ['post', '/cr/remind-log/read', '提醒记录标记已读', ['admin']],
  ['post', '/cr/remind-log/resend', '提醒记录重发', ['admin']],

  // ===== 任务调度（自动采集）：任务维护 / 批量监控 / 调度配置 / 手工调度 / 集群配置 =====
  ['post', '/cr/collect-task/create', '采集任务新建', ['admin']],
  ['put', '/cr/collect-task/update', '采集任务修改', ['admin']],
  ['delete', '/cr/collect-task/delete?id=999999', '采集任务删除', ['admin']],
  ['delete', '/cr/collect-task/delete-list?ids=999998,999999', '采集任务批量删除', ['admin']],
  // 配置前置任务会改依赖关系，和改任务同级别
  ['put', '/cr/collect-task/update-pre-tasks', '配置前置任务', ['admin']],
  // 「立即执行」会真写一条跑批日志（第三轮审核的教训：看着像操作、实际落库的都要当写接口）
  ['post', '/cr/collect-task-log/run', '跑批任务立即执行', ['admin']],
  ['post', '/cr/schedule/create', '调度配置新建', ['admin']],
  ['put', '/cr/schedule/update', '调度配置修改', ['admin']],
  ['delete', '/cr/schedule/delete?id=999999', '调度配置删除', ['admin']],
  ['delete', '/cr/schedule/delete-list?ids=999998,999999', '调度配置批量删除', ['admin']],
  ['post', '/cr/schedule/toggle', '调度启停', ['admin']],
  // 手工调度按"分组 × 期次"批量生成跑批记录，是本域最大的写操作
  ['post', '/cr/schedule/manual-run', '手工调度批量执行', ['admin']],
  ['post', '/cr/cluster/create', '集群节点新增', ['admin']],
  ['put', '/cr/cluster/update', '集群节点修改', ['admin']],
  ['delete', '/cr/cluster/delete?id=999999', '集群节点删除', ['admin']],
  ['delete', '/cr/cluster/delete-list?ids=999998,999999', '集群节点批量删除', ['admin']],

  // ===== 报文配置 · 公式SQL定制 =====
  ['post', '/cr/message-formula/create', '公式新建', ['admin']],
  ['put', '/cr/message-formula/update', '公式修改', ['admin']],
  ['delete', '/cr/message-formula/delete?id=999999', '公式删除', ['admin']],
  ['delete', '/cr/message-formula/delete-list?ids=999998,999999', '公式批量删除', ['admin']]
]

// "看起来像写、其实只算数"的接口：必须不落任何一行数据（不然就是绕过写接口的后门）
// 用整库行数快照比对，任何一张表多/少一行都算失败
const COMPUTE = [
  ['post', '/cr/desens-execute/precheck', { orgId: 11, reportId: 1, period: '202608' }, '脱敏预检'],
  [
    'post',
    '/cr/desens-field/check-condition',
    { orgId: 11, reportId: 1, period: '202608', condition: '销售渠道 = 银保' },
    '条件试算'
  ],
  ['post', '/cr/split-execute/precheck', { orgId: 11, reportId: 11, period: '202608' }, '拆分预检'],
  ['post', '/cr/desens-execute/recheck', { id: 1 }, '放行前复算'],
  // 报表功能的两个"预览"也是只读计算：POST 只是因为要传对象，不能落任何数据
  ['post', '/cr/report-dataset/preview', { id: 1, limit: 5 }, '数据集预览'],
  ['post', '/cr/report-design/preview', { id: 2 }, '报表预览'],
  // 公式「试运行」只做静态解析（连 SQL 都不执行），必须一行都不写
  ['post', '/cr/message-formula/try-run', { id: 1 }, '公式试运行（只解析不执行）']
]

// 只读接口：审核岗必须能用（锁写操作时别把审核岗关在门外）
const READS = [
  ['/cr/desens-task/page', { pageNo: 1, pageSize: 5 }, '审批列表'],
  ['/cr/desens-task/approval-stats', {}, '待审统计'],
  ['/cr/audit-desensitize/page', { pageNo: 1, pageSize: 5 }, '脱敏结果查询'],
  // 跑批结果是"谁都能看"的只读数据：菜单只发给管理员，但接口不锁角色，审核岗查得到
  ['/cr/collect-task-log/page', { pageNo: 1, pageSize: 5 }, '批量监控列表']
]

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok)
  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  ).json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
      return
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      if (text) logs.push(text)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: BASE + '/index' })
  await waitFor(
    async () => await evaluate(`!!localStorage.getItem('cr-mock:table:system.role')`),
    25000,
    'seed'
  )

  // 预热：第一条请求要等 Vite 现场编译一堆模块，提示可能晚于探针窗口落地
  await evaluate(
    `${PROBE}('/cr/desens-task/page', 'get', { pageNo: 1, pageSize: 1 }, 'Bearer mock-token.1.x')`
  )
  await sleep(800)
  await clearNotes()

  // 身份自证（放在预热之后：第一条请求要等模块编译，否则会把所有人误判成未登录）：先确认每个令牌真的代表它声称的那个人，再拿它去探权限
  // （复验时曾把 header 写成字符串 → axios 忽略它、回落到已登录的 admin，差点把"未登录放行"误报成漏洞）
  const identity = async (role) => {
    const r = await evaluate(`(async () => {
      const m = (await import('/src/config/axios/index.ts')).default
      const token = ${JSON.stringify(ROLES[role].token)}
      const headers = token ? { isToken: false, Authorization: token } : { isToken: false }
      try {
        const info = await m.get({ url: '/system/auth/get-permission-info', headers })
        return { ok: true, name: (info.user && info.user.nickname) || '', roles: (info.roles || []).map(r => r.code).join(',') }
      } catch (e) { return { ok: false, name: '（未登录）', roles: '' } }
    })()`)
    return r || { ok: false, name: '?', roles: '' }
  }
  const EXPECT = {
    admin: '系统管理员',
    filler: '张天报',
    reviewer: '李复华',
    auditor: '王审核',
    anon: '（未登录）'
  }
  for (const role of Object.keys(ROLES)) {
    const info = await identity(role)
    check(
      `身份自证 ${ROLES[role].label}`,
      info.name === EXPECT[role],
      `实测：${info.name} / ${info.roles}`
    )
  }

  // 撤回接口要求"申请人本人或管理员"，得拿一条真实申请单去探（否则先报"申请不存在"就看不出版权判定）
  const pendingId = await evaluate(`(async () => {
    const m = (await import('/src/config/axios/index.ts')).default
    const headers = { isToken: false, Authorization: 'Bearer mock-token.1.x' }
    const page = await m.get({ url: '/cr/desens-task/page', params: { pageNo: 1, pageSize: 1, status: 6 }, headers })
    return (page.list && page.list[0] && page.list[0].id) || 0
  })()`)

  // ① 非管理员：所有写接口都必须被拒
  for (const [method, url, action, allowed] of WRITES) {
    const offenders = ['filler', 'reviewer', 'auditor', 'anon'].filter((r) => !allowed.includes(r))
    const leaks = []
    for (const role of offenders) {
      const data = url.indexOf('withdraw') >= 0 ? { id: pendingId } : {}
      const r = await probeAs(role, url, method, data)
      // 允许"被拒"的两种表现：权限文案，或非权限类的业务报错（说明角色检查已放行，但该角色本不该放行）
      // 需要登录 / 需要先登录 都算权限文案：guards.ts 的 assertLogin 用的是「需要登录后操作」，
      // 以前正则里只有「需要先登录」，会把它误判成「没给出中文原因」的漏洞（门禁盲点）。
      const denied =
        !r.ok && /可操作|需要先登录|需要登录|登录已过期|只有申请人本人|对照表由/.test(r.msg)
      if (!denied)
        leaks.push(`${ROLES[role].label}${r.ok ? '放行' : '报错=' + (r.msg || '无中文原因')}`)
    }
    check(`写接口拦截 ${action}（${url.split('?')[0]}）`, leaks.length === 0, leaks.join(' | '))
  }

  // ② 管理员：同一个接口不能被拦（用"不存在的 id"探针，看到的是业务报错而不是权限报错）
  for (const [method, url, action] of WRITES) {
    const data = url.indexOf('withdraw') >= 0 ? { id: pendingId } : {}
    const r = await probeAs('admin', url, method, data)
    const blocked = !r.ok && /可操作|只有申请人本人/.test(r.msg)
    check(`管理员可用 ${action}`, !blocked, blocked ? r.msg : '')
  }

  // ②b 只算数不落库：整库行数快照必须一模一样
  const snapshot = () =>
    evaluate(
      `(() => { const out = {}; Object.keys(localStorage).filter((k) => k.startsWith('cr-mock:table:')).forEach((k) => { try { const v = JSON.parse(localStorage.getItem(k)); out[k] = Array.isArray(v) ? v.length : 0 } catch (e) { out[k] = -1 } }); return out })()`
    )
  for (const [method, url, data, label] of COMPUTE) {
    const before = await snapshot()
    const r = await probeAs('auditor', url, method, data)
    const after = await snapshot()
    const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k])
    check(
      `只算数不落库 ${label}`,
      changed.length === 0,
      (r.ok ? '' : '调用报错=' + r.msg + ' ') + '行数变化：' + changed.join(',')
    )
  }

  // ③ 脱敏对照表：连管理员也不许手工增删改（审计证据）
  for (const [method, url] of [
    ['post', '/cr/audit-desensitize/create'],
    ['put', '/cr/audit-desensitize/update'],
    ['delete', '/cr/audit-desensitize/delete?id=1']
  ]) {
    const r = await probeAs('admin', url, method, { id: 1 })
    check(`对照表不可手工写 ${url.split('?')[0]}`, !r.ok && /对照表/.test(r.msg), r.msg)
  }

  // 管理员写探针会往库里塞脏行（比如没有 startTime 的批次），
  // 只读检查前清一次本地库重新播种，避免拿探针留下的垃圾数据去验列表
  await evaluate(`localStorage.clear(); location.reload(); 'cleared'`)
  await waitFor(
    async () => await evaluate(`!!localStorage.getItem('cr-mock:table:system.role')`),
    25000,
    'reseed'
  )

  // ④ 只读接口对审核岗开放
  for (const [url, params, label] of READS) {
    const r = await probeAs('auditor', url, 'get', params)
    check(`审核岗可读 ${label}`, !!r.ok, r.msg)
  }

  // ⑤ 管理员走一遍真实写链路：建临时拆分规则 → 启停 → 删除
  const created = await evaluate(
    `${PROBE}('/cr/split-rule/create', 'post', { ruleName: '鉴权门禁临时规则', orgId: 11, reportId: 11, mode: 1, rowsPerPackage: 20, pkgPrefix: 'AUTHCHK' }, 'Bearer mock-token.1.x')`
  )
  const createdId = await evaluate(
    `(async () => { const m = (await import('/src/config/axios/index.ts')).default; const headers = { isToken: false, Authorization: 'Bearer mock-token.1.x' }; const id = await m.post({ url: '/cr/split-rule/create', data: { ruleName: '鉴权门禁临时规则', orgId: 11, reportId: 11, mode: 1, rowsPerPackage: 20, pkgPrefix: 'AUTHCHK' }, headers }); const t = await m.put({ url: '/cr/split-rule/toggle', data: { id }, headers }); await m.delete({ url: '/cr/split-rule/delete?id=' + id, headers }); return { id, tip: t.tip } })()`
  )
  check(
    '管理员建/启停/删临时拆分规则',
    !!createdId?.id && /停用|启用/.test(String(createdId?.tip || '')),
    JSON.stringify(createdId)
  )

  const errors = logs.filter(
    (l) => !/favicon|可操作|对照表|不存在|缺少|Mock/.test(l) && /\[exception\]|Uncaught/.test(l)
  )
  check('无 JS 异常', errors.length === 0, errors.slice(0, 2).join(' | '))
} catch (error) {
  check('执行过程', false, error.message)
} finally {
  try {
    ws?.close()
  } catch {}
  chrome.kill('SIGKILL')
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
  const failed = results.filter((r) => !r.ok)
  console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`)
  process.exit(failed.length ? 1 : 0)
}
