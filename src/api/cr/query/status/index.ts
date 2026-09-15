import request from '@/config/axios'

/** 报表状态查询 VO */
export interface ReportStatusVO {
  id?: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  subjectName?: string
  period: string
  /** 数据填报状态，见字典 cr_fill_status */
  fillStatus: number
  /** 数据校验状态，见字典 cr_check_status */
  checkStatus: number
  /** 报送状态：0 未报送 / 1 报送中 / 2 已报送 */
  submitStatus: number
  dataRows: number
  lastModifier: string
  lastModifyTime: string
}

/** 小结卡片数据 */
export interface ReportStatusSummaryVO {
  shouldReport: number
  filled: number
  checked: number
  submitted: number
}

/** 抽屉明细：数据表拆分 */
export interface ReportStatusTableVO {
  tableCode: string
  tableName: string
  cnName: string
  subjectName: string
  rows: number
  lastSyncTime: string
}

/** 抽屉明细：校验问题 */
export interface ReportStatusIssueVO {
  ruleCode: string
  ruleName: string
  level: number
  levelName: string
  description: string
  affectRows: number
  status: string
  foundTime: string
}

/** 抽屉明细：处理轨迹 */
export interface ReportStatusLogVO {
  node: string
  time: string
  operator: string
  result: string
  affectRows: number
  remark: string
}

/** 抽屉明细 VO */
export interface ReportStatusDetailVO extends ReportStatusVO {
  freq?: number
  caliber?: string
  fillStatusName: string
  checkStatusName: string
  submitStatusName: string
  tables: ReportStatusTableVO[]
  issues: ReportStatusIssueVO[]
  logs: ReportStatusLogVO[]
  remarks: Array<{ id: number; creator: string; createTime: string; content: string }>
}

// 分页查询报表报送状态
export const getReportStatusPage = (params: any) => {
  return request.get({ url: '/cr/query-status/page', params })
}

// 查询小结卡片数据
export const getReportStatusSummary = (params: any) => {
  return request.get({ url: '/cr/query-status/summary', params })
}

// 查询某机构某报表某期次的明细
export const getReportStatusDetail = (params: any) => {
  return request.get({ url: '/cr/query-status/detail', params })
}

// 导出报表报送状态
export const exportReportStatus = (params: any) => {
  return request.download({ url: '/cr/query-status/export-excel', params })
}
