/**
 * Mock 种子数据 — 菜单
 *
 * 一份 spec 三处复用：
 * 1. `/system/menu/list`、`/system/menu/simple-list` → 菜单管理页面
 * 2. `/system/auth/get-permission-info` 的 `menus` → 动态路由 + 侧边栏
 * 3. `permissions` → `v-hasPermi` / `checkPermi` 按钮权限
 *
 * 菜单按附件文档章节组织；`stage` 用于分层交付（P0 → P1 → P2），
 * 未进入当前阶段的菜单不会下发给前端，避免出现点不进去的空菜单。
 */
import { ROLE_CODE } from './system'

export type Stage = 'P0' | 'P1' | 'P2'

/** 当前交付阶段：实现完某一层后把它往上调，菜单会自动"长"出来 */
export const CURRENT_STAGE: Stage = 'P2'

const STAGE_ORDER: Record<Stage, number> = { P0: 0, P1: 1, P2: 2 }

export const ALL_ROLES = [ROLE_CODE.ADMIN, ROLE_CODE.FILLER, ROLE_CODE.REVIEWER, ROLE_CODE.AUDITOR]

const ADMIN_ONLY = [ROLE_CODE.ADMIN]

export interface MenuSpec {
  name: string
  /** 顶级目录用绝对路径（/cr-task），子菜单用相对段（template） */
  path: string
  /** 相对 src/views 的组件路径，不含扩展名；不填则为目录 */
  component?: string
  componentName?: string
  icon?: string
  /** 1 目录 2 菜单 3 按钮（不填时按有无 component 推导） */
  type?: 1 | 2 | 3
  permission?: string
  visible?: boolean
  keepAlive?: boolean
  alwaysShow?: boolean
  stage?: Stage
  /** 允许访问的角色 code；不填 = 全部角色 */
  roles?: string[]
  /**
   * 页面是否已实现。为 false 时该菜单不会下发给前端，
   * 避免演示时点进未完成的页面。每完成一个页面就把它改成 true（或删掉该字段）。
   */
  implemented?: boolean
  children?: MenuSpec[]
}

/** 页面按钮权限：[名称, 权限标识, 允许的角色?] */
type ButtonSpec = [string, string, string[]?]

/** 按页面路径追加按钮权限 */
const BUTTONS: Record<string, ButtonSpec[]> = {
  // ===== 报表任务管理 =====
  'cr-task/template': [
    ['查询', 'cr:task-template:query'],
    ['新增', 'cr:task-template:create'],
    ['修改', 'cr:task-template:update'],
    ['删除', 'cr:task-template:delete'],
    ['添加报表', 'cr:task-template:add-report'],
    ['导出', 'cr:task-template:export']
  ],
  'cr-task/manage': [
    ['查询', 'cr:task:query'],
    ['任务下发', 'cr:task:dispatch'],
    ['批量下发', 'cr:task:dispatch-batch'],
    ['任务初始化', 'cr:task:init'],
    ['删除', 'cr:task:delete'],
    ['导出', 'cr:task:export']
  ],
  'cr-task/review': [
    ['查询', 'cr:task-review:query'],
    ['复核通过', 'cr:task-review:pass'],
    ['复核不通过', 'cr:task-review:reject'],
    ['批量复核', 'cr:task-review:batch']
  ],
  'cr-task/audit-local': [
    ['查询', 'cr:task-audit-local:query'],
    ['审核通过', 'cr:task-audit-local:pass'],
    ['审核不通过', 'cr:task-audit-local:reject']
  ],
  'cr-task/audit-upper': [
    ['查询', 'cr:task-audit-upper:query'],
    ['审核通过', 'cr:task-audit-upper:pass'],
    ['审核不通过', 'cr:task-audit-upper:reject']
  ],
  'cr-task/return': [
    ['查询', 'cr:task-return:query'],
    ['打回', 'cr:task-return:back']
  ],

  // ===== 报表数据处理 =====
  'cr-data/fill': [
    ['查询', 'cr:data-fill:query'],
    ['填报', 'cr:data-fill:edit'],
    ['保存', 'cr:data-fill:save'],
    ['批量操作', 'cr:data-fill:batch'],
    ['校验', 'cr:data-fill:check'],
    ['提交', 'cr:data-fill:submit'],
    ['导出', 'cr:data-fill:export']
  ],
  'cr-data/batch': [
    ['查询', 'cr:data-batch:query'],
    ['执行操作', 'cr:data-batch:execute']
  ],
  'cr-data/submit': [
    ['查询', 'cr:data-submit:query'],
    ['批量提交', 'cr:data-submit:batch']
  ],
  'cr-data/monitor': [['查询', 'cr:data-monitor:query']],
  'cr-data/message': [
    ['查询', 'cr:data-message:query'],
    ['生成报文', 'cr:data-message:generate'],
    ['下载', 'cr:data-message:download']
  ],

  // ===== 数据查询 =====
  'cr-query/status': [
    ['查询', 'cr:query-status:query'],
    ['导出', 'cr:query-status:export']
  ],
  'cr-query/my-task': [['查询', 'cr:query-my-task:query']],
  'cr-query/comprehensive': [
    ['查询', 'cr:query-comprehensive:query'],
    ['高级对比', 'cr:query-comprehensive:compare'],
    ['数据追溯', 'cr:query-comprehensive:trace'],
    ['导出', 'cr:query-comprehensive:export']
  ],

  // ===== 报送配置管理 =====
  'cr-meta/org': [
    ['查询', 'cr:meta-org:query'],
    ['新增', 'cr:meta-org:create'],
    ['修改', 'cr:meta-org:update'],
    ['删除', 'cr:meta-org:delete']
  ],
  'cr-meta/org-report': [
    ['查询', 'cr:meta-org-report:query'],
    ['新增', 'cr:meta-org-report:create'],
    ['修改', 'cr:meta-org-report:update'],
    ['删除', 'cr:meta-org-report:delete']
  ],
  'cr-meta/org-host': [
    ['查询', 'cr:meta-org-host:query'],
    ['新增', 'cr:meta-org-host:create'],
    ['修改', 'cr:meta-org-host:update'],
    ['删除', 'cr:meta-org-host:delete']
  ],
  'cr-meta/org-contact': [
    ['查询', 'cr:meta-org-contact:query'],
    ['新增', 'cr:meta-org-contact:create'],
    ['修改', 'cr:meta-org-contact:update'],
    ['删除', 'cr:meta-org-contact:delete']
  ],
  'cr-meta/subject': [
    ['查询', 'cr:meta-subject:query'],
    ['新增', 'cr:meta-subject:create'],
    ['修改', 'cr:meta-subject:update'],
    ['删除', 'cr:meta-subject:delete']
  ],
  'cr-meta/table': [
    ['查询', 'cr:meta-table:query'],
    ['新增', 'cr:meta-table:create'],
    ['修改', 'cr:meta-table:update'],
    ['删除', 'cr:meta-table:delete']
  ],
  'cr-meta/column': [
    ['查询', 'cr:meta-column:query'],
    ['新增', 'cr:meta-column:create'],
    ['修改', 'cr:meta-column:update'],
    ['删除', 'cr:meta-column:delete']
  ],

  // ===== 数据检核管理 =====
  'cr-check/rule': [
    ['查询', 'cr:check-rule:query'],
    ['新增', 'cr:check-rule:create'],
    ['修改', 'cr:check-rule:update'],
    ['删除', 'cr:check-rule:delete'],
    ['导出', 'cr:check-rule:export']
  ],
  'cr-check/execute': [
    ['查询', 'cr:check-execute:query'],
    ['执行校验', 'cr:check-execute:run']
  ],
  'cr-check/status': [
    ['查询', 'cr:check-status:query'],
    ['重新校验', 'cr:check-status:recheck'],
    ['重置数据', 'cr:check-status:reset'],
    ['导出', 'cr:check-status:export']
  ],
  'cr-check/result': [
    ['查询', 'cr:check-result:query'],
    ['查看详情', 'cr:check-result:detail'],
    ['导出', 'cr:check-result:export']
  ],

  // ===== 一键报送 =====
  'cr-submit/generate': [
    ['查询', 'cr:submit-generate:query'],
    ['开始生成', 'cr:submit-generate:run']
  ],
  'cr-submit/status': [['查询', 'cr:submit-status:query']],
  'cr-submit/file-config': [
    ['查询', 'cr:submit-file-config:query'],
    ['新增', 'cr:submit-file-config:create'],
    ['修改', 'cr:submit-file-config:update'],
    ['删除', 'cr:submit-file-config:delete']
  ],
  'cr-submit/list': [
    ['查询', 'cr:submit-list:query'],
    ['下载', 'cr:submit-list:download']
  ],
  'cr-submit/quality': [
    ['查询', 'cr:submit-quality:query'],
    ['下载', 'cr:submit-quality:download']
  ],

  // ===== 数据审核 =====
  'cr-audit/reason': [
    ['查询', 'cr:audit-reason:query'],
    ['填写错误原因', 'cr:audit-reason:create'],
    ['确认', 'cr:audit-reason:confirm']
  ],
  'cr-audit/approve': [
    ['查询', 'cr:audit-approve:query'],
    ['审核通过', 'cr:audit-approve:pass'],
    ['审核不通过', 'cr:audit-approve:reject'],
    ['导出', 'cr:audit-approve:export']
  ],
  'cr-audit/result': [
    ['查询', 'cr:audit-result:query'],
    ['导出', 'cr:audit-result:export']
  ],
  'cr-audit/desensitize-query': [
    ['查询', 'cr:audit-desensitize:query'],
    ['导出', 'cr:audit-desensitize:export']
  ],

  // ===== 报文配置 =====
  'cr-message/report-custom': [
    ['查询', 'cr:message-report-custom:query'],
    ['新增', 'cr:message-report-custom:create'],
    ['修改', 'cr:message-report-custom:update'],
    ['删除', 'cr:message-report-custom:delete'],
    ['配置字段', 'cr:message-report-custom:columns'],
    ['导出', 'cr:message-report-custom:export']
  ],
  'cr-message/message-info': [
    ['查询', 'cr:message-info:query'],
    ['新增', 'cr:message-info:create'],
    ['修改', 'cr:message-info:update'],
    ['删除', 'cr:message-info:delete'],
    ['报文结构', 'cr:message-info:structure'],
    ['报文样例', 'cr:message-info:sample'],
    ['导出', 'cr:message-info:export']
  ],
  'cr-message/caliber': [
    ['查询', 'cr:message-caliber:query'],
    ['新增', 'cr:message-caliber:create'],
    ['修改', 'cr:message-caliber:update'],
    ['删除', 'cr:message-caliber:delete'],
    ['导出', 'cr:message-caliber:export']
  ],
  'cr-message/report-set': [
    ['查询', 'cr:message-report-set:query'],
    ['新增', 'cr:message-report-set:create'],
    ['修改', 'cr:message-report-set:update'],
    ['删除', 'cr:message-report-set:delete'],
    ['生成报文', 'cr:message-report-set:generate'],
    ['导出', 'cr:message-report-set:export']
  ],
  'cr-message/filler': [
    ['查询', 'cr:message-filler:query'],
    ['新增', 'cr:message-filler:create'],
    ['修改', 'cr:message-filler:update'],
    ['删除', 'cr:message-filler:delete'],
    ['批量分配', 'cr:message-filler:batch'],
    ['导出', 'cr:message-filler:export']
  ],

  // ===== 数据脱敏 =====
  'cr-desensitize/rule': [
    ['查询', 'cr:desens-rule:query'],
    ['新增', 'cr:desens-rule:create'],
    ['修改', 'cr:desens-rule:update'],
    ['删除', 'cr:desens-rule:delete'],
    ['启用停用', 'cr:desens-rule:toggle'],
    ['导出', 'cr:desens-rule:export']
  ],
  'cr-desensitize/field': [
    ['查询', 'cr:desens-field:query'],
    ['新增', 'cr:desens-field:create'],
    ['修改', 'cr:desens-field:update'],
    ['删除', 'cr:desens-field:delete'],
    ['启用停用', 'cr:desens-field:toggle'],
    ['导出', 'cr:desens-field:export']
  ],
  'cr-desensitize/execute': [
    ['查询', 'cr:desens-execute:query'],
    ['预检', 'cr:desens-execute:precheck'],
    ['提交执行申请', 'cr:desens-execute:apply'],
    ['还原', 'cr:desens-execute:restore'],
    ['查看结果', 'cr:desens-execute:result']
  ],
  // 脱敏审批：管理员提交申请，审核岗（或管理员）在这里放行；放行那一刻才真正改写数据
  'cr-desensitize/approval': [
    ['查询', 'cr:desens-approval:query'],
    ['审核通过', 'cr:desens-approval:approve'],
    ['审核驳回', 'cr:desens-approval:reject'],
    ['撤回申请', 'cr:desens-approval:withdraw'],
    ['导出', 'cr:desens-approval:export']
  ],
  // 数据拆分：拆分规则 CRUD + 执行拆分 + 拆分记录（页面把三块放在一起）
  'cr-desensitize/split': [
    ['查询', 'cr:split-rule:query'],
    ['新增规则', 'cr:split-rule:create'],
    ['修改规则', 'cr:split-rule:update'],
    ['删除规则', 'cr:split-rule:delete'],
    ['规则启停', 'cr:split-rule:toggle'],
    ['导出规则', 'cr:split-rule:export'],
    ['预检', 'cr:split-execute:precheck'],
    ['执行拆分', 'cr:split-execute:run'],
    ['拆分详情', 'cr:split-task:detail'],
    ['导出', 'cr:split-task:export']
  ],
  'cr-desensitize/log': [
    ['查询', 'cr:desens-log:query'],
    ['批次详情', 'cr:desens-log:detail'],
    ['导出', 'cr:desens-log:export']
  ],

  // ===== 数据采集 =====
  'cr-collect/period': [
    ['查询', 'cr:collect-period:query'],
    ['新增', 'cr:collect-period:create'],
    ['修改', 'cr:collect-period:update'],
    ['删除', 'cr:collect-period:delete'],
    ['开启采集', 'cr:collect-period:open'],
    ['关闭期次', 'cr:collect-period:close'],
    ['导出', 'cr:collect-period:export']
  ],
  'cr-collect/channel': [
    ['查询', 'cr:collect-channel:query'],
    ['新增', 'cr:collect-channel:create'],
    ['修改', 'cr:collect-channel:update'],
    ['删除', 'cr:collect-channel:delete'],
    ['启用停用', 'cr:collect-channel:toggle'],
    ['连接测试', 'cr:collect-channel:test'],
    ['立即采集', 'cr:collect-channel:collect'],
    ['取数记录', 'cr:collect-channel:job'],
    ['导出', 'cr:collect-channel:export']
  ],
  'cr-collect/import': [
    ['查询', 'cr:collect-import:query'],
    ['数据导入', 'cr:collect-import:import'],
    ['批次详情', 'cr:collect-import:detail'],
    ['导出', 'cr:collect-import:export'],
    // 下面三个是审核动作：页面已对填报岗开放（填报岗才是真正传文件的人），
    // 但审核 / 回滚 / 删除必须收窄到管理员，否则填报岗能自己审自己导的批次
    ['审核', 'cr:collect-import:audit', ADMIN_ONLY],
    ['回滚', 'cr:collect-import:rollback', ADMIN_ONLY],
    ['删除', 'cr:collect-import:delete', ADMIN_ONLY]
  ],
  'cr-collect/import-config': [
    ['查询', 'cr:import-config:query'],
    ['新增', 'cr:import-config:create'],
    ['修改', 'cr:import-config:update'],
    ['删除', 'cr:import-config:delete'],
    ['导出', 'cr:import-config:export']
  ],
  'cr-collect/import-audit': [
    ['查询', 'cr:import-audit:query'],
    ['审核', 'cr:import-audit:audit'],
    ['批次详情', 'cr:import-audit:detail'],
    ['导出', 'cr:import-audit:export']
  ],
  'cr-collect/import-auth': [
    ['查询', 'cr:import-auth:query'],
    ['新增', 'cr:import-auth:create'],
    ['修改', 'cr:import-auth:update'],
    ['删除', 'cr:import-auth:delete'],
    ['导出', 'cr:import-auth:export']
  ],
  'cr-collect/import-log': [
    ['查询', 'cr:import-log:query'],
    ['详情', 'cr:import-log:detail'],
    ['导出', 'cr:import-log:export']
  ],
  'cr-collect/supplement': [
    ['查询', 'cr:collect-supplement:query'],
    ['新增', 'cr:collect-supplement:create'],
    ['修改', 'cr:collect-supplement:update'],
    ['删除', 'cr:collect-supplement:delete'],
    ['审核', 'cr:collect-supplement:audit'],
    ['执行补录', 'cr:collect-supplement:execute'],
    ['上传附件', 'cr:collect-supplement:upload-file'],
    ['下载附件', 'cr:collect-supplement:download-file'],
    ['删除附件', 'cr:collect-supplement:delete-file'],
    ['导出', 'cr:collect-supplement:export']
  ],

  // ===== 系统管理（脚手架原生权限标识） =====
  'system/user': [
    ['查询', 'system:user:query'],
    ['新增', 'system:user:create'],
    ['修改', 'system:user:update'],
    ['删除', 'system:user:delete'],
    ['导出', 'system:user:export'],
    ['导入', 'system:user:import'],
    ['重置密码', 'system:user:update-password'],
    ['分配角色', 'system:permission:assign-user-role']
  ],
  'system/role': [
    ['查询', 'system:role:query'],
    ['新增', 'system:role:create'],
    ['修改', 'system:role:update'],
    ['删除', 'system:role:delete'],
    ['导出', 'system:role:export'],
    ['分配权限', 'system:permission:assign-role-menu'],
    ['数据权限', 'system:permission:assign-role-data-scope']
  ],
  'system/menu': [
    ['查询', 'system:menu:query'],
    ['新增', 'system:menu:create'],
    ['修改', 'system:menu:update'],
    ['删除', 'system:menu:delete']
  ],
  'system/dept': [
    ['查询', 'system:dept:query'],
    ['新增', 'system:dept:create'],
    ['修改', 'system:dept:update'],
    ['删除', 'system:dept:delete']
  ],
  'system/post': [
    ['查询', 'system:post:query'],
    ['新增', 'system:post:create'],
    ['修改', 'system:post:update'],
    ['删除', 'system:post:delete'],
    ['导出', 'system:post:export']
  ],
  'system/dict': [
    ['查询', 'system:dict:query'],
    ['新增', 'system:dict:create'],
    ['修改', 'system:dict:update'],
    ['删除', 'system:dict:delete'],
    ['导出', 'system:dict:export']
  ],
  'system/notice': [
    ['查询', 'system:notice:query'],
    ['新增', 'system:notice:create'],
    ['修改', 'system:notice:update'],
    ['删除', 'system:notice:delete']
  ],
  'system/operate-log': [
    ['查询', 'system:operate-log:query'],
    ['导出', 'system:operate-log:export']
  ],
  'system/login-log': [
    ['查询', 'system:login-log:query'],
    ['导出', 'system:login-log:export']
  ],

  // ===== 基础设施（脚手架原生权限标识） =====
  'infra/job': [
    ['查询', 'infra:job:query'],
    ['新增', 'infra:job:create'],
    ['修改', 'infra:job:update'],
    ['删除', 'infra:job:delete'],
    ['导出', 'infra:job:export'],
    ['手动执行', 'infra:job:trigger']
  ],
  'infra/job-log': [['查询', 'infra:job-log:query']],
  'infra/config': [
    ['查询', 'infra:config:query'],
    ['新增', 'infra:config:create'],
    ['修改', 'infra:config:update'],
    ['删除', 'infra:config:delete'],
    ['导出', 'infra:config:export']
  ],
  'infra/file': [
    ['查询', 'infra:file:query'],
    ['删除', 'infra:file:delete']
  ],
  'infra/api-access-log': [
    ['查询', 'infra:api-access-log:query'],
    ['导出', 'infra:api-access-log:export']
  ],
  'infra/api-error-log': [
    ['查询', 'infra:api-error-log:query'],
    ['处理', 'infra:api-error-log:update-status'],
    ['导出', 'infra:api-error-log:export']
  ],

  // ===== 监管码值配置（文档「监管码值配置」章节：码值字典维护 / 码值管理 / 本地字典 / 本地枚举 / 本地标准映射） =====
  'cr-dict/reg-dict': [
    ['查询', 'cr:reg-dict:query'],
    ['新增', 'cr:reg-dict:create'],
    ['修改', 'cr:reg-dict:update'],
    ['删除', 'cr:reg-dict:delete'],
    ['导出', 'cr:reg-dict:export']
  ],
  'cr-dict/reg-code': [
    ['查询', 'cr:reg-code:query'],
    ['新增', 'cr:reg-code:create'],
    ['修改', 'cr:reg-code:update'],
    ['删除', 'cr:reg-code:delete'],
    ['导出', 'cr:reg-code:export']
  ],
  'cr-dict/local-dict': [
    ['查询', 'cr:local-dict:query'],
    ['新增', 'cr:local-dict:create'],
    ['修改', 'cr:local-dict:update'],
    ['删除', 'cr:local-dict:delete'],
    ['导出', 'cr:local-dict:export']
  ],
  'cr-dict/local-code': [
    ['查询', 'cr:local-code:query'],
    ['新增', 'cr:local-code:create'],
    ['修改', 'cr:local-code:update'],
    ['删除', 'cr:local-code:delete'],
    ['导出', 'cr:local-code:export']
  ],
  'cr-dict/local-map': [
    ['查询', 'cr:local-map:query'],
    ['新增', 'cr:local-map:create'],
    ['修改', 'cr:local-map:update'],
    ['删除', 'cr:local-map:delete'],
    ['导出', 'cr:local-map:export'],
    ['映射校验', 'cr:local-map:validate']
  ],

  // ===== 权限审批管理（数据权限 / 部门权限配置） =====
  'cr-system/data-scope': [
    ['查询', 'cr:data-scope:query'],
    ['新增', 'cr:data-scope:create'],
    ['修改', 'cr:data-scope:update'],
    ['删除', 'cr:data-scope:delete'],
    ['导出', 'cr:data-scope:export'],
    ['生效判断', 'cr:data-scope:decide']
  ],
  'cr-system/dept-scope': [
    ['查询', 'cr:dept-scope:query'],
    ['新增', 'cr:dept-scope:create'],
    ['修改', 'cr:dept-scope:update'],
    ['删除', 'cr:dept-scope:delete'],
    ['导出', 'cr:dept-scope:export'],
    ['生效判断', 'cr:dept-scope:decide']
  ],

  // ===== 报送数据统计（10 个系列查询，全部只读） =====
  'cr-stat/progress': [
    ['查询', 'cr:stat:progress:query'],
    ['导出', 'cr:stat:progress:export']
  ],
  'cr-stat/timely': [
    ['查询', 'cr:stat:timely:query'],
    ['导出', 'cr:stat:timely:export']
  ],
  'cr-stat/task': [
    ['查询', 'cr:stat:task:query'],
    ['导出', 'cr:stat:task:export']
  ],
  'cr-stat/volume': [
    ['查询', 'cr:stat:volume:query'],
    ['导出', 'cr:stat:volume:export']
  ],
  'cr-stat/check': [
    ['查询', 'cr:stat:check:query'],
    ['导出', 'cr:stat:check:export']
  ],
  'cr-stat/reject': [
    ['查询', 'cr:stat:reject:query'],
    ['导出', 'cr:stat:reject:export']
  ],
  'cr-stat/import': [
    ['查询', 'cr:stat:import:query'],
    ['导出', 'cr:stat:import:export']
  ],
  'cr-stat/desens': [
    ['查询', 'cr:stat:desens:query'],
    ['导出', 'cr:stat:desens:export']
  ],
  'cr-stat/submit': [
    ['查询', 'cr:stat:submit:query'],
    ['导出', 'cr:stat:submit:export']
  ],
  'cr-stat/summary': [
    ['查询', 'cr:stat:summary:query'],
    ['导出', 'cr:stat:summary:export']
  ],

  // ===== 报表功能（数据源 / 数据集 / 报表维护） =====
  'cr-report/datasource': [
    ['查询', 'cr:report-datasource:query'],
    ['新增', 'cr:report-datasource:create'],
    ['修改', 'cr:report-datasource:update'],
    ['删除', 'cr:report-datasource:delete'],
    ['导出', 'cr:report-datasource:export'],
    ['连接测试', 'cr:report-datasource:test']
  ],
  'cr-report/dataset': [
    ['查询', 'cr:report-dataset:query'],
    ['新增', 'cr:report-dataset:create'],
    ['修改', 'cr:report-dataset:update'],
    ['删除', 'cr:report-dataset:delete'],
    ['导出', 'cr:report-dataset:export'],
    ['数据预览', 'cr:report-dataset:preview']
  ],
  'cr-report/design': [
    ['查询', 'cr:report-design:query'],
    ['新增', 'cr:report-design:create'],
    ['修改', 'cr:report-design:update'],
    ['删除', 'cr:report-design:delete'],
    ['导出', 'cr:report-design:export'],
    ['报表预览', 'cr:report-design:preview']
  ],

  // ===== 系统集成（接入系统 / 接入权限 / 接入附件） =====
  'cr-integration/system': [
    ['查询', 'cr:integration-system:query'],
    ['新增', 'cr:integration-system:create'],
    ['修改', 'cr:integration-system:update'],
    ['删除', 'cr:integration-system:delete'],
    ['导出', 'cr:integration-system:export'],
    ['心跳检测', 'cr:integration-system:heartbeat']
  ],
  'cr-integration/auth': [
    ['查询', 'cr:integration-auth:query'],
    ['新增', 'cr:integration-auth:create'],
    ['修改', 'cr:integration-auth:update'],
    ['删除', 'cr:integration-auth:delete'],
    ['导出', 'cr:integration-auth:export'],
    ['生效判断', 'cr:integration-auth:decide']
  ],
  'cr-integration/attachment': [
    ['查询', 'cr:integration-attachment:query'],
    ['删除', 'cr:integration-attachment:delete'],
    ['导出', 'cr:integration-attachment:export'],
    ['接收附件', 'cr:integration-attachment:upload'],
    ['重新校验', 'cr:integration-attachment:recheck']
  ],

  // ===== 服务管理（主机 / 密钥） =====
  'cr-service/host': [
    ['查询', 'cr:service-host:query'],
    ['新增', 'cr:service-host:create'],
    ['修改', 'cr:service-host:update'],
    ['删除', 'cr:service-host:delete'],
    ['导出', 'cr:service-host:export'],
    ['连接测试', 'cr:service-host:test']
  ],
  'cr-service/secret': [
    ['查询', 'cr:service-secret:query'],
    ['新增', 'cr:service-secret:create'],
    ['修改', 'cr:service-secret:update'],
    ['删除', 'cr:service-secret:delete'],
    ['导出', 'cr:service-secret:export'],
    ['密钥轮换', 'cr:service-secret:rotate']
  ],

  // ===== 自动提醒（规则 / 记录） =====
  'cr-remind/rule': [
    ['查询', 'cr:remind-rule:query'],
    ['新增', 'cr:remind-rule:create'],
    ['修改', 'cr:remind-rule:update'],
    ['删除', 'cr:remind-rule:delete'],
    ['导出', 'cr:remind-rule:export'],
    ['立即执行', 'cr:remind-rule:run']
  ],
  'cr-remind/log': [
    ['查询', 'cr:remind-log:query'],
    ['删除', 'cr:remind-log:delete'],
    ['导出', 'cr:remind-log:export'],
    ['标记已读', 'cr:remind-log:read'],
    ['重发', 'cr:remind-log:resend']
  ],

  // ===== 自动采集（需求文档「任务调度功能」章的采集侧 5 页） =====
  'cr-schedule/task': [
    ['查询', 'cr:collect-task:query'],
    ['新增', 'cr:collect-task:create'],
    ['修改', 'cr:collect-task:update'],
    ['删除', 'cr:collect-task:delete'],
    ['导出', 'cr:collect-task:export'],
    ['前置任务', 'cr:collect-task:pre-task']
  ],
  'cr-schedule/monitor': [
    ['查询', 'cr:collect-task-log:query'],
    ['导出', 'cr:collect-task-log:export'],
    // 立即执行会真的写一条跑批记录，是写操作（接口层同样只放管理员）
    ['立即执行', 'cr:collect-task-log:run'],
    // 需求文档把「前置任务」放在任务监控页，批量监控合并了任务监控，所以这里也放一个入口
    ['前置任务', 'cr:collect-task:pre-task']
  ],
  'cr-schedule/config': [
    ['查询', 'cr:schedule:query'],
    ['新增', 'cr:schedule:create'],
    ['修改', 'cr:schedule:update'],
    ['删除', 'cr:schedule:delete'],
    ['导出', 'cr:schedule:export'],
    ['启停', 'cr:schedule:toggle']
  ],
  'cr-schedule/manual': [
    ['查询', 'cr:schedule-manual:query'],
    ['批量执行', 'cr:schedule-manual:run']
  ],
  'cr-schedule/cluster': [
    ['查询', 'cr:cluster:query'],
    ['新增', 'cr:cluster:create'],
    ['修改', 'cr:cluster:update'],
    ['删除', 'cr:cluster:delete'],
    ['导出', 'cr:cluster:export']
  ],

  // ===== 报文配置 · 公式SQL定制（需求文档「系统配置操作」章，口径按通行做法提案） =====
  'cr-message/sql-custom': [
    ['查询', 'cr:sql-formula:query'],
    ['新增', 'cr:sql-formula:create'],
    ['修改', 'cr:sql-formula:update'],
    ['删除', 'cr:sql-formula:delete'],
    ['导出', 'cr:sql-formula:export'],
    ['试运行', 'cr:sql-formula:try-run']
  ],

  // ===== 报送数据统计 · 三个补口径的查询（时点 / 历史 / 评价指标） =====
  'cr-stat/asof': [
    ['查询', 'cr:stat:asof:query'],
    ['导出', 'cr:stat:asof:export']
  ],
  'cr-stat/history': [
    ['查询', 'cr:stat:history:query'],
    ['导出', 'cr:stat:history:export']
  ],
  'cr-stat/metric': [
    ['查询', 'cr:stat:metric:query'],
    ['导出', 'cr:stat:metric:export']
  ]
}

const P0: Stage = 'P0'
const P1: Stage = 'P1'
const P2: Stage = 'P2'

/** ============ 菜单树 ============ */
const CURRENT_MENU_TREE: MenuSpec[] = [
  {
    name: '报表任务管理',
    path: '/cr-task',
    alwaysShow: true,
    icon: 'ep:tickets',
    stage: P0,
    children: [
      {
        name: '任务模板',
        path: 'template',
        component: 'cr/task/template/index',
        componentName: 'CrTaskTemplate',
        icon: 'ep:document-copy',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '任务管理',
        path: 'manage',
        component: 'cr/task/manage/index',
        componentName: 'CrTaskManage',
        icon: 'ep:promotion',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '复核操作',
        path: 'review',
        component: 'cr/task/review/index',
        componentName: 'CrTaskReview',
        icon: 'ep:view',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER]
      },
      {
        name: '本级审核',
        path: 'audit-local',
        component: 'cr/task/auditLocal/index',
        componentName: 'CrTaskAuditLocal',
        icon: 'ep:stamp',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER]
      },
      {
        name: '上级审核',
        path: 'audit-upper',
        component: 'cr/task/auditUpper/index',
        componentName: 'CrTaskAuditUpper',
        icon: 'ep:finished',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER]
      },
      {
        name: '打回操作',
        path: 'return',
        component: 'cr/task/returnBack/index',
        componentName: 'CrTaskReturnBack',
        icon: 'ep:refresh-left',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER]
      }
    ]
  },
  {
    name: '报表数据处理',
    path: '/cr-data',
    alwaysShow: true,
    icon: 'ep:data-line',
    stage: P0,
    children: [
      {
        name: '数据填报',
        path: 'fill',
        component: 'cr/data/fill/index',
        componentName: 'CrDataFill',
        icon: 'ep:edit-pen',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER]
      },
      {
        name: '手工批量操作',
        path: 'batch',
        component: 'cr/data/batch/index',
        componentName: 'CrDataBatch',
        icon: 'ep:operation',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER]
      },
      {
        name: '批量提交',
        path: 'submit',
        component: 'cr/data/submit/index',
        componentName: 'CrDataSubmit',
        icon: 'ep:upload',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER]
      },
      {
        name: '批处理监控',
        path: 'monitor',
        component: 'cr/data/monitor/index',
        componentName: 'CrDataMonitor',
        icon: 'ep:monitor',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER]
      },
      {
        name: '报文生成下载',
        path: 'message',
        component: 'cr/data/message/index',
        componentName: 'CrDataMessage',
        icon: 'ep:download',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER, ROLE_CODE.REVIEWER]
      }
    ]
  },
  {
    name: '数据查询',
    path: '/cr-query',
    alwaysShow: true,
    icon: 'ep:search',
    stage: P0,
    children: [
      {
        name: '报表状态查询',
        path: 'status',
        component: 'cr/query/status/index',
        componentName: 'CrQueryStatus',
        icon: 'ep:list',
        stage: P0
      },
      {
        name: '我的任务',
        path: 'my-task',
        component: 'cr/query/myTask/index',
        componentName: 'CrQueryMyTask',
        icon: 'ep:user',
        stage: P0
      },
      {
        name: '综合查询',
        path: 'comprehensive',
        component: 'cr/query/comprehensive/index',
        componentName: 'CrQueryComprehensive',
        icon: 'ep:data-analysis',
        stage: P0
      }
    ]
  },
  {
    name: '数据检核管理',
    path: '/cr-check',
    alwaysShow: true,
    icon: 'ep:finished',
    stage: P0,
    children: [
      {
        name: '校验规则维护',
        path: 'rule',
        component: 'cr/check/rule/index',
        componentName: 'CrCheckRule',
        icon: 'ep:set-up',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER]
      },
      {
        name: '数据校验',
        path: 'execute',
        component: 'cr/check/execute/index',
        componentName: 'CrCheckExecute',
        icon: 'ep:circle-check',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER, ROLE_CODE.FILLER]
      },
      {
        name: '数据校验状态',
        path: 'status',
        component: 'cr/check/status/index',
        componentName: 'CrCheckStatus',
        icon: 'ep:loading',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER]
      },
      {
        name: '校验结果查询',
        path: 'result',
        component: 'cr/check/result/index',
        componentName: 'CrCheckResult',
        icon: 'ep:warning',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.REVIEWER, ROLE_CODE.AUDITOR]
      }
    ]
  },
  {
    name: '一键报送',
    path: '/cr-submit',
    alwaysShow: true,
    icon: 'ep:upload-filled',
    stage: P0,
    children: [
      {
        name: '报文生成',
        path: 'generate',
        component: 'cr/submit/generate/index',
        componentName: 'CrSubmitGenerate',
        icon: 'ep:document-add',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      },
      {
        name: '报文状态查询',
        path: 'status',
        component: 'cr/submit/status/index',
        componentName: 'CrSubmitStatus',
        icon: 'ep:search',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      },
      {
        name: '报送文件配置',
        path: 'file-config',
        component: 'cr/submit/fileConfig/index',
        componentName: 'CrSubmitFileConfig',
        icon: 'ep:setting',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '数据报送清单',
        path: 'list',
        component: 'cr/submit/list/index',
        componentName: 'CrSubmitList',
        icon: 'ep:notebook',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      },
      {
        name: '质量检核结果',
        path: 'quality',
        component: 'cr/submit/quality/index',
        componentName: 'CrSubmitQuality',
        icon: 'ep:medal',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      }
    ]
  },
  {
    name: '数据审核',
    path: '/cr-audit',
    alwaysShow: true,
    icon: 'ep:checked',
    stage: P0,
    children: [
      {
        name: '错误原因填报',
        path: 'reason',
        component: 'cr/audit/reason/index',
        componentName: 'CrAuditReason',
        icon: 'ep:edit',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER]
      },
      {
        name: '数据审核',
        path: 'approve',
        component: 'cr/audit/approve/index',
        componentName: 'CrAuditApprove',
        icon: 'ep:stamp',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      },
      {
        name: '审核结果',
        path: 'result',
        component: 'cr/audit/result/index',
        componentName: 'CrAuditResult',
        icon: 'ep:document-checked',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR, ROLE_CODE.REVIEWER]
      },
      {
        name: '脱敏结果查询',
        path: 'desensitize-query',
        component: 'cr/audit/desensitizeQuery/index',
        componentName: 'CrAuditDesensitizeQuery',
        icon: 'ep:hide',
        stage: P0,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      }
    ]
  },
  {
    name: '报送配置管理',
    path: '/cr-meta',
    alwaysShow: true,
    icon: 'ep:coin',
    stage: P0,
    children: [
      {
        name: '机构维护',
        path: 'org',
        implemented: true,
        component: 'cr/meta/org/index',
        componentName: 'CrMetaOrg',
        icon: 'ep:office-building',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '机构上报配置',
        path: 'org-report',
        implemented: true,
        component: 'cr/meta/orgReport/index',
        componentName: 'CrMetaOrgReport',
        icon: 'ep:position',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '机构主机配置',
        path: 'org-host',
        implemented: true,
        component: 'cr/meta/orgHost/index',
        componentName: 'CrMetaOrgHost',
        icon: 'ep:connection',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '机构联系人配置',
        path: 'org-contact',
        implemented: true,
        component: 'cr/meta/orgContact/index',
        componentName: 'CrMetaOrgContact',
        icon: 'ep:phone',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '主题域管理',
        path: 'subject',
        implemented: true,
        component: 'cr/meta/subject/index',
        componentName: 'CrMetaSubject',
        icon: 'ep:collection',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '表管理',
        path: 'table',
        implemented: true,
        component: 'cr/meta/table/index',
        componentName: 'CrMetaTable',
        icon: 'ep:grid',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '列管理',
        path: 'column',
        implemented: true,
        component: 'cr/meta/column/index',
        componentName: 'CrMetaColumn',
        icon: 'ep:menu',
        stage: P0,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '报文配置',
    path: '/cr-message',
    alwaysShow: true,
    icon: 'ep:document',
    stage: P1,
    children: [
      {
        name: '报表定制',
        path: 'report-custom',
        component: 'cr/message/reportCustom/index',
        componentName: 'CrMessageReportCustom',
        icon: 'ep:document-copy',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '报文信息管理',
        path: 'message-info',
        component: 'cr/message/messageInfo/index',
        componentName: 'CrMessageInfo',
        icon: 'ep:tickets',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '口径信息配置',
        path: 'caliber',
        component: 'cr/message/caliber/index',
        componentName: 'CrMessageCaliber',
        icon: 'ep:compass',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '报文集配置',
        path: 'report-set',
        component: 'cr/message/reportSet/index',
        componentName: 'CrMessageReportSet',
        icon: 'ep:files',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '填报人管理',
        path: 'filler',
        component: 'cr/message/filler/index',
        componentName: 'CrMessageFiller',
        icon: 'ep:user-filled',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        // 需求文档「系统配置操作」章只有一句「用于定义 SQL」，字段与校验规则按通行做法提案
        name: '公式SQL定制',
        path: 'sql-custom',
        component: 'cr/message/sqlCustom/index',
        componentName: 'CrMessageSqlCustom',
        icon: 'ep:set-up',
        stage: P1,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '数据采集',
    path: '/cr-collect',
    alwaysShow: true,
    icon: 'ep:download',
    stage: P1,
    children: [
      {
        name: '报送期次设置',
        path: 'period',
        component: 'cr/collect/period/index',
        componentName: 'CrCollectPeriod',
        icon: 'ep:calendar',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '采集方式配置',
        path: 'channel',
        component: 'cr/collect/channel/index',
        componentName: 'CrCollectChannel',
        icon: 'ep:connection',
        stage: P1,
        roles: ADMIN_ONLY
      },
      // 数据导入对填报岗开放：填报岗才是真正上传文件的人，导入权限（cr.importAuth）
      // 也才有落点 —— 否则导入权限永远只对超管生效，等于没做。审核/回滚/删除仍限管理员。
      {
        name: '数据导入',
        path: 'import',
        component: 'cr/collect/import/index',
        componentName: 'CrCollectImport',
        icon: 'ep:upload',
        stage: P1,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.FILLER]
      },
      {
        name: '导入设置',
        path: 'import-config',
        component: 'cr/collect/importConfig/index',
        componentName: 'CrCollectImportConfig',
        icon: 'ep:setting',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '导入审核',
        path: 'import-audit',
        component: 'cr/collect/importAudit/index',
        componentName: 'CrCollectImportAudit',
        icon: 'ep:finished',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '导入权限',
        path: 'import-auth',
        component: 'cr/collect/importAuth/index',
        componentName: 'CrCollectImportAuth',
        icon: 'ep:lock',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '导入日志',
        path: 'import-log',
        component: 'cr/collect/importLog/index',
        componentName: 'CrCollectImportLog',
        icon: 'ep:document',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '数据补录',
        path: 'supplement',
        component: 'cr/collect/supplement/index',
        componentName: 'CrCollectSupplement',
        icon: 'ep:edit-pen',
        stage: P1,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    // 需求文档「任务调度功能」章的采集侧 5 页：任务维护 / 批量监控 / 调度配置 / 手工调度 / 集群配置。
    // 文档里「任务监控」与「批量监控」字段几乎相同，按文档建议只做一页（立即执行 / 前置任务两个操作都放在上面）。
    name: '自动采集',
    path: '/cr-schedule',
    alwaysShow: true,
    icon: 'ep:alarm-clock',
    stage: P1,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '任务维护',
        path: 'task',
        component: 'cr/schedule/task/index',
        componentName: 'CrScheduleTask',
        icon: 'ep:list',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '批量监控',
        path: 'monitor',
        component: 'cr/schedule/monitor/index',
        componentName: 'CrScheduleMonitor',
        icon: 'ep:monitor',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '调度配置',
        path: 'config',
        component: 'cr/schedule/config/index',
        componentName: 'CrScheduleConfig',
        icon: 'ep:timer',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '手工调度',
        path: 'manual',
        component: 'cr/schedule/manual/index',
        componentName: 'CrScheduleManual',
        icon: 'ep:video-play',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '集群配置',
        path: 'cluster',
        component: 'cr/schedule/cluster/index',
        componentName: 'CrScheduleCluster',
        icon: 'ep:connection',
        stage: P1,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '数据脱敏',
    path: '/cr-desensitize',
    alwaysShow: true,
    icon: 'ep:view',
    stage: P1,
    children: [
      {
        name: '脱敏规则配置',
        path: 'rule',
        component: 'cr/desensitize/rule/index',
        componentName: 'CrDesensitizeRule',
        icon: 'ep:magic-stick',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '脱敏字段配置',
        path: 'field',
        component: 'cr/desensitize/field/index',
        componentName: 'CrDesensitizeField',
        icon: 'ep:grid',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '脱敏执行',
        path: 'execute',
        component: 'cr/desensitize/execute/index',
        componentName: 'CrDesensitizeExecute',
        icon: 'ep:video-play',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '脱敏审批',
        path: 'approval',
        component: 'cr/desensitize/approval/index',
        componentName: 'CrDesensitizeApproval',
        icon: 'ep:stamp',
        stage: P1,
        roles: [ROLE_CODE.ADMIN, ROLE_CODE.AUDITOR]
      },
      {
        name: '数据拆分',
        path: 'split',
        component: 'cr/split/index',
        componentName: 'CrSplit',
        icon: 'ep:scissor',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '脱敏日志',
        path: 'log',
        component: 'cr/desensitize/log/index',
        componentName: 'CrDesensitizeLog',
        icon: 'ep:document',
        stage: P1,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '监管码值配置',
    path: '/cr-dict',
    alwaysShow: true,
    icon: 'ep:collection-tag',
    stage: P1,
    roles: ADMIN_ONLY,
    children: [
      // 文档「监管码值配置」章节的五页：码值字典维护 / 码值管理（监管侧 regDict、regCode 表）、
      // 本地字典管理 / 本地枚举管理（本地库 localDict、localCode 表）、本地标准映射。
      // 五页各自维护一张表：映射页的两个下拉直接读这四张表，所以监管侧也不能复用系统管理的字典管理页
      // （系统字典是脚手架自己的 system_dict_* 表，改它映射页看不到）。
      {
        name: '码值字典维护',
        path: 'reg-dict',
        component: 'cr/dict/regDict/index',
        componentName: 'CrDictRegDict',
        icon: 'ep:collection',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '码值管理',
        path: 'reg-code',
        component: 'cr/dict/regCode/index',
        componentName: 'CrDictRegCode',
        icon: 'ep:postcard',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '本地字典管理',
        path: 'local-dict',
        component: 'cr/dict/localDict/index',
        componentName: 'CrDictLocalDict',
        icon: 'ep:notebook',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '本地枚举管理',
        path: 'local-code',
        component: 'cr/dict/localCode/index',
        componentName: 'CrDictLocalCode',
        icon: 'ep:list',
        stage: P1,
        roles: ADMIN_ONLY
      },
      {
        name: '本地标准映射',
        path: 'local-map',
        component: 'cr/dict/localMap/index',
        componentName: 'CrDictLocalMap',
        icon: 'ep:switch',
        stage: P1,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '权限审批管理',
    path: '/cr-system',
    alwaysShow: true,
    icon: 'ep:lock',
    stage: P0,
    roles: ADMIN_ONLY,
    children: [
      // 脚手架「角色管理 → 分配权限 / 数据权限」维护角色默认范围，这两页做业务侧细化并真正落到接口
      {
        name: '数据权限配置',
        path: 'data-scope',
        component: 'cr/system/dataScope/index',
        componentName: 'CrSystemDataScope',
        icon: 'ep:data-line',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '部门权限配置',
        path: 'dept-scope',
        component: 'cr/system/deptScope/index',
        componentName: 'CrSystemDeptScope',
        icon: 'ep:office-building',
        stage: P0,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '报送数据统计',
    path: '/cr-stat',
    alwaysShow: true,
    icon: 'ep:data-analysis',
    stage: P2,
    roles: ADMIN_ONLY,
    children: [
      // 附件文档第 16 章的"报送数据统计系列查询"；数据全部按口径从业务表现算，不另建统计表
      {
        name: '报送进度统计',
        path: 'progress',
        component: 'cr/stat/progress/index',
        componentName: 'CrStatProgress',
        icon: 'ep:trend-charts',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '报送及时率统计',
        path: 'timely',
        component: 'cr/stat/timely/index',
        componentName: 'CrStatTimely',
        icon: 'ep:timer',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '任务完成情况统计',
        path: 'task',
        component: 'cr/stat/task/index',
        componentName: 'CrStatTask',
        icon: 'ep:finished',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '报送数据量统计',
        path: 'volume',
        component: 'cr/stat/volume/index',
        componentName: 'CrStatVolume',
        icon: 'ep:histogram',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '数据检核问题统计',
        path: 'check',
        component: 'cr/stat/check/index',
        componentName: 'CrStatCheck',
        icon: 'ep:warning',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '审核打回统计',
        path: 'reject',
        component: 'cr/stat/reject/index',
        componentName: 'CrStatReject',
        icon: 'ep:refresh-left',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '数据采集批次统计',
        path: 'import',
        component: 'cr/stat/import/index',
        componentName: 'CrStatImport',
        icon: 'ep:upload',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '脱敏执行统计',
        path: 'desens',
        component: 'cr/stat/desens/index',
        componentName: 'CrStatDesens',
        icon: 'ep:magic-stick',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '报文报送统计',
        path: 'submit',
        component: 'cr/stat/submit/index',
        componentName: 'CrStatSubmit',
        icon: 'ep:document-checked',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '期次报送汇总',
        path: 'summary',
        component: 'cr/stat/summary/index',
        componentName: 'CrStatSummary',
        icon: 'ep:notebook',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        // 需求文档「报送数据统计功能」章里口径偏薄的三个子项，2026-09-13 补页
        name: '时点数据查询',
        path: 'asof',
        component: 'cr/stat/asof/index',
        componentName: 'CrStatAsof',
        icon: 'ep:clock',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '历史数据查询',
        path: 'history',
        component: 'cr/stat/history/index',
        componentName: 'CrStatHistory',
        icon: 'ep:folder-opened',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '评价指标查询',
        path: 'metric',
        component: 'cr/stat/metric/index',
        componentName: 'CrStatMetric',
        icon: 'ep:medal',
        stage: P2,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '报表功能',
    path: '/cr-report',
    alwaysShow: true,
    icon: 'ep:data-board',
    stage: P2,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '数据源管理',
        path: 'datasource',
        component: 'cr/report/datasource/index',
        componentName: 'CrReportDatasource',
        icon: 'ep:coin',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '数据集管理',
        path: 'dataset',
        component: 'cr/report/dataset/index',
        componentName: 'CrReportDataset',
        icon: 'ep:files',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '报表维护',
        path: 'design',
        component: 'cr/report/design/index',
        componentName: 'CrReportDesign',
        icon: 'ep:pie-chart',
        stage: P2,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '系统集成',
    path: '/cr-integration',
    alwaysShow: true,
    icon: 'ep:connection',
    stage: P2,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '接入系统管理',
        path: 'system',
        component: 'cr/integration/system/index',
        componentName: 'CrIntegrationSystem',
        icon: 'ep:link',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '接入权限',
        path: 'auth',
        component: 'cr/integration/auth/index',
        componentName: 'CrIntegrationAuth',
        icon: 'ep:key',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '接入附件',
        path: 'attachment',
        component: 'cr/integration/attachment/index',
        componentName: 'CrIntegrationAttachment',
        icon: 'ep:paperclip',
        stage: P2,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '服务管理',
    path: '/cr-service',
    alwaysShow: true,
    icon: 'ep:monitor',
    stage: P2,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '服务主机管理',
        path: 'host',
        component: 'cr/service/host/index',
        componentName: 'CrServiceHost',
        icon: 'ep:platform',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '密钥管理',
        path: 'secret',
        component: 'cr/service/secret/index',
        componentName: 'CrServiceSecret',
        icon: 'ep:lock',
        stage: P2,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '自动提醒',
    path: '/cr-remind',
    alwaysShow: true,
    icon: 'ep:alarm-clock',
    stage: P2,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '提醒规则配置',
        path: 'rule',
        component: 'cr/remind/rule/index',
        componentName: 'CrRemindRule',
        icon: 'ep:setting',
        stage: P2,
        roles: ADMIN_ONLY
      },
      {
        name: '提醒记录',
        path: 'log',
        component: 'cr/remind/log/index',
        componentName: 'CrRemindLog',
        icon: 'ep:bell',
        stage: P2,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '系统管理',
    path: '/system',
    alwaysShow: true,
    icon: 'ep:setting',
    stage: P0,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '用户管理',
        path: 'user',
        component: 'system/user/index',
        componentName: 'SystemUser',
        icon: 'ep:user',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '角色管理',
        path: 'role',
        component: 'system/role/index',
        componentName: 'SystemRole',
        icon: 'ep:user-filled',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '菜单管理',
        path: 'menu',
        component: 'system/menu/index',
        componentName: 'SystemMenu',
        icon: 'ep:menu',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '部门管理',
        path: 'dept',
        component: 'system/dept/index',
        componentName: 'SystemDept',
        icon: 'ep:office-building',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '岗位管理',
        path: 'post',
        component: 'system/post/index',
        componentName: 'SystemPost',
        icon: 'ep:postcard',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '字典管理',
        path: 'dict',
        component: 'system/dict/index',
        componentName: 'SystemDictType',
        icon: 'ep:collection',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '通知公告',
        path: 'notice',
        component: 'system/notice/index',
        componentName: 'SystemNotice',
        icon: 'ep:bell',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '操作日志',
        path: 'operate-log',
        component: 'system/operatelog/index',
        componentName: 'SystemOperateLog',
        icon: 'ep:document',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '登录日志',
        path: 'login-log',
        component: 'system/loginlog/index',
        componentName: 'SystemLoginLog',
        icon: 'ep:key',
        stage: P0,
        roles: ADMIN_ONLY
      }
    ]
  },
  {
    name: '系统调度',
    path: '/infra',
    alwaysShow: true,
    icon: 'ep:monitor',
    stage: P0,
    roles: ADMIN_ONLY,
    children: [
      {
        name: '定时任务',
        path: 'job',
        component: 'infra/job/index',
        componentName: 'InfraJob',
        icon: 'ep:timer',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '调度日志',
        path: 'job-log',
        component: 'infra/job/logger/index',
        componentName: 'InfraJobLog',
        icon: 'ep:document',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '参数配置',
        path: 'config',
        component: 'infra/config/index',
        componentName: 'InfraConfig',
        icon: 'ep:tools',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: '文件管理',
        path: 'file',
        component: 'infra/file/index',
        componentName: 'InfraFile',
        icon: 'ep:folder',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: 'API 访问日志',
        path: 'api-access-log',
        component: 'infra/apiAccessLog/index',
        componentName: 'InfraApiAccessLog',
        icon: 'ep:link',
        stage: P0,
        roles: ADMIN_ONLY
      },
      {
        name: 'API 错误日志',
        path: 'api-error-log',
        component: 'infra/apiErrorLog/index',
        componentName: 'InfraApiErrorLog',
        icon: 'ep:warning',
        stage: P0,
        roles: ADMIN_ONLY
      }
    ]
  }
]

/**
 * 监管报送业务统一挂在「新统信报送」入口下；EAST 与保单登记暂只在门户展示占位卡片。
 * 报送目录改为相对路径后，页面真实地址会带上 `/new-unified` 前缀，避免用户在门户前
 * 就直接看到当前业务菜单。
 */
const REPORTING_MENU_PREFIX = '/cr-'
const toUnifiedRelativePath = (spec: MenuSpec): MenuSpec => ({
  ...spec,
  path: spec.path.replace(/^\//, '')
})

const unifiedReportingMenu: MenuSpec = {
  name: '新统信报送',
  path: '/new-unified',
  alwaysShow: true,
  icon: 'ep:platform',
  stage: P0,
  children: [
    {
      name: '首页',
      path: 'home',
      component: 'Home/Index',
      componentName: 'CrNewTrustHome',
      icon: 'ep:home-filled',
      stage: P0
    },
    ...CURRENT_MENU_TREE.filter((spec) => spec.path.startsWith(REPORTING_MENU_PREFIX)).map(
      toUnifiedRelativePath
    )
  ]
}

export const MENU_TREE: MenuSpec[] = [
  unifiedReportingMenu,
  ...CURRENT_MENU_TREE.filter((spec) => !spec.path.startsWith(REPORTING_MENU_PREFIX))
]

/** ============ 扁平化 ============ */

/** 菜单管理页面用的扁平结构（MenuVO） */
export interface MenuRow {
  id: number
  name: string
  permission: string
  type: number
  sort: number
  parentId: number
  path: string
  icon: string
  component: string
  componentName: string
  status: number
  visible: boolean
  keepAlive: boolean
  alwaysShow: boolean
  createTime: string
  /** 仅建树时使用，不对外返回 */
  stage: Stage
  roles: string[]
  implemented: boolean
}

const flattenMenus = (): MenuRow[] => {
  const rows: MenuRow[] = []
  let id = 1000

  const walk = (
    spec: MenuSpec,
    parentId: number,
    sort: number,
    parentStage: Stage,
    parentKey: string
  ) => {
    const stage = spec.stage || parentStage
    const implemented = spec.implemented !== false
    const isDir = spec.type ? spec.type === 1 : !spec.component
    const currentId = ++id
    // 按钮权限的 key 约定：<父级路由 key>/<本段 path>，
    // 顶级目录为去掉前导斜杠的 path（如 /cr-task → cr-task）。
    const routeKey = parentKey ? `${parentKey}/${spec.path}` : spec.path.replace(/^\//, '')
    rows.push({
      id: currentId,
      name: spec.name,
      permission: spec.permission || '',
      type: spec.type ?? (isDir ? 1 : 2),
      sort,
      parentId,
      path: spec.path,
      icon: spec.icon || '',
      component: spec.component || '',
      componentName: spec.componentName || '',
      status: 0,
      visible: spec.visible !== false,
      keepAlive: spec.keepAlive !== false,
      alwaysShow: spec.alwaysShow ?? false,
      createTime: '2024-01-01 09:00:00',
      stage,
      roles: spec.roles || ALL_ROLES,
      implemented
    })
    spec.children?.forEach((child, index) => walk(child, currentId, index + 1, stage, routeKey))
    // 追加该页面的按钮权限
    const legacyRouteKey = routeKey.replace(/^new-unified\//, '')
    const buttons = spec.component
      ? BUTTONS[routeKey] || BUTTONS[legacyRouteKey] || BUTTONS[spec.component]
      : undefined
    if (buttons) {
      buttons.forEach(([name, permission, buttonRoles], index) => {
        rows.push({
          id: ++id,
          name,
          permission,
          type: 3,
          sort: index + 1,
          parentId: currentId,
          path: '',
          icon: '',
          component: '',
          componentName: '',
          status: 0,
          visible: true,
          keepAlive: true,
          alwaysShow: false,
          createTime: '2024-01-01 09:00:00',
          stage,
          // 按钮角色默认跟随页面；显式写了第三个元素就按按钮自己的角色收窄
          roles: buttonRoles || spec.roles || ALL_ROLES,
          implemented
        })
      })
    }
  }

  MENU_TREE.forEach((spec, index) => walk(spec, 0, index + 1, P0, ''))
  return rows
}

export const menuTable = {
  all: (): MenuRow[] => flattenMenus()
}

/**
 * 当前阶段可见 + 已实现的扁平菜单。
 *
 * 只有"非目录节点"（页面 / 按钮）才作为存活锚点；目录本身必须靠已实现的子节点
 * 往回挂载。这样当某个目录下所有页面都还没实现时，该目录不会以空目录的形式
 * 出现在侧边栏里。
 */
export const visibleMenuRows = (): MenuRow[] => {
  const inStage = flattenMenus().filter(
    (row) => STAGE_ORDER[row.stage] <= STAGE_ORDER[CURRENT_STAGE]
  )
  const aliveIds = new Set<number>()
  inStage
    .filter((row) => row.implemented && row.type !== 1)
    .forEach((row) => {
      aliveIds.add(row.id)
      // 向上保留父目录
      let parentId = row.parentId
      while (parentId) {
        const parent = inStage.find((item) => item.id === parentId)
        if (!parent) break
        aliveIds.add(parent.id)
        parentId = parent.parentId
      }
    })
  return inStage.filter((row) => aliveIds.has(row.id))
}

/** 某组角色可见的扁平菜单（用于菜单管理页面按角色过滤） */
export const menuRowsForRoles = (roleCodes: string[]): MenuRow[] =>
  visibleMenuRows().filter((row) => row.roles.some((role) => roleCodes.includes(role)))

/** 角色可见的权限标识集合 */
export const permissionsForRoles = (roleCodes: string[]): string[] =>
  menuRowsForRoles(roleCodes)
    .filter((row) => row.permission)
    .map((row) => row.permission)

/** 构造 get-permission-info 需要的路由树 */
export interface MenuRouteNode {
  id: number
  parentId: number
  name: string
  path: string
  component: string
  componentName: string
  icon: string
  visible: boolean
  keepAlive: boolean
  alwaysShow: boolean
  redirect?: string
  children?: MenuRouteNode[]
}

export const routeTreeForRoles = (roleCodes: string[]): MenuRouteNode[] => {
  const rows = menuRowsForRoles(roleCodes).filter((row) => row.type !== 3)
  const allowed = new Set(rows.map((row) => row.id))

  const nodes = new Map<number, MenuRouteNode>()
  rows.forEach((row) => {
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      path: row.path,
      component: row.component,
      componentName: row.componentName,
      icon: row.icon,
      visible: row.visible,
      keepAlive: row.keepAlive,
      alwaysShow: row.alwaysShow
    })
  })

  const roots: MenuRouteNode[] = []
  nodes.forEach((node) => {
    if (node.parentId && allowed.has(node.parentId) && nodes.has(node.parentId)) {
      const parent = nodes.get(node.parentId)!
      parent.children = parent.children || []
      parent.children.push(node)
    } else if (!node.parentId) {
      roots.push(node)
    }
  })
  // 兜底：递归丢掉既没有子节点、自身又没有页面组件的空目录
  // （防止前端渲染成点不动的空菜单）
  const prune = (node: MenuRouteNode): boolean => {
    if (node.children?.length) {
      node.children = node.children.filter(prune)
      if (node.children.length) return true
    }
    return !!node.component
  }
  const prunedRoots = roots.filter(prune)
  return prunedRoots
}
