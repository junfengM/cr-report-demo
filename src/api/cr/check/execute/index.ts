import request from '@/config/axios'

/** 校验日志（前端逐条播放） */
export interface CheckLogVO {
  /** HH:mm:ss */
  time: string
  text: string
  /** info / success / warning / error */
  level: string
}

/** 校验执行结果 */
export interface CheckExecuteResultVO {
  taskNo: string
  period: string
  orgCount: number
  reportCount: number
  /** 通过 + 警告 + 错误 */
  total: number
  passCount: number
  warnCount: number
  errorCount: number
  /** 本次产生的校验明细条数 */
  resultCount: number
  checkTime: string
  logs: CheckLogVO[]
}

/** 校验进度（供轮询使用） */
export interface CheckProgressVO {
  percent: number
  done: boolean
  logs: CheckLogVO[]
  summary?: CheckExecuteResultVO
}

/** 机构下拉选项 */
export interface CheckOrgOptionVO {
  id: number
  name: string
  code: string
  level: number
}

/** 报表下拉选项 */
export interface CheckReportOptionVO {
  id: number
  name: string
  code: string
  freq: number
  subjectName: string
}

// 启动数据校验（返回任务号、日志全量与汇总）
export const runCheckExecute = (params: {
  period: string
  orgIds: number[]
  reportIds: number[]
}) => {
  return request.get({
    url: '/cr/check-execute/run',
    params: {
      period: params.period,
      orgIds: params.orgIds.join(','),
      reportIds: params.reportIds.join(',')
    }
  })
}

// 查询校验进度
export const getCheckExecuteProgress = (taskNo: string) => {
  return request.get({ url: '/cr/check-execute/progress', params: { taskNo } })
}

// 报送机构下拉选项
export const getCheckExecuteOrgOptions = () => {
  return request.get({ url: '/cr/check-execute/org-options' })
}

// 报表下拉选项
export const getCheckExecuteReportOptions = () => {
  return request.get({ url: '/cr/check-execute/report-options' })
}
