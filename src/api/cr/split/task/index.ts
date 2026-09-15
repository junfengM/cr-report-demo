import request from '@/config/axios'
import type { SplitPackageVO } from '../execute'

/** 拆分批次 VO */
export interface SplitTaskVO {
  id?: number
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  scopeName: string
  ruleId: number
  ruleCode: string
  ruleName: string
  mode: number
  totalRows: number
  pkgCount: number
  /** 1 执行中 / 2 拆分成功 / 3 拆分失败，见字典 cr_split_status */
  status: number
  startTime: string
  endTime: string
  cost: number
  operator: string
  packages?: SplitPackageVO[]
  message: string
  remark: string
}

/** 拆分详情（含包清单与一致性校验） */
export interface SplitTaskDetailVO extends SplitTaskVO {
  packages: SplitPackageVO[]
  stats: {
    pkgCount: number
    totalRows: number
    maxRows: number
    minRows: number
    avgRows: number
    /** 各包行数之和是否等于拆分前的总行数 */
    consistent: boolean
  }
}

/** 拆分页头部统计 */
export interface SplitStatsVO {
  ruleCount: number
  taskCount: number
  successCount: number
  failedCount: number
  pkgCount: number
  splitRows: number
  lastTime: string
}

// 分页查询拆分批次
export const getSplitTaskPage = (params: any) => {
  return request.get({ url: '/cr/split-task/page', params })
}

// 拆分详情（包清单）
export const getSplitTaskDetail = (id: number) => {
  return request.get({ url: '/cr/split-task/detail?id=' + id })
}

// 导出拆分批次
export const exportSplitTask = (params: any) => {
  return request.download({ url: '/cr/split-task/export-excel', params })
}

// 下载某个包的报文文件（与「一键报送」同一套生成口径：行数/字节数 = 包清单上的数字）
export const downloadSplitPackage = (taskId: number, pkgNo: number) => {
  return request.download({ url: '/cr/split-task/package-file', params: { taskId, pkgNo } })
}

// 拆分页头部统计
export const getSplitStats = () => {
  return request.get({ url: '/cr/split-task/stats' })
}
