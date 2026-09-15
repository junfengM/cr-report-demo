/**
 * Mock 引擎 — 本地"数据表"
 *
 * 每张表用一个 localStorage key 持久化；整库带种子版本号，版本升级时自动重置，
 * 避免开发期改了种子数据但浏览器里还是旧数据。
 */
import { clone, nextId } from './util'

/**
 * 种子数据版本：修改 src/mock/db/** 的初始数据后请 +1，浏览器会清空旧数据重新播种。
 *
 * v2（2026-09-12）：新增 cr-meta / cr-task / cr-query / cr-check 各域种子表；
 *                   并修正字典 cr_rule_type（六类）与 cr_error_level（1 警告 / 2 错误）的取值。
 *                   —— 字典也走 localStorage 持久化，不 bump 版本会残留旧码值。
 * v3（2026-09-12）：新增 cr-submit 一键报送域种子表（文件配置 / 报文上报状态 / 报送批次 /
 *                   批次明细 / 质量检核），并调整报文状态与生成时间分布。
 * v4（2026-09-12）：删除工作台独立统计表，改为从任务表实时汇总。
 * v5（2026-09-12）：补充 120 条历史任务，配合工作台时间趋势。
 * v6（2026-09-12）：新增 cr-message 报文配置域种子表（报表定制 / 报文信息 / 口径信息 /
 *                   报文集 / 填报人指派），并补两个字典 cr_message_type、cr_caliber_type。
 * v7（2026-09-12）：新增 cr-collect 数据采集域种子表（期次 / 采集方式 / 导入设置 / 导入任务与明细 /
 *                   导入审核 / 导入权限 / 导入日志 / 补录），并补 8 个字典（期次状态、采集方式、
 *                   文件类型、导入状态、导入动作、补录状态、授权主体、启停状态）。
 * v8（2026-09-12）：导入审核流水状态改为复用已有的 cr_audit_status 字典（0 待审核 / 1 审核通过 /
 *                   2 审核不通过），种子里的 1/2/3 三套码值随之重映射。
 * v9（2026-09-12）：新增 cr-desensitize 数据脱敏域三张种子表（规则 8 / 字段配置 17 / 历史批次 11）
 *                   与字典 cr_desens_status；填报明细的证件号由「出生即掩码」改为 18 位原文——
 *                   否则这一列永远不会被「脱敏执行」命中。
 * v10（2026-09-12）：脱敏批次号改为按「期次」独立编号（种子批次与执行批次同一口径：
 *                   DS + 期次 + 4 位序号，取已用最大序号 +1，删除批次也不会撞号）。
 * v12（2026-09-13）：任务调度一章补齐——新增 cr.collectTaskGroup / cr.collectTask / cr.collectTaskLog /
 *                   cr.schedule / cr.cluster 五张表（跑批日志种子含"失败 → 等待前置 → 手工重跑"的完整现场），
 *                   crMessage 新增 cr.sqlFormula（公式 SQL 定制）；另补 5 个字典：
 *                   任务实现类型 / 任务运行状态 / 集群节点角色 / 集群节点状态 / 公式类型。
 * v13（2026-09-13）：跑批日志种子里"失败 / 等待前置 / 运行中"三种现场用强制状态造，
 *                   并修正强制状态传参（原来传了 status 而构造函数读的是 forceStatus，
 *                   导致"2026-09-01 那条失败与两条等待前置"实际没生效）；
 *                   跑批日志行不再自带 id:0（会被 insert 当成"已指定 id"，立即执行的返回值恒为 0）。
 * v11（2026-09-12）：数据采集深化——新增 cr.supplementFile（补录附件，内容以 base64 存本地）、
 *                   cr.collectJob（取数任务 / 连接测试留痕）两张表；导入权限 cr.importAuth
 *                   开始真正参与导入校验（补齐 effectiveImportAuth 的口径，未命中即拒绝）；
 *                   导入设置里「广东分公司 × BX011」那条由停用改为启用的 XLSX 模板（浏览器内直接解析）；
 *                   collectJob 的请求参数带上真实机构代码（原来机构代码写死成空串）。
 */
export const SEED_VERSION = 25

const VERSION_KEY = 'cr-mock:seed-version'
const TABLE_PREFIX = 'cr-mock:table:'
export const DB_RESET_EVENT = 'cr-mock:db-reset'

const storage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** 版本不一致时清空所有 mock 表 */
const ensureSeedVersion = () => {
  const s = storage()
  if (!s) return
  if (s.getItem(VERSION_KEY) !== String(SEED_VERSION)) {
    Object.keys(s)
      .filter((key) => key.startsWith(TABLE_PREFIX))
      .forEach((key) => s.removeItem(key))
    s.setItem(VERSION_KEY, String(SEED_VERSION))
  }
}
ensureSeedVersion()

export interface Table<T extends { id: number }> {
  readonly name: string
  /** 全量数据（副本） */
  all(): T[]
  /** 全量覆盖保存 */
  save(rows: T[]): void
  find(predicate: (row: T) => boolean): T[]
  findOne(predicate: (row: T) => boolean): T | undefined
  get(id: number): T | undefined
  insert(row: Partial<T>): T
  update(row: Partial<T> & { id: number }): T | undefined
  remove(id: number): void
  removeBatch(ids: number[]): void
  /** 恢复为种子数据 */
  reset(): void
}

/**
 * 定义一张 mock 表。
 * @param name 表名（同时作为 localStorage key 后缀）
 * @param seed 种子数据（函数形式可延迟到首次访问时求值）
 */
export const defineTable = <T extends { id: number }>(
  name: string,
  seed: T[] | (() => T[])
): Table<T> => {
  const key = TABLE_PREFIX + name
  const readSeed = (): T[] => clone(typeof seed === 'function' ? seed() : seed)

  const load = (): T[] => {
    const s = storage()
    if (!s) return readSeed()
    const raw = s.getItem(key)
    if (!raw) {
      const initial = readSeed()
      s.setItem(key, JSON.stringify(initial))
      return initial
    }
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : readSeed()
    } catch {
      return readSeed()
    }
  }

  let rows: T[] = load()

  const flush = () => {
    const s = storage()
    if (s) s.setItem(key, JSON.stringify(rows))
  }

  return {
    name,
    all: () => clone(rows),
    save(next) {
      rows = clone(next)
      flush()
    },
    find: (predicate) => clone(rows.filter(predicate)),
    findOne: (predicate) => {
      const hit = rows.find(predicate)
      return hit ? clone(hit) : undefined
    },
    get: (id) => {
      const hit = rows.find((row) => String(row.id) === String(id))
      return hit ? clone(hit) : undefined
    },
    insert(row) {
      const created = { ...(row as T), id: row.id ?? nextId(rows) }
      rows.unshift(created)
      flush()
      return clone(created)
    },
    update(row) {
      const index = rows.findIndex((item) => String(item.id) === String(row.id))
      if (index === -1) return undefined
      rows[index] = { ...rows[index], ...row }
      flush()
      return clone(rows[index])
    },
    remove(id) {
      rows = rows.filter((item) => String(item.id) !== String(id))
      flush()
    },
    removeBatch(ids) {
      const set = new Set(ids.map(String))
      rows = rows.filter((item) => !set.has(String(item.id)))
      flush()
    },
    reset() {
      rows = readSeed()
      flush()
    }
  }
}

/** 清空全部 mock 数据并重新播种（在"重置演示数据"入口调用） */
export const resetDatabase = () => {
  const s = storage()
  if (!s) return
  Object.keys(s)
    .filter((key) => key.startsWith(TABLE_PREFIX))
    .forEach((key) => s.removeItem(key))
  s.removeItem(VERSION_KEY)
  ensureSeedVersion()
  window.dispatchEvent(new CustomEvent(DB_RESET_EVENT))
}
