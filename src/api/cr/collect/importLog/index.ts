import request from '@/config/axios'

/** 导入日志 VO */
export interface ImportLogVO {
  id: number
  batchNo: string
  orgName: string
  reportName: string
  period: string
  /** 见字典 cr_import_action：1 解析 / 2 校验 / 3 入库 / 4 回滚 / 5 审核通过 / 6 审核驳回 */
  action: number
  operator: string
  operateTime: string
  /** 1 成功 / 0 失败 */
  result: number
  duration: number
  ip: string
  message: string
}

// 分页查询导入日志
export const getImportLogPage = (params: any) => {
  return request.get({ url: '/cr/import-log/page', params })
}

// 查询导入日志详情
export const getImportLog = (id: number) => {
  return request.get({ url: '/cr/import-log/get?id=' + id })
}

// 导出导入日志
export const exportImportLog = (params: any) => {
  return request.download({ url: '/cr/import-log/export-excel', params })
}
