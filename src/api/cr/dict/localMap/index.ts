import request from '@/config/axios'

/** 本地标准映射 VO（本地码值 ↔ 监管码值） */
export interface LocalMapVO {
  id?: number
  /** 本地字典编码，如 LOCAL_CHANNEL */
  localDict: string
  localDictName?: string
  localCode: string
  localName?: string
  /** 监管字典编码，如 REG_CHANNEL */
  regDict: string
  regDictName?: string
  regCode: string
  regName?: string
  /** 优先级 0~999，缺省 50：同一本地码值有多条启用映射时数字小的生效 */
  priority: number
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  updateUser?: string
  updateTime?: string
  remark: string
  createTime?: string
}

/** 映射生效判断（列表逐行标注） */
export interface LocalMapDecisionVO {
  state: 'EFFECTIVE' | 'COVERED' | 'DISABLED'
  stateLabel: string
  reason: string
  effectiveId: number
}

/** 映射校验问题 */
export interface LocalMapIssueVO {
  id: string
  type: string
  level: 'error' | 'warn'
  target: string
  message: string
  suggestion: string
}

/** 映射校验报告 */
export interface LocalMapReportVO {
  checkedAt: string
  summary: string
  stats: {
    localTotal: number
    mapTotal: number
    mappedLocalCount: number
    unmappedCount: number
    duplicateCount: number
    missingRegCount: number
    disabledCount: number
    errorCount: number
    coverRate: number
  }
  issues: LocalMapIssueVO[]
}

/** 字典下拉项 */
export interface LocalDictOptionVO {
  localDict: string
  dictName: string
  count: number
}
export interface RegDictOptionVO {
  regDict: string
  dictName: string
  count: number
}

// 分页查询本地标准映射
export const getLocalMapPage = (params: any) => {
  return request.get({ url: '/cr/local-map/page', params })
}

// 查询映射详情
export const getLocalMap = (id: number) => {
  return request.get({ url: '/cr/local-map/get?id=' + id })
}

// 新增映射
export const createLocalMap = (data: LocalMapVO) => {
  return request.post({ url: '/cr/local-map/create', data })
}

// 修改映射
export const updateLocalMap = (data: LocalMapVO) => {
  return request.put({ url: '/cr/local-map/update', data })
}

// 删除映射
export const deleteLocalMap = (id: number) => {
  return request.delete({ url: '/cr/local-map/delete?id=' + id })
}

// 批量删除映射
export const deleteLocalMapList = (ids: number[]) => {
  return request.delete({ url: '/cr/local-map/delete-list', params: { ids: ids.join(',') } })
}

// 导出映射
export const exportLocalMap = (params: any) => {
  return request.download({ url: '/cr/local-map/export-excel', params })
}

// 本地字典 / 监管字典下拉
export const getLocalMapDictOptions = () => {
  return request.get({ url: '/cr/local-map/dict-options' })
}

// 本地码值下拉（按本地字典取）
export const getLocalCodeOptions = (localDict: string) => {
  return request.get({ url: '/cr/local-code/simple-list', params: { localDict } })
}

// 监管码值下拉（按监管字典取）
export const getRegCodeOptions = (regDict: string) => {
  return request.get({ url: '/cr/reg-code/simple-list', params: { regDict } })
}

// 每条映射的生效判断
export const getLocalMapDecisions = () => {
  return request.get({ url: '/cr/local-map/decisions' })
}

// 映射完整性校验（只算不写）
export const validateLocalMap = () => {
  return request.get({ url: '/cr/local-map/validate' })
}
