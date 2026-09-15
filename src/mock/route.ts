/**
 * Mock 引擎 — 路由注册表
 *
 * 约定：按 `METHOD /path` 精确匹配（path 不含 query）。
 * path 支持 `:param` 占位符，例如 `/system/user/get/:id`。
 */
export interface MockContext {
  /** 大写 HTTP 方法 */
  method: string
  /** 去掉 baseURL 与 query 后的路径，如 /system/user/page */
  path: string
  /** query 参数（URL 上的 + config.params 合并） */
  params: Record<string, any>
  /** 请求体（JSON 已解析；FormData 原样） */
  body: any
  /** path 上的占位符参数 */
  pathParams: Record<string, string>
  /** 原始 axios 配置 */
  config: any
}

export type MockHandler = (ctx: MockContext) => any

interface Route {
  method: string
  /** 原始注册路径 */
  path: string
  /** 匹配用的正则 */
  regexp: RegExp
  /** 占位符名称 */
  keys: string[]
  handler: MockHandler
}

const routes: Route[] = []

const compile = (path: string) => {
  const keys: string[] = []
  const pattern = path
    .replace(/\/+$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, (match) => (match === '*' ? '.*' : `\\${match}`))
    .replace(/:([A-Za-z0-9_]+)/g, (_match, key) => {
      keys.push(key)
      return '([^/]+)'
    })
  return { regexp: new RegExp(`^${pattern}$`), keys }
}

const register = (method: string, path: string, handler: MockHandler) => {
  const normalized = method.toUpperCase()
  const { regexp, keys } = compile(path)
  // 后注册的覆盖先注册的（便于业务层覆盖通用资源路由）
  const index = routes.findIndex((route) => route.method === normalized && route.path === path)
  const route: Route = { method: normalized, path, regexp, keys, handler }
  if (index === -1) {
    routes.push(route)
  } else {
    routes[index] = route
  }
}

const match = (
  method: string,
  path: string
): { handler: MockHandler; pathParams: Record<string, string> } | undefined => {
  const normalized = method.toUpperCase()
  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i]
    if (route.method !== normalized) continue
    const result = route.regexp.exec(path)
    if (!result) continue
    const pathParams: Record<string, string> = {}
    route.keys.forEach((key, index) => {
      pathParams[key] = decodeURIComponent(result[index + 1] ?? '')
    })
    return { handler: route.handler, pathParams }
  }
  return undefined
}

export const onGet = (path: string, handler: MockHandler) => register('GET', path, handler)
export const onPost = (path: string, handler: MockHandler) => register('POST', path, handler)
export const onPut = (path: string, handler: MockHandler) => register('PUT', path, handler)
export const onDelete = (path: string, handler: MockHandler) => register('DELETE', path, handler)
/** 同一个 path 注册全部方法（用于兜底） */
export const onAny = (path: string, handler: MockHandler) => {
  ;['GET', 'POST', 'PUT', 'DELETE'].forEach((method) => register(method, path, handler))
}

export const findRoute = match
export const routeCount = () => routes.length
export const routeList = () => routes.map((route) => `${route.method} ${route.path}`)
