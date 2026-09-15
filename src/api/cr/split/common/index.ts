import request from '@/config/axios'

/** 机构下拉（含「全部机构」） */
export const getSplitOrgOptions = () => {
  return request.get({ url: '/cr/split-common/org-options' })
}

/** 报表下拉（含「全部报表」） */
export const getSplitReportOptions = () => {
  return request.get({ url: '/cr/split-common/report-options' })
}

/** 期次下拉 */
export const getSplitPeriodOptions = () => {
  return request.get({ url: '/cr/split-common/period-options' })
}

/** 拆分方式 / 可选拆分字段 / 单次包数上限（由服务端给，页面不自己写枚举） */
export interface SplitMetaVO {
  modes: Array<{ value: number; label: string }>
  fields: Array<{ field: string; label: string }>
  maxPackages: number
}

export const getSplitMeta = () => {
  return request.get({ url: '/cr/split-common/meta' })
}
