import request from '@/config/axios'
import type { CollectTaskLogVO } from '../monitor'

export interface ManualPeriodVO {
  period: string
  periodName: string
  status: number
  /** 该期次对应的数据日期（服务端按月末推导，页面直接显示） */
  dataDate: string
}

export interface ManualRunResultVO {
  period: string
  dataDate: string
  generated: number
  success: number
  failed: number
  waiting: number
  rowsAdded: number
  logs: CollectTaskLogVO[]
}

// 手工调度选项：任务分组 + 期次（期次带推导出的数据日期）
export const getManualOptions = () => request.get({ url: '/cr/schedule/manual-options' })

// 手工调度：勾选任务分组 + 选择期次 → 批量重跑
export const manualRun = (groupIds: number[], period: string) =>
  request.post({ url: '/cr/schedule/manual-run', data: { groupIds, period } })
