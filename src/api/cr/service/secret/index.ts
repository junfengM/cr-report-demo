import request from '@/config/axios'

/** 密钥 VO */
export interface ServiceSecretVO {
  id?: number
  secretCode: string
  secretName: string
  /** 1 SSH 密钥 / 2 SFTP 口令 / 3 API 密钥 / 4 证书 */
  secretType: number
  algorithm: string
  /** 指纹（页面唯一可见的"身份"，明文永不落库） */
  fingerprint?: string
  effectiveFrom: string
  effectiveTo: string
  status: number
  rotateUser?: string
  rotateTime?: string
  rotateCount?: number
  /** 距到期天数（由接口按系统当天算） */
  daysLeft?: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

// 分页查询密钥
export const getPage = (params: any) => {
  return request.get({ url: '/cr/service-secret/page', params })
}

// 查询密钥详情
export const getDetail = (id: number) => {
  return request.get({ url: '/cr/service-secret/get?id=' + id })
}

// 新增密钥
export const create = (data: ServiceSecretVO) => {
  return request.post({ url: '/cr/service-secret/create', data })
}

// 修改密钥
export const update = (data: ServiceSecretVO) => {
  return request.put({ url: '/cr/service-secret/update', data })
}

// 删除密钥
export const remove = (id: number) => {
  return request.delete({ url: '/cr/service-secret/delete?id=' + id })
}

// 批量删除密钥
export const removeList = (ids: number[]) => {
  return request.delete({ url: '/cr/service-secret/delete-list', params: { ids: ids.join(',') } })
}

// 导出密钥
export const exportExcel = (params: any) => {
  return request.download({ url: '/cr/service-secret/export-excel', params })
}

/** 密钥留痕 */
export interface SecretTrailVO {
  id: number
  secretId: number
  secretCode: string
  action: string
  user: string
  time: string
  fingerprint: string
  remark: string
}

// 密钥轮换（生成新指纹 + 留痕，仅系统管理员）
export const rotateSecret = (id: number, remark?: string) => {
  return request.post({ url: '/cr/service-secret/rotate', data: { id, remark } })
}

// 密钥留痕（只读）
export const getSecretTrail = (secretId?: number) => {
  return request.get({ url: '/cr/service-secret/trail', params: { secretId } })
}

// 即将过期（只读，默认 90 天内，已过期的负数也会列出）
export const getExpiringSecrets = (withinDays = 90) => {
  return request.get({ url: '/cr/service-secret/expiring', params: { withinDays } })
}
