import request from '@/config/axios'

/** 高级对比：单个指标一行，多期数值 + 环比 / 同比 */
export interface CompareRowVO {
  indicator: string
  unit: string
  /** 期次 → 数值（缺失为 null） */
  values: Record<string, number | null>
  latest: number | null
  /** 环比（%，与上期对比；除数缺失或为 0 时为 null） */
  mom: number | null
  /** 同比（%，与去年同期对比；除数缺失或为 0 时为 null） */
  yoy: number | null
}

/** 高级对比结果 */
export interface CompareResultVO {
  reportId: number
  reportCode: string
  reportName: string
  freq: number
  orgId: number
  orgName: string
  /** 参与对比的期次（升序） */
  periods: string[]
  /** 环比对照期次 */
  momPeriod: string
  /** 同比对照期次（去年同期） */
  yoyPeriod: string
  rows: CompareRowVO[]
}

/** 数据追溯：单个环节 */
export interface TraceNodeVO {
  node: string
  nodeTime: string
  operator: string
  /** 耗时（秒） */
  costSeconds: number
  /** 成功 / 进行中 / 失败 / 待执行 */
  result: string
  affectRows: number
  remark: string
}

/** 数据追溯结果 */
export interface TraceResultVO {
  reportId: number
  reportCode: string
  reportName: string
  orgId: number
  orgName: string
  period: string
  nodes: TraceNodeVO[]
}

/** 报表备注 VO */
export interface RemarkVO {
  id?: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  content: string
  creator: string
  createTime: string
}

// 多期数据对比（含环比 / 同比）
export const getCompareData = (params: any) => {
  return request.get({ url: '/cr/query-comprehensive/compare', params })
}

// 导出多期数据对比结果
export const exportCompareData = (params: any) => {
  return request.download({ url: '/cr/query-comprehensive/compare-export', params })
}

// 数据追溯链路
export const getTraceData = (params: any) => {
  return request.get({ url: '/cr/query-comprehensive/trace', params })
}

// 分页查询报表备注
export const getRemarkPage = (params: any) => {
  return request.get({ url: '/cr/query-comprehensive/remark/page', params })
}

// 新增报表备注
export const createRemark = (data: RemarkVO) => {
  return request.post({ url: '/cr/query-comprehensive/remark/create', data })
}
