// 通用调试：登录后，在页面上下文里执行一段 JS 表达式并打印结果
// 用法：node scripts/e2e/eval.mjs "<表达式>" [--user=admin] [--url=/index]
//
// 例：
//   node scripts/e2e/eval.mjs "location.pathname"
//   node scripts/e2e/eval.mjs "import('/src/config/axios/index.ts').then(m => m.default.get({url:'/system/role/page',params:{pageNo:1,pageSize:10}})).then(r=>JSON.stringify(r).slice(0,400)).catch(e=>'ERR:'+e.message)"
//   node scripts/e2e/eval.mjs "JSON.parse(localStorage.getItem('roleRouters').replace(/^.*?\$/,'')).length" --url=/cr-meta/org
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveChrome } from './chrome.mjs'

const argv = process.argv.slice(2)
const expression = argv.find((a) => !a.startsWith('--'))
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
if (!expression) {
  console.log('用法：node scripts/e2e/eval.mjs "<表达式>" [--user=admin] [--url=/index]')
  process.exit(1)
}

const CHROME = resolveChrome()
const PORT = Number(process.env.CDP_PORT || 9338)
const BASE = process.env.APP_URL || 'http://localhost:5173'
const USER = arg('user', 'admin')
const START_URL = arg('url', '/index')

const profile = mkdtempSync(join(tmpdir(), 'cdp-eval-'))
const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${arg('size', '1440x1200').replace('x', ',')}`,
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
      logs.push('[exception] ' + (d?.exception?.description || d?.text))
    }
    const verbose = process.env.VERBOSE === '1'
    if (
      m.method === 'Runtime.consoleAPICalled' &&
      (verbose || ['error', 'warning'].includes(m.params.type))
    ) {
      logs.push(
        `[${m.params.type}] ` +
          (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      )
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  const SHOT = arg('shot', '')

  await send('Page.navigate', { url: `${BASE}/` })
  await waitFor(() => evaluate(`document.querySelectorAll('input').length > 0`), 25000, 'login')
  await sleep(800)
  await evaluate(`(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) }
    const inputs = [...document.querySelectorAll('input')]
    setVal(inputs.find(i => (i.type === 'text' || i.type === '') && i.offsetParent !== null), ${JSON.stringify(USER)})
    setVal(inputs.find(i => i.type === 'password'), ${JSON.stringify(process.env.APP_PASSWORD || 'admin123')})
    return true
  })()`)
  await waitFor(
    async () => {
      if (await evaluate(`!!document.querySelector('.v-layout')`)) return true
      await evaluate(
        `(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('登录')); if (b) b.click() })()`
      )
      return false
    },
    30000,
    'login-submit'
  )

  if (START_URL !== '/index') {
    await send('Page.navigate', { url: BASE + START_URL })
    await sleep(2500)
  }

  const result = await evaluate(expression)
  console.log('--- 执行结果 ---')
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))

  const shot = SHOT
  if (shot) {
    const { writeFileSync } = await import('node:fs')
    await new Promise((r) => setTimeout(r, 800))
    await evaluate(`window.scrollTo(0,0)`)
    await new Promise((r) => setTimeout(r, 500))
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    writeFileSync(shot, Buffer.from(data, 'base64'))
    console.log(`截图已保存：${shot}`)
  }
} catch (error) {
  console.log('执行失败：' + error.message)
  // 失败时补一次现场快照，省得再跑一遍
  try {
    const snap = await evaluate(`(() => {
      const toast = [...document.querySelectorAll('.el-message, .el-notification')].map(e => e.innerText.trim())
      const err = [...document.querySelectorAll('.el-form-item__error')].map(e => e.innerText.trim())
      const btn = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => b.innerText.trim()).filter(Boolean)
      const inp = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null).map(i => i.type + '=' + i.value)
      const net = performance.getEntriesByType('resource')
        .map(e => e.name)
        .filter(n => !/\\.(js|css|png|svg|woff2?|ico|jpg|jpeg|gif|webp)(\\?|$)/.test(n))
      return { url: location.href, toast, formError: err, buttons: btn, inputs: inp, net }
    })()`)
    console.log('--- 现场快照 ---')
    console.log(JSON.stringify(snap, null, 2))
  } catch {}
} finally {
  if (logs.length) {
    console.log('\n--- 页面错误/告警 ---')
    console.log(logs.slice(-12).join('\n'))
  }
  try {
    ws?.close()
  } catch {}
  chrome.kill('SIGKILL')
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
}
