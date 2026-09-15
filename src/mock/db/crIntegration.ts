/**
 * Mock 种子数据 — 系统集成（接入系统 / 接入权限 / 接入附件）
 *
 * 附件文档第 16 章的「系统集成（接入系统/权限/附件）」在工程内没有可对照字段说明，
 * 按通行做法提案：**接入系统**登记对端系统与回调地址，**接入权限**按接口范围 + 数据范围授权
 * （显式优先级 + 生效判断，与拆分规则 / 数据权限同一套约定），**接入附件**是双方交换的文件
 * ——附件在 Demo 里真的能下载（内容以 base64 存本地，与补录附件同一做法，单文件 ≤ 1MB）。
 */
import { defineTable } from '../store'

/** 接入系统 */
export interface IntegrationSystemRow {
  id: number
  sysCode: string
  sysName: string
  /** 1 报送交换 / 2 数据采集 / 3 监管对接 */
  sysType: number
  owner: string
  contact: string
  callbackUrl: string
  /** 只展示掩码，明文密钥不落库（真实系统里在密钥管理服务里） */
  secretMask: string
  status: number
  lastHeartbeat: string
  heartbeatResult: string
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 接入权限：系统 × 接口范围 × 数据范围 */
export interface IntegrationAuthRow {
  id: number
  sysCode: string
  sysName: string
  /** 接口范围，如 /cr/collect-import/* */
  apiScope: string
  orgIds: number[]
  orgNames: string
  reportIds: number[]
  reportNames: string
  /** 优先级 0~999，缺省 50：同一系统多条授权时数字小的生效 */
  priority: number
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 接入附件 */
export interface IntegrationAttachmentRow {
  id: number
  sysCode: string
  sysName: string
  fileName: string
  fileExt: string
  fileSize: number
  /** 1 报送报文 / 2 监管回执 / 3 校验报告 / 4 其他 */
  bizType: number
  uploadUser: string
  uploadTime: string
  /** 内容指纹（Demo 用轻量哈希，不是 MD5 / 国密，页面已如实标注） */
  contentHash: string
  /** 1 已接收 / 2 校验通过 / 3 校验失败 */
  status: number
  checkMessage: string
  /** data URL（base64），能真的下载下来 */
  content: string
  remark: string
}

/** 文本 → data URL（种子附件用） */
const textFileDataUrl = (text: string, mime = 'text/csv'): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return 'data:' + mime + ';base64,' + btoa(binary)
}

/**
 * 内容指纹：djb2（32 位）变体，确定性、可复算（页面标注「轻量哈希（非加密算法）」）。
 * 只算文件正文：入参可能是 data URL（种子附件），先剥掉 `data:<mime>;base64,` 前缀，
 * 这样同一份字节换个 MIME 前缀得到的指纹仍然相同（以前把前缀一起喂进去，指纹会跟着变）。
 */
export const contentHashOf = (content: string): string => {
  const text = content.startsWith('data:') ? content.slice(content.indexOf(',') + 1) : content
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) & 0xffffffff
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8).toUpperCase()
}

const systemSeed: IntegrationSystemRow[] = [
  {
    id: 1,
    sysCode: 'SYS_BAOSONG',
    sysName: '报送交换平台',
    sysType: 1,
    owner: '报送管理部',
    contact: '孙建国 / 13800000008',
    callbackUrl: 'https://cr.huxin-life.com/api/exchange/callback',
    secretMask: 'sk-****3f7c',
    status: 1,
    lastHeartbeat: '2026-09-11 09:00:12',
    heartbeatResult: '心跳正常，平均往返 48 ms',
    updateUser: '系统管理员',
    updateTime: '2026-09-11 09:00:12',
    remark: '行内报送交换主通道',
    createTime: '2026-08-01 09:00:00'
  },
  {
    id: 2,
    sysCode: 'SYS_YINBAO',
    sysName: '银保通数据采集',
    sysType: 2,
    owner: '银保业务部',
    contact: '李银保 / 13800000021',
    callbackUrl: 'https://ybt.huxin-life.com/openapi/cr/push',
    secretMask: 'ak-****91bd',
    status: 1,
    lastHeartbeat: '2026-09-11 08:58:40',
    heartbeatResult: '心跳正常，平均往返 96 ms',
    updateUser: '系统管理员',
    updateTime: '2026-09-11 08:58:40',
    remark: '银保渠道每日推送导入文件',
    createTime: '2026-08-02 10:30:00'
  },
  {
    id: 3,
    sysCode: 'SYS_REG',
    sysName: '监管回执对接',
    sysType: 3,
    owner: '报送管理部',
    contact: '周文彬 / 13800000009',
    callbackUrl: 'https://api.reg-demo.gov.cn/cr/receipt',
    secretMask: 'reg-****7a02',
    status: 1,
    lastHeartbeat: '2026-09-05 17:20:00',
    heartbeatResult: '心跳失败：对端 502（监管侧维护窗口）',
    updateUser: '系统管理员',
    updateTime: '2026-09-05 17:20:00',
    remark: '演示失败分支：对端 502（监管侧维护窗口）',
    createTime: '2026-08-03 14:00:00'
  },
  {
    id: 4,
    sysCode: 'SYS_OLD_EDI',
    sysName: '旧版 EDI 通道（已停用）',
    sysType: 1,
    owner: '信息科技部',
    contact: '林昊 / 13800000012',
    callbackUrl: 'https://edi-old-demo.internal/cr/push',
    secretMask: 'edi-****31b8',
    status: 0,
    lastHeartbeat: '2026-08-28 09:05:00',
    heartbeatResult: '心跳失败：系统已停用，未发起真实请求',
    updateUser: '系统管理员',
    updateTime: '2026-08-28 09:05:00',
    remark: '演示失败分支：系统已停用',
    createTime: '2026-07-18 11:20:00'
  }
]

const authSeed: IntegrationAuthRow[] = [
  {
    id: 1,
    sysCode: 'SYS_BAOSONG',
    sysName: '报送交换平台',
    apiScope: '/cr/submit-*/push',
    orgIds: [1, 11, 12, 13, 14],
    orgNames: '总公司、北京分公司、上海分公司、江苏分公司、广东分公司',
    reportIds: [],
    reportNames: '全部报表',
    priority: 50,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-06 09:10:00',
    remark: '报送交换平台可推送全部机构的报文',
    createTime: '2026-08-05 09:00:00'
  },
  {
    id: 2,
    sysCode: 'SYS_YINBAO',
    sysName: '银保通数据采集',
    apiScope: '/cr/collect-import/*',
    orgIds: [11, 12],
    orgNames: '北京分公司、上海分公司',
    reportIds: [11],
    reportNames: 'BX011 保费收入统计表',
    priority: 30,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-06 09:20:00',
    remark: '银保通只能往两家分公司的保费收入统计表推数据',
    createTime: '2026-08-05 09:10:00'
  },
  {
    id: 3,
    sysCode: 'SYS_YINBAO',
    sysName: '银保通数据采集',
    apiScope: '/cr/collect-import/*',
    orgIds: [11, 12, 13, 14],
    orgNames: '北京分公司、上海分公司、江苏分公司、广东分公司',
    reportIds: [],
    reportNames: '全部报表',
    priority: 60,
    status: 1,
    updateUser: '系统管理员',
    updateTime: '2026-09-06 09:25:00',
    remark: '兜底授权：接口范围相同但优先级更大，会被第 2 条盖住（演示"被覆盖"）',
    createTime: '2026-08-05 09:20:00'
  },
  {
    id: 4,
    sysCode: 'SYS_REG',
    sysName: '监管回执对接',
    apiScope: '/cr/submit-*/receipt',
    orgIds: [1],
    orgNames: '总公司',
    reportIds: [],
    reportNames: '全部报表',
    priority: 50,
    status: 0,
    updateUser: '系统管理员',
    updateTime: '2026-09-06 09:30:00',
    remark: '已停用示例：对端维护期间先收回授权',
    createTime: '2026-08-05 09:30:00'
  }
]

const receiptCsv =
  'batchNo,reportCode,orgCode,result,problemCount,feedbackTime\n' +
  'SB2026080001,BX011,110000,PASS,0,2026-09-08 10:12:00\n' +
  'SB2026080002,BX012,310000,FAIL,3,2026-09-08 10:15:00\n'

const attachmentSeed: IntegrationAttachmentRow[] = [
  {
    id: 1,
    sysCode: 'SYS_REG',
    sysName: '监管回执对接',
    fileName: 'reg_receipt_20260908.csv',
    fileExt: 'csv',
    fileSize: new TextEncoder().encode(receiptCsv).length,
    bizType: 2,
    uploadUser: '监管回执对接',
    uploadTime: '2026-09-08 10:16:02',
    contentHash: contentHashOf(receiptCsv),
    status: 2,
    checkMessage: '校验通过：扩展名 csv 在白名单内，大小未超限，内容指纹已登记',
    content: textFileDataUrl(receiptCsv),
    remark: '监管方回执，含 1 条 FAIL'
  },
  {
    id: 2,
    sysCode: 'SYS_YINBAO',
    sysName: '银保通数据采集',
    fileName: 'ybt_channel_202608.csv',
    fileExt: 'csv',
    fileSize: new TextEncoder().encode('渠道代码,渠道名称\nA03,银行代理\nA05,互联网\n').length,
    bizType: 1,
    uploadUser: '银保通数据采集',
    uploadTime: '2026-09-09 09:02:11',
    contentHash: contentHashOf('渠道代码,渠道名称\nA03,银行代理\nA05,互联网\n'),
    status: 2,
    checkMessage: '校验通过：扩展名 csv 在白名单内，大小未超限，内容指纹已登记',
    content: textFileDataUrl('渠道代码,渠道名称\nA03,银行代理\nA05,互联网\n'),
    remark: '渠道码值，用于本地标准映射核对'
  },
  {
    id: 3,
    sysCode: 'SYS_YINBAO',
    sysName: '银保通数据采集',
    fileName: 'ybt_policy_dump.exe',
    fileExt: 'exe',
    fileSize: 20480,
    bizType: 4,
    uploadUser: '银保通数据采集',
    uploadTime: '2026-09-09 09:05:40',
    contentHash: 'UNKNOWN1',
    status: 3,
    checkMessage:
      '校验失败：扩展名 exe 不在白名单（csv / txt / xlsx / json / pdf / png / jpg）内，已拒绝入库',
    content: '',
    remark: '演示校验失败分支：只登记了登记信息，不保存内容'
  },
  {
    id: 4,
    sysCode: 'SYS_BAOSONG',
    sysName: '报送交换平台',
    fileName: 'check_report_20260910.txt',
    fileExt: 'txt',
    fileSize: new TextEncoder().encode(
      'BX011 保费收入统计表：字段 销售渠道 存在 9 行取值不在监管码值范围内\n'
    ).length,
    bizType: 3,
    uploadUser: '报送交换平台',
    uploadTime: '2026-09-10 16:40:00',
    contentHash: contentHashOf(
      'BX011 保费收入统计表：字段 销售渠道 存在 9 行取值不在监管码值范围内\n'
    ),
    status: 1,
    checkMessage: '已接收，等待校验',
    content: textFileDataUrl(
      'BX011 保费收入统计表：字段 销售渠道 存在 9 行取值不在监管码值范围内\n',
      'text/plain'
    ),
    remark: ''
  }
]

export const integrationSystemTable = defineTable<IntegrationSystemRow>(
  'cr.integrationSystem',
  systemSeed
)
export const integrationAuthTable = defineTable<IntegrationAuthRow>('cr.integrationAuth', authSeed)
export const integrationAttachmentTable = defineTable<IntegrationAttachmentRow>(
  'cr.integrationAttachment',
  attachmentSeed
)

export const SYS_TYPE_LABEL: Record<number, string> = {
  1: '报送交换',
  2: '数据采集',
  3: '监管对接'
}
export const BIZ_TYPE_LABEL: Record<number, string> = {
  1: '报送报文',
  2: '监管回执',
  3: '校验报告',
  4: '其他'
}
export const ATTACH_STATUS_LABEL: Record<number, string> = {
  1: '已接收',
  2: '校验通过',
  3: '校验失败'
}
/** 附件白名单与上限（与补录附件同一口径：单文件 ≤ 1MB） */
export const INTEGRATION_ATTACH_EXTS = ['csv', 'txt', 'xlsx', 'json', 'pdf', 'png', 'jpg']
export const INTEGRATION_ATTACH_MAX = 1024 * 1024
