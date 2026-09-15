/**
 * 写接口鉴权审计（静态）—— 「藏按钮拦不住接口」这条教训的常规化检查
 *
 * 用法：node scripts/audit-writes.mjs [--json]
 *
 * 检查两件事：
 *  A. **接口层有没有判角色**：每个写路由（registerResource 的 create/update/delete/delete-list
 *     与 handler 里显式注册的 onPost/onPut/onDelete）附近有没有
 *     guard / assertAdmin / assertRoles / assertLogin；
 *  B. **有没有进 e2e:auth 的 WRITES 清单**：没进清单的写接口，下一次"漏一个 toggle"还是没人发现。
 *
 * 注意这是**静态**检查：靠的是"守卫调用出现在同一段代码里"这个启发式（前后 N 行窗口），
 * 能做到"提醒你别忘了"，不能替代 pnpm e2e:auth 的真机验证。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const HANDLER_DIR = 'src/mock/handlers'
const WINDOW = 30
const GUARD_PATTERN =
  /guard\s*:|assertAdmin\(|assertRoles\(|assertLogin\(|assertDeptAction\(|visibleOrgIdsOf\(/
const CRUD_SEGMENTS = [
  ['post', '/create'],
  ['put', '/update'],
  ['delete', '/delete'],
  ['delete', '/delete-list']
]

const files = readdirSync(HANDLER_DIR).filter((name) => name.endsWith('.ts'))
const routes = []

for (const file of files) {
  const text = readFileSync(join(HANDLER_DIR, file), 'utf8')
  const lines = text.split('\n')

  // ① registerResource 的四个标准 CRUD：guard 一般写在 prefix 附近
  lines.forEach((line, index) => {
    const match = line.match(/prefix:\s*'([^']+)'/)
    if (!match) return
    const window = lines.slice(index, index + WINDOW).join('\n')
    // 只在"这个 resource 定义块"里找：遇到下一个 prefix 就停
    const nextPrefix = lines.slice(index + 1).findIndex((item) => /prefix:\s*'/.test(item))
    const block = (
      nextPrefix < 0 ? lines.slice(index) : lines.slice(index, index + 1 + nextPrefix)
    ).join('\n')
    const guarded = GUARD_PATTERN.test(block) && GUARD_PATTERN.test(window)
    CRUD_SEGMENTS.forEach(([method, segment]) =>
      routes.push({
        file,
        method,
        url: match[1] + segment,
        guarded,
        kind: 'resource'
      })
    )
  })

  // ② handler 里显式注册的写路由：守卫调用一般紧跟在 onXxx( 之后
  lines.forEach((line, index) => {
    const match = line.match(/on(Post|Put|Delete)\('([^']+)'/)
    if (!match) return
    const block = lines.slice(index, index + WINDOW).join('\n')
    routes.push({
      file,
      method: match[1].toLowerCase(),
      url: match[2],
      guarded: GUARD_PATTERN.test(block),
      kind: 'explicit'
    })
  })
}

const authSource = readFileSync('scripts/e2e/auth.mjs', 'utf8')
const writesBlock = authSource.match(/const WRITES = \[([\s\S]*?)\n\]/)[1]
// 只认 HTTP 方法的匹配：条目里还有 ['admin','auditor'] 这类角色白名单，
// 按「两个小写引号字符串」粗匹配会把它们也算进来（历史打印值是 98，比真实条目多 1 条）。
const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete'])
const listed = new Set()
for (const match of writesBlock.matchAll(/'([a-z]+)',\s*'([^']+)'/g)) {
  if (!HTTP_METHODS.has(match[1])) continue
  listed.add(match[1] + ' ' + match[2].split('?')[0])
}

const report = routes.map((route) => ({
  ...route,
  listed: listed.has(route.method + ' ' + route.url)
}))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const unguarded = report.filter((route) => !route.guarded)
  const unlisted = report.filter((route) => !route.listed)
  const byFile = (rows) => {
    const map = new Map()
    rows.forEach((row) => map.set(row.file, (map.get(row.file) || 0) + 1))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }
  console.log(
    '写路由总数：' +
      report.length +
      '（resource CRUD ' +
      report.filter((r) => r.kind === 'resource').length +
      ' + 显式 ' +
      report.filter((r) => r.kind === 'explicit').length +
      '）\n'
  )
  console.log('=== A. 接口层没有判角色的写路由：' + unguarded.length + ' 条 ===')
  byFile(unguarded).forEach(([file, count]) => console.log('  ' + file.padEnd(26) + count + ' 条'))
  console.log('\n=== B. 没进 scripts/e2e/auth.mjs WRITES 清单：' + unlisted.length + ' 条 ===')
  byFile(unlisted).forEach(([file, count]) => console.log('  ' + file.padEnd(26) + count + ' 条'))
  console.log('\n（清单当前 ' + listed.size + ' 条；A/B 两段是"待收口"的存量，不是本轮新增）')
}
