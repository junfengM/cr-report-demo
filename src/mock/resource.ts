/**
 * Mock 引擎 — 通用资源路由
 *
 * 脚手架里 95% 的接口都是 `${prefix}/page|list|get|create|update|delete|delete-list|simple-list|export-excel`
 * 这一套固定形态。这里抽成通用注册器，业务 handler 只需描述"用哪张表、怎么过滤、simple-list 返回什么"。
 */
import { onDelete, onGet, onPost, onPut, type MockContext } from './route'
import type { Table } from './store'
import { csvBlob, paginate } from './util'

export interface ExportColumn {
  field: string
  label: string
  /** 导出取值：默认取 row[field]；枚举列 / 数组列在这里换成中文或可读文本 */
  formatter?: (row: any) => any
}

export interface ResourceOptions<T extends { id: number }> {
  /** 接口前缀，如 /system/user */
  prefix: string
  /** 数据表 */
  table: Table<T>
  /** 列表过滤条件（page / list / export 共用） */
  filter?: (row: T, params: Record<string, any>) => boolean
  /** 追加排序 */
  sort?: (a: T, b: T) => number
  /** 新建前加工（第二个参数是请求上下文，可用来取操作人） */
  beforeCreate?: (body: any, ctx?: MockContext) => Partial<T>
  /** 更新前加工（同上） */
  beforeUpdate?: (body: any, ctx?: MockContext) => Partial<T>
  /**
   * 写操作前的角色守卫：registerResource 的 hook 拿不到 ctx，所以角色校验走这里。
   * 调用时机是"写操作入口"，不是"页面藏按钮"——直接拿接口地址也要拦住。
   * action 是中文动作名（新建 / 修改 / 删除 / 批量删除），拼进错误提示。
   */
  guard?: (ctx: MockContext, action: string) => void
  /** simple-list 的映射（默认 id + name） */
  toSimple?: (row: T) => any
  /** 列表投影（page / list 共用；用来在列表里去掉 base64 内容这类大字段，get 与导出不受影响） */
  toListRow?: (row: T) => any
  /** 导出列（不传则不注册 export-excel） */
  exportColumns?: ExportColumn[]
  /** 是否注册 export-excel（默认 exportColumns 存在时注册） */
  registerExport?: boolean
}

/** 把 ids 参数（"1,2,3" 或 [1,2,3]）解析成数组 */
export const parseIds = (ids: any): number[] => {
  if (ids === undefined || ids === null || ids === '') return []
  const list = Array.isArray(ids) ? ids : String(ids).split(',')
  return list.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
}

/**
 * 注册一套标准 CRUD 路由。
 * 注意：本函数不注册 get（部分页面用 /get/:id，部分用 /get?id=），两种都注册。
 */
export const registerResource = <T extends { id: number }>(options: ResourceOptions<T>): void => {
  const { prefix, table } = options

  const query = (params: Record<string, any>): T[] => {
    let rows = table.all()
    if (options.filter) {
      rows = rows.filter((row) => options.filter!(row, params))
    }
    if (options.sort) {
      rows = [...rows].sort(options.sort)
    }
    return rows
  }

  const simple = (rows: T[]) =>
    options.toSimple ? rows.map(options.toSimple) : rows.map((row) => ({ ...row }))

  const listed = (rows: T[]) => (options.toListRow ? rows.map(options.toListRow) : rows)
  // 分页
  onGet(`${prefix}/page`, (ctx) => paginate(listed(query(ctx.params)), ctx.params))
  // 不分页列表
  onGet(`${prefix}/list`, (ctx) => listed(query(ctx.params)))
  // 下拉简化列表
  onGet(`${prefix}/simple-list`, (ctx) => simple(query(ctx.params)))

  const getById = (ctx: MockContext) => {
    const id = ctx.pathParams.id ?? ctx.params.id
    const row = table.get(Number(id))
    if (!row) throw new Error(`记录不存在：id=${id}`)
    return row
  }
  onGet(`${prefix}/get`, getById)
  onGet(`${prefix}/get/:id`, getById)

  const create = (ctx: MockContext) => {
    if (options.guard) options.guard(ctx, '新建')
    const body = { ...(ctx.body || {}) }
    // 由页面传入 id 时（部分主子表提交）保留，否则自增
    const payload = options.beforeCreate ? options.beforeCreate(body, ctx) : body
    const created = table.insert(payload as Partial<T>)
    return created.id
  }
  onPost(`${prefix}/create`, create)

  const update = (ctx: MockContext) => {
    if (options.guard) options.guard(ctx, '修改')
    const body = { ...(ctx.body || {}) }
    if (body.id === undefined || body.id === null) throw new Error('缺少 id')
    // beforeUpdate 的返回值常常是"只挑出可改字段"的部分载荷（不含 id），
    // 而 table.update 是按 payload.id 匹配的 —— 这里统一把 id 兜回来，
    // 否则所有 fill 型 beforeUpdate 的"修改"都会报「记录不存在」。
    const handled = options.beforeUpdate ? options.beforeUpdate(body, ctx) : body
    const payload = { ...handled, id: Number(body.id) }
    const updated = table.update(payload as Partial<T> & { id: number })
    if (!updated) throw new Error(`记录不存在：id=${body.id}`)
    return true
  }
  onPut(`${prefix}/update`, update)

  const remove = (ctx: MockContext) => {
    if (options.guard) options.guard(ctx, '删除')
    const id = Number(ctx.params.id)
    if (Number.isNaN(id)) throw new Error('缺少 id')
    table.remove(id)
    return true
  }
  onDelete(`${prefix}/delete`, remove)

  const removeBatch = (ctx: MockContext) => {
    if (options.guard) options.guard(ctx, '批量删除')
    const ids = parseIds(ctx.params.ids)
    if (!ids.length) throw new Error('缺少 ids')
    table.removeBatch(ids)
    return true
  }
  onDelete(`${prefix}/delete-list`, removeBatch)

  if (options.exportColumns && options.registerExport !== false) {
    onGet(`${prefix}/export-excel`, (ctx) => csvBlob(query(ctx.params), options.exportColumns!))
  }
}

/** 通用"按 id 集合查询"辅助：params.ids = '1,2,3' */
export const byIds = (ids: any) => {
  const list = parseIds(ids)
  return (row: { id: number }) => (list.length ? list.includes(row.id) : true)
}
