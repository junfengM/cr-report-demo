// 生成「换电脑能用」的两个交付包（纯 node 内置模块，无新增依赖）：
//
//   1. cr-report-demo-win-x64.zip   演示包：产物 + 内置 Node 运行时 + 双击启动脚本。对方零安装、不联网即可演示。
//   2. cr-report-src.zip            源码包：完整源码 + 安装说明。给要改代码的人，装 Node/pnpm 后 `pnpm install` 即可。
//
// 用法：
//   node scripts/make-release.mjs                      # 重新构建 → 打两个包（演示包内置 Windows Node）
//   node scripts/make-release.mjs --skip-build         # 复用现有 dist，不重新构建
//   node scripts/make-release.mjs --node-version=24.21.0
//   node scripts/make-release.mjs --no-node            # 演示包不带 Node（对方自己装 Node）
//   node scripts/make-release.mjs --no-src             # 只打演示包
//
// 说明：源码包取自 git HEAD，所以**先提交再打包**；工作区不干净时脚本会提醒（仍按 HEAD 打包）。
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { get } from 'node:https'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeTree } from './lib/sanitize-public.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)

const OUT = join(ROOT, arg('out', 'release'))
const CACHE = join(OUT, '.cache')
const DEMO_NAME = 'cr-report-demo-win-x64'
const SRC_NAME = 'cr-report-src'
const NODE_VERSION = arg('node-version', '24.21.0')
const WITH_NODE = !flag('no-node')
const WITH_SRC = !flag('no-src')

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts })
const shOut = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() ?? ''
const log = (msg) => console.log(`\n▶ ${msg}`)
const human = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`)
const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex')

/** 跟随 302 下载到文件（nodejs.org 会把 /dist/... 重定向到镜像） */
const download = (url, dest, depth = 0) =>
  new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('重定向次数过多：' + url))
    get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume()
        return resolve(download(new URL(res.headers.location, url).href, dest, depth + 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`下载失败 ${res.statusCode}：${url}`))
      }
      const total = Number(res.headers['content-length'] || 0)
      let got = 0
      let lastTick = 0
      const chunks = []
      res.on('data', (c) => {
        chunks.push(c)
        got += c.length
        const pct = total ? Math.floor((got / total) * 100) : 0
        if (pct >= lastTick + 10) {
          lastTick = pct
          process.stdout.write(`\r  下载 ${pct}% (${human(got)})   `)
        }
      })
      res.on('end', async () => {
        process.stdout.write('\r' + ' '.repeat(40) + '\r')
        await writeFile(dest, Buffer.concat(chunks))
        resolve(dest)
      })
      res.on('error', reject)
    }).on('error', reject)
  })

/** 取 Windows 版 Node 的 node.exe（单文件，自包含，不需要 npm），并用官方 SHASUMS256.txt 校验 */
const fetchWindowsNode = async () => {
  const dir = join(CACHE, `node-v${NODE_VERSION}-win-x64`)
  const exe = join(dir, 'node.exe')
  await mkdir(dir, { recursive: true })
  const sumsFile = join(dir, 'SHASUMS256.txt')
  if (!existsSync(sumsFile)) {
    await download(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`, sumsFile)
  }
  const sums = await readFile(sumsFile, 'utf8')
  const sumFor = (suffix) =>
    sums
      .split('\n')
      .find((l) => l.trim().endsWith(suffix))
      ?.trim()
      .split(/\s+/)[0]
  const want = sumFor('win-x64/node.exe')
  if (!want) throw new Error(`SHASUMS256.txt 里找不到 win-x64/node.exe（版本 v${NODE_VERSION} 是否存在？）`)

  // 随包分发 Node 运行时必须带上它的许可证（MIT）与版本说明，否则再分发不合规。
  // nodejs.org 的 dist 目录目前不单独提供 LICENSE（只打在 zip 里），故失败时回退到
  // nodejs/node 仓库同版本 tag 下的官方 LICENSE（内容更全：含 V8/OpenSSL 等第三方许可）。
  const license = join(dir, 'LICENSE')
  if (!existsSync(license)) {
    const urls = [
      `https://nodejs.org/dist/v${NODE_VERSION}/LICENSE`,
      `https://raw.githubusercontent.com/nodejs/node/v${NODE_VERSION}/LICENSE`
    ]
    for (const url of urls) {
      try {
        await download(url, license)
        break
      } catch {
        console.log(`  该地址取不到 LICENSE，换下一个：${url}`)
      }
    }
  }
  const licenseText = existsSync(license) ? await readFile(license, 'utf8') : ''
  if (!licenseText.includes('Node.js is licensed for use as follows') || !licenseText.includes('MIT')) {
    throw new Error(`Node 的 LICENSE 内容不对（来源失效？），拒绝在缺许可证的情况下打包`)
  }
  console.log(`  LICENSE 就位（${(licenseText.length / 1024).toFixed(0)} KB，含 MIT 与第三方许可）`)

  if (existsSync(exe) && (await sha256(exe)) === want) {
    console.log(`  复用已下载的 node.exe（sha256 校验通过）`)
    return { exe, license }
  }
  console.log(`  下载 Windows Node v${NODE_VERSION} 的 node.exe（约 80MB，仅打包时下载一次）`)
  await download(`https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`, exe)
  const got = await sha256(exe)
  if (got !== want) throw new Error(`node.exe 校验失败：期望 ${want}，实际 ${got}`)
  console.log(`  ✅ sha256 校验通过 ${got.slice(0, 16)}…`)
  return { exe, license }
}

/** 演示包里那个自定位的静态服务器：不依赖 cwd，端口被占自动顺延，可自动开浏览器 */
const SERVER_SOURCE = `// 统一监管报送平台 · 演示包内置静态服务器（只用 node 内置模块，零依赖）
// 由 scripts/make-release.mjs 生成，请勿手改；要改请改仓库里的 scripts/make-release.mjs。
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { exec } from 'node:child_process'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', 'dist')
const argv = process.argv.slice(2)
const has = (name) => argv.includes('--' + name)
const val = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith('--' + name + '='))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const START_PORT = Number(val('port', 4188))
const OPEN = has('open')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

const send = async (res, file, status = 200) => {
  const body = await readFile(file)
  res.writeHead(status, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

const handler = async (req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0])
  const safe = normalize(pathname).replace(/^(\\.\\.[/\\\\])+/, '')
  const target = join(ROOT, safe)
  try {
    const info = await stat(target)
    if (info.isFile()) return await send(res, target)
    if (info.isDirectory()) {
      const index = join(target, 'index.html')
      if ((await stat(index)).isFile()) return await send(res, index)
    }
  } catch {
    /* 落空走 SPA 回退 */
  }
  try {
    return await send(res, join(ROOT, 'index.html'))
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('找不到 dist 目录，演示包可能没有解压完整。')
  }
}

const openBrowser = (url) => {
  const cmd =
    process.platform === 'win32' ? \`start "" "\${url}"\` : process.platform === 'darwin' ? \`open "\${url}"\` : \`xdg-open "\${url}"\`
  exec(cmd, () => {})
}

const start = (port, tries = 0) => {
  const server = createServer(handler)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && tries < 20) {
      console.log(\`  端口 \${port} 被占用，换 \${port + 1} 试试…\`)
      return start(port + 1, tries + 1)
    }
    console.error('启动失败：' + err.message)
    process.exit(1)
  })
  server.listen(port, '127.0.0.1', () => {
    const url = \`http://127.0.0.1:\${port}\`
    console.log('')
    console.log('  ┌──────────────────────────────────────────────┐')
    console.log('  │  统一监管报送平台 · 演示环境已启动            │')
    console.log('  └──────────────────────────────────────────────┘')
    console.log(\`  访问地址：\${url}\`)
    console.log('  账号：admin / filler / reviewer / auditor   密码：admin123')
    console.log('  停止：关闭本窗口，或按 Ctrl+C')
    console.log('')
    if (OPEN) openBrowser(url)
  })
}

start(START_PORT)
`

const BAT_SOURCE = `@echo off
chcp 65001 >nul
title 统一监管报送平台 · 演示环境
cd /d "%~dp0"

set "NODE=%~dp0node\\node.exe"
if not exist "%NODE%" set "NODE=node"

"%NODE%" "%~dp0server\\serve.mjs" --open
if errorlevel 1 (
  echo.
  echo [提示] 启动失败。若提示找不到 node，请在本机安装 Node.js 后重试，
  echo        或直接运行：node server\\serve.mjs
)
echo.
echo 演示已停止，关闭本窗口即可。
pause
`

const README_SOURCE = `统一监管报送平台 · 演示环境（Windows 免安装版）
====================================================

一、怎么用（三步）
  1. 把整个文件夹解压到任意目录（路径里不要有特殊符号，中文路径可以）
  2. 双击  start-demo.bat
  3. 浏览器会自动打开 http://127.0.0.1:4188 ；窗口里出现「演示环境已启动」即为成功
  * 不需要联网，不需要装 Node、不需要装 npm、不需要装数据库。
  * 黑色命令行窗口是服务本体，演示过程中不要关闭；演示结束再关。
  * 若 4188 端口被占用，程序会自动顺延到 4189 / 4190…，以窗口里打印的地址为准。

二、演示账号（密码都是 admin123）
  admin     系统管理员    104 个页面（全部功能）
  filler    报送填报岗    11 个页面
  reviewer  报送复核岗    13 个页面
  auditor   报送审核岗    12 个页面
  切换角色：右上角头像 → 退出登录 → 换账号登录。

三、数据说明
  * 所有数据都是浏览器本地数据（localStorage），不连任何服务器；关掉浏览器再打开，改过的数据还在。
  * 想把演示数据恢复成初始状态：按 F12 打开控制台，执行 localStorage.clear() 然后刷新页面。
  * 换一个浏览器（或用无痕窗口）等于一份全新的初始数据；多台电脑之间数据互不影响。

四、常见问题
  * 双击后一闪而过 / 提示找不到 node：
      说明包没解压完整，确认文件夹里有 node\\node.exe 与 dist\\index.html；
      也可以手动在命令行里执行：node server\\serve.mjs
  * Windows 提示"已保护你的电脑"（SmartScreen）：
      点「更多信息」→「仍要运行」。这是因为包里的 node.exe 是未签名的独立运行时。
  * 杀毒软件报 node.exe 可疑：
      属于误报（自带的 Node 运行时），放行即可；不放心可以让对方装 Node 后用同目录的 server\\serve.mjs。
  * 页面打开是空白：
      确认窗口里打印的端口和地址栏一致；再不行按 F12 看 Console 报错信息。

五、给别人讲什么
  逐页演示话术见源码包里的 docs/02-演示脚本.md（五条动线 + 常见提问标准回答 + 翻车点清单）。
  本演示包 = dist（构建产物）+ node.exe（运行时）+ server/serve.mjs（静态服务）+ 本说明。

六、第三方组件与许可
  * Node.js 运行时：本包 node/ 目录下的 node.exe 是 Node.js 官方 Windows x64 版本（v${NODE_VERSION}），
    未做任何修改，以 MIT 许可分发，许可证全文见 node/LICENSE，版权归 Node.js 贡献者所有。
  * 前端脚手架：本项目基于开源项目 yudao-ui-admin-vue3（MIT）搭建，许可证见源码包内的 LICENSE。
  * 本项目自身的代码与文档：MIT。
`

const SRC_README = `统一监管报送平台 · 源码包（在别的电脑上继续开发）
====================================================

一、环境要求
  Node.js >= 20.19.0（推荐 22 LTS 或 24 LTS）· pnpm >= 8.6.0
  Windows 上建议用官方安装包装 Node，然后 npm i -g pnpm。

二、首次安装与启动（4 条命令）
  pnpm install        # 依赖 79 个，从 npmmirror 源拉取（.npmrc 已配好），首次约 2~5 分钟
  pnpm dev            # http://localhost:5173
  pnpm build:demo     # 打静态产物到 dist/（注意：不要用 pnpm build:dev，原因见 README）
  pnpm preview:dist   # 预览静态产物 http://127.0.0.1:4188

三、自检（5 个质量门禁，需先 pnpm dev 起着）
  pnpm e2e          # 主链路 10 项
  pnpm e2e:crud     # 增删改查持久化 5 项
  pnpm e2e:pages    # 逐页巡检 104 条路由
  pnpm e2e:perms    # 按钮权限静态检查（0 缺失）
  pnpm e2e:auth     # 133 条写接口判角色 287 项
  * 自检脚本会自动找本机浏览器（Chrome / Edge 都行）；找不到就用 CHROME_BIN 指定，例如：
      set CHROME_BIN=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe

四、改代码前必读
  docs/01-页面开发规范.md     页面 / API / mock 的写法约定
  docs/00-项目上下文.md       需求、关键决策（ADR）、架构、进度日志 —— 唯一上下文事实源
  docs/02-演示脚本.md         逐页演示话术
  README.md                   项目说明（含已知边界与门禁说明）

五、离线与隐私
  * 本 Demo 零后端：所有接口由项目内自写的 axios mock adapter 接管，数据存浏览器 localStorage。
  * 断网可用（已实测：把除 localhost 外的 DNS 全部黑洞后，主链路自检仍 10/10）。
  * 页面不做任何第三方外联（百度统计已显式关闭，源码里 grep 不到 hm.baidu.com）。

六、怎么再打一个「给别人的演示包」
  node scripts/make-release.mjs          # 生成 release/cr-report-demo-win-x64.zip（含 Node 运行时）
  node scripts/make-release.mjs --no-node  # 不带运行时（对方自己装 Node）
`

const buildDemo = async () => {
  log('构建静态产物（pnpm build:demo）')
  const code = sh('pnpm', ['build:demo']).status
  if (code !== 0) throw new Error('构建失败，已中止打包')
}

const makeDemoPackage = async () => {
  const dir = join(OUT, DEMO_NAME)
  log(`组装演示包：${relative(ROOT, dir)}`)
  await rm(dir, { recursive: true, force: true })
  await mkdir(join(dir, 'server'), { recursive: true })
  await cp(join(ROOT, 'dist'), join(dir, 'dist'), { recursive: true })
  await writeFile(join(dir, 'server', 'serve.mjs'), SERVER_SOURCE)
  await writeFile(join(dir, 'start-demo.bat'), BAT_SOURCE)
  await writeFile(join(dir, 'README.txt'), README_SOURCE)
  if (WITH_NODE) {
    const { exe, license } = await fetchWindowsNode()
    await mkdir(join(dir, 'node'), { recursive: true })
    await cp(exe, join(dir, 'node', 'node.exe'))
    await cp(license, join(dir, 'node', 'LICENSE'))
    await writeFile(
      join(dir, 'node', 'README.txt'),
      `本目录里的 node.exe 是 Node.js v${NODE_VERSION} 的 Windows x64 官方运行时（来自 https://nodejs.org/dist/v${NODE_VERSION}/win-x64/，\n` +
        `打包时已用官方 SHASUMS256.txt 校验 sha256）。\n` +
        `Node.js 以 MIT 许可发布，版权归 Node.js 贡献者所有；许可证全文见同目录 LICENSE。\n` +
        `本项目只把运行时原样放进演示包，未做任何修改。\n`
    )
  } else {
    console.log('  跳过内置 Node（--no-node）：对方需要自己装 Node.js')
  }
  return dir
}

const makeSourcePackage = async () => {
  const dir = join(OUT, SRC_NAME)
  log(`组装源码包（git HEAD → ${relative(ROOT, dir)}）`)
  const dirty = shOut('git', ['status', '--porcelain'])
  if (dirty) console.log('  ⚠️  工作区有未提交改动，源码包只包含 HEAD 的内容（先提交再打包才是最新的）')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const code = sh('bash', ['-c', `git archive HEAD | tar -x -C "${dir}"`]).status
  if (code !== 0) throw new Error('git archive 失败')

  // 源码包同样从 git HEAD 导出，因此**也会带上第三方文档提取件**。
  // 默认净化（与公开发布同一套规则）；要留内部版就加 --keep-vendor-doc。
  if (flag('keep-vendor-doc')) {
    console.log('  ⚠️  --keep-vendor-doc：源码包里保留了第三方文档提取件，**不要外发**')
  } else {
    const { removed } = sanitizeTree(dir, { log: (m) => console.log(`  ${m}`) })
    removed.forEach((r) => console.log(`  剔除：${r}`))
  }

  await writeFile(join(dir, '安装与启动.md'), SRC_README)
  const files = await readdir(dir)
  console.log(`  导出 ${files.length} 个顶层条目`)
  return dir
}

/** 用系统 zip 打包（macOS / Linux 自带；Windows 打包机上用 tar 兜底提示） */
const zipDir = async (dir, zipPath) => {
  const source = dir.split('/').pop()
  await rm(zipPath, { force: true })
  const r = sh('zip', ['-r', '-q', '-X', zipPath, source], { cwd: OUT })
  if (r.error || r.status !== 0) {
    throw new Error('系统缺少 zip 命令，无法打包。macOS/Linux 自带 zip；Windows 可用 tar -a -c -f 手动打包。')
  }
  return zipPath
}

const main = async () => {
  await mkdir(OUT, { recursive: true })
  if (!flag('skip-build')) await buildDemo()
  else log('跳过构建（--skip-build），复用现有 dist')

  const summary = []
  const demoDir = await makeDemoPackage()
  const demoZip = await zipDir(demoDir, join(OUT, `${DEMO_NAME}.zip`))
  summary.push(['演示包（Windows 免安装）', `${DEMO_NAME}.zip`, demoZip])

  if (WITH_SRC) {
    const srcDir = await makeSourcePackage()
    const srcZip = await zipDir(srcDir, join(OUT, `${SRC_NAME}.zip`))
    summary.push(['源码包（可二次开发）', `${SRC_NAME}.zip`, srcZip])
  }

  log('打包完成')
  for (const [label, name, file] of summary) {
    const size = (await stat(file)).size
    console.log(`  ${label.padEnd(22)} ${name.padEnd(32)} ${human(size).padStart(8)}  sha256=${(await sha256(file)).slice(0, 16)}…`)
  }
  console.log(`\n  产物目录：${relative(ROOT, OUT)}/`)
  console.log(`  演示包用法：解压 → 双击 start-demo.bat → 浏览器自动打开发访问地址（对方零安装、不联网）`)
  console.log(`  源码包用法：解压 → pnpm install → pnpm dev（详见包内「安装与启动.md」）\n`)
}

main().catch((err) => {
  console.error('\n❌ 打包失败：' + err.message)
  process.exit(1)
})
