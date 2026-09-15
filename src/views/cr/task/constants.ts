/**
 * 报表任务流转 — 前端共享常量与展示辅助
 *
 * 状态取值与 `src/mock/db/crTask.ts` 的 TASK_STATUS 一一对应（即字典 cr_task_status）。
 * 页面只读这里，避免 5 个页面各写一套魔法数字。
 */

/** 任务状态：见字典 cr_task_status */
export const TASK_STATUS = {
  /** 待下发 */
  PENDING_DISPATCH: 10,
  /** 已下发（待填报） */
  DISPATCHED: 20,
  /** 填报中 */
  FILLING: 30,
  /** 待复核 */
  WAIT_REVIEW: 40,
  /** 复核通过 */
  REVIEW_PASSED: 50,
  /** 复核不通过 */
  REVIEW_REJECTED: 60,
  /** 本级审核中 */
  WAIT_LOCAL_AUDIT: 70,
  /** 上级审核中 */
  WAIT_UPPER_AUDIT: 80,
  /** 审核通过（已完成） */
  FINISHED: 90,
  /** 已打回 */
  RETURNED: 100
} as const

/** 打回环节 */
export const RETURN_STAGE = {
  FILL: '填报',
  REVIEW: '复核',
  LOCAL_AUDIT: '本级审核',
  UPPER_AUDIT: '上级审核'
} as const

/** 状态 → 流转进度（el-steps 的 active 下标） */
export const STATUS_STEP: Record<number, number> = {
  [TASK_STATUS.PENDING_DISPATCH]: 0,
  [TASK_STATUS.DISPATCHED]: 0,
  [TASK_STATUS.FILLING]: 0,
  [TASK_STATUS.REVIEW_PASSED]: 1,
  [TASK_STATUS.REVIEW_REJECTED]: 0,
  [TASK_STATUS.WAIT_REVIEW]: 1,
  [TASK_STATUS.WAIT_LOCAL_AUDIT]: 2,
  [TASK_STATUS.WAIT_UPPER_AUDIT]: 3,
  [TASK_STATUS.FINISHED]: 4,
  [TASK_STATUS.RETURNED]: 0
}

/** 状态 → 当前环节文案（列表「当前环节」列） */
export const STATUS_STAGE: Record<number, string> = {
  [TASK_STATUS.PENDING_DISPATCH]: '待下发',
  [TASK_STATUS.DISPATCHED]: '填报',
  [TASK_STATUS.FILLING]: '填报',
  [TASK_STATUS.REVIEW_PASSED]: '本级审核',
  [TASK_STATUS.REVIEW_REJECTED]: '填报',
  [TASK_STATUS.WAIT_REVIEW]: '复核',
  [TASK_STATUS.WAIT_LOCAL_AUDIT]: '本级审核',
  [TASK_STATUS.WAIT_UPPER_AUDIT]: '上级审核',
  [TASK_STATUS.FINISHED]: '已完成',
  [TASK_STATUS.RETURNED]: '打回处理'
}

/** 流转主链路（轨迹弹窗 / 进度展示用） */
export const FLOW_STEPS = ['填报', '复核', '本级审核', '上级审核', '已完成']

/** el-tag 支持的主题色 */
export type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

/** 环节 → el-tag 主题色 */
export const STAGE_TAG_TYPE: Record<string, TagType> = {
  填报: 'primary',
  复核: 'warning',
  本级审核: 'warning',
  上级审核: 'warning',
  已完成: 'success',
  打回处理: 'danger',
  待下发: 'info'
}

/** 操作结果：见字典 cr_audit_status */
export const AUDIT_RESULT = {
  PASS: 1,
  REJECT: 2
} as const

/** 常用期次（提单默认当期） */
export const DEFAULT_PERIOD = '202608'

/** 展示用：状态 → 环节文案 */
export const stageOf = (status?: number): string =>
  (status !== undefined && STATUS_STAGE[status]) || '未知'

/** 展示用：状态 → el-tag 类型 */
export const tagTypeOf = (status?: number): TagType => STAGE_TAG_TYPE[stageOf(status)] || 'info'

/** 展示用：状态是否处于打回 / 异常 */
export const isReturned = (status?: number): boolean =>
  status === TASK_STATUS.RETURNED || status === TASK_STATUS.REVIEW_REJECTED

/** 展示用：状态是否已结束 */
export const isFinished = (status?: number): boolean => status === TASK_STATUS.FINISHED
