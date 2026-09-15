import request from '@/config/axios'

/** 报文配置域公共下拉：报表 / 机构 / 报文 */

export interface MessageReportOptionVO {
  id: number
  name: string
  code: string
  reportCode: string
  reportName: string
  freq: number
  subjectName: string
  tableId: number
  tableCode: string
  tableName: string
  columnCount: number
}

export interface MessageOrgOptionVO {
  id: number
  name: string
  code: string
}

export interface MessageOptionVO {
  id: number
  name: string
  code: string
  messageCode: string
  messageName: string
  messageType: string
  freq: number
}

/** 报表下拉（可按频度过滤） */
export const getReportOptions = (freq?: number) => {
  return request.get({ url: '/cr/message-common/report-options', params: { freq } })
}

/** 报送机构下拉 */
export const getOrgOptions = () => {
  return request.get({ url: '/cr/message-common/org-options' })
}

/** 报文信息下拉（可按频度过滤） */
export const getMessageOptions = (freq?: number) => {
  return request.get({ url: '/cr/message-common/message-options', params: { freq } })
}
