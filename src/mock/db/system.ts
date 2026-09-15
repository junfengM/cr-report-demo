/**
 * Mock 种子数据 — 用户 / 角色 / 岗位
 *
 * 角色与附件文档「数据认责」章节对齐：按角色划分报送职责，登录后菜单与数据范围不同。
 */
import { defineTable } from '../store'

/** ---------- 角色 ---------- */
export interface RoleRow {
  id: number
  name: string
  code: string
  sort: number
  status: number
  /** 1 内置角色 2 自定义角色 */
  type: number
  /** 1 全部数据 2 指定部门 3 本部门 4 本部门及以下 5 仅本人 */
  dataScope: number
  dataScopeDeptIds: number[]
  remark: string
  createTime: string
}

export const ROLE_CODE = {
  /** 系统管理员：全部菜单 + 全部数据 */
  ADMIN: 'super_admin',
  /** 报送填报岗 */
  FILLER: 'cr_filler',
  /** 报送复核岗 */
  REVIEWER: 'cr_reviewer',
  /** 报送审核岗 */
  AUDITOR: 'cr_auditor'
} as const

const roleSeed: RoleRow[] = [
  {
    id: 1,
    name: '系统管理员',
    code: ROLE_CODE.ADMIN,
    sort: 1,
    status: 0,
    type: 1,
    dataScope: 1,
    dataScopeDeptIds: [],
    remark: '拥有全部菜单与全量数据权限',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 2,
    name: '报送填报岗',
    code: ROLE_CODE.FILLER,
    sort: 2,
    status: 0,
    type: 2,
    dataScope: 4,
    dataScopeDeptIds: [10101, 10102, 10103],
    remark: '负责本部门报送数据填报与提交',
    createTime: '2024-01-01 09:05:00'
  },
  {
    id: 3,
    name: '报送复核岗',
    code: ROLE_CODE.REVIEWER,
    sort: 3,
    status: 0,
    type: 2,
    dataScope: 3,
    dataScopeDeptIds: [10106],
    remark: '负责报表复核与打回',
    createTime: '2024-01-01 09:06:00'
  },
  {
    id: 4,
    name: '报送审核岗',
    code: ROLE_CODE.AUDITOR,
    sort: 4,
    status: 0,
    type: 2,
    dataScope: 2,
    dataScopeDeptIds: [10104, 10105, 10106],
    remark: '负责数据审核、错误原因确认与报文报送审批',
    createTime: '2024-01-01 09:07:00'
  }
]

export const roleTable = defineTable<RoleRow>('system.role', roleSeed)

/** ---------- 岗位 ---------- */
export interface PostRow {
  id: number
  name: string
  code: string
  sort: number
  status: number
  remark: string
  createTime: string
}

export const postTable = defineTable<PostRow>('system.post', [
  {
    id: 1,
    name: '报送专员',
    code: 'cr_specialist',
    sort: 1,
    status: 0,
    remark: '负责监管数据填报',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 2,
    name: '数据复核员',
    code: 'cr_reviewer',
    sort: 2,
    status: 0,
    remark: '负责报表复核',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 3,
    name: '数据审核员',
    code: 'cr_auditor',
    sort: 3,
    status: 0,
    remark: '负责数据审核与报送审批',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 4,
    name: '系统管理员',
    code: 'sys_admin',
    sort: 4,
    status: 0,
    remark: '负责平台配置与权限管理',
    createTime: '2024-01-01 09:00:00'
  }
])

/** ---------- 用户 ---------- */
export interface UserRow {
  id: number
  username: string
  /** 登录密码（Demo 明文保存，真实系统不会这样） */
  password: string
  nickname: string
  deptId: number
  postIds: number[]
  roleIds: number[]
  email: string
  mobile: string
  sex: number
  avatar: string
  loginIp: string
  loginDate: string
  status: number
  remark: string
  createTime: string
}

/** Demo 统一密码 */
export const DEMO_PASSWORD = 'admin123'

const userSeed: UserRow[] = [
  {
    id: 1,
    username: 'admin',
    password: DEMO_PASSWORD,
    nickname: '系统管理员',
    deptId: 10107,
    postIds: [4],
    roleIds: [1],
    email: 'admin@huaxin-life.com',
    mobile: '13800000001',
    sex: 1,
    avatar: '',
    loginIp: '127.0.0.1',
    loginDate: '2026-09-12 09:00:00',
    status: 0,
    remark: '演示账号：全部菜单 + 全量数据',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 2,
    username: 'filler',
    password: DEMO_PASSWORD,
    nickname: '张天报',
    deptId: 10101,
    postIds: [1],
    roleIds: [2],
    email: 'zhangtb@huaxin-life.com',
    mobile: '13800000002',
    sex: 1,
    avatar: '',
    loginIp: '10.1.1.21',
    loginDate: '2026-09-12 08:31:00',
    status: 0,
    remark: '演示账号：报送填报岗',
    createTime: '2024-01-02 09:00:00'
  },
  {
    id: 3,
    username: 'reviewer',
    password: DEMO_PASSWORD,
    nickname: '李复华',
    deptId: 10106,
    postIds: [2],
    roleIds: [3],
    email: 'lifh@huaxin-life.com',
    mobile: '13800000003',
    sex: 2,
    avatar: '',
    loginIp: '10.1.1.31',
    loginDate: '2026-09-12 08:45:00',
    status: 0,
    remark: '演示账号：报送复核岗',
    createTime: '2024-01-02 09:05:00'
  },
  {
    id: 4,
    username: 'auditor',
    password: DEMO_PASSWORD,
    nickname: '王审核',
    deptId: 10105,
    postIds: [3],
    roleIds: [4],
    email: 'wangsh@huaxin-life.com',
    mobile: '13800000004',
    sex: 1,
    avatar: '',
    loginIp: '10.1.1.41',
    loginDate: '2026-09-12 08:52:00',
    status: 0,
    remark: '演示账号：报送审核岗',
    createTime: '2024-01-02 09:10:00'
  },
  {
    id: 5,
    username: 'liyf',
    password: DEMO_PASSWORD,
    nickname: '李银芬',
    deptId: 10103,
    postIds: [1],
    roleIds: [2],
    email: 'liyf@huaxin-life.com',
    mobile: '13800000005',
    sex: 2,
    avatar: '',
    loginIp: '10.1.1.51',
    loginDate: '2026-09-11 17:20:00',
    status: 0,
    remark: '银保业务部填报人',
    createTime: '2024-01-03 09:00:00'
  },
  {
    id: 6,
    username: 'chenjs',
    password: DEMO_PASSWORD,
    nickname: '陈精算',
    deptId: 10104,
    postIds: [3],
    roleIds: [4],
    email: 'chenjs@huaxin-life.com',
    mobile: '13800000006',
    sex: 1,
    avatar: '',
    loginIp: '10.1.1.61',
    loginDate: '2026-09-11 16:02:00',
    status: 0,
    remark: '精算部数据审核人',
    createTime: '2024-01-03 09:05:00'
  },
  {
    id: 7,
    username: 'zhaocw',
    password: DEMO_PASSWORD,
    nickname: '赵财务',
    deptId: 10105,
    postIds: [3],
    roleIds: [4],
    email: 'zhaocw@huaxin-life.com',
    mobile: '13800000007',
    sex: 2,
    avatar: '',
    loginIp: '10.1.1.71',
    loginDate: '2026-09-11 15:40:00',
    status: 0,
    remark: '',
    createTime: '2024-01-03 09:10:00'
  },
  {
    id: 8,
    username: 'sunfx',
    password: DEMO_PASSWORD,
    nickname: '孙风险',
    deptId: 10106,
    postIds: [2],
    roleIds: [3],
    email: 'sunfx@huaxin-life.com',
    mobile: '13800000008',
    sex: 1,
    avatar: '',
    loginIp: '10.1.1.81',
    loginDate: '2026-09-11 14:10:00',
    status: 0,
    remark: '',
    createTime: '2024-01-03 09:15:00'
  },
  {
    id: 9,
    username: 'zhoubj',
    password: DEMO_PASSWORD,
    nickname: '周北京',
    deptId: 10201,
    postIds: [1],
    roleIds: [2],
    email: 'zhoubj@huaxin-life.com',
    mobile: '13800000009',
    sex: 1,
    avatar: '',
    loginIp: '10.2.1.11',
    loginDate: '2026-09-11 11:30:00',
    status: 0,
    remark: '北京分公司填报人',
    createTime: '2024-01-04 09:00:00'
  },
  {
    id: 10,
    username: 'wush',
    password: DEMO_PASSWORD,
    nickname: '吴上海',
    deptId: 103,
    postIds: [1],
    roleIds: [2],
    email: 'wush@huaxin-life.com',
    mobile: '13800000010',
    sex: 2,
    avatar: '',
    loginIp: '10.3.1.11',
    loginDate: '2026-09-11 10:05:00',
    status: 0,
    remark: '',
    createTime: '2024-01-04 09:05:00'
  },
  {
    id: 11,
    username: 'zhengjs',
    password: DEMO_PASSWORD,
    nickname: '郑江苏',
    deptId: 104,
    postIds: [1],
    roleIds: [2],
    email: 'zhengjs@huaxin-life.com',
    mobile: '13800000011',
    sex: 1,
    avatar: '',
    loginIp: '10.4.1.11',
    loginDate: '2026-09-10 17:55:00',
    status: 0,
    remark: '',
    createTime: '2024-01-04 09:10:00'
  },
  {
    id: 12,
    username: 'huangy',
    password: DEMO_PASSWORD,
    nickname: '黄粤生',
    deptId: 105,
    postIds: [2],
    roleIds: [3],
    email: 'huangy@huaxin-life.com',
    mobile: '13800000012',
    sex: 1,
    avatar: '',
    loginIp: '10.5.1.11',
    loginDate: '2026-09-10 16:20:00',
    status: 0,
    remark: '',
    createTime: '2024-01-04 09:15:00'
  },
  {
    id: 13,
    username: 'wangit',
    password: DEMO_PASSWORD,
    nickname: '王信息',
    deptId: 10107,
    postIds: [4],
    roleIds: [1],
    email: 'wangit@huaxin-life.com',
    mobile: '13800000013',
    sex: 2,
    avatar: '',
    loginIp: '10.1.1.91',
    loginDate: '2026-09-10 09:12:00',
    status: 0,
    remark: '',
    createTime: '2024-01-05 09:00:00'
  },
  {
    id: 14,
    username: 'test01',
    password: DEMO_PASSWORD,
    nickname: '测试用户一',
    deptId: 10101,
    postIds: [1],
    roleIds: [2],
    email: 'test01@huaxin-life.com',
    mobile: '13800000014',
    sex: 1,
    avatar: '',
    loginIp: '',
    loginDate: '',
    status: 1,
    remark: '已停用演示数据',
    createTime: '2024-01-06 09:00:00'
  }
]

export const userTable = defineTable<UserRow>('system.user', userSeed)

/** ---------- 用户与角色的关联（供权限分配界面使用） ---------- */
export const userRoleTable = defineTable<{ id: number; userId: number; roleId: number }>(
  'system.userRole',
  userSeed.flatMap((user) =>
    user.roleIds.map((roleId, index) => ({ id: user.id * 100 + index, userId: user.id, roleId }))
  )
)
