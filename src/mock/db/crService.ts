/**
 * Mock 种子数据 — 服务管理（服务主机 / 密钥）
 *
 * 附件文档第 16 章的「服务管理（主机/密钥）」在工程内没有可对照字段说明，按通行做法提案：
 *   服务主机 = 与监管方 / 行内系统交换文件的主机（SFTP / FTP / HTTP），带连接测试；
 *   密钥     = 主机登录用的 SSH 密钥 / SFTP 口令 / API 密钥 / 证书，**永远不下发明文**，
 *             页面只显示指纹与有效期，轮换会留痕（谁、什么时候、指纹变成什么）。
 * 「即将过期」按系统当天算，页面上的天数与接口同源。
 */
import { defineTable } from '../store'
import { formatDate } from '../util'

/** 服务主机 */
export interface ServiceHostRow {
  id: number
  hostCode: string
  hostName: string
  /** 1 SFTP / 2 FTP / 3 HTTP */
  hostType: number
  address: string
  port: number
  username: string
  /** 1 密码 / 2 密钥 */
  authType: number
  secretId: number
  secretName: string
  /** 协议描述，如 sftp / ftps / https */
  protocol: string
  status: number
  lastCheckTime: string
  checkResult: string
  checkCost: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 密钥（只存指纹，不存明文） */
export interface ServiceSecretRow {
  id: number
  secretCode: string
  secretName: string
  /** 1 SSH 密钥 / 2 SFTP 口令 / 3 API 密钥 / 4 证书 */
  secretType: number
  algorithm: string
  /** 指纹（页面上唯一可见的"身份"） */
  fingerprint: string
  effectiveFrom: string
  effectiveTo: string
  status: number
  rotateUser: string
  rotateTime: string
  rotateCount: number
  remark: string
  createTime: string
}

/** 密钥操作留痕（生成 / 轮换 / 启用 / 停用） */
export interface SecretTrailRow {
  id: number
  secretId: number
  secretCode: string
  action: string
  user: string
  time: string
  fingerprint: string
  remark: string
}

/**
 * 确定性指纹：同一密钥 + 轮换次数 → 同一个指纹。
 * 算法是 32 位 FNV-1a（Demo 用轻量哈希，可复现、便于演示轮换），前缀如实写 FNV32 ——
 * 曾经写成 'SHA256:'，那是假的：既不是 SHA-256，长度也对不上，容易被当成真摘要。
 */
export const fingerprintOf = (secretCode: string, round: number): string => {
  const text = secretCode + '#' + round + '#HX2026'
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const hex = ('00000000' + hash.toString(16).toUpperCase()).slice(-8)
  return (
    'FNV32:' +
    hex.slice(0, 2) +
    ':' +
    hex.slice(2, 6) +
    ':' +
    hex.slice(6) +
    ':' +
    hex.split('').reverse().join('')
  )
}

/** 距到期还有几天（按系统当天算；负数 = 已过期） */
export const daysUntil = (date: string): number => {
  if (!date) return 0
  const today = new Date(formatDate() + 'T00:00:00').getTime()
  const target = new Date(date + 'T00:00:00').getTime()
  return Math.round((target - today) / 86400000)
}

const hostSeed: ServiceHostRow[] = [
  {
    id: 1,
    hostCode: 'HOST_REG_SFTP',
    hostName: '监管报送前置机',
    hostType: 1,
    address: '10.20.1.15',
    port: 22,
    username: 'cr_report',
    authType: 2,
    secretId: 1,
    secretName: '监管前置机 SSH 密钥',
    protocol: 'sftp',
    status: 1,
    lastCheckTime: '2026-09-11 08:40:21',
    checkResult: '连接成功：目录 /upload/202608 可写，握手 68 ms',
    checkCost: 68,
    updateUser: '系统管理员',
    updateTime: '2026-09-11 08:40:21',
    remark: '报文文件上传主通道',
    createTime: '2026-08-05 09:00:00'
  },
  {
    id: 2,
    hostCode: 'HOST_REG_HTTP',
    hostName: '监管回执接口网关',
    hostType: 3,
    address: 'api.reg-demo.gov.cn',
    port: 443,
    username: 'hxcr',
    authType: 2,
    secretId: 3,
    secretName: '监管回执 API 密钥',
    protocol: 'https',
    status: 1,
    lastCheckTime: '2026-09-11 08:42:03',
    checkResult: '连接成功：TLS 1.3，接口 /cr/receipt 可达，握手 132 ms',
    checkCost: 132,
    updateUser: '系统管理员',
    updateTime: '2026-09-11 08:42:03',
    remark: '回执拉取通道',
    createTime: '2026-08-05 09:10:00'
  },
  {
    id: 3,
    hostCode: 'HOST_DR_FTP',
    hostName: '灾备文件服务器',
    hostType: 2,
    address: '10.20.9.9',
    port: 21,
    username: 'cr_backup',
    authType: 1,
    secretId: 2,
    secretName: '灾备 FTP 口令',
    protocol: 'ftps',
    status: 0,
    lastCheckTime: '2026-09-02 16:20:44',
    checkResult: '连接失败：主机已停用（演示分支）',
    checkCost: 3000,
    updateUser: '系统管理员',
    updateTime: '2026-09-02 16:20:44',
    remark: '已停用示例：灾备演练期间关闭',
    createTime: '2026-08-05 09:20:00'
  }
]

const secretSeed: ServiceSecretRow[] = [
  {
    id: 1,
    secretCode: 'SEC_SSH_REG',
    secretName: '监管前置机 SSH 密钥',
    secretType: 1,
    algorithm: 'ed25519',
    fingerprint: fingerprintOf('SEC_SSH_REG', 2),
    effectiveFrom: '2026-03-01',
    effectiveTo: '2027-03-01',
    status: 1,
    rotateUser: '系统管理员',
    rotateTime: '2026-08-15 10:20:00',
    rotateCount: 2,
    remark: '每 12 个月轮换一次',
    createTime: '2025-03-01 10:00:00'
  },
  {
    id: 2,
    secretCode: 'SEC_FTP_DR',
    secretName: '灾备 FTP 口令',
    secretType: 2,
    algorithm: '口令（16 位随机）',
    fingerprint: fingerprintOf('SEC_FTP_DR', 1),
    effectiveFrom: '2025-09-01',
    effectiveTo: '2026-09-01',
    status: 0,
    rotateUser: '系统管理员',
    rotateTime: '2025-09-01 09:00:00',
    rotateCount: 1,
    remark: '已过期示例：2026-09-01 到期，主机也已停用',
    createTime: '2025-09-01 09:00:00'
  },
  {
    id: 3,
    secretCode: 'SEC_API_REG',
    secretName: '监管回执 API 密钥',
    secretType: 3,
    algorithm: 'HMAC-SHA256',
    fingerprint: fingerprintOf('SEC_API_REG', 4),
    effectiveFrom: '2026-06-01',
    effectiveTo: '2026-12-01',
    status: 1,
    rotateUser: '系统管理员',
    rotateTime: '2026-09-01 09:30:00',
    rotateCount: 4,
    remark: '按季度轮换',
    createTime: '2025-12-01 09:00:00'
  },
  {
    id: 4,
    secretCode: 'SEC_CERT_REG',
    secretName: '监管上报客户端证书',
    secretType: 4,
    algorithm: 'RSA-2048',
    fingerprint: fingerprintOf('SEC_CERT_REG', 1),
    effectiveFrom: '2025-10-01',
    effectiveTo: '2027-10-01',
    status: 1,
    rotateUser: '系统管理员',
    rotateTime: '2025-10-01 09:00:00',
    rotateCount: 1,
    remark: '两年有效期，到期前 30 天提醒',
    createTime: '2025-10-01 09:00:00'
  }
]

const trailSeed: SecretTrailRow[] = [
  {
    id: 1,
    secretId: 1,
    secretCode: 'SEC_SSH_REG',
    action: '轮换',
    user: '系统管理员',
    time: '2026-08-15 10:20:00',
    fingerprint: fingerprintOf('SEC_SSH_REG', 2),
    remark: '按年度轮换计划执行，旧密钥保留 7 天后失效'
  },
  {
    id: 2,
    secretId: 1,
    secretCode: 'SEC_SSH_REG',
    action: '生成',
    user: '系统管理员',
    time: '2025-03-01 10:00:00',
    fingerprint: fingerprintOf('SEC_SSH_REG', 1),
    remark: '首次生成'
  },
  {
    id: 3,
    secretId: 3,
    secretCode: 'SEC_API_REG',
    action: '轮换',
    user: '系统管理员',
    time: '2026-09-01 09:30:00',
    fingerprint: fingerprintOf('SEC_API_REG', 4),
    remark: '季度轮换'
  },
  {
    id: 4,
    secretId: 2,
    secretCode: 'SEC_FTP_DR',
    action: '停用',
    user: '系统管理员',
    time: '2026-09-02 16:18:00',
    fingerprint: fingerprintOf('SEC_FTP_DR', 1),
    remark: '随灾备主机停用一起冻结'
  }
]

export const serviceHostTable = defineTable<ServiceHostRow>('cr.serviceHost', hostSeed)
export const serviceSecretTable = defineTable<ServiceSecretRow>('cr.serviceSecret', secretSeed)
export const secretTrailTable = defineTable<SecretTrailRow>('cr.secretTrail', trailSeed)

export const HOST_TYPE_LABEL: Record<number, string> = { 1: 'SFTP', 2: 'FTP', 3: 'HTTP' }
export const AUTH_TYPE_LABEL: Record<number, string> = { 1: '密码', 2: '密钥' }
export const SECRET_TYPE_LABEL: Record<number, string> = {
  1: 'SSH 密钥',
  2: 'SFTP 口令',
  3: 'API 密钥',
  4: '证书'
}
export const SECRET_STATUS_LABEL: Record<number, string> = { 0: '停用', 1: '启用' }
