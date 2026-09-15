/**
 * Mock 引擎 — axios adapter
 *
 * 用自定义 adapter 接管请求：命中的路由走本地 mock，未命中的返回一个显式错误，
 * 方便开发期及时发现"页面调了但没实现"的接口。
 *
 * 这样 src/api/** 与页面层完全不用改动；将来接真实后端，只要把
 * VITE_MOCK_ENABLE 置为 false 即可恢复走网络。
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { findRoute, type MockContext } from './route'
import { ElMessage } from 'element-plus'

/** 解析 query string 为对象 */
const parseQuery = (search: string): Record<string, any> => {
  const result: Record<string, any> = {}
  if (!search) return result
  new URLSearchParams(search).forEach((value, key) => {
    result[key] = value
  })
  return result
}

/** 从完整 URL 中剥离 baseURL 与 query，得到用于匹配的 path */
export const resolvePath = (url: string, baseURL?: string): string => {
  let target = url || ''
  if (baseURL && target.startsWith(baseURL)) {
    target = target.slice(baseURL.length)
  } else if (/^https?:\/\//.test(target)) {
    // 绝对地址但 baseURL 不匹配时，取 pathname
    try {
      target = new URL(target).pathname
    } catch {
      /* ignore */
    }
  }
  target = target.split('?')[0].split('#')[0]
  if (!target.startsWith('/')) target = '/' + target
  // 去掉结尾多余的 /
  return target.replace(/\/+$/, '') || '/'
}

/** 从完整 URL 中提取 query */
const resolveQuery = (url: string): Record<string, any> => {
  const index = (url || '').indexOf('?')
  if (index === -1) return {}
  return parseQuery(url.slice(index + 1))
}

/** 解析请求体 */
const resolveBody = (data: any): any => {
  if (data === undefined || data === null || data === '') return undefined
  if (typeof FormData !== 'undefined' && data instanceof FormData) return data
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      // 非 JSON（如 x-www-form-urlencoded）
      return parseQuery(data)
    }
  }
  return data
}

/** 构造一个符合 axios 约定的响应对象（注意 response.request.responseType 被拦截器读取） */
const buildResponse = (
  config: InternalAxiosRequestConfig,
  data: any,
  status = 200
): AxiosResponse => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config,
  // 拦截器会读 request.responseType，用于判断是否二进制下载
  request: { responseType: config.responseType, responseURL: config.url }
})

/**
 * 记下最后一条业务失败原因：脚手架拦截器收到 400 时只弹提示并 Promise.reject('error')，
 * 调用方拿不到中文原因。探针 / e2e 可以用 window.__lastMockError.message 精确断言文案。
 */
const recordMockError = (message: string, method: string, path: string): string => {
  ;(globalThis as any).__lastMockError = { message, method, path, time: new Date().toISOString() }
  return message
}

/** 业务失败：返回脚手架约定的错误码，由响应拦截器统一提示 */
const buildError = (config: InternalAxiosRequestConfig, msg: string, code = 500) => {
  const payload = { code, data: null, msg }
  // 下载类接口（responseType=blob）失败时也必须返回 Blob，且 MIME 必须是 application/json：
  // 否则响应拦截器会把错误对象当成文件交给前端，用户下载到一个内容是 [object Object] 的假文件。
  if (config.responseType === 'blob' || config.responseType === 'arraybuffer') {
    return buildResponse(config, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  }
  return buildResponse(config, payload)
}

export const createMockAdapter = (): AxiosAdapter => {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method || 'get').toUpperCase()
    const url = config.url || ''
    const path = resolvePath(url, config.baseURL)

    const matched = findRoute(method, path)
    if (!matched) {
      const message = `[Mock] 接口未实现：${method} ${path}`
      // eslint-disable-next-line no-console
      console.warn(message)
      ElMessage.error(message)
      return buildError(config, recordMockError(message, method, path))
    }

    const params = {
      ...resolveQuery(url),
      ...(config.params && typeof config.params === 'object' ? config.params : {})
    }

    const ctx: MockContext = {
      method,
      path,
      params,
      body: resolveBody(config.data),
      pathParams: matched.pathParams,
      config
    }

    try {
      const result = await matched.handler(ctx)
      // 二进制下载：handler 直接返回 Blob，保持 responseType 语义
      if (
        (typeof Blob !== 'undefined' && result instanceof Blob) ||
        (typeof ArrayBuffer !== 'undefined' && result instanceof ArrayBuffer)
      ) {
        return buildResponse(config, result)
      }
      // handler 可通过 { __envelope: true, ... } 自行控制返回结构（如登录）
      if (result && typeof result === 'object' && result.__envelope === true) {
        const { __envelope, ...rest } = result
        return buildResponse(config, rest)
      }
      return buildResponse(config, { code: 0, data: result, msg: '' })
    } catch (error: any) {
      const message = error?.message || 'Mock 处理异常'
      // eslint-disable-next-line no-console
      console.error(`[Mock] ${method} ${path} 处理失败：`, error)
      // 业务校验失败统一用 400：脚手架拦截器对 400 会原样弹出 msg，
      // 而 500 会被替换成通用的"系统异常"文案，业务提示会丢失。
      return buildError(config, recordMockError(message, method, path), 400)
    }
  }
}
