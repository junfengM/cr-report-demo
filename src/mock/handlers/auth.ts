/**
 * Mock Handler — 登录 / 权限
 *
 * 完整复刻脚手架原生登录链路所依赖的接口：
 *   login → get-permission-info（user / roles / permissions / menus）→ 动态路由
 *
 * Token 采用 `mock-token.{userId}.{随机串}` 形式，便于 get-permission-info
 * 从 Authorization 头反解出当前登录人，从而演示"切换角色登录 = 切换菜单与数据范围"。
 */
import { onGet, onPost, onPut, type MockContext } from '../route'
import { ROLE_CODE, DEMO_PASSWORD, roleTable, userTable, type UserRow } from '../db/system'
import { permissionsForRoles, routeTreeForRoles } from '../db/menu'
import { deptTable } from '../db/org'
import { postTable } from '../db/system'
import { formatDateTime } from '../util'

const TOKEN_PREFIX = 'mock-token.'

const createToken = (userId: number) =>
  `${TOKEN_PREFIX}${userId}.${Math.random().toString(36).slice(2, 10)}`

/** 从 Authorization 头解析当前用户 */
export const currentUser = (ctx: MockContext): UserRow | undefined => {
  const headers = ctx.config?.headers || {}
  const raw: string =
    headers.Authorization || headers.authorization || headers.Authorization?.toString?.() || ''
  const token = String(raw).replace(/^Bearer\s+/i, '')
  if (!token.startsWith(TOKEN_PREFIX)) return undefined
  const userId = Number(token.slice(TOKEN_PREFIX.length).split('.')[0])
  if (Number.isNaN(userId)) return undefined
  return userTable.get(userId)
}

/** 当前用户的角色 code 列表 */
export const currentRoleCodes = (ctx: MockContext): string[] => {
  const user = currentUser(ctx)
  if (!user) return []
  const roles = roleTable.all().filter((role) => user.roleIds.includes(role.id))
  return roles.map((role) => role.code)
}

/** 取当前用户；取不到直接抛错，交由 adapter 转成错误响应 */
export const requireUser = (ctx: MockContext): UserRow => {
  const user = currentUser(ctx)
  if (!user) throw new Error('登录已过期，请重新登录')
  return user
}

/** ---------- 登录 ---------- */
onPost('/system/auth/login', (ctx) => {
  const { username, password } = ctx.body || {}
  const user = userTable.findOne((row) => row.username === String(username || '').trim())
  if (!user || user.password !== password) {
    throw new Error('账号或密码不正确')
  }
  if (user.status === 1) {
    throw new Error('账号已被停用，请联系系统管理员')
  }
  // 记录登录信息
  userTable.update({
    id: user.id,
    loginIp: '127.0.0.1',
    loginDate: formatDateTime()
  })
  const accessToken = createToken(user.id)
  return {
    id: user.id,
    accessToken,
    refreshToken: accessToken.replace(TOKEN_PREFIX, 'mock-refresh.'),
    userId: user.id,
    userType: 2,
    clientId: 'mock-client',
    expiresTime: Date.now() + 30 * 24 * 3600 * 1000
  }
})

/** 刷新令牌：脚手架刷新用的是全局 axios，不走 adapter，这里仅作兜底 */
onPost('/system/auth/refresh-token', (ctx) => {
  const refreshToken = String(ctx.params.refreshToken || '')
  const userId = Number(refreshToken.replace('mock-refresh.', '').split('.')[0])
  const user = userTable.get(userId)
  if (!user) throw new Error('无效的刷新令牌')
  const accessToken = createToken(user.id)
  return {
    id: user.id,
    accessToken,
    refreshToken: accessToken.replace(TOKEN_PREFIX, 'mock-refresh.'),
    userId: user.id,
    userType: 2,
    clientId: 'mock-client',
    expiresTime: Date.now() + 30 * 24 * 3600 * 1000
  }
})

onPost('/system/auth/logout', () => true)

/** ---------- 权限信息 ---------- */
onGet('/system/auth/get-permission-info', (ctx) => {
  const user = requireUser(ctx)
  const roleCodes = currentRoleCodes(ctx)
  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      deptId: user.deptId
    },
    roles: roleCodes,
    permissions: permissionsForRoles(roleCodes),
    menus: routeTreeForRoles(roleCodes)
  }
})

/** ---------- 个人中心 ---------- */
onGet('/system/user/profile/get', (ctx) => {
  const user = requireUser(ctx)
  const dept = deptTable.get(user.deptId)
  const posts = postTable.all().filter((post) => user.postIds.includes(post.id))
  return {
    ...user,
    dept: dept ? { id: dept.id, name: dept.name } : undefined,
    posts: posts.map((post) => ({ id: post.id, name: post.name }))
  }
})

/**
 * 个人中心更新：脚手架把昵称/邮箱/手机号/性别放在 `user` 字段里。
 * 更新昵称后需要同步刷新缓存，否则头部显示的还是旧昵称。
 */
onPut('/system/user/profile/update', (ctx) => {
  const user = requireUser(ctx)
  const body = ctx.body || {}
  userTable.update({
    id: user.id,
    ...body,
    ...(body.user && typeof body.user === 'object' ? {} : {})
  })
  return true
})

onPut('/system/user/profile/update-password', (ctx) => {
  const user = requireUser(ctx)
  const { oldPassword, newPassword } = ctx.body || {}
  if (user.password !== oldPassword) throw new Error('旧密码不正确')
  userTable.update({ id: user.id, password: newPassword })
  return true
})

/** ---------- 租户（Demo 关闭多租户，保留空实现避免报错） ---------- */
onGet('/system/tenant/get-id-by-name', () => 1)
onGet('/system/tenant/get-by-website', () => ({ id: 1, name: '华信人寿' }))

/** ---------- 短信 / 社交登录（Demo 未启用，给明确提示） ---------- */
onPost('/system/auth/send-sms-code', () => {
  throw new Error('Demo 未启用短信验证码登录，请使用账号密码登录')
})
onPost('/system/auth/sms-login', () => {
  throw new Error('Demo 未启用短信验证码登录，请使用账号密码登录')
})
onPost('/system/auth/social-login', () => {
  throw new Error('Demo 未启用社交登录')
})
onGet('/system/auth/social-auth-redirect', () => {
  throw new Error('Demo 未启用社交登录')
})
onPost('/system/auth/register', () => {
  throw new Error('Demo 未开放注册，请使用演示账号登录')
})
onPost('/system/auth/reset-password', () => {
  throw new Error('Demo 未开放找回密码，请使用演示账号登录')
})

/** 图片验证码（未启用，返回占位结构） */
onPost('/system/captcha/get', () => ({
  repCode: '0000',
  repMsg: 'Demo 未启用图形验证码',
  repData: {}
}))
onPost('/system/captcha/check', () => ({
  repCode: '0000',
  repMsg: 'Demo 未启用图形验证码',
  repData: {}
}))

export { DEMO_PASSWORD, ROLE_CODE }
