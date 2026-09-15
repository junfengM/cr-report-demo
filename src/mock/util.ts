/**
 * Mock 引擎 — 通用工具
 *
 * 说明：本目录是「监管报送 Demo」的纯前端数据层，用于替代真实后端。
 * 所有数据存于浏览器 localStorage，页面层与 src/api/** 均无需改动。
 */
import { cloneDeep } from 'lodash-es'

export const clone = <T>(value: T): T => cloneDeep(value)

/** 生成下一个自增 id */
export const nextId = (rows: Array<{ id: number }>): number =>
  rows.reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0) + 1

/** 是否为空条件（空条件表示"不过滤"） */
export const isEmpty = (value: any): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

/** 精确匹配：条件为空时视为通过 */
export const eq = (row: Record<string, any>, field: string, value: any): boolean => {
  if (isEmpty(value)) return true
  return String(row[field]) === String(value)
}

/** 包含匹配：条件为空时视为通过 */
export const includes = (row: Record<string, any>, field: string, value: any): boolean => {
  if (isEmpty(value)) return true
  const values = Array.isArray(value) ? value : String(value).split(',')
  return values.some((v) => String(row[field]) === String(v))
}

/** 模糊匹配：任一字段包含关键字 */
export const likeAny = (row: Record<string, any>, fields: string[], keyword?: string): boolean => {
  if (isEmpty(keyword)) return true
  const kw = String(keyword).trim().toLowerCase()
  if (!kw) return true
  return fields.some((field) =>
    String(row[field] ?? '')
      .toLowerCase()
      .includes(kw)
  )
}

/** 日期/时间区间过滤：value 落在 [begin, end] 内（含边界，按字符串比较即可） */
export const betweenDate = (value: any, begin?: string, end?: string): boolean => {
  if (isEmpty(value)) return isEmpty(begin) && isEmpty(end)
  const v = String(value).replace(/[-: ]/g, '').slice(0, 14)
  if (!isEmpty(begin) && v < String(begin).replace(/[-: ]/g, '')) return false
  if (!isEmpty(end) && v > String(end).replace(/[-: ]/g, '')) return false
  return true
}

/** 数值区间过滤 */
export const betweenNumber = (value: any, min?: any, max?: any): boolean => {
  const v = Number(value)
  if (Number.isNaN(v)) return isEmpty(min) && isEmpty(max)
  if (!isEmpty(min) && v < Number(min)) return false
  if (!isEmpty(max) && v > Number(max)) return false
  return true
}

/** 分页：入参 pageNo / pageSize（缺省 1 / 10），返回 { list, total } */
export const paginate = <T>(rows: T[], params: Record<string, any> = {}) => {
  const pageNo = Math.max(1, Number(params.pageNo) || 1)
  const pageSize = Math.max(1, Number(params.pageSize) || 10)
  const start = (pageNo - 1) * pageSize
  return { list: rows.slice(start, start + pageSize), total: rows.length }
}

/** 扁平列表 → 树（默认按 id / parentId 组装） */
export const toTree = <T extends Record<string, any>>(
  rows: T[],
  idKey = 'id',
  parentKey = 'parentId',
  childrenKey = 'children'
): T[] => {
  const map = new Map<any, T>()
  const roots: T[] = []
  rows.forEach((row) => map.set(row[idKey], { ...row, [childrenKey]: [] }))
  map.forEach((node) => {
    const parent = map.get(node[parentKey])
    if (parent) {
      parent[childrenKey].push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

/** 收集树上某个节点的全部后代 id（含自身） */
export const collectTreeIds = <T extends Record<string, any>>(
  rows: T[],
  rootId: any,
  idKey = 'id',
  parentKey = 'parentId'
): any[] => {
  const result: any[] = [rootId]
  let frontier = [rootId]
  while (frontier.length) {
    const next = rows.filter((row) => frontier.includes(row[parentKey])).map((row) => row[idKey])
    if (!next.length) break
    result.push(...next)
    frontier = next
  }
  return result
}

/** 时间戳格式化 yyyy-MM-dd HH:mm:ss */
export const formatDateTime = (date: Date | number = new Date()): string => {
  const d = typeof date === 'number' ? new Date(date) : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** 时间戳格式化 yyyy-MM-dd */
export const formatDate = (date: Date | number = new Date()): string => {
  const d = typeof date === 'number' ? new Date(date) : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 生成 CSV Blob，用于让脚手架里的「导出 Excel」按钮在无后端时也能下载到文件。
 * 注意：不改动 api 层，导出的仍是 .xls 文件名，内容为 CSV（Excel 可直接打开）。
 */
export const csvBlob = (
  rows: Array<Record<string, any>>,
  headers: Array<{ field: string; label: string; formatter?: (row: Record<string, any>) => any }>
): Blob => {
  const escape = (value: any) => {
    const text = value === undefined || value === null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [
    headers.map((h) => escape(h.label)).join(','),
    // 有 formatter 就用它（枚举列导出中文名、数组列拼成可读文本），否则按字段原值导出
    ...rows.map((row) =>
      headers.map((h) => escape(h.formatter ? h.formatter(row) : row[h.field])).join(',')
    )
  ]
  // 加 BOM，避免 Excel 打开中文乱码
  return new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
}

/** 生成随机业务编号，如 BX2026090001 */
export const genNo = (prefix: string, seq: number, width = 4): string =>
  `${prefix}${String(seq).padStart(width, '0')}`
