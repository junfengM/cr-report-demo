import request from '@/config/axios'

/** 报送数据统计 — 统计项定义 */
export interface StatDefVO {
  code: string
  title: string
  description: string
  note: string
  icon: string
  /**
   * 该查询特有的附加筛选：'asOf'（截止时点）/ 'archiveMonth'（归档月份）。
   * 页面按它决定要不要渲染对应的筛选项 —— 只有时点查询需要时点，别让所有页面都挂一个用不上的控件。
   */
  filters?: string[]
}

/** 统计表格列 */
export interface StatColumnVO {
  prop: string
  label: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

/** 统计结果（10 个查询共用同一形状，页面用一个组件渲染） */
export interface StatPayloadVO {
  code: string
  title: string
  description: string
  /** 口径说明：数据是怎么算出来的，页面上必须展示 */
  note: string
  generatedAt: string
  filterText: string
  columns: StatColumnVO[]
  rows: Array<Record<string, any>>
  summary: Array<{ label: string; value: number | string; unit?: string; tip?: string }>
  chart: { categories: string[]; series: Array<{ name: string; data: number[] }> } | null
}

export interface StatFilterOptionsVO {
  orgs: Array<{ id: number; orgName: string }>
  reports: Array<{ id: number; reportCode: string; reportName: string }>
  periods: string[]
}

// 统计项定义 + 筛选下拉
export const getStatMeta = () => {
  return request.get({ url: '/cr/stat/meta' })
}

// 某个统计查询的汇总结果
export const getStatData = (code: string, params?: any) => {
  return request.get({ url: '/cr/stat/data', params: { code, ...(params || {}) } })
}
