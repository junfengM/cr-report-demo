// 依赖：本机无头浏览器（CHROME_BIN 可覆盖）+ 已启动的 dev server（APP_URL，默认 http://localhost:5173）
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveChrome } from './chrome.mjs'

// 用 CDP 驱动无头 Chrome 做端到端验证（无需 playwright/puppeteer 依赖）

const CHROME = resolveChrome()
const PORT = 9333
const BASE = process.env.APP_URL || 'http://localhost:5173'

// 报送业务的 9 个一级目录。登录后要等它们**全部渲染出来**再取菜单快照：
// 侧边栏是登录后动态挂载的，菜单里新增页面会让挂载变长；只等 .v-layout 出现就取样，
// 会拿到「渲染到一半」的快照，把还没画出来的目录误报成「目录缺失」（2026-09-13 补页面后踩到）。
const CR_DIRS = [
  '报表任务管理',
  '报表数据处理',
  '数据查询',
  '数据检核管理',
  '一键报送',
  '数据审核',
  '报送配置管理',
  '报文配置',
  '数据采集'
]

const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--disable-dev-shm-usage',
    // 窗口不能太窄：布局在窄屏会把侧边栏折叠，折叠态下目录标题只渲染图标、innerText 为空，
    // 「9 个业务目录都在侧边栏」这条断言会变成看运气（此前是恰好采到了折叠前那一帧才通过）。
    // eval.mjs 早就带了这个参数，这里补齐成同一口径。
    '--window-size=1440,1200',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank'
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const waitFor = async (fn, timeout = 20000, interval = 250) => {
  const start = Date.now()
  let last
  while (Date.now() - start < timeout) {
    try {
      last = await fn()
      if (last) return last
    } catch (e) {
      last = e.message
    }
    await sleep(interval)
  }
  throw new Error(`waitFor 超时，最后结果：${JSON.stringify(last)}`)
}

let ws
let msgId = 0
const pending = new Map()
const consoleLogs = []

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP 超时: ${method}`))
      }
    }, 30000)
  })

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (res.exceptionDetails) {
    throw new Error(
      `页面执行异常: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`
    )
  }
  return res.result?.value
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  // 1. 等待 devtools 就绪
  const version = await waitFor(async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    return r.ok ? r.json() : null
  })
  console.log(`Chrome: ${version['Browser']}`)

  // 2. 新建标签页
  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  ).json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      consoleLogs.push(`[${msg.params.type}] ${text}`)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleLogs.push(
        `[exception] ${msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text}`
      )
    }
  }

  await send('Page.enable')
  await send('Runtime.enable')

  // 3. 打开应用
  await send('Page.navigate', { url: `${BASE}/` })
  await waitFor(() =>
    evaluate(`!!document.querySelector('#app') && document.querySelectorAll('input').length > 0`)
  )
  await sleep(1200)

  const loginInfo = await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input')]
    return {
      url: location.href,
      title: document.title,
      inputCount: inputs.length,
      hasPassword: inputs.some(i => i.type === 'password'),
      text: document.body.innerText.slice(0, 300)
    }
  })()`)
  check('登录页渲染', loginInfo.hasPassword, `url=${loginInfo.url}`)
  check('站点标题已替换', loginInfo.title.startsWith('统一监管报送平台'), loginInfo.title)

  // 4. 执行登录
  const doLogin = async (username) => {
    await evaluate(`(() => {
      const setVal = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const inputs = [...document.querySelectorAll('input')]
      const pwd = inputs.find(i => i.type === 'password')
      const user = inputs.find(i => (i.type === 'text' || i.type === '') && i.offsetParent !== null)
      setVal(user, ${JSON.stringify(username)})
      setVal(pwd, 'admin123')
      const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('登录'))
      if (!btn) throw new Error('找不到登录按钮')
      btn.click()
      return true
    })()`)
    // 等待进入系统
    return waitFor(async () => {
      const s = await evaluate(`(() => {
          const menu = [...document.querySelectorAll('.el-menu .el-sub-menu__title, .el-menu .el-menu-item')]
            .map(el => el.innerText.trim()).filter(Boolean)
          const errorMsg = [...document.querySelectorAll('.el-notification__content, .el-message__content')]
            .map(el => el.innerText.trim())
          return { path: location.pathname, menu, errorMsg, loggedIn: !!document.querySelector('.v-layout') }
        })()`)
      return s.loggedIn ? s : null
    }, 25000)
  }

  const afterLogin = await doLogin('admin')
  check('管理员登录成功', afterLogin.loggedIn, `path=${afterLogin.path}`)
  check(
    '侧边栏含新统信报送菜单',
    afterLogin.menu.includes('新统信报送') &&
      afterLogin.menu.includes('报表任务管理') &&
      afterLogin.menu.includes('任务模板'),
    `菜单=${afterLogin.menu.slice(0, 16).join(' / ')}`
  )
  check(
    '侧边栏含系统管理',
    afterLogin.menu.some((m) => m.includes('系统管理')),
    ''
  )
  // 全部页面均已交付：断言 9 个报送业务一级目录都在侧边栏里（清单见文件头 CR_DIRS）
  // 侧边栏是登录后逐层挂载的：登录一返回就取快照会拿到「渲染到一半」的菜单（本轮补页面后踩到），
  // 这里再等一次，等目录齐了或超时（超时也继续，让下面的断言把实际缺的目录打出来）
  let menuNow = afterLogin.menu
  try {
    const settled = await waitFor(async () => {
      const s = await evaluate(`(() => {
        const menu = [...document.querySelectorAll('.el-menu .el-sub-menu__title, .el-menu .el-menu-item')]
          .map(el => el.innerText.trim()).filter(Boolean)
        return { menu }
      })()`)
      return CR_DIRS.every((d) => s.menu.includes(d)) ? s : null
    }, 10000)
    menuNow = settled.menu
  } catch {
    // 菜单确实缺目录：保留登录时的快照，下面的断言会报出缺了哪一个
  }
  const missingDir = CR_DIRS.filter((n) => !menuNow.includes(n))
  check('9 个报送业务目录全部下发', missingDir.length === 0, missingDir.join('、') || '全部就位')

  // 5. 点击侧边栏进入 "任务模板" 页面，验证动态路由 + mock 数据
  const clickedLeaf = await evaluate(`(() => {
    const item = [...document.querySelectorAll('.el-menu .el-menu-item')]
      .find(el => el.innerText.trim() === '任务模板')
    if (!item) return false
    item.click()
    return true
  })()`)
  check('侧边栏可点进“任务模板”', clickedLeaf === true, '')
  // 先等路由真正切过去，再等表格出数据
  // （首页工作台也有表格，不能只看"有没有表格"）
  await waitFor(() => evaluate(`location.pathname === '/new-unified/cr-task/template'`), 15000, 'route-change')
  await waitFor(async () => {
    const n = await evaluate(
      `[...document.querySelectorAll('.el-table__body tbody tr')].filter(r => /RW/.test(r.innerText)).length`
    )
    return n > 0 ? n : null
  })
  const pageState = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
    return {
      url: location.href,
      rowCount: rows.length,
      firstRow: rows[0] ? rows[0].innerText.replace(/\\n/g, ' | ') : '',
      pagination: document.querySelector('.el-pagination')?.innerText.replace(/\\n/g,' ') || ''
    }
  })()`)
  check(
    '任务模板列表加载 mock 数据',
    pageState.rowCount > 0,
    `${pageState.rowCount} 行｜${pageState.firstRow.slice(0, 90)}`
  )

  // 6. 验证"添加报表"弹窗（频度一致性约束）
  const selectedCount = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')].filter(b => /添加报表/.test(b.innerText) && b.offsetParent !== null)
    if (!btns.length) return 'no-button'
    btns[0].click()
    return 'clicked:' + btns.length
  })()`)
  await sleep(1500)
  const dialogState = await evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return { open: false }
    const rows = [...dlg.querySelectorAll('.el-table__body tbody tr')]
    return { open: true, title: dlg.querySelector('.el-dialog__title')?.innerText, optionRows: rows.length }
  })()`)
  check(
    '“添加报表”弹窗可用',
    dialogState.open === true,
    `${dialogState.title || ''} 可选报表 ${dialogState.optionRows ?? 0} 行 (触发=${selectedCount})`
  )

  // 7. 检查页面控制台异常
  const errors = consoleLogs.filter(
    (l) => /exception|\[error\]/.test(l) && !/favicon|hm\.baidu|net::ERR/.test(l)
  )
  check('页面无 JS 异常', errors.length === 0, errors.slice(0, 3).join(' ｜ '))
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
}

const failed = results.filter((r) => !r.ok)
console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`)
if (consoleLogs.length) {
  console.log('\n----- 页面控制台（最后 25 条）-----')
  console.log(consoleLogs.slice(-25).join('\n'))
}
process.exit(failed.length ? 1 : 0)
