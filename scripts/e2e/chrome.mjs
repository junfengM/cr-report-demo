// 无头浏览器定位（五个自检脚本共用一份，避免五处各写一遍后漂移）
// 依赖：本机已装 Chrome / Edge / Chromium 之一，或用 CHROME_BIN 显式指定可执行文件。
//
// 换电脑时这里最容易踩坑：原先把 macOS 的 Chrome 路径和 playwright 缓存路径写死在五个脚本里，
// 到了 Windows 上跑 `pnpm e2e:pages` 会直接报「找不到可用的无头浏览器」。
// macOS / Windows / Linux 的常见安装位置都在下面，最后兜底提示用 CHROME_BIN。
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** playwright 的浏览器缓存：macOS 与 Windows 位置不同 */
const playwrightCaches = [
  join(homedir(), 'Library/Caches/ms-playwright'), // macOS
  join(homedir(), 'AppData/Local/ms-playwright'), // Windows
  join(homedir(), '.cache/ms-playwright') // Linux
]

/** 系统安装的浏览器：Chrome 优先，Windows 上通常还自带 Edge（同样支持 headless） */
const systemBrowsers = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/microsoft-edge',
  join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe')
]

/** 自动定位无头浏览器：优先 CHROME_BIN，其次 playwright 缓存，再次系统安装的 Chrome / Edge */
export const resolveChrome = () => {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN
  for (const cache of playwrightCaches) {
    if (!existsSync(cache)) continue
    const dir = readdirSync(cache)
      .filter((name) => name.startsWith('chromium_headless_shell-'))
      .sort()
      .pop()
    if (!dir) continue
    for (const d of readdirSync(join(cache, dir))) {
      for (const bin of ['chrome-headless-shell', 'chrome-headless-shell.exe']) {
        const hit = join(cache, dir, d, bin)
        if (existsSync(hit)) return hit
      }
    }
  }
  for (const p of systemBrowsers) {
    if (p && existsSync(p)) return p
  }
  throw new Error(
    '找不到可用的无头浏览器。请安装 Chrome / Edge，或用 CHROME_BIN 指定可执行文件，' +
      '例如 CHROME_BIN="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
  )
}
