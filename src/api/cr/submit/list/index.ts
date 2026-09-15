import request from '@/config/axios'

/** 数据报送清单（报送批次）VO */
export interface SubmitListVO {
  id?: number
  /** 报送批次号 */
  batchNo: string
  orgId: number
  orgName: string
  period: string
  /** 报表数量 */
  reportCount: number
  /** 数据总行数 */
  totalRows: number
  /** 文件总大小（字节） */
  totalSize: number
  /** 报送人 */
  submitter: string
  /** 报送时间 */
  submitTime: string
  /** 批次状态：0 生成中 / 1 已生成 / 2 上报中 / 3 上报成功 / 4 存在上报失败 */
  status: number
  remark: string
  createTime?: string
}

/** 报送批次明细 VO */
export interface SubmitBatchItemVO {
  id: number
  batchId: number
  batchNo: string
  orgId: number
  orgName: string
  reportCode: string
  reportName: string
  period: string
  fileName: string
  rowCount: number
  fileSize: number
  /** 上报状态：见报文上报状态口径 */
  submitStatus: number
  submitTime: string
}

/** 机构下拉选项 */
export interface SubmitOrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

// 分页查询数据报送清单
export const getSubmitListPage = (params: any) => {
  return request.get({ url: '/cr/submit-list/page', params })
}

// 查询批次明细
export const getSubmitListItems = (batchId: number) => {
  return request.get({ url: '/cr/submit-list/items', params: { batchId } })
}

// 导出数据报送清单
export const exportSubmitList = (params: any) => {
  return request.download({ url: '/cr/submit-list/export-excel', params })
}

// 报送机构下拉选项
export const getSubmitListOrgOptions = () => {
  return request.get({ url: '/cr/submit-list/org-options' })
}

// 期次下拉选项
export const getSubmitListPeriodOptions = () => {
  return request.get({ url: '/cr/submit-list/period-options' })
}
