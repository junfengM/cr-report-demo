/**
 * Mock 种子数据 — 字典（监管码值配置）
 *
 * 分两部分：
 * 1. 脚手架原生需要的系统字典（user_type、common_status、infra_job_status 等），
 *    缺少这些会导致 system / infra 页面下拉框为空。
 * 2. 监管报送业务字典（cr_* 前缀），对齐附件文档「监管码值配置」章节。
 */
import { defineTable } from '../store'

export interface DictTypeRow {
  id: number
  name: string
  type: string
  status: number
  remark: string
  createTime: string
}

export interface DictDataRow {
  id: number
  sort: number
  label: string
  value: string
  dictType: string
  status: number
  colorType: string
  cssClass: string
  remark: string
  createTime: string
}

interface DictSpec {
  name: string
  type: string
  remark?: string
  values: Array<[string, string, string?]>
}

const specs: DictSpec[] = [
  // ========== 脚手架通用 ==========
  {
    name: '用户类型',
    type: 'user_type',
    remark: '用户类型',
    values: [
      ['1', '会员'],
      ['2', '管理员']
    ]
  },
  {
    name: '通用状态',
    type: 'common_status',
    remark: '通用状态',
    values: [
      ['0', '开启', 'success'],
      ['1', '关闭', 'danger']
    ]
  },
  {
    name: '用户性别',
    type: 'system_user_sex',
    values: [
      ['1', '男', 'primary'],
      ['2', '女', 'danger']
    ]
  },
  {
    name: '菜单类型',
    type: 'system_menu_type',
    values: [
      ['1', '目录'],
      ['2', '菜单'],
      ['3', '按钮']
    ]
  },
  {
    name: '角色类型',
    type: 'system_role_type',
    values: [
      ['1', '内置角色'],
      ['2', '自定义角色']
    ]
  },
  {
    name: '数据范围',
    type: 'system_data_scope',
    values: [
      ['1', '全部数据权限'],
      ['2', '指定部门数据权限'],
      ['3', '本部门数据权限'],
      ['4', '本部门及以下数据权限'],
      ['5', '仅本人数据权限']
    ]
  },
  {
    name: '通知类型',
    type: 'system_notice_type',
    values: [
      ['1', '通知'],
      ['2', '公告']
    ]
  },
  {
    name: '登录类型',
    type: 'system_login_type',
    values: [
      ['1', '账号密码登录'],
      ['2', '手机验证码登录'],
      ['3', '微信小程序登录'],
      ['4', '微信公众号登录'],
      ['5', '企业微信登录'],
      ['6', '钉钉登录'],
      ['7', '支付宝小程序登录']
    ]
  },
  {
    name: '登录结果',
    type: 'system_login_result',
    values: [
      ['0', '成功', 'success'],
      ['10', '账号或密码不正确', 'danger'],
      ['20', '账号被禁用', 'danger'],
      ['30', '账号已经注销', 'danger']
    ]
  },
  {
    name: '短信渠道编码',
    type: 'system_sms_channel_code',
    values: [
      ['1', '阿里云', 'primary'],
      ['2', '腾讯云', 'success'],
      ['3', '七牛云', 'warning'],
      ['4', '华为云', 'info']
    ]
  },
  {
    name: '短信模板类型',
    type: 'system_sms_template_type',
    values: [
      ['1', '验证码'],
      ['2', '通知'],
      ['3', '营销']
    ]
  },
  {
    name: '短信发送状态',
    type: 'system_sms_send_status',
    values: [
      ['0', '未发送'],
      ['10', '发送成功', 'success'],
      ['20', '发送失败', 'danger']
    ]
  },
  {
    name: '短信接收状态',
    type: 'system_sms_receive_status',
    values: [
      ['0', '未接收'],
      ['10', '接收成功', 'success'],
      ['20', '接收失败', 'danger']
    ]
  },
  {
    name: '邮件发送状态',
    type: 'system_mail_send_status',
    values: [
      ['0', '未发送'],
      ['10', '发送成功', 'success'],
      ['20', '发送失败', 'danger']
    ]
  },
  {
    name: '站内信模板类型',
    type: 'system_notify_template_type',
    values: [
      ['1', '站内信'],
      ['2', '邮件'],
      ['3', '短信'],
      ['4', '微信公众号'],
      ['5', '企业微信'],
      ['6', '钉钉']
    ]
  },
  {
    name: '社交类型',
    type: 'system_social_type',
    values: [
      ['0', 'GitHub'],
      ['10', 'Gitee'],
      ['20', '钉钉'],
      ['30', '企业微信'],
      ['31', '微信公众平台'],
      ['32', '微信小程序'],
      ['34', '支付宝小程序']
    ]
  },
  {
    name: 'OAuth2 授权类型',
    type: 'system_oauth2_grant_type',
    values: [
      ['password', '密码模式'],
      ['authorization_code', '授权码模式'],
      ['implicit', '简化模式'],
      ['client_credentials', '客户端模式'],
      ['refresh_token', '刷新令牌']
    ]
  },
  {
    name: '是否',
    type: 'infra_boolean_string',
    values: [
      ['true', '是', 'success'],
      ['false', '否', 'info']
    ]
  },
  {
    name: '任务状态',
    type: 'infra_job_status',
    values: [
      ['1', '开启', 'success'],
      ['2', '暂停', 'info']
    ]
  },
  {
    name: '任务日志状态',
    type: 'infra_job_log_status',
    values: [
      ['0', '初始化中'],
      ['1', '执行中', 'primary'],
      ['2', '执行成功', 'success'],
      ['3', '执行失败', 'danger']
    ]
  },
  {
    name: 'API 错误日志处理状态',
    type: 'infra_api_error_log_process_status',
    values: [
      ['0', '未处理', 'warning'],
      ['1', '已处理', 'success'],
      ['2', '已忽略', 'info']
    ]
  },
  {
    name: '参数类型',
    type: 'infra_config_type',
    values: [
      ['1', '系统配置'],
      ['2', '自定义配置']
    ]
  },
  {
    name: '文件存储',
    type: 'infra_file_storage',
    values: [
      ['1', '本地磁盘'],
      ['10', '数据库'],
      ['20', '七牛云'],
      ['30', '阿里云'],
      ['40', '腾讯云'],
      ['50', 'MinIO']
    ]
  },
  {
    name: '操作类型',
    type: 'infra_operate_type',
    values: [
      ['1', '新增'],
      ['2', '修改'],
      ['3', '删除'],
      ['4', '查询'],
      ['5', '导出'],
      ['6', '导入']
    ]
  },
  {
    name: '代码生成模板类型',
    type: 'infra_codegen_template_type',
    values: [
      ['1', '单表（增删改查）'],
      ['2', '树表（增删改查）'],
      ['3', '主子表（增删改查）']
    ]
  },
  {
    name: '代码生成前端类型',
    type: 'infra_codegen_front_type',
    values: [
      ['1', 'Vue3 标准版（element-plus）'],
      ['2', 'Vue3 简洁版（element-plus）'],
      ['3', 'Vue2 标准版（element-ui）']
    ]
  },
  {
    name: '代码生成场景',
    type: 'infra_codegen_scene',
    values: [
      ['1', '生成到项目'],
      ['2', '自定义路径'],
      ['3', '下载']
    ]
  },

  // ========== 监管报送业务字典 ==========
  {
    name: '报送数据频度',
    type: 'cr_report_freq',
    remark: '对齐新统信报送频度',
    values: [
      ['1', '日报'],
      ['2', '旬报'],
      ['3', '月报'],
      ['4', '季报'],
      ['5', '半年报'],
      ['6', '年报']
    ]
  },
  {
    name: '报表任务状态',
    type: 'cr_task_status',
    remark: '报表任务在填报-复核-审核链路中的状态',
    values: [
      ['10', '待下发', 'info'],
      ['20', '已下发', 'primary'],
      ['30', '填报中', 'warning'],
      ['40', '待复核', 'warning'],
      ['50', '复核通过', 'success'],
      ['60', '复核不通过', 'danger'],
      ['70', '本级审核中', 'warning'],
      ['80', '上级审核中', 'warning'],
      ['90', '审核通过', 'success'],
      ['100', '已打回', 'danger']
    ]
  },
  {
    name: '数据填报状态',
    type: 'cr_fill_status',
    values: [
      ['0', '未填报', 'info'],
      ['1', '填报中', 'warning'],
      ['2', '已提交', 'success']
    ]
  },
  {
    name: '数据校验状态',
    type: 'cr_check_status',
    values: [
      ['0', '未校验', 'info'],
      ['1', '校验中', 'primary'],
      ['2', '校验通过', 'success'],
      ['3', '校验不通过', 'danger']
    ]
  },
  {
    name: '机构层级',
    type: 'cr_org_level',
    values: [
      ['1', '总公司'],
      ['2', '省级分公司'],
      ['3', '中心支公司']
    ]
  },
  {
    name: '上报方式',
    type: 'cr_report_type',
    values: [
      ['FTP', 'FTP'],
      ['SFTP', 'SFTP'],
      ['MANUAL', '手工上传']
    ]
  },
  {
    name: '错误级别',
    type: 'cr_error_level',
    values: [
      ['1', '警告', 'warning'],
      ['2', '错误', 'danger']
    ]
  },
  {
    name: '校验规则类型',
    type: 'cr_rule_type',
    values: [
      ['1', '非空校验', 'info'],
      ['2', '长度校验', 'info'],
      ['3', '值域校验', 'info'],
      ['4', '逻辑校验', 'primary'],
      ['5', '表间校验', 'primary'],
      ['6', '枚举校验', 'primary']
    ]
  },
  {
    name: '脱敏规则类型',
    type: 'cr_desensitize_type',
    values: [
      ['MASK', '掩码'],
      ['HASH', '哈希'],
      ['REPLACE', '替换'],
      ['TRUNCATE', '截断']
    ]
  },
  {
    name: '报送审核状态',
    type: 'cr_audit_status',
    values: [
      ['0', '待审核', 'warning'],
      ['1', '审核通过', 'success'],
      ['2', '审核不通过', 'danger']
    ]
  },
  {
    name: '报文类型',
    type: 'cr_message_type',
    remark: '报文配置 — 报文文件类型',
    values: [
      ['TXT', '文本（TXT）'],
      ['XML', 'XML 报文'],
      ['CSV', 'CSV']
    ]
  },
  {
    name: '口径类型',
    type: 'cr_caliber_type',
    remark: '报文配置 — 指标口径类型',
    values: [
      ['1', '取数口径'],
      ['2', '计算口径'],
      ['3', '汇总口径'],
      ['4', '折算口径']
    ]
  },
  {
    name: '报送期次状态',
    type: 'cr_period_status',
    remark: '数据采集 — 期次开放状态',
    values: [
      ['0', '未开始', 'info'],
      ['1', '进行中', 'primary'],
      ['2', '已关闭', 'danger']
    ]
  },
  {
    name: '数据采集方式',
    type: 'cr_collect_channel',
    remark: '数据采集 — 数据怎么进来',
    values: [
      ['1', '系统直连', 'primary'],
      ['2', '文件导入', 'success'],
      ['3', '接口推送', 'warning'],
      ['4', '手工录入', 'info']
    ]
  },
  {
    name: '导入文件类型',
    type: 'cr_file_type',
    remark: '数据采集 — 导入文件格式',
    values: [
      ['1', 'CSV', 'primary'],
      ['2', 'TXT', 'info'],
      ['3', 'XLSX', 'success']
    ]
  },
  {
    name: '脱敏执行状态',
    type: 'cr_desens_status',
    remark:
      '数据脱敏 — 执行批次状态（6/7 是审批流引入的状态：提交申请后先是待审核，审核通过才会真正执行）',
    values: [
      ['1', '执行中', 'warning'],
      ['2', '执行成功', 'success'],
      ['3', '部分失败', 'warning'],
      ['4', '执行失败', 'danger'],
      ['5', '已还原', 'info'],
      ['6', '待审核', 'primary'],
      ['7', '已驳回', 'danger']
    ]
  },
  {
    name: '数据拆分方式',
    type: 'cr_split_mode',
    remark: '数据拆分 — 拆分方式（按行数均分 / 按字段值分组 / 不拆分）',
    values: [
      ['1', '按行数均分', 'primary'],
      ['2', '按字段值分组', 'success'],
      ['3', '不拆分', 'info']
    ]
  },
  {
    name: '数据拆分状态',
    type: 'cr_split_status',
    remark: '数据拆分 — 拆分批次状态',
    values: [
      ['1', '执行中', 'warning'],
      ['2', '拆分成功', 'success'],
      ['3', '拆分失败', 'danger']
    ]
  },
  {
    name: '导入任务状态',
    type: 'cr_import_status',
    remark: '数据采集 — 导入批次状态',
    values: [
      ['1', '解析中', 'warning'],
      ['2', '解析失败', 'danger'],
      ['3', '待审核', 'primary'],
      ['4', '已入库', 'success'],
      ['5', '已驳回', 'danger']
    ]
  },
  {
    name: '导入日志动作',
    type: 'cr_import_action',
    remark: '数据采集 — 导入过程中做了什么',
    values: [
      ['1', '文件解析', 'primary'],
      ['2', '数据校验', 'info'],
      ['3', '数据入库', 'success'],
      ['4', '数据回滚', 'warning'],
      ['5', '审核通过', 'success'],
      ['6', '审核驳回', 'danger']
    ]
  },
  {
    name: '补录状态',
    type: 'cr_supplement_status',
    remark: '数据采集 — 补录申请状态',
    values: [
      ['1', '待审核', 'warning'],
      ['2', '已通过', 'success'],
      ['3', '已驳回', 'danger'],
      ['4', '已补录', 'primary']
    ]
  },
  {
    name: '授权主体类型',
    type: 'cr_subject_type',
    remark: '数据采集 — 导入权限授权给角色还是用户',
    values: [
      ['1', '角色', 'primary'],
      ['2', '用户', 'success']
    ]
  },
  {
    name: '启停状态',
    type: 'cr_enable_status',
    remark: '数据采集 — 采集方式 / 导入设置 / 权限的启停',
    values: [
      ['0', '停用', 'info'],
      ['1', '启用', 'success']
    ]
  },
  {
    name: '机构数据范围类型',
    type: 'cr_scope_type',
    remark: '数据权限配置 — 规则选定后展开成哪些机构',
    values: [
      ['1', '全部数据', 'danger'],
      ['2', '本级及以下', 'primary'],
      ['3', '仅本机构', 'warning'],
      ['4', '指定机构', 'success']
    ]
  },
  {
    name: '部门权限动作',
    type: 'cr_dept_action',
    remark: '部门权限配置 — 一个部门在某张报表上允许做的动作',
    values: [
      ['fill', '数据填报', 'primary'],
      ['review', '复核', 'warning'],
      ['audit', '审核', 'success'],
      ['submit', '批量提交', 'info']
    ]
  },
  {
    name: '任务实现类型',
    type: 'cr_task_impl_type',
    remark: '任务调度 — 采集任务用什么实现（存储过程 / Shell / SQL）',
    values: [
      ['1', '存储过程', 'primary'],
      ['2', 'Shell 脚本', 'warning'],
      ['3', 'SQL 语句', 'success'],
      ['4', 'Java 类', 'info']
    ]
  },
  {
    name: '任务运行状态',
    type: 'cr_task_run_status',
    remark: '任务调度 — 批量监控里每次跑批的结果',
    values: [
      ['1', '运行中', 'warning'],
      ['2', '执行成功', 'success'],
      ['3', '执行失败', 'danger'],
      ['4', '等待前置任务', 'info'],
      ['5', '已跳过', 'info']
    ]
  },
  {
    name: '集群节点角色',
    type: 'cr_cluster_role',
    remark: '集群配置 — 节点在集群里是主节点还是工作节点',
    values: [
      ['master', '主节点（master）', 'danger'],
      ['worker', '工作节点（worker）', 'primary']
    ]
  },
  {
    name: '集群节点状态',
    type: 'cr_cluster_status',
    remark: '集群配置 — 节点当前是否可用',
    values: [
      ['1', '在线', 'success'],
      ['0', '离线', 'danger']
    ]
  },
  {
    name: '公式类型',
    type: 'cr_formula_type',
    remark: '公式 SQL 定制 — 这条公式/脚本用在哪里',
    values: [
      ['1', '取数公式', 'primary'],
      ['2', '校验公式', 'warning'],
      ['3', '指标计算', 'success'],
      ['4', '报表口径', 'info']
    ]
  }
]

const typeSeed: DictTypeRow[] = []
const dataSeed: DictDataRow[] = []
let typeId = 1
let dataId = 1
let timeCursor = Date.parse('2024-01-01 09:00:00')

specs.forEach((spec) => {
  timeCursor += 60_000
  typeSeed.push({
    id: typeId++,
    name: spec.name,
    type: spec.type,
    status: 0,
    remark: spec.remark || '',
    createTime: new Date(timeCursor).toISOString().replace('T', ' ').slice(0, 19)
  })
  spec.values.forEach(([value, label, colorType], index) => {
    timeCursor += 60_000
    dataSeed.push({
      id: dataId++,
      sort: index + 1,
      label,
      value,
      dictType: spec.type,
      status: 0,
      colorType: colorType || '',
      cssClass: '',
      remark: '',
      createTime: new Date(timeCursor).toISOString().replace('T', ' ').slice(0, 19)
    })
  })
})

export const dictTypeTable = defineTable<DictTypeRow>('system.dictType', typeSeed)
export const dictDataTable = defineTable<DictDataRow>('system.dictData', dataSeed)
