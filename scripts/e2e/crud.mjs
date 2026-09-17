// 依赖：本机无头浏览器（CHROME_BIN 可覆盖）+ 已启动的 dev server（APP_URL，默认 http://localhost:5173）
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveChrome } from './chrome.mjs'

// 验证：前台操作结果持久化在 localStorage（新增 → 刷新仍在 → 删除）

const CHROME = resolveChrome()
const PORT = 9336
const BASE = 'http://localhost:5173'
const profile = mkdtempSync(join(tmpdir(), 'cdp4-'))
const chrome = spawn(
  CHROME,
  ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
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
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)) } }, 20000)
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value
}
const waitFor = async (fn, timeout = 25000, label = '') => {
  const t = Date.now()
  while (Date.now() - t < timeout) { try { const v = await fn(); if (v) return v } catch {} await sleep(300) }
  throw new Error('waitFor timeout ' + label)
}
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const fillInput = (selectorExpr, value) => `(() => {
  const el = ${selectorExpr}
  if (!el) throw new Error('input not found')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, ${JSON.stringify(value)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})()`

const login = async () => {
  const logged = await waitFor(async () => {
    const ok = await evaluate(`!!document.querySelector('.v-layout')`)
    if (ok) return true
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('登录'))
      if (btn) btn.click()
    })()`)
    return false
  }, 30000, 'login')
  return logged
}

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok)
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text))
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/` })
  await waitFor(() => evaluate(`document.querySelectorAll('input').length > 0`))
  await sleep(1200)
  await evaluate(fillInput(`[...document.querySelectorAll('input')].find(i => i.type !== 'password' && i.offsetParent !== null)`, 'admin'))
  await evaluate(fillInput(`[...document.querySelectorAll('input')].find(i => i.type === 'password')`, 'admin123'))
  await login()

  await send('Page.navigate', { url: `${BASE}/new-unified/cr-task/template` })
  await waitFor(async () => (await evaluate(`document.querySelectorAll('.el-table__body tbody tr').length`)) > 0, 25000, 'list')

  const before = await evaluate(`document.querySelectorAll('.el-table__body tbody tr').length`)
  const totalBefore = await evaluate(`document.querySelector('.el-pagination__total')?.innerText || ''`)

  // 1. 新增
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /新增任务/.test(b.innerText) && b.offsetParent !== null)
    if (!btn) throw new Error('找不到新增按钮')
    btn.click()
    return true
  })()`)
  await waitFor(() => evaluate(`!!document.querySelector('.el-dialog') && document.querySelector('.el-dialog').offsetParent !== null`), 10000, 'dialog')
  await sleep(500)

  const NEW_CODE = 'RW-E2E-001'
  const NEW_NAME = '端到端验证任务'
  await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null)
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) }
    const items = [...dlg.querySelectorAll('.el-form-item')]
    const pick = (label) => items.find(i => i.querySelector('.el-form-item__label')?.innerText.replace(/\\s/g,'').startsWith(label))
    setVal(pick('任务编码').querySelector('input'), ${JSON.stringify(NEW_CODE)})
    setVal(pick('任务名称').querySelector('input'), ${JSON.stringify(NEW_NAME)})
    setVal(pick('报送期次').querySelector('input'), '202610')
    setVal(pick('截止日期').querySelector('input'), '2026-10-20')
    setVal(pick('起始日期').querySelector('input'), '2026-10-01')
    return true
  })()`)
  await sleep(400)
  const formState = await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null)
    return {
      values: [...dlg.querySelectorAll('input')].map(i => i.value),
      errors: [...dlg.querySelectorAll('.el-form-item__error')].map(e => e.innerText)
    }
  })()`)
  console.log('  表单快照:', JSON.stringify(formState))

  // 频度用默认值(月报=3)，直接提交
  await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null)
    const btn = [...dlg.querySelectorAll('button')].find(b => /确\\s*定/.test(b.innerText))
    if (!btn) throw new Error('找不到确定按钮')
    btn.click()
    return true
  })()`)

  const created = await waitFor(async () => {
    const txt = await evaluate(`document.querySelector('.el-table__body')?.innerText || ''`)
    if (txt.includes(NEW_CODE)) return true
    const msgs = await evaluate(`[...document.querySelectorAll('.el-notification__content, .el-message__content, .el-form-item__error')].map(e => e.innerText).join(' | ')`)
    if (msgs) console.log('  页面提示:', msgs.slice(0, 300))
    return null
  }, 15000, 'created row')
  check('新增任务后列表出现新记录', created === true, `${before} 行 / ${totalBefore}`)

  // 2. 刷新后仍然存在（localStorage 持久化）
  await send('Page.navigate', { url: `${BASE}/new-unified/cr-task/template` })
  await waitFor(async () => (await evaluate(`document.querySelectorAll('.el-table__body tbody tr').length`)) > 0, 25000, 'reload-list')
  const persisted = await evaluate(`document.querySelector('.el-table__body')?.innerText.includes(${JSON.stringify(NEW_CODE)})`)
  const storageCount = await evaluate(`(() => {
    const raw = localStorage.getItem('cr-mock:table:cr.taskTemplate')
    if (!raw) return -1
    const parsed = JSON.parse(raw)
    const rows = parsed && parsed.v !== undefined ? parsed.v : parsed
    return Array.isArray(rows) ? rows.length : -2
  })()`)
  check('刷新页面后新记录仍在（localStorage 持久化）', persisted === true, `localStorage 中 ${storageCount} 条`)

  // 3. 编辑
  await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
    const row = rows.find(r => r.innerText.includes(${JSON.stringify(NEW_CODE)}))
    const btn = [...row.querySelectorAll('button')].find(b => /编辑/.test(b.innerText))
    btn.click()
    return true
  })()`)
  await waitFor(() => evaluate(`!!document.querySelector('.el-dialog') && document.querySelector('.el-dialog').offsetParent !== null`), 10000, 'edit-dialog')
  await sleep(600)
  await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null)
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) }
    const items = [...dlg.querySelectorAll('.el-form-item')]
    const pick = (label) => items.find(i => i.querySelector('.el-form-item__label')?.innerText.replace(/\\s/g,'').startsWith(label))
    setVal(pick('任务名称').querySelector('input'), '端到端验证任务（已改）')
    ;[...dlg.querySelectorAll('button')].find(b => /确\\s*定/.test(b.innerText)).click()
    return true
  })()`)
  const updated = await waitFor(async () => {
    const txt = await evaluate(`document.querySelector('.el-table__body')?.innerText || ''`)
    return txt.includes('已改') ? true : null
  }, 15000, 'updated')
  check('编辑后列表同步更新', updated === true, '')

  // 4. 删除
  await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
    const row = rows.find(r => r.innerText.includes(${JSON.stringify(NEW_CODE)}))
    const btn = [...row.querySelectorAll('button')].find(b => /删除/.test(b.innerText))
    btn.click()
    return true
  })()`)
  await sleep(800)
  await evaluate(`(() => {
    const box = [...document.querySelectorAll('.el-message-box')].find(b => b.offsetParent !== null)
    if (!box) return 'no-box'
    const btn = [...box.querySelectorAll('button')].find(b => /确定|确 定/.test(b.innerText))
    btn.click()
    return 'confirmed'
  })()`)
  const deleted = await waitFor(async () => {
    const txt = await evaluate(`document.querySelector('.el-table__body')?.innerText || ''`)
    return txt.includes(NEW_CODE) ? null : true
  }, 15000, 'deleted')
  check('删除后记录从列表移除', deleted === true, '')

  const errors = logs.filter((l) => !/favicon/.test(l))
  check('无 JS 异常', errors.length === 0, errors.slice(0, 2).join(' | '))
} catch (error) {
  check('执行过程', false, error.message)
} finally {
  try { ws?.close() } catch {}
  chrome.kill('SIGKILL')
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
  const failed = results.filter((r) => !r.ok)
  console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`)
  process.exit(failed.length ? 1 : 0)
}
