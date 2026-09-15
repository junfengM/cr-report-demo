/**
 * 一键报送 — 前端共享常量与展示辅助
 *
 * 状态取值与 `src/mock/db/crSubmit.ts` 的 SUBMIT_STATUS / BATCH_STATUS 一一对应，
 * 5 个页面只读这里，避免各页各写一套魔法数字。
 */

/** el-tag 主题色 */
export type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

/** 报文上报状态（见 mock/db/crSubmit.ts SUBMIT_STATUS） */
export const SUBMIT_STATUS = {
  /** 待生成 */
  WAIT_GENERATE: 0,
  /** 已生成 */
  GENERATED: 1,
  /** 上报中 */
  REPORTING: 2,
  /** 上报成功 */
  SUCCESS: 3,
  /** 上报失败 */
  FAILED: 4,
  /** 已回执 */
  RECEIPTED: 5
} as const

/** 上报状态 → 中文名 */
export const SUBMIT_STATUS_NAME: Record<number, string> = {
  [SUBMIT_STATUS.WAIT_GENERATE]: '待生成',
  [SUBMIT_STATUS.GENERATED]: '已生成',
  [SUBMIT_STATUS.REPORTING]: '上报中',
  [SUBMIT_STATUS.SUCCESS]: '上报成功',
  [SUBMIT_STATUS.FAILED]: '上报失败',
  [SUBMIT_STATUS.RECEIPTED]: '已回执'
}

/** 上报状态 → el-tag 主题色（6 种状态颜色各不相同） */
export const SUBMIT_STATUS_TAG: Record<number, TagType> = {
  [SUBMIT_STATUS.WAIT_GENERATE]: 'info',
  [SUBMIT_STATUS.GENERATED]: 'primary',
  [SUBMIT_STATUS.REPORTING]: 'warning',
  [SUBMIT_STATUS.SUCCESS]: 'success',
  [SUBMIT_STATUS.FAILED]: 'danger',
  [SUBMIT_STATUS.RECEIPTED]: 'success'
}

/** 上报状态下拉选项（本域常量，不走字典） */
export const SUBMIT_STATUS_OPTIONS = Object.entries(SUBMIT_STATUS_NAME).map(([value, label]) => ({
  value: Number(value),
  label
}))

/** 报送批次状态 */
export const BATCH_STATUS = {
  GENERATING: 0,
  GENERATED: 1,
  REPORTING: 2,
  SUCCESS: 3,
  FAILED: 4
} as const

/** 批次状态 → 中文名 */
export const BATCH_STATUS_NAME: Record<number, string> = {
  [BATCH_STATUS.GENERATING]: '生成中',
  [BATCH_STATUS.GENERATED]: '已生成',
  [BATCH_STATUS.REPORTING]: '上报中',
  [BATCH_STATUS.SUCCESS]: '上报成功',
  [BATCH_STATUS.FAILED]: '存在上报失败'
}

/** 批次状态 → el-tag 主题色 */
export const BATCH_STATUS_TAG: Record<number, TagType> = {
  [BATCH_STATUS.GENERATING]: 'info',
  [BATCH_STATUS.GENERATED]: 'primary',
  [BATCH_STATUS.REPORTING]: 'warning',
  [BATCH_STATUS.SUCCESS]: 'success',
  [BATCH_STATUS.FAILED]: 'danger'
}

/** 批次状态下拉选项 */
export const BATCH_STATUS_OPTIONS = Object.entries(BATCH_STATUS_NAME).map(([value, label]) => ({
  value: Number(value),
  label
}))

/** 质量检核结论 */
export const QUALITY_RESULT = { PASS: 1, FAIL: 0 } as const

/** 默认报送期次 */
export const DEFAULT_PERIOD = '202608'

/** 文件类型选项 */
export const FILE_TYPE_OPTIONS = [
  { value: 'TXT', label: 'TXT 定长/分隔符文本' },
  { value: 'XML', label: 'XML 报文' },
  { value: 'CSV', label: 'CSV 逗号分隔' }
]

/** 字符编码选项 */
export const CHARSET_OPTIONS = ['UTF-8', 'GBK', 'GB18030']

/** 字段分隔符选项 */
export const SEPARATOR_OPTIONS = [
  { value: '|', label: '竖线 |' },
  { value: ',', label: '逗号 ,' },
  { value: '^', label: '脱字符 ^' },
  { value: '\\t', label: '制表符 \\t' }
]

/** 命名规则占位符说明（列表页 el-alert 与表单提示共用） */
export const FILE_RULE_PLACEHOLDERS = [
  { name: '{orgCode}', desc: '机构编码，如 110000' },
  { name: '{reportCode}', desc: '报表编码，如 BX001' },
  { name: '{tableCode}', desc: '数据表编码，如 T01' },
  { name: '{period}', desc: '报送期次，如 202608' },
  { name: '{date}', desc: '报送日期，如 20260912' },
  { name: '{seq}', desc: '文件分片序号，如 001' }
]

/** 展示用：上报状态 → 中文名 */
export const submitStatusName = (value?: number): string =>
  (value !== undefined && SUBMIT_STATUS_NAME[Number(value)]) || '未知'

/** 展示用：上报状态 → el-tag 主题色 */
export const submitStatusTag = (value?: number): TagType =>
  SUBMIT_STATUS_TAG[Number(value)] || 'info'

/** 展示用：批次状态 → 中文名 */
export const batchStatusName = (value?: number): string =>
  (value !== undefined && BATCH_STATUS_NAME[Number(value)]) || '未知'

/** 展示用：批次状态 → el-tag 主题色 */
export const batchStatusTag = (value?: number): TagType => BATCH_STATUS_TAG[Number(value)] || 'info'

/** 千分位格式化 */
export const formatNumber = (value?: number): string =>
  value === undefined || value === null ? '-' : Number(value).toLocaleString('zh-CN')

/** 文件大小格式化：字节 → B / KB / MB */
export const formatFileSize = (size?: number): string => {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}
