/**
 * Mock 种子数据 — 报送工作台（首页）
 *
 * 注意：工作台的汇总指标（概况 / 节点跟踪 / 期次趋势 / 机构进度 / 我的待办）已全部改为
 * 从任务、填报、校验、报文等业务表实时汇总，本文件不再维护任何统计种子表
 * （原 cr.dashboardOrgStat / cr.dashboardTodo 已删除），汇总口径见 src/mock/handlers/crDashboard.ts。
 *
 * 只保留「最近动态」：它本身就是一条条历史流水，不参与指标计算。
 */
import { defineTable } from '../store'

export interface DashboardActivityRow {
  id: number
  time: string
  operator: string
  orgName: string
  action: string
  target: string
  /** info | success | warning | danger */
  type: string
}

export const dashboardActivityTable = defineTable<DashboardActivityRow>('cr.dashboardActivity', [
  {
    id: 1,
    time: '2026-09-12 16:42',
    operator: '孙建国',
    orgName: '总公司',
    action: '上级审核通过',
    target: '202608 责任准备金余额表',
    type: 'success'
  },
  {
    id: 2,
    time: '2026-09-12 15:58',
    operator: '陈志强',
    orgName: '北京分公司',
    action: '复核不通过',
    target: '202608 赔案信息表（赔付金额与保险金额勾稽不符）',
    type: 'danger'
  },
  {
    id: 3,
    time: '2026-09-12 15:20',
    operator: '王雅琴',
    orgName: '上海分公司',
    action: '提交填报数据',
    target: '202608 投保人基本信息表',
    type: 'info'
  },
  {
    id: 4,
    time: '2026-09-12 14:37',
    operator: '系统',
    orgName: '—',
    action: '校验任务完成',
    target: '202608 数据校验：警告 26 条，错误 8 条',
    type: 'warning'
  },
  {
    id: 5,
    time: '2026-09-12 11:05',
    operator: '赵敏',
    orgName: '上海分公司',
    action: '复核通过',
    target: '202608 保单贷款业务统计表',
    type: 'success'
  },
  {
    id: 6,
    time: '2026-09-12 10:12',
    operator: '刘婉婷',
    orgName: '广东分公司',
    action: '报文生成',
    target: '202608 销售渠道信息表',
    type: 'info'
  },
  {
    id: 7,
    time: '2026-09-11 17:30',
    operator: '张明浩',
    orgName: '江苏分公司',
    action: '数据导入',
    target: '202608 缴费信息表（1,286 行）',
    type: 'info'
  },
  {
    id: 8,
    time: '2026-09-11 16:08',
    operator: '孙建国',
    orgName: '总公司',
    action: '打回处理',
    target: '202608 受益人信息表 打回至复核环节',
    type: 'warning'
  }
])
