/**
 * Mock 引擎入口
 *
 * 用法：在 main.ts 中调用 `setupMock()`（受 VITE_MOCK_ENABLE 控制）。
 * 安装后 axios 的所有请求都由本地 mock 处理，`src/api/**` 与页面层零改动。
 */
import { service } from '@/config/axios/service'
import { createMockAdapter } from './adapter'
import { routeCount } from './route'

/**
 * 自动发现并注册所有 handler（导入即注册路由）。
 *
 * 约定：新增业务接口时，只要在 `src/mock/handlers/` 下新建一个模块并调用
 * `onGet/onPost/onPut/onDelete/registerResource`，无需修改本文件。
 */
const handlerModules = import.meta.glob('./handlers/**/*.ts', { eager: true })
export const HANDLER_COUNT = Object.keys(handlerModules).length

export const MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLE === 'true'

/** 安装 mock adapter */
export const setupMock = (): void => {
  if (!MOCK_ENABLED) return
  service.defaults.adapter = createMockAdapter()
  // eslint-disable-next-line no-console
  console.info(
    `%c[Mock] 本地数据模式已启用：${HANDLER_COUNT} 个 handler 模块，` +
      `${routeCount()} 条接口路由。数据持久化在 localStorage（key 前缀 cr-mock:）。`,
    'color:#409eff;font-weight:bold'
  )
}

export { resetDatabase, SEED_VERSION } from './store'
export { routeList } from './route'
