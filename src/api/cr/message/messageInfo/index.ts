import request from '@/config/axios'

/** 报文信息 VO */
export interface MessageInfoVO {
  id?: number
  messageCode: string
  messageName: string
  /** 报文类型：TXT / XML / CSV，见字典 cr_message_type */
  messageType: string
  freq: number
  period: string
  reportIds: number[]
  reportCount: number
  tableCount: number
  columnCount: number
  version: string
  /** 监管文号 */
  regulatoryRef: string
  headerRows: number
  /** 是否含报尾 */
  tailFlag: boolean
  effectDate: string
  status: number
  remark: string
  createTime?: string
}

/** 报文段（结构）VO */
export interface MessageSegmentVO {
  segNo: number
  reportId: number
  reportCode: string
  reportName: string
  freq: number
  tableId: number
  tableCode: string
  tableName: string
  columnCount: number
}

/** 报文样例 VO */
export interface MessageSampleVO {
  fileName: string
  format: string
  orgName: string
  dataRows: number
  lineCount: number
  bytes: number
  preview: string[]
}

// 分页查询报文信息
export const getMessageInfoPage = (params: any) => {
  return request.get({ url: '/cr/message-info/page', params })
}

// 查询报文信息详情
export const getMessageInfo = (id: number) => {
  return request.get({ url: '/cr/message-info/get?id=' + id })
}

// 新增报文信息
export const createMessageInfo = (data: MessageInfoVO) => {
  return request.post({ url: '/cr/message-info/create', data })
}

// 修改报文信息
export const updateMessageInfo = (data: MessageInfoVO) => {
  return request.put({ url: '/cr/message-info/update', data })
}

// 删除报文信息
export const deleteMessageInfo = (id: number) => {
  return request.delete({ url: '/cr/message-info/delete?id=' + id })
}

// 批量删除报文信息
export const deleteMessageInfoList = (ids: number[]) => {
  return request.delete({ url: '/cr/message-info/delete-list', params: { ids: ids.join(',') } })
}

// 导出报文信息
export const exportMessageInfo = (params: any) => {
  return request.download({ url: '/cr/message-info/export-excel', params })
}

// 查询报文结构（报文段）
export const getMessageSegments = (id: number) => {
  return request.get({ url: '/cr/message-info/report-list?id=' + id })
}

// 查询报文样例（与一键报送同一套报文生成器）
export const getMessageSample = (id: number) => {
  return request.get({ url: '/cr/message-info/sample?id=' + id })
}
