// 页面做完后，把对应菜单的 implemented: false 标记去掉（让菜单下发）
// 用法：node scripts/enable-menus.mjs cr/meta cr/task/manage
//       node scripts/enable-menus.mjs --all
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MENU = join(process.cwd(), 'src/mock/db/menu.ts')
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('用法：node scripts/enable-menus.mjs <组件路径前缀...> | --all')
  process.exit(1)
}

const all = args.includes('--all')
const prefixes = args.filter((a) => a !== '--all')

const source = readFileSync(MENU, 'utf-8')
const lines = source.split('\n')
const enabled = []
const skipped = []

const out = lines.map((line) => {
  if (!line.includes('implemented: false')) return line
  const comp = line.match(/component: '([^']+)'/)?.[1]
  if (!comp) return line
  if (!all && !prefixes.some((p) => comp.startsWith(p))) {
    skipped.push(comp)
    return line
  }
  enabled.push(comp)
  return line.replace('implemented: false, ', '')
})

if (enabled.length === 0) {
  console.log('没有匹配到需要启用的菜单。')
  if (skipped.length) console.log(`仍处于未实现状态的页面：\n  ${skipped.join('\n  ')}`)
  process.exit(0)
}

writeFileSync(MENU, out.join('\n'), 'utf-8')
console.log(`✅ 已启用 ${enabled.length} 个菜单：`)
enabled.forEach((c) => console.log('   ' + c))

const remaining = out.filter((l) => l.includes('implemented: false')).length
console.log(`\n仍未实现（不会下发）的页面：${remaining} 个`)
if (remaining) {
  out
    .filter((l) => l.includes('implemented: false'))
    .forEach((l) => console.log('   ' + (l.match(/component: '([^']+)'/)?.[1] || l.trim())))
}
