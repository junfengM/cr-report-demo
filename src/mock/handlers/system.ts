/**
 * Mock Handler — 系统管理（用户 / 角色 / 菜单 / 部门 / 岗位 / 字典 / 通知 / 日志 / 站内信 / 权限分配）
 */
import { onDelete, onGet, onPost, onPut, type MockContext } from '../route'
import { byIds, parseIds, registerResource } from '../resource'
import { csvBlob, formatDateTime, likeAny, paginate } from '../util'
import { deptTable } from '../db/org'
import { menuRowsForRoles, visibleMenuRows, type MenuRow } from '../db/menu'
import {
  DEMO_PASSWORD,
  postTable,
  roleTable,
  userRoleTable,
  userTable,
  type RoleRow,
  type UserRow
} from '../db/system'
import { dictDataTable, dictTypeTable } from '../db/dict'
import { loginLogTable, noticeTable, notifyMessageTable, operateLogTable } from '../db/infra'
import { currentRoleCodes, currentUser, requireUser } from './auth'

/* ==================================================================
 * 用户
 * ================================================================== */
const deptName = (id: number) => deptTable.get(id)?.name || ''
const roleNames = (ids: number[]) =>
  roleTable
    .all()
    .filter((role) => ids.includes(role.id))
    .map((role) => role.name)
    .join(', ')

const withUserExtras = (user: UserRow) => ({
  ...user,
  deptName: deptName(user.deptId),
  roleNames: roleNames(user.roleIds)
})

registerResource<UserRow>({
  prefix: '/system/user',
  table: userTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (!likeAny(row, ['username', 'nickname', 'mobile'], params.username)) return false
    if (params.mobile && !String(row.mobile).includes(String(params.mobile))) return false
    if (
      params.status !== undefined &&
      params.status !== '' &&
      Number(row.status) !== Number(params.status)
    )
      return false
    if (params.deptId) {
      // 含子部门
      const ids = new Set([Number(params.deptId)])
      let changed = true
      while (changed) {
        changed = false
        deptTable.all().forEach((dept) => {
          if (ids.has(dept.parentId) && !ids.has(dept.id)) {
            ids.add(dept.id)
            changed = true
          }
        })
      }
      if (!ids.has(row.deptId)) return false
    }
    return true
  },
  beforeCreate: (body) => ({
    password: DEMO_PASSWORD,
    avatar: '',
    loginIp: '',
    loginDate: '',
    status: body.status ?? 0,
    createTime: formatDateTime()
  }),
  toSimple: (row) => ({ id: row.id, nickname: row.nickname, deptId: row.deptId }),
  exportColumns: [
    { field: 'id', label: '用户编号' },
    { field: 'username', label: '登录名称' },
    { field: 'nickname', label: '用户名称' },
    { field: 'deptId', label: '部门编号' },
    { field: 'mobile', label: '手机号码' },
    { field: 'status', label: '状态' },
    { field: 'createTime', label: '创建时间' }
  ]
})

// 用户分页需要附带部门名与角色名
onGet('/system/user/page', (ctx) => {
  const params = ctx.params
  const rows = userTable
    .all()
    .filter((row) => {
      if (!likeAny(row, ['username', 'nickname', 'mobile'], params.username)) return false
      if (
        params.status !== undefined &&
        params.status !== '' &&
        Number(row.status) !== Number(params.status)
      )
        return false
      return true
    })
    .sort((a, b) => a.id - b.id)
  return paginate(rows.map(withUserExtras), params)
})

onGet('/system/user/list-by-nickname', (ctx) =>
  userTable
    .all()
    .filter((row) => likeAny(row, ['nickname'], ctx.params.nickname))
    .map((row) => ({ id: row.id, nickname: row.nickname }))
)

onGet('/system/user/get-simple', (ctx) => {
  const user = userTable.get(Number(ctx.params.id))
  if (!user) throw new Error('用户不存在')
  return { ...user, deptName: deptName(user.deptId) }
})

onPut('/system/user/update-status', (ctx) => {
  const { id, status } = ctx.body || {}
  userTable.update({ id: Number(id), status: Number(status) })
  return true
})

onPut('/system/user/update-password', (ctx) => {
  const { id, password } = ctx.body || {}
  userTable.update({ id: Number(id), password: password || DEMO_PASSWORD })
  return true
})

onGet('/system/user/get-import-template', () =>
  csvBlob(
    [{ username: 'zhangsan', nickname: '张三', deptId: '10101', mobile: '13800000000' }],
    [
      { field: 'username', label: '登录名称' },
      { field: 'nickname', label: '用户名称' },
      { field: 'deptId', label: '部门编号' },
      { field: 'mobile', label: '手机号码' }
    ]
  )
)

/* ==================================================================
 * 角色
 * ================================================================== */
registerResource<RoleRow>({
  prefix: '/system/role',
  table: roleTable,
  sort: (a, b) => a.sort - b.sort,
  filter: (row, params) =>
    likeAny(row, ['name', 'code'], params.name) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)),
  beforeCreate: () => ({ createTime: formatDateTime(), dataScopeDeptIds: [] }),
  toSimple: (row) => ({ id: row.id, name: row.name }),
  exportColumns: [
    { field: 'id', label: '角色编号' },
    { field: 'name', label: '角色名称' },
    { field: 'code', label: '角色编码' },
    { field: 'sort', label: '显示顺序' },
    { field: 'status', label: '状态' },
    { field: 'createTime', label: '创建时间' }
  ]
})

/* ==================================================================
 * 菜单
 * ================================================================== */
const menuRowToVO = (row: MenuRow, parentIdOverride?: number) => ({
  id: row.id,
  name: row.name,
  permission: row.permission,
  type: row.type,
  sort: row.sort,
  parentId: parentIdOverride ?? row.parentId,
  path: row.path,
  icon: row.icon,
  component: row.component,
  componentName: row.componentName,
  status: row.status,
  visible: row.visible,
  keepAlive: row.keepAlive,
  alwaysShow: row.alwaysShow,
  createTime: row.createTime
})

onGet('/system/menu/list', (ctx) => {
  const keyword = ctx.params.name
  return visibleMenuRows()
    .filter((row) => likeAny(row, ['name', 'permission'], keyword))
    .map((row) => menuRowToVO(row))
})

onGet('/system/menu/simple-list', () => visibleMenuRows().map((row) => menuRowToVO(row)))

onGet('/system/menu/get', (ctx) => {
  const row = visibleMenuRows().find((item) => item.id === Number(ctx.params.id))
  if (!row) throw new Error('菜单不存在')
  return menuRowToVO(row)
})

onPost('/system/menu/create', (ctx) => {
  // 菜单是"结构型"数据，Demo 不落库，仅提示
  throw new Error('Demo 中菜单由代码定义（src/mock/db/menu.ts），不支持在线新增')
})
onPut('/system/menu/update', () => {
  throw new Error('Demo 中菜单由代码定义（src/mock/db/menu.ts），不支持在线修改')
})
onDelete('/system/menu/delete', () => {
  throw new Error('Demo 中菜单由代码定义（src/mock/db/menu.ts），不支持在线删除')
})

/* ==================================================================
 * 部门
 * ================================================================== */
registerResource({
  prefix: '/system/dept',
  table: deptTable,
  sort: (a, b) => a.sort - b.sort,
  filter: (row, params) => likeAny(row, ['name'], params.name),
  beforeCreate: (body) => ({ createTime: formatDateTime(), status: body.status ?? 0 }),
  toSimple: (row) => ({ id: row.id, name: row.name, parentId: row.parentId }),
  exportColumns: [
    { field: 'id', label: '部门编号' },
    { field: 'name', label: '部门名称' },
    { field: 'parentId', label: '父部门编号' },
    { field: 'sort', label: '显示顺序' },
    { field: 'status', label: '状态' }
  ]
})

/* ==================================================================
 * 岗位
 * ================================================================== */
registerResource({
  prefix: '/system/post',
  table: postTable,
  sort: (a, b) => a.sort - b.sort,
  filter: (row, params) =>
    likeAny(row, ['name', 'code'], params.name) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)),
  beforeCreate: () => ({ createTime: formatDateTime() }),
  toSimple: (row) => ({ id: row.id, name: row.name }),
  exportColumns: [
    { field: 'id', label: '岗位编号' },
    { field: 'name', label: '岗位名称' },
    { field: 'code', label: '岗位编码' },
    { field: 'sort', label: '显示顺序' },
    { field: 'status', label: '状态' }
  ]
})

/* ==================================================================
 * 字典
 * ================================================================== */
registerResource({
  prefix: '/system/dict-type',
  table: dictTypeTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) =>
    likeAny(row, ['name', 'type'], params.name) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)),
  beforeCreate: () => ({ createTime: formatDateTime() }),
  toSimple: (row) => ({ id: row.id, name: row.name, type: row.type }),
  exportColumns: [
    { field: 'id', label: '字典编号' },
    { field: 'name', label: '字典名称' },
    { field: 'type', label: '字典类型' },
    { field: 'status', label: '状态' },
    { field: 'createTime', label: '创建时间' }
  ]
})

registerResource({
  prefix: '/system/dict-data',
  table: dictDataTable,
  sort: (a, b) => a.sort - b.sort,
  filter: (row, params) =>
    likeAny(row, ['label', 'value'], params.label) &&
    (params.dictType ? row.dictType === params.dictType : true) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)),
  beforeCreate: () => ({ createTime: formatDateTime() }),
  exportColumns: [
    { field: 'id', label: '字典数据编号' },
    { field: 'dictType', label: '字典类型' },
    { field: 'label', label: '字典标签' },
    { field: 'value', label: '字典键值' },
    { field: 'sort', label: '显示顺序' },
    { field: 'status', label: '状态' }
  ]
})

// 字典 store 依赖的"全量简单列表"
onGet('/system/dict-data/list-all-simple', () =>
  dictDataTable.all().map((row) => ({
    id: row.id,
    dictType: row.dictType,
    label: row.label,
    value: row.value,
    colorType: row.colorType,
    cssClass: row.cssClass
  }))
)

onGet('/system/dict-data/type', (ctx) =>
  dictDataTable
    .all()
    .filter((row) => row.dictType === ctx.params.type)
    .sort((a, b) => a.sort - b.sort)
)

/* ==================================================================
 * 通知公告
 * ================================================================== */
registerResource({
  prefix: '/system/notice',
  table: noticeTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) => likeAny(row, ['title'], params.title),
  beforeCreate: () => ({ createTime: formatDateTime(), creator: 'admin' })
})

onPost('/system/notice/push', (ctx) => {
  const id = Number(ctx.params.id)
  const notice = noticeTable.get(id)
  if (!notice) throw new Error('通知公告不存在')
  // 推送给全部用户，模拟站内信
  userTable.all().forEach((user, index) => {
    notifyMessageTable.insert({
      userId: user.id,
      userType: 2,
      templateCode: 'system_notice',
      templateNickname: '通知公告',
      templateContent: notice.title,
      templateType: 1,
      readStatus: false,
      readTime: '',
      createTime: formatDateTime()
    })
    void index
  })
  return true
})

/* ==================================================================
 * 日志
 * ================================================================== */
registerResource({
  prefix: '/system/login-log',
  table: loginLogTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) =>
    likeAny(row, ['username'], params.username) &&
    (params.userIp ? String(row.userIp).includes(String(params.userIp)) : true) &&
    (params.result === undefined ||
      params.result === '' ||
      Number(row.result) === Number(params.result)),
  exportColumns: [
    { field: 'id', label: '日志编号' },
    { field: 'username', label: '用户名称' },
    { field: 'userIp', label: '登录地址' },
    { field: 'result', label: '登录结果' },
    { field: 'createTime', label: '登录时间' }
  ]
})

registerResource({
  prefix: '/system/operate-log',
  table: operateLogTable,
  sort: (a, b) => b.id - a.id,
  filter: (row, params) =>
    likeAny(row, ['userName', 'type', 'action'], params.userName || params.type),
  exportColumns: [
    { field: 'id', label: '日志编号' },
    { field: 'userName', label: '操作人' },
    { field: 'type', label: '操作模块' },
    { field: 'action', label: '操作内容' },
    { field: 'createTime', label: '操作时间' }
  ]
})

/* ==================================================================
 * 站内信
 * ================================================================== */
onGet('/system/notify-message/my-page', (ctx) => {
  const user = requireUser(ctx)
  const rows = notifyMessageTable
    .all()
    .filter((row) => row.userId === user.id)
    .sort((a, b) => b.id - a.id)
  return paginate(rows, ctx.params)
})

onGet('/system/notify-message/page', (ctx) => paginate(notifyMessageTable.all(), ctx.params))

onGet('/system/notify-message/get-unread-list', (ctx) => {
  const user = currentUser(ctx)
  if (!user) return []
  return notifyMessageTable
    .all()
    .filter((row) => row.userId === user.id && !row.readStatus)
    .sort((a, b) => b.id - a.id)
})

onGet('/system/notify-message/get-unread-count', (ctx) => {
  const user = currentUser(ctx)
  if (!user) return 0
  return notifyMessageTable.all().filter((row) => row.userId === user.id && !row.readStatus).length
})

onPut('/system/notify-message/update-read', (ctx) => {
  parseIds(ctx.params.ids).forEach((id) => {
    notifyMessageTable.update({ id, readStatus: true, readTime: formatDateTime() })
  })
  return true
})

onPut('/system/notify-message/update-all-read', (ctx) => {
  const user = currentUser(ctx)
  if (!user) return true
  notifyMessageTable
    .all()
    .filter((row) => row.userId === user.id)
    .forEach((row) =>
      notifyMessageTable.update({ id: row.id, readStatus: true, readTime: formatDateTime() })
    )
  return true
})

/* ==================================================================
 * 权限分配
 * ================================================================== */
onGet('/system/permission/list-role-menus', (ctx) => {
  const roleId = Number(ctx.params.roleId)
  const role = roleTable.get(roleId)
  if (!role) return []
  // Demo：每个角色返回其可见菜单的 id 集合（含按钮）
  const rows = menuRowsForRoles([role.code])
  return rows.map((row) => ({ id: row.id, name: row.name, permission: row.permission }))
})

onPost('/system/permission/assign-role-menu', () => {
  // 菜单由代码定义，此处仅提示成功，避免演示中断
  return true
})

onGet('/system/permission/list-user-roles', (ctx) => {
  const userId = Number(ctx.params.userId)
  const user = userTable.get(userId)
  return user ? user.roleIds : []
})

onPut('/system/permission/assign-user-role', (ctx) => {
  const { userId, roleIds } = ctx.body || {}
  userTable.update({ id: Number(userId), roleIds: (roleIds || []).map(Number) })
  return true
})

onPut('/system/permission/assign-role-data-scope', (ctx) => {
  const { roleId, dataScope, dataScopeDeptIds } = ctx.body || {}
  roleTable.update({
    id: Number(roleId),
    dataScope: Number(dataScope),
    dataScopeDeptIds: (dataScopeDeptIds || []).map(Number)
  })
  return true
})

/* ==================================================================
 * 其他（避免页面报"接口未实现"）
 * ================================================================== */
onGet('/system/area/tree', () => [])
onGet('/system/area/get-by-ip', () => ({ id: 110000, name: '北京市' }))
onGet('/system/social-user/get-bind-list', () => [])
onGet('/system/notify-template/simple-list', () => [])
onGet('/system/notify-template/page', (ctx) => paginate([], ctx.params))
onGet('/system/oauth2-client/page', (ctx) => paginate([], ctx.params))

export { byIds, currentRoleCodes, visibleMenuRows }
