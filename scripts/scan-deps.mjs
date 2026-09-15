/**
 * 依赖引用扫描（「依赖瘦身」的证据工具）
 *
 * 用法：node scripts/scan-deps.mjs [--json]
 *
 * 做法：把 package.json 里的每个依赖拿到 src / scripts / build / types / 各配置文件里找引用，
 * 支持 from / import() / require() / @import / url() / 直接字符串这些写法，并且认子路径引用
 * （例如 echarts/core、element-plus/es/...）。
 *
 * 结论怎么用：**只有一条引用都没有的依赖**才允许从 package.json 删掉；
 * 有引用的（哪怕只有一处）都列出来当"留着它"的证据 —— 删了会直接构建失败。
 * 注意：@types/*、eslint/prettier/stylelint 插件这类走"配置字符串"的依赖，
 * 本脚本会在 eslint / stylelint / prettier / tsconfig / vite / uno 配置里一起找。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.vite', '.cache', 'coverage'])
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.vue', '.json', '.scss', '.css', '.html'])
const ROOT_FILES = [
  'vite.config.ts',
  'uno.config.ts',
  'tsconfig.json',
  'postcss.config.js',
  'stylelint.config.js',
  'eslint.config.js',
  'eslint.config.mjs',
  'prettier.config.js',
  '.eslintrc.js',
  '.prettierrc.js'
]
// 注意：package.json 本身不算"引用"（它是声明的地方），否则每个依赖都会至少命中一次自引用

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name))
      continue
    }
    if (EXTS.has(extname(entry.name))) files.push(join(dir, entry.name))
  }
}
for (const dir of ['src', 'scripts', 'build', 'types']) {
  if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir))
}
for (const file of ROOT_FILES) {
  if (existsSync(join(ROOT, file))) files.push(join(ROOT, file))
}

// walk 里已经拼过绝对路径，这里直接用
const sources = files.map((file) => ({ file, text: readFileSync(file, 'utf8') }))

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
// npm scripts 里按名字调用的命令行工具（eslint / prettier / stylelint / rimraf / vue-tsc…）
// 也是真实引用 —— 代码里 import 不到它们，但删了就 pnpm lint / ts:check 起不来
sources.push({ file: 'package.json#scripts', text: JSON.stringify(pkg.scripts || {}) })

/** 一个依赖出现的几种写法：import/require 的模块名、配置里的字符串、样式里的 url()/@import */
const hitsOf = (dep) => {
  const pattern = new RegExp(
    '(?:from\\s*|import\\(\\s*|require\\(\\s*|@import\\s+|url\\(\\s*|["\'\`])' +
      dep.replace(/[/@.+-]/g, (char) => '\\' + char) +
      '(?:[/"\'\`]|\\s|$)',
    'g'
  )
  const hits = sources.filter((source) => pattern.test(source.text)).map((source) => source.file)
  // @types/x 是给 TypeScript 隐式消费的：只要它对应的运行库还在依赖里，就属于"有引用"
  if (dep.indexOf('@types/') === 0) {
    const base = dep.slice('@types/'.length)
    const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    if (declared[base] || base === 'node') hits.push('tsconfig / TypeScript 隐式（' + base + '）')
  }
  // 说明性依赖：本项目用到的构建期工具链
  return hits
}
const groups = [
  ['dependencies', pkg.dependencies || {}],
  ['devDependencies', pkg.devDependencies || {}]
]

const rows = []
for (const [group, deps] of groups) {
  for (const dep of Object.keys(deps).sort()) {
    const hits = hitsOf(dep)
    rows.push({ dep, group, version: deps[dep], count: hits.length, files: hits })
  }
}

/**
 * 不用 import 也能构成真实引用的几类（脚本路径调用 / 配置文件键名 / peer 依赖）。
 * 这几条是"人工确认过、不能删"的证据，写死在这里，避免下次复扫时被误删。
 */
const INDIRECT_REASONS = {
  'vue-tsc': 'npm script ts:check 直接用 ./node_modules/vue-tsc/bin/vue-tsc.js 调用',
  rimraf: 'npm script clean / clean:cache 用 npx rimraf 调用',
  sass: '项目大量 <style lang="scss"> + vite 的 css.preprocessorOptions.scss',
  postcss: 'postcss.config.js 存在，PostCSS 配置本身需要它',
  autoprefixer: 'postcss.config.js 的 plugins.autoprefixer（删了样式前缀会消失）',
  '@unocss/eslint-plugin': '@unocss/eslint-config 的 peer，eslint.config.mjs 导入 @unocss/eslint-config/flat',
  'vue-eslint-parser': 'eslint.config.mjs 解析 .vue 文件时的 parser（eslint-plugin-vue 的 peer）'
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  const zero = rows.filter((row) => row.count === 0)
  const indirect = zero.filter((row) => INDIRECT_REASONS[row.dep])
  const unused = zero.filter((row) => !INDIRECT_REASONS[row.dep])
  console.log('依赖总数：' + rows.length + '\n')
  console.log('=== A. 真正无引用（可安全删除） ===')
  if (!unused.length) console.log('  （无）')
  unused.forEach((row) => console.log('  ' + row.dep + '  ' + row.version + '  [' + row.group + ']'))
  console.log('\n=== B. 无 import 引用但有间接证据（保留，附理由） ===')
  if (!indirect.length) console.log('  （无）')
  indirect.forEach((row) => console.log('  ' + row.dep.padEnd(24) + ' ' + INDIRECT_REASONS[row.dep]))
  console.log('\n=== 有引用（保留证据，引用处最多的只列前 3 个） ===')
  rows
    .filter((row) => row.count > 0)
    .sort((a, b) => a.count - b.count)
    .forEach((row) =>
      console.log(
        '  ' + row.dep.padEnd(34) + ' ×' + String(row.count).padStart(2) + '  ' + row.files.slice(0, 3).join(', ')
      )
    )
}
