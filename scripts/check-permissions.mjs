// 静态检查：**已上线页面**里用到的 v-hasPermi / checkPermi 权限标识，是否都在 mock 菜单里授权了
// 漏授权的后果是按钮整块从 DOM 消失（v-hasPermi 的行为），而且控制台不报错，很难发现。
//
// 扫描范围口径（关键）：
//   不再按目录遍历 src/views，而是从 src/mock/db/menu.ts 里提取所有
//   `component: 'xxx/yyy/index'`，映射到 src/views/xxx/yyy/ 目录后再递归扫描
//   （页面会把子弹窗组件放在同目录的子目录里，必须递归）。
//   这样：
//     - 以后新增任何上线页面都会自动纳入检查；
//     - src/views/system 下的未上线残留页面（mail / sms / notify / tenant /
//       social / oauth2 / area 等）不在 menu.ts 里，不会被误报。
// 用法：node scripts/check-permissions.mjs
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const ROOT = process.cwd()
const MENU = join(ROOT, 'src/mock/db/menu.ts')
const VIEWS = join(ROOT, 'src/views')

const menuSource = readFileSync(MENU, 'utf-8')

/** ============ 1. 上线页面：menu.ts 里的组件路径 ============ */
const components = [...menuSource.matchAll(/component:\s*'([^']+)'/g)].map((m) => m[1])
const pageDirs = [...new Set(components.map((component) => join(VIEWS, dirname(component))))]

/** 递归收集目录下的 .vue（同目录子文件夹里的子弹窗组件也要算进来） */
const walk = (dir) => {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (name.endsWith('.vue')) out.push(full)
  }
  return out
}

const files = new Set()
const missingDirs = []
for (const dir of pageDirs) {
  if (!existsSync(dir)) {
    missingDirs.push(dir)
    continue
  }
  walk(dir).forEach((file) => files.add(file))
}

/** ============ 2. mock 里已授权的权限标识 ============ */
const granted = new Set()
// BUTTONS 的 [名称, 权限标识] 元组
// BUTTONS 的 [名称, 权限标识] 元组。第三个元素是可选的「按钮角色」，写成数组字面量
// （[ROLE_CODE.ADMIN]）或常量（ADMIN_ONLY）都要能匹配到，否则会把已授权的按钮误报成缺失。
for (const m of menuSource.matchAll(
  /\['[^']*',\s*'([^']+)'(?:\s*,\s*(?:\[[^\]]*\]|[A-Za-z_$][\w$]*))?\]/g
)) {
  granted.add(m[1])
}
// 菜单自身的 permission 字段（type 2 菜单节点）
for (const m of menuSource.matchAll(/permission:\s*'([^']+)'/g)) {
  granted.add(m[1])
}

/** ============ 3. 页面里用到的权限标识 → 出现位置 ============ */
const used = new Map()
const record = (perm, rel) => {
  if (!used.has(perm)) used.set(perm, new Set())
  used.get(perm).add(rel)
}
for (const file of files) {
  const src = readFileSync(file, 'utf-8')
  const rel = relative(ROOT, file)
  // v-hasPermi="['a', 'b']"（模板里可能跨行）
  for (const m of src.matchAll(/v-hasPermi="\[([^\]]+)\]"/g)) {
    for (const p of m[1].matchAll(/'([^']+)'/g)) record(p[1], rel)
  }
  // checkPermi(['a'])（脚本里常用于控制按钮/下拉项显隐）
  for (const m of src.matchAll(/checkPermi\(\[([^\]]+)\]/g)) {
    for (const p of m[1].matchAll(/'([^']+)'/g)) record(p[1], rel)
  }
}

const missing = [...used.entries()].filter(([perm]) => !granted.has(perm))
const grantedUsed = used.size - missing.length

console.log(`上线页面数：${components.length} 个（来自 src/mock/db/menu.ts 的 component 路径）`)
console.log(`扫描页面目录：${pageDirs.length} 个，.vue 文件：${files.size} 个（含子目录子弹窗）`)
console.log(`页面用到的权限标识：${used.size} 个，其中已授权：${grantedUsed} 个`)
console.log(`mock 菜单已授权权限标识总数：${granted.size} 个`)
if (missingDirs.length) {
  console.log(`\n⚠️  以下上线页面的目录不存在：\n${missingDirs.map((d) => `  ${relative(ROOT, d)}`).join('\n')}`)
}

if (missing.length === 0) {
  console.log(
    `\n✅ 上线页面用到的 ${used.size} 个权限标识都已在 src/mock/db/menu.ts 的 BUTTONS 中授权`
  )
  process.exit(0)
}

console.log(`\n❌ 未授权清单：${missing.length} 个权限标识没有在 mock 菜单里授权，对应按钮不会显示：\n`)
for (const [perm, sources] of missing) {
  console.log(`  ${perm}`)
  for (const f of sources) console.log(`      ← ${f}`)
}
console.log('\n修复方式：在 src/mock/db/menu.ts 的 BUTTONS 里，给对应路由 key 补上该权限标识。')
process.exit(1)
