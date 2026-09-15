import request from '@/config/axios'

/** 报文文件记录 VO */
export interface MessageVO {
  id?: number
  /** 报文文件名 */
  messageName: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 文件类型：TXT / XML / CSV，由文件名后缀推导（与下载内容格式一致） */
  fileType: string
  /** 文件大小（字节）= 实际下载到的 Blob 大小；0 表示还没有可下载的文件 */
  fileSize: number
  /** 数据行数 = 报文文件里的业务数据行数（不含表头 / XML 声明与根节点） */
  rowCount: number
  /** 1 生成中 / 2 生成成功 / 3 生成失败 */
  status: number
  genTime: string
  genUser: string
  /** 上报方式：SFTP / FTP / MANUAL */
  reportType?: string
  direction: string
  remark: string
}

// 报文记录分页
export const getMessagePage = (params: any) => request.get({ url: '/cr/data-message/page', params })

// 生成报文
export const generateMessage = (data: {
  orgId: number
  reportId: number
  period: string
  fileType: string
}) => request.post({ url: '/cr/data-message/generate', data })

// 重新生成报文
export const regenerateMessage = (id: number) =>
  request.put({ url: '/cr/data-message/regenerate', data: { id } })

// 删除报文
export const deleteMessage = (id: number) =>
  request.delete({ url: '/cr/data-message/delete?id=' + id })

// 下载报文（按文件名后缀返回对应格式的 Blob：txt / csv / xml，均带正确 MIME）
export const downloadMessage = (id: number) =>
  request.download({ url: '/cr/data-message/download?id=' + id })

// 机构下拉
export const getMessageOrgOptions = () => request.get({ url: '/cr/data-message/org-options' })

// 报表下拉
export const getMessageReportOptions = () => request.get({ url: '/cr/data-message/report-options' })

// 期次下拉
export const getMessagePeriodOptions = () => request.get({ url: '/cr/data-message/period-options' })
