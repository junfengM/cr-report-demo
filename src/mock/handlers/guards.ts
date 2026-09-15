/**
 * Mock Handler — 接口层角色守卫（新模块统一从这里取）
 *
 * 为什么单独抽一个文件：第三轮独立审核推翻过「页面藏按钮 = 拦住人」的假设 ——
 * 藏按钮只能让人"看不见"，拿到接口地址照样能改数据。所以每个写接口都要在这一层再判一次角色。
 * 实现与 crDesensitize / crSplit 里那两份完全一致（那边是历史代码，保持不动），
 * 新模块一律 import 这里的函数，不要再各写一份 roleIds 遍历。
 */
import { currentRoleCodes, currentUser } from './auth'
import { ROLE_CODE, roleTable, type UserRow } from '../db/system'

/** 允许的角色 code 列表里命中一个即放行；否则抛中文错误（带当前账号昵称） */
export const assertRoles = (ctx: any, allow: string[], action: string): UserRow => {
  const user = currentUser(ctx)
  const codes = user ? currentRoleCodes(ctx) : []
  const ok = allow.some((code) => codes.indexOf(code) >= 0)
  if (!ok) {
    // 报错给中文角色名，不要把 super_admin / cr_auditor 这种代码甩给用户
    const names = allow
      .map((code) => roleTable.all().find((role) => role.code === code)?.name || code)
      .join(' / ')
    throw new Error(
      '「' +
        action +
        '」仅 ' +
        names +
        ' 可操作（当前账号：' +
        (user ? user.nickname : '未登录') +
        '）'
    )
  }
  return user!
}

/** 仅系统管理员 */
export const assertAdmin = (ctx: any, action: string): UserRow =>
  assertRoles(ctx, [ROLE_CODE.ADMIN], action)

/** 至少要求登录（用于"看着像查询其实会落库"的接口） */
export const assertLogin = (ctx: any, action: string): UserRow => {
  const user = currentUser(ctx)
  if (!user) throw new Error('「' + action + '」需要登录后操作')
  return user
}

/** 操作人昵称：优先取当前登录用户，其次页面显式传的 operator，最后兜底 */
export const operatorOf = (ctx: any, fallback = '系统管理员'): string => {
  const user = currentUser(ctx)
  return String(ctx?.body?.operator || (user ? user.nickname : '') || fallback)
}
