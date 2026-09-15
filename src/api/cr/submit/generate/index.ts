import request from '@/config/axios'

/** 生成预览 VO（生成前预估将生成多少个文件） */
export interface SubmitGeneratePreviewVO {
  period: string
  orgCount: number
  reportCount: number
  /** 选中组合总数（机构 × 报表） */
  totalCount: number
  /** 本次将生成的文件数 */
  fileCount: number
  /** 已生成过、本次将跳过的数量 */
  skipCount: number
  estimateRows: number
  estimateSize: number
  orgNames: string[]
  reportNames: string[]
}

/** 生成日志（前端逐条播放） */
export interface SubmitGenerateLogVO {
  /** HH:mm:ss */
  time: string
  text: string
  /** info / success / warning / error */
  level: string
}

/** 生成汇总 */
export interface SubmitGenerateSummaryVO {
  batchNo: string
  period: string
  orgCount: number
  reportCount: number
  totalCount: number
  /** 成功生成数 */
  successCount: number
  /** 生成失败数 */
  failCount: number
  /** 已存在报文跳过数 */
  skipCount: number
  totalRows: number
  totalSize: number
  submitter: string
  generateTime: string
}

/** 生成结果 */
export interface SubmitGenerateResultVO {
  batchNo: string
  batchNos: string[]
  logs: SubmitGenerateLogVO[]
  summary: SubmitGenerateSummaryVO
}

/** 最近生成记录 */
export interface SubmitRecentVO {
  id: number
  orgName: string
  reportName: string
  reportCode: string
  period: string
  fileName: string
  fileSize: number
  submitStatus: number
  submitTime: string
  generateTime: string
  failReason: string
}

/** 机构下拉选项 */
export interface SubmitOrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

/** 报表下拉选项 */
export interface SubmitReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

// 生成前预览（将生成多少个文件）
export const previewSubmitGenerate = (params: {
  period: string
  orgIds: number[]
  reportIds: number[]
}) => {
  return request.get({
    url: '/cr/submit-generate/preview',
    params: {
      period: params.period,
      orgIds: params.orgIds.join(','),
      reportIds: params.reportIds.join(',')
    }
  })
}

// 执行报文生成（返回批次号、日志全量与汇总）
export const runSubmitGenerate = (params: {
  period: string
  orgIds: number[]
  reportIds: number[]
}) => {
  return request.get({
    url: '/cr/submit-generate/run',
    params: {
      period: params.period,
      orgIds: params.orgIds.join(','),
      reportIds: params.reportIds.join(',')
    }
  })
}

// 最近生成记录
export const getSubmitGenerateRecent = (limit = 8) => {
  return request.get({ url: '/cr/submit-generate/recent', params: { limit } })
}

// 报送机构下拉选项
export const getSubmitGenerateOrgOptions = () => {
  return request.get({ url: '/cr/submit-generate/org-options' })
}

// 报表下拉选项
export const getSubmitGenerateReportOptions = () => {
  return request.get({ url: '/cr/submit-generate/report-options' })
}

// 期次下拉选项
export const getSubmitGeneratePeriodOptions = () => {
  return request.get({ url: '/cr/submit-generate/period-options' })
}
