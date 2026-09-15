// 本地预览 dist 静态产物（带 SPA history 回退），仅用 node 内置模块，无新依赖
// 用法：node scripts/serve-dist.mjs [--port=4188] [--dir=dist]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const PORT = Number(arg('port', 4188))
const ROOT = join(process.cwd(), arg('dir', 'dist'))

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

createServer(async (req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0])
  // 防目录穿越
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const target = join(ROOT, safe)
  try {
    const info = await stat(target)
    if (info.isFile()) return await send(res, target)
    if (info.isDirectory()) {
      const index = join(target, 'index.html')
      if ((await stat(index)).isFile()) return await send(res, index)
    }
  } catch {
    /* 落空则走 SPA 回退 */
  }
  // history 回退：任何未命中的路径都返回 index.html，交给前端路由
  try {
    return await send(res, join(ROOT, 'index.html'))
  } catch {
    return await send(res, join(ROOT, 'index.html'), 404).catch(() => {
      res.writeHead(404)
      res.end('dist 不存在，请先执行 pnpm build:demo')
    })
  }
}).listen(PORT, () => {
  console.log(`静态预览：http://127.0.0.1:${PORT}  （目录 ${ROOT}，已开启 SPA 回退）`)
})
