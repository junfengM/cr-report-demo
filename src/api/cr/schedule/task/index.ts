import request from '@/config/axios'

/** 采集任务 VO（任务维护页） */
export interface CollectTaskVO {
  id?: number
  /** 所属任务分组 */
  groupId: number
  /** 任务编码（存储过程英文名），创建后不可修改 */
  code: string
  /** 任务名称（存储过程中文名） */
  name: string
  /** 优先级：1 高 / 2 中 / 3 低（数字小的先跑） */
  priority: number
  /** 实现类型，见字典 cr_task_impl_type：1 存储过程 / 2 Shell / 3 SQL / 4 Java 类 */
  implType: number
  /** 实现方法：存储过程名 / 脚本路径 / SQL 正文 / 类名 */
  implMethod: string
  /** 前置任务 id 列表 */
  preTaskIds?: number[]
  description: string
  createUser?: string
  createTime?: string
  updateUser?: string
  updateTime?: string
  /** 列表附带：分组名 / 优先级中文 / 实现类型中文 / 前置任务名 */
  groupName?: string
  groupCode?: string
  priorityLabel?: string
  implTypeLabel?: string
  preTaskNames?: string[]
}

export interface CollectTaskGroupVO {
  id: number
  groupCode: string
  groupName: string
  description: string
  taskCount: number
  highPriorityCount: number
}

export interface CollectTaskOptionVO {
  id: number
  code: string
  name: string
  groupId: number
  groupName: string
  priority: number
  implType: number
  /** 前置任务 id 列表（前置任务弹窗用它算"谁依赖它"的反向依赖） */
  preTaskIds?: number[]
}

// 分页查询采集任务
export const getCollectTaskPage = (params: any) =>
  request.get({ url: '/cr/collect-task/page', params })

// 查询采集任务详情
export const getCollectTask = (id: number) => request.get({ url: '/cr/collect-task/get?id=' + id })

// 新增采集任务
export const createCollectTask = (data: CollectTaskVO) =>
  request.post({ url: '/cr/collect-task/create', data })

// 修改采集任务（任务编码不可改）
export const updateCollectTask = (data: CollectTaskVO) =>
  request.put({ url: '/cr/collect-task/update', data })

// 删除采集任务
export const deleteCollectTask = (id: number) =>
  request.delete({ url: '/cr/collect-task/delete?id=' + id })

// 批量删除采集任务
export const deleteCollectTaskList = (ids: number[]) =>
  request.delete({ url: '/cr/collect-task/delete-list', params: { ids: ids.join(',') } })

// 导出采集任务
export const exportCollectTask = (params: any) =>
  request.download({ url: '/cr/collect-task/export-excel', params })

// 任务分组树（左侧）
export const getCollectTaskGroupTree = () => request.get({ url: '/cr/collect-task/group-tree' })

// 任务下拉（前置任务选择 / 调度配置选任务）
export const getCollectTaskOptions = () => request.get({ url: '/cr/collect-task/options' })

// 元数据：实现类型 / 优先级选项 / 状态中文（页面不写第二套）
export const getCollectTaskMeta = () => request.get({ url: '/cr/collect-task/meta' })

// 配置前置任务（服务端会拦自我依赖与循环依赖）
export const updatePreTasks = (id: number, preTaskIds: number[]) =>
  request.put({ url: '/cr/collect-task/update-pre-tasks', data: { id, preTaskIds } })
