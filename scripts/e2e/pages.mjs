// 逐页巡检：登录后遍历侧边栏所有已实现路由，断言页面能渲染且无 JS 异常
// 用法：node scripts/e2e/pages.mjs [--user=admin] [--filter=cr-meta]
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveChrome } from './chrome.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const CHROME = resolveChrome()
const PORT = Number(process.env.CDP_PORT || 9337)
const BASE = process.env.APP_URL || 'http://localhost:5173'
const USER = arg('user', 'admin')
const FILTER = arg('filter', '')
const PASSWORD = process.env.APP_PASSWORD || 'admin123'

const profile = mkdtempSync(join(tmpdir(), 'cdp-pages-'))
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
let consoleErrors = []

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

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
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
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      consoleErrors.push(d?.exception?.description || d?.text || 'unknown')
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  // 登录
  await send('Page.navigate', { url: `${BASE}/` })
  await waitFor(() => evaluate(`document.querySelectorAll('input').length > 0`), 20000, 'login-page')
  await sleep(1000)
  await evaluate(`(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) }
    const inputs = [...document.querySelectorAll('input')]
    setVal(inputs.find(i => (i.type === 'text' || i.type === '') && i.offsetParent !== null), ${JSON.stringify(USER)})
    setVal(inputs.find(i => i.type === 'password'), ${JSON.stringify(PASSWORD)})
    return true
  })()`)
  await waitFor(
    async () => {
      const ok = await evaluate(`!!document.querySelector('.v-layout')`)
      if (ok) return true
      await evaluate(
        `(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('登录')); if (b) b.click() })()`
      )
      return false
    },
    30000,
    'login'
  )
  console.log(`登录成功：${USER}`)

  // 取全部路由叶子节点
  const routes = await evaluate(`(() => {
    const raw = localStorage.getItem('roleRouters')
    const wrap = raw ? JSON.parse(raw) : null
    const list = wrap && wrap.v ? JSON.parse(wrap.v) : []
    const out = []
    const walk = (node, parentPath) => {
      const full = node.path && node.path.startsWith('/')
        ? node.path
        : (parentPath.replace(/\\/$/, '') + '/' + node.path)
      if (node.component) out.push({ name: node.name, path: full, component: node.component })
      ;(node.children || []).forEach((c) => walk(c, full))
    }
    list.forEach((n) => walk(n, ''))
    return out
  })()`)

  const targets = FILTER ? routes.filter((r) => r.path.includes(FILTER)) : routes
  console.log(`共 ${routes.length} 个页面路由，本次巡检 ${targets.length} 个\n`)

  for (const route of targets) {
    consoleErrors = []
    let status = 'ok'
    let detail = ''
    try {
      await send('Page.navigate', { url: BASE + route.path })
      // 等页面主内容出现：表格 / 表单 / 树 / 空状态 任一
      await waitFor(
        () =>
          evaluate(
            `!!document.querySelector('.el-table, .el-table-v2, .el-form, .el-tree, .el-empty, .el-descriptions, .el-tabs')`
          ),
        20000,
        route.path
      )
      await sleep(900)
      const state = await evaluate(`(() => {
        const main = document.querySelector('.v-layout__main') || document.body
        return {
          url: location.pathname,
          text: (main.innerText || '').replace(/\\s+/g, ' ').slice(0, 160),
          tableRows: document.querySelectorAll('.el-table__body tbody tr').length,
          virtualRows: document.querySelectorAll('.el-table-v2__row').length,
          hasError: /系统异常|接口未实现|Cannot read|undefined is not/.test(main.innerText || '')
        }
      })()`)
      if (state.url !== route.path) {
        status = 'redirect'
        detail = `被重定向到 ${state.url}`
      } else if (state.hasError) {
        status = 'error'
        detail = state.text
      } else {
        detail = state.virtualRows ? `虚拟表格 ${state.virtualRows} 行` : `表格 ${state.tableRows} 行`
      }
    } catch (error) {
      status = 'fail'
      detail = error.message.slice(0, 140)
    }
    const realErrors = consoleErrors.filter(
      (e) => !/favicon|hm\\.baidu|net::ERR|ResizeObserver|el-link.*underline|deprecated/i.test(e)
    )
    if (status === 'ok' && realErrors.length) {
      status = 'warn'
      detail = realErrors[0].slice(0, 160)
    }
    results.push({ route, status, detail })
    const icon = { ok: '✅', warn: '⚠️ ', error: '❌', fail: '❌', redirect: '↪️ ' }[status]
    console.log(`${icon} ${route.path.padEnd(32)} ${route.name.padEnd(18)} ${detail}`)
  }
} catch (error) {
  console.log(`❌ 巡检中断：${error.message}`)
  results.push({ route: { path: '-', name: 'runner' }, status: 'fail', detail: error.message })
} finally {
  try {
    ws?.close()
  } catch {}
  chrome.kill('SIGKILL')
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
  const bad = results.filter((r) => r.status === 'error' || r.status === 'fail' || r.status === 'redirect')
  const warn = results.filter((r) => r.status === 'warn')
  console.log(
    `\n===== 巡检结果：${results.length - bad.length - warn.length}/${results.length} 正常` +
      (warn.length ? `，${warn.length} 有告警` : '') +
      (bad.length ? `，${bad.length} 失败` : '') +
      ' ====='
  )
  process.exit(bad.length ? 1 : 0)
}
