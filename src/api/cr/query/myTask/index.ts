import request from '@/config/axios'

/** 我的任务 VO */
export interface MyTaskVO {
  id?: number
  taskCode: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 任务状态，见字典 cr_task_status */
  status: number
  /** 截止日期 */
  deadline: string
  ownerId: number
  ownerName: string
  orgId: number
  orgName: string
  /** 提交填报时间 */
  fillTime: string
  remark: string
}

// 分页查询我的任务（tab：todo 待办 / done 已办）
export const getMyTaskPage = (params: any) => {
  return request.get({ url: '/cr/query-my-task/page', params })
}
