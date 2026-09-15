/**
 * Mock 种子数据 — 组织架构
 *
 * 包含两类"机构"：
 * 1. dept   ：公司内部组织架构（供 system/dept 部门管理、部门权限配置使用）
 * 2. org    ：监管报送口径下的报送机构树（总公司 → 分公司 → 中心支公司），
 *             供附件文档「报送配置管理 — 机构维护 / 机构上报配置」使用
 */
import { defineTable } from '../store'

/** ---------- 公司内部组织架构（部门） ---------- */
export interface DeptRow {
  id: number
  name: string
  parentId: number
  sort: number
  leaderUserId: number
  phone: string
  email: string
  status: number
  createTime: string
}

const deptSeed: DeptRow[] = [
  {
    id: 100,
    name: '华信人寿',
    parentId: 0,
    sort: 0,
    leaderUserId: 1,
    phone: '010-88880000',
    email: 'hq@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 101,
    name: '总公司',
    parentId: 100,
    sort: 1,
    leaderUserId: 1,
    phone: '010-88880001',
    email: 'hq@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 10101,
    name: '个险业务部',
    parentId: 101,
    sort: 1,
    leaderUserId: 2,
    phone: '010-88880101',
    email: 'gx@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 10102,
    name: '团险业务部',
    parentId: 101,
    sort: 2,
    leaderUserId: 3,
    phone: '010-88880102',
    email: 'tx@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 10103,
    name: '银保业务部',
    parentId: 101,
    sort: 3,
    leaderUserId: 4,
    phone: '010-88880103',
    email: 'yb@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 10104,
    name: '精算部',
    parentId: 101,
    sort: 4,
    leaderUserId: 5,
    phone: '010-88880104',
    email: 'js@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 10105,
    name: '财务部',
    parentId: 101,
    sort: 5,
    leaderUserId: 6,
    phone: '010-88880105',
    email: 'cw@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 10106,
    name: '风险管理部',
    parentId: 101,
    sort: 6,
    leaderUserId: 7,
    phone: '010-88880106',
    email: 'fx@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 10107,
    name: '信息技术部',
    parentId: 101,
    sort: 7,
    leaderUserId: 8,
    phone: '010-88880107',
    email: 'it@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 102,
    name: '北京分公司',
    parentId: 100,
    sort: 2,
    leaderUserId: 9,
    phone: '010-66660000',
    email: 'bj@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:20:00'
  },
  {
    id: 10201,
    name: '北京分公司-个险业务部',
    parentId: 102,
    sort: 1,
    leaderUserId: 9,
    phone: '010-66660101',
    email: 'bj-gx@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:20:00'
  },
  {
    id: 10202,
    name: '北京分公司-运营管理部',
    parentId: 102,
    sort: 2,
    leaderUserId: 10,
    phone: '010-66660102',
    email: 'bj-yy@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:20:00'
  },
  {
    id: 103,
    name: '上海分公司',
    parentId: 100,
    sort: 3,
    leaderUserId: 11,
    phone: '021-55550000',
    email: 'sh@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:30:00'
  },
  {
    id: 104,
    name: '江苏分公司',
    parentId: 100,
    sort: 4,
    leaderUserId: 12,
    phone: '025-44440000',
    email: 'js@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:40:00'
  },
  {
    id: 105,
    name: '广东分公司',
    parentId: 100,
    sort: 5,
    leaderUserId: 13,
    phone: '020-33330000',
    email: 'gd@huaxin-life.com',
    status: 0,
    createTime: '2024-01-01 09:50:00'
  }
]

export const deptTable = defineTable<DeptRow>('system.dept', deptSeed)

/** ---------- 监管报送口径的报送机构树 ---------- */
export interface OrgRow {
  id: number
  /** 机构编码（监管口径） */
  orgCode: string
  /** 机构名称 */
  orgName: string
  parentId: number
  /** 层级：1 总公司 / 2 分公司 / 3 中心支公司 */
  orgLevel: number
  /** 机构类型：1 总公司 / 2 省级分公司 / 3 中心支公司 */
  orgType: number
  /** 所属监管局 */
  regulator: string
  /** 负责人 */
  leader: string
  /** 联系电话 */
  phone: string
  /** 状态：0 正常 1 停用 */
  status: number
  sort: number
  remark: string
  createTime: string
}

const orgSeed: OrgRow[] = [
  {
    id: 1,
    orgCode: '000000',
    orgName: '华信人寿保险股份有限公司',
    parentId: 0,
    orgLevel: 1,
    orgType: 1,
    regulator: '国家金融监督管理总局',
    leader: '陈立国',
    phone: '010-88880000',
    status: 0,
    sort: 1,
    remark: '总公司',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 11,
    orgCode: '110000',
    orgName: '北京分公司',
    parentId: 1,
    orgLevel: 2,
    orgType: 2,
    regulator: '北京监管局',
    leader: '赵京生',
    phone: '010-66660000',
    status: 0,
    sort: 1,
    remark: '',
    createTime: '2024-01-01 09:20:00'
  },
  {
    id: 111,
    orgCode: '110101',
    orgName: '北京朝阳中心支公司',
    parentId: 11,
    orgLevel: 3,
    orgType: 3,
    regulator: '北京监管局',
    leader: '孙朝',
    phone: '010-66660101',
    status: 0,
    sort: 1,
    remark: '',
    createTime: '2024-01-01 09:25:00'
  },
  {
    id: 112,
    orgCode: '110108',
    orgName: '北京海淀中心支公司',
    parentId: 11,
    orgLevel: 3,
    orgType: 3,
    regulator: '北京监管局',
    leader: '李海',
    phone: '010-66660102',
    status: 0,
    sort: 2,
    remark: '',
    createTime: '2024-01-01 09:25:00'
  },
  {
    id: 12,
    orgCode: '310000',
    orgName: '上海分公司',
    parentId: 1,
    orgLevel: 2,
    orgType: 2,
    regulator: '上海监管局',
    leader: '周沪生',
    phone: '021-55550000',
    status: 0,
    sort: 2,
    remark: '',
    createTime: '2024-01-01 09:30:00'
  },
  {
    id: 121,
    orgCode: '310104',
    orgName: '上海徐汇中心支公司',
    parentId: 12,
    orgLevel: 3,
    orgType: 3,
    regulator: '上海监管局',
    leader: '吴徐',
    phone: '021-55550101',
    status: 0,
    sort: 1,
    remark: '',
    createTime: '2024-01-01 09:35:00'
  },
  {
    id: 13,
    orgCode: '320000',
    orgName: '江苏分公司',
    parentId: 1,
    orgLevel: 2,
    orgType: 2,
    regulator: '江苏监管局',
    leader: '郑苏宁',
    phone: '025-44440000',
    status: 0,
    sort: 3,
    remark: '',
    createTime: '2024-01-01 09:40:00'
  },
  {
    id: 131,
    orgCode: '320105',
    orgName: '南京中心支公司',
    parentId: 13,
    orgLevel: 3,
    orgType: 3,
    regulator: '江苏监管局',
    leader: '王宁',
    phone: '025-44440101',
    status: 0,
    sort: 1,
    remark: '',
    createTime: '2024-01-01 09:45:00'
  },
  {
    id: 132,
    orgCode: '320505',
    orgName: '苏州中心支公司',
    parentId: 13,
    orgLevel: 3,
    orgType: 3,
    regulator: '江苏监管局',
    leader: '冯苏',
    phone: '0512-44440102',
    status: 0,
    sort: 2,
    remark: '',
    createTime: '2024-01-01 09:45:00'
  },
  {
    id: 14,
    orgCode: '440000',
    orgName: '广东分公司',
    parentId: 1,
    orgLevel: 2,
    orgType: 2,
    regulator: '广东监管局',
    leader: '黄粤生',
    phone: '020-33330000',
    status: 0,
    sort: 4,
    remark: '',
    createTime: '2024-01-01 09:50:00'
  },
  {
    id: 141,
    orgCode: '440103',
    orgName: '广州中心支公司',
    parentId: 14,
    orgLevel: 3,
    orgType: 3,
    regulator: '广东监管局',
    leader: '许广',
    phone: '020-33330101',
    status: 0,
    sort: 1,
    remark: '',
    createTime: '2024-01-01 09:55:00'
  },
  {
    id: 142,
    orgCode: '440304',
    orgName: '深圳中心支公司',
    parentId: 14,
    orgLevel: 3,
    orgType: 3,
    regulator: '深圳监管局',
    leader: '林深',
    phone: '0755-33330102',
    status: 0,
    sort: 2,
    remark: '',
    createTime: '2024-01-01 09:55:00'
  }
]

export const orgTable = defineTable<OrgRow>('cr.org', orgSeed)

/** ---------- 机构上报配置（各地监管局上报要求） ---------- */
export interface OrgReportConfigRow {
  id: number
  orgId: number
  orgName: string
  /** 上报方式：FTP / SFTP / 手工上传 */
  reportType: string
  /** 监管局名称 */
  regulator: string
  /** 上报路径 */
  uploadPath: string
  /** 下载路径（反馈报文） */
  downloadPath: string
  /** 文件命名规则 */
  fileRule: string
  /** 是否压缩 */
  compress: boolean
  status: number
  createTime: string
}

export const orgReportConfigTable = defineTable<OrgReportConfigRow>('cr.orgReportConfig', [
  {
    id: 1,
    orgId: 11,
    orgName: '北京分公司',
    reportType: 'SFTP',
    regulator: '北京监管局',
    uploadPath: '/bj/report/upload',
    downloadPath: '/bj/report/feedback',
    fileRule: 'HX_BJ_{table}_{date}.txt',
    compress: true,
    status: 0,
    createTime: '2024-02-01 10:00:00'
  },
  {
    id: 2,
    orgId: 12,
    orgName: '上海分公司',
    reportType: 'SFTP',
    regulator: '上海监管局',
    uploadPath: '/sh/report/upload',
    downloadPath: '/sh/report/feedback',
    fileRule: 'HX_SH_{table}_{date}.txt',
    compress: true,
    status: 0,
    createTime: '2024-02-01 10:05:00'
  },
  {
    id: 3,
    orgId: 13,
    orgName: '江苏分公司',
    reportType: 'FTP',
    regulator: '江苏监管局',
    uploadPath: '/js/report/upload',
    downloadPath: '/js/report/feedback',
    fileRule: 'HX_JS_{table}_{date}.txt',
    compress: false,
    status: 0,
    createTime: '2024-02-01 10:10:00'
  },
  {
    id: 4,
    orgId: 14,
    orgName: '广东分公司',
    reportType: 'SFTP',
    regulator: '广东监管局',
    uploadPath: '/gd/report/upload',
    downloadPath: '/gd/report/feedback',
    fileRule: 'HX_GD_{table}_{date}.txt',
    compress: true,
    status: 0,
    createTime: '2024-02-01 10:15:00'
  }
])

/** ---------- 机构主机配置（FTP 目标服务器） ---------- */
export interface OrgHostRow {
  id: number
  orgName: string
  remoteHost: string
  port: number
  protocol: string
  reportRule: string
  uploadPath: string
  downloadPath: string
  username: string
  status: number
  createTime: string
}

export const orgHostTable = defineTable<OrgHostRow>('cr.orgHost', [
  {
    id: 1,
    orgName: '北京监管局',
    remoteHost: '10.10.21.11',
    port: 22,
    protocol: 'SFTP',
    reportRule: '按日增量上报',
    uploadPath: '/bj/upload',
    downloadPath: '/bj/download',
    username: 'hx_bj',
    status: 0,
    createTime: '2024-02-01 11:00:00'
  },
  {
    id: 2,
    orgName: '上海监管局',
    remoteHost: '10.10.22.11',
    port: 22,
    protocol: 'SFTP',
    reportRule: '按月全量上报',
    uploadPath: '/sh/upload',
    downloadPath: '/sh/download',
    username: 'hx_sh',
    status: 0,
    createTime: '2024-02-01 11:05:00'
  },
  {
    id: 3,
    orgName: '江苏监管局',
    remoteHost: '10.10.23.11',
    port: 21,
    protocol: 'FTP',
    reportRule: '按月全量上报',
    uploadPath: '/js/upload',
    downloadPath: '/js/download',
    username: 'hx_js',
    status: 0,
    createTime: '2024-02-01 11:10:00'
  }
])

/** ---------- 机构联系人配置 ---------- */
export interface OrgContactRow {
  id: number
  orgName: string
  contactName: string
  contactPhone: string
  contactEmail: string
  duty: string
  status: number
  createTime: string
}

export const orgContactTable = defineTable<OrgContactRow>('cr.orgContact', [
  {
    id: 1,
    orgName: '北京分公司',
    contactName: '赵京生',
    contactPhone: '13800001111',
    contactEmail: 'bj@huaxin-life.com',
    duty: '报送负责人',
    status: 0,
    createTime: '2024-02-01 11:30:00'
  },
  {
    id: 2,
    orgName: '上海分公司',
    contactName: '周沪生',
    contactPhone: '13800002222',
    contactEmail: 'sh@huaxin-life.com',
    duty: '报送负责人',
    status: 0,
    createTime: '2024-02-01 11:35:00'
  },
  {
    id: 3,
    orgName: '江苏分公司',
    contactName: '郑苏宁',
    contactPhone: '13800003333',
    contactEmail: 'js@huaxin-life.com',
    duty: '数据填报人',
    status: 0,
    createTime: '2024-02-01 11:40:00'
  },
  {
    id: 4,
    orgName: '广东分公司',
    contactName: '黄粤生',
    contactPhone: '13800004444',
    contactEmail: 'gd@huaxin-life.com',
    duty: '复核人',
    status: 0,
    createTime: '2024-02-01 11:45:00'
  }
])
