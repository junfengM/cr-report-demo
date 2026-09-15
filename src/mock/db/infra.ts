/**
 * Mock 种子数据 — 基础设施与日志
 *
 * 用于脚手架原生页面：定时任务 / 调度日志 / 参数配置 / 文件管理 /
 * API 访问日志 / API 错误日志 / 操作日志 / 登录日志 / 通知公告 / 站内信。
 */
import { defineTable } from '../store'

/** ---------- 系统参数 ---------- */
export interface ConfigRow {
  id: number
  category: string
  name: string
  key: string
  value: string
  type: number
  visible: boolean
  remark: string
  createTime: string
}

export const configTable = defineTable<ConfigRow>('infra.config', [
  {
    id: 1,
    category: '监管报送',
    name: '报送机构编码',
    key: 'cr.org.code',
    value: 'HX000000',
    type: 1,
    visible: true,
    remark: '总公司监管机构编码',
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 2,
    category: '监管报送',
    name: '当前报送期次',
    key: 'cr.period.current',
    value: '202608',
    type: 1,
    visible: true,
    remark: '当前监管数据报送期次（yyyyMM）',
    createTime: '2024-01-01 09:01:00'
  },
  {
    id: 3,
    category: '监管报送',
    name: '报送截止日',
    key: 'cr.period.deadline',
    value: '15',
    type: 1,
    visible: true,
    remark: '每月报送截止日（自然日）',
    createTime: '2024-01-01 09:02:00'
  },
  {
    id: 4,
    category: '监管报送',
    name: '报文文件扩展名',
    key: 'cr.message.ext',
    value: 'txt',
    type: 1,
    visible: true,
    remark: '生成报文的文件扩展名',
    createTime: '2024-01-01 09:03:00'
  },
  {
    id: 5,
    category: '监管报送',
    name: '是否启用数据脱敏',
    key: 'cr.desensitize.enable',
    value: 'true',
    type: 1,
    visible: true,
    remark: '报文生成前是否自动脱敏',
    createTime: '2024-01-01 09:04:00'
  },
  {
    id: 6,
    category: '数据校验',
    name: '校验失败是否阻断报送',
    key: 'cr.check.block',
    value: 'false',
    type: 1,
    visible: true,
    remark: '存在"错误"级别校验结果时是否阻断报文生成',
    createTime: '2024-01-01 09:05:00'
  },
  {
    id: 7,
    category: '数据校验',
    name: '校验并发线程数',
    key: 'cr.check.threads',
    value: '4',
    type: 2,
    visible: true,
    remark: '',
    createTime: '2024-01-01 09:06:00'
  },
  {
    id: 8,
    category: '提醒设置',
    name: '报送节点提醒提前天数',
    key: 'cr.remind.ahead-days',
    value: '3',
    type: 2,
    visible: false,
    remark: '报送截止前 N 天开始提醒责任人',
    createTime: '2024-01-01 09:07:00'
  },
  {
    id: 9,
    category: '提醒设置',
    name: '提醒方式',
    key: 'cr.remind.channel',
    value: 'email,sms',
    type: 2,
    visible: true,
    remark: '邮箱 / 短信 / 企业微信',
    createTime: '2024-01-01 09:08:00'
  }
])

/** ---------- 定时任务 ---------- */
export interface JobRow {
  id: number
  name: string
  status: number
  handlerName: string
  handlerParam: string
  cronExpression: string
  retryCount: number
  retryInterval: number
  monitorTimeout: number
  createTime: string
}

export const jobTable = defineTable<JobRow>('infra.job', [
  {
    id: 1,
    name: '监管数据采集任务',
    status: 1,
    handlerName: 'crDataCollectJob',
    handlerParam: '',
    cronExpression: '0 0 2 * * ?',
    retryCount: 3,
    retryInterval: 60,
    monitorTimeout: 0,
    createTime: '2024-01-01 09:00:00'
  },
  {
    id: 2,
    name: '监管数据校验任务',
    status: 1,
    handlerName: 'crDataCheckJob',
    handlerParam: '',
    cronExpression: '0 30 2 * * ?',
    retryCount: 2,
    retryInterval: 60,
    monitorTimeout: 0,
    createTime: '2024-01-01 09:05:00'
  },
  {
    id: 3,
    name: '报文生成任务',
    status: 1,
    handlerName: 'crMessageGenerateJob',
    handlerParam: '',
    cronExpression: '0 0 6 10 * ?',
    retryCount: 1,
    retryInterval: 30,
    monitorTimeout: 0,
    createTime: '2024-01-01 09:10:00'
  },
  {
    id: 4,
    name: '报文上报任务',
    status: 2,
    handlerName: 'crMessageUploadJob',
    handlerParam: '',
    cronExpression: '0 0 8 12 * ?',
    retryCount: 3,
    retryInterval: 120,
    monitorTimeout: 0,
    createTime: '2024-01-01 09:15:00'
  },
  {
    id: 5,
    name: '报送超期提醒任务',
    status: 1,
    handlerName: 'crDeadlineRemindJob',
    handlerParam: '',
    cronExpression: '0 0 9 * * ?',
    retryCount: 1,
    retryInterval: 60,
    monitorTimeout: 0,
    createTime: '2024-01-01 09:20:00'
  }
])

/** ---------- 调度日志 ---------- */
export interface JobLogRow {
  id: number
  jobId: number
  handlerName: string
  handlerParam: string
  executeIndex: number
  beginTime: string
  endTime: string
  duration: string
  status: number
  result: string
  createTime: string
}

export const jobLogTable = defineTable<JobLogRow>('infra.jobLog', [
  {
    id: 1,
    jobId: 1,
    handlerName: 'crDataCollectJob',
    handlerParam: '',
    executeIndex: 1,
    beginTime: '2026-09-12 02:00:00',
    endTime: '2026-09-12 02:03:21',
    duration: '201s',
    status: 2,
    result: '采集成功，新增 12,480 条，更新 3,206 条',
    createTime: '2026-09-12 02:00:00'
  },
  {
    id: 2,
    jobId: 2,
    handlerName: 'crDataCheckJob',
    handlerParam: '',
    executeIndex: 1,
    beginTime: '2026-09-12 02:30:00',
    endTime: '2026-09-12 02:36:52',
    duration: '412s',
    status: 2,
    result: '校验完成，命中规则 486 条，错误 37 条，警告 129 条',
    createTime: '2026-09-12 02:30:00'
  },
  {
    id: 3,
    jobId: 5,
    handlerName: 'crDeadlineRemindJob',
    handlerParam: '',
    executeIndex: 1,
    beginTime: '2026-09-12 09:00:00',
    endTime: '2026-09-12 09:00:04',
    duration: '4s',
    status: 2,
    result: '发送提醒邮件 6 封',
    createTime: '2026-09-12 09:00:00'
  },
  {
    id: 4,
    jobId: 3,
    handlerName: 'crMessageGenerateJob',
    handlerParam: '',
    executeIndex: 1,
    beginTime: '2026-09-10 06:00:00',
    endTime: '2026-09-10 06:01:12',
    duration: '72s',
    status: 2,
    result: '生成报文 27 个',
    createTime: '2026-09-10 06:00:00'
  },
  {
    id: 5,
    jobId: 4,
    handlerName: 'crMessageUploadJob',
    handlerParam: '',
    executeIndex: 1,
    beginTime: '2026-09-12 08:00:00',
    endTime: '2026-09-12 08:00:00',
    duration: '0s',
    status: 3,
    result: '任务已暂停，未执行',
    createTime: '2026-09-12 08:00:00'
  }
])

/** ---------- 文件管理 ---------- */
export interface FileRow {
  id: number
  configId: number
  name: string
  path: string
  url: string
  type: string
  size: number
  createTime: string
}

export const fileTable = defineTable<FileRow>('infra.file', [
  {
    id: 1,
    configId: 1,
    name: '202608_人身险公司商保年金业务统计表.xlsx',
    path: '/cr/report/202608/annuity.xlsx',
    url: '/admin-api/infra/file/1/get',
    type: 'application/vnd.ms-excel',
    size: 128_640,
    createTime: '2026-09-10 06:01:00'
  },
  {
    id: 2,
    configId: 1,
    name: '202608_新统信报文.zip',
    path: '/cr/message/202608/message.zip',
    url: '/admin-api/infra/file/2/get',
    type: 'application/zip',
    size: 2_458_112,
    createTime: '2026-09-10 06:01:10'
  },
  {
    id: 3,
    configId: 1,
    name: '202608_质量检核结果.xlsx',
    path: '/cr/quality/202608/quality.xlsx',
    url: '/admin-api/infra/file/3/get',
    type: 'application/vnd.ms-excel',
    size: 86_016,
    createTime: '2026-09-10 06:01:20'
  },
  {
    id: 4,
    configId: 1,
    name: '报送说明附件_202608.docx',
    path: '/cr/attach/202608/readme.docx',
    url: '/admin-api/infra/file/4/get',
    type: 'application/msword',
    size: 42_880,
    createTime: '2026-09-11 15:22:00'
  }
])

/** ---------- API 访问日志 ---------- */
export interface ApiAccessLogRow {
  id: number
  traceId: string
  userId: number
  userType: number
  applicationName: string
  requestMethod: string
  requestParams: string
  responseBody: string
  requestUrl: string
  userIp: string
  userAgent: string
  operateModule: string
  operateName: string
  operateType: number
  beginTime: string
  endTime: string
  duration: number
  resultCode: number
  resultMsg: string
  createTime: string
}

const accessLogSeed: ApiAccessLogRow[] = [
  {
    id: 1,
    traceId: 'a1b2c3d4e5f60001',
    userId: 2,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'POST',
    requestParams: '{"taskId":1001}',
    responseBody: '{"code":0}',
    requestUrl: '/admin-api/cr/data/fill/save',
    userIp: '10.1.1.21',
    userAgent: 'Mozilla/5.0 Chrome/126',
    operateModule: '数据填报',
    operateName: '保存填报数据',
    operateType: 2,
    beginTime: '2026-09-12 09:12:31',
    endTime: '2026-09-12 09:12:31',
    duration: 86,
    resultCode: 0,
    resultMsg: '',
    createTime: '2026-09-12 09:12:31'
  },
  {
    id: 2,
    traceId: 'a1b2c3d4e5f60002',
    userId: 2,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'POST',
    requestParams: '{"taskId":1001,"type":"CHECK"}',
    responseBody: '{"code":0}',
    requestUrl: '/admin-api/cr/data/fill/check',
    userIp: '10.1.1.21',
    userAgent: 'Mozilla/5.0 Chrome/126',
    operateModule: '数据填报',
    operateName: '执行校验',
    operateType: 4,
    beginTime: '2026-09-12 09:13:02',
    endTime: '2026-09-12 09:13:13',
    duration: 11_200,
    resultCode: 0,
    resultMsg: '',
    createTime: '2026-09-12 09:13:13'
  },
  {
    id: 3,
    traceId: 'a1b2c3d4e5f60003',
    userId: 3,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'PUT',
    requestParams: '{"taskId":1001,"result":"PASS"}',
    responseBody: '{"code":0}',
    requestUrl: '/admin-api/cr/task/review',
    userIp: '10.1.1.31',
    userAgent: 'Mozilla/5.0 Chrome/126',
    operateModule: '复核操作',
    operateName: '复核通过',
    operateType: 2,
    beginTime: '2026-09-12 10:02:11',
    endTime: '2026-09-12 10:02:11',
    duration: 132,
    resultCode: 0,
    resultMsg: '',
    createTime: '2026-09-12 10:02:11'
  },
  {
    id: 4,
    traceId: 'a1b2c3d4e5f60004',
    userId: 4,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'POST',
    requestParams: '{"orgId":11,"period":"202608"}',
    responseBody: '{"code":0}',
    requestUrl: '/admin-api/cr/submit/generate',
    userIp: '10.1.1.41',
    userAgent: 'Mozilla/5.0 Chrome/126',
    operateModule: '一键报送',
    operateName: '生成报文',
    operateType: 1,
    beginTime: '2026-09-12 10:30:00',
    endTime: '2026-09-12 10:31:26',
    duration: 86_400,
    resultCode: 0,
    resultMsg: '',
    createTime: '2026-09-12 10:31:26'
  },
  {
    id: 5,
    traceId: 'a1b2c3d4e5f60005',
    userId: 1,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'DELETE',
    requestParams: 'id=3',
    responseBody: '{"code":0}',
    requestUrl: '/admin-api/system/user/delete',
    userIp: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Chrome/126',
    operateModule: '用户管理',
    operateName: '删除用户',
    operateType: 3,
    beginTime: '2026-09-11 16:40:09',
    endTime: '2026-09-11 16:40:09',
    duration: 45,
    resultCode: 0,
    resultMsg: '',
    createTime: '2026-09-11 16:40:09'
  },
  {
    id: 6,
    traceId: 'a1b2c3d4e5f60006',
    userId: 2,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'POST',
    requestParams: '{"tableId":3}',
    responseBody: '{"code":0}',
    requestUrl: '/admin-api/cr/collect/import',
    userIp: '10.1.1.21',
    userAgent: 'Mozilla/5.0 Chrome/126',
    operateModule: '数据采集',
    operateName: 'Excel 导入',
    operateType: 6,
    beginTime: '2026-09-11 14:20:00',
    endTime: '2026-09-11 14:20:08',
    duration: 8_100,
    resultCode: 0,
    resultMsg: '',
    createTime: '2026-09-11 14:20:08'
  }
]

export const apiAccessLogTable = defineTable<ApiAccessLogRow>('infra.apiAccessLog', accessLogSeed)

/** ---------- API 错误日志 ---------- */
export interface ApiErrorLogRow {
  id: number
  traceId: string
  userId: number
  userType: number
  applicationName: string
  requestMethod: string
  requestParams: string
  requestUrl: string
  userIp: string
  userAgent: string
  exceptionTime: string
  exceptionName: string
  exceptionMessage: string
  exceptionRootCauseMessage: string
  exceptionStackTrace: string
  exceptionClassName: string
  exceptionFileName: string
  exceptionMethodName: string
  exceptionLineNumber: number
  processUserId: number
  processStatus: number
  processTime: string
  resultCode: number
  createTime: string
}

export const apiErrorLogTable = defineTable<ApiErrorLogRow>('infra.apiErrorLog', [
  {
    id: 1,
    traceId: 'e5f6a1b2c3d40001',
    userId: 2,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'POST',
    requestParams: '{"tableId":9,"period":"202608"}',
    requestUrl: '/admin-api/cr/collect/import',
    userIp: '10.1.1.21',
    userAgent: 'Mozilla/5.0 Chrome/126',
    exceptionTime: '2026-09-11 14:18:22',
    exceptionName: 'java.lang.IllegalArgumentException',
    exceptionMessage: '导入模板与目标表结构不匹配：缺少字段 OUT_COUNTRY_FLAG',
    exceptionRootCauseMessage: '列 [out_country_flag] 不存在',
    exceptionStackTrace:
      'java.lang.IllegalArgumentException: 导入模板与目标表结构不匹配\n\tat com.huaxin.cr.collect.ImportService.validate(ImportService.java:186)',
    exceptionClassName: 'java.lang.IllegalArgumentException',
    exceptionFileName: 'ImportService.java',
    exceptionMethodName: 'validate',
    exceptionLineNumber: 186,
    processUserId: 1,
    processStatus: 1,
    processTime: '2026-09-11 15:02:00',
    resultCode: 500,
    createTime: '2026-09-11 14:18:22'
  },
  {
    id: 2,
    traceId: 'e5f6a1b2c3d40002',
    userId: 4,
    userType: 2,
    applicationName: 'cr-report-server',
    requestMethod: 'POST',
    requestParams: '{"orgId":14,"period":"202608"}',
    requestUrl: '/admin-api/cr/submit/upload',
    userIp: '10.1.1.41',
    userAgent: 'Mozilla/5.0 Chrome/126',
    exceptionTime: '2026-09-12 08:05:41',
    exceptionName: 'java.net.SocketTimeoutException',
    exceptionMessage: '连接广东监管局 SFTP 服务器超时（10.10.24.11:22）',
    exceptionRootCauseMessage: 'connect timed out',
    exceptionStackTrace:
      'java.net.SocketTimeoutException: connect timed out\n\tat com.huaxin.cr.submit.SftpClient.connect(SftpClient.java:74)',
    exceptionClassName: 'java.net.SocketTimeoutException',
    exceptionFileName: 'SftpClient.java',
    exceptionMethodName: 'connect',
    exceptionLineNumber: 74,
    processUserId: 0,
    processStatus: 0,
    processTime: '',
    resultCode: 500,
    createTime: '2026-09-12 08:05:41'
  }
])

/** ---------- 操作日志 ---------- */
export interface OperateLogRow {
  id: number
  traceId: string
  userType: number
  userId: number
  userName: string
  type: string
  subType: string
  bizId: number
  action: string
  extra: string
  requestMethod: string
  requestUrl: string
  userIp: string
  userAgent: string
  creator: string
  creatorName: string
  createTime: string
}

export const operateLogTable = defineTable<OperateLogRow>('system.operateLog', [
  {
    id: 1,
    traceId: 'a1b2c3d4e5f60001',
    userType: 2,
    userId: 2,
    userName: '张天报',
    type: '数据填报',
    subType: '保存',
    bizId: 1001,
    action: '保存人身险公司商保年金业务统计表',
    extra: '{}',
    requestMethod: 'POST',
    requestUrl: '/admin-api/cr/data/fill/save',
    userIp: '10.1.1.21',
    userAgent: 'Chrome/126',
    creator: '2',
    creatorName: '张天报',
    createTime: '2026-09-12 09:12:31'
  },
  {
    id: 2,
    traceId: 'a1b2c3d4e5f60003',
    userType: 2,
    userId: 3,
    userName: '李复华',
    type: '复核操作',
    subType: '复核通过',
    bizId: 1001,
    action: '复核通过 202608 期次月报',
    extra: '{}',
    requestMethod: 'PUT',
    requestUrl: '/admin-api/cr/task/review',
    userIp: '10.1.1.31',
    userAgent: 'Chrome/126',
    creator: '3',
    creatorName: '李复华',
    createTime: '2026-09-12 10:02:11'
  },
  {
    id: 3,
    traceId: 'a1b2c3d4e5f60004',
    userType: 2,
    userId: 4,
    userName: '王审核',
    type: '一键报送',
    subType: '报文生成',
    bizId: 11,
    action: '生成北京分公司 202608 期次报文',
    extra: '{}',
    requestMethod: 'POST',
    requestUrl: '/admin-api/cr/submit/generate',
    userIp: '10.1.1.41',
    userAgent: 'Chrome/126',
    creator: '4',
    creatorName: '王审核',
    createTime: '2026-09-12 10:30:00'
  },
  {
    id: 4,
    traceId: 'a1b2c3d4e5f60005',
    userType: 2,
    userId: 1,
    userName: '系统管理员',
    type: '用户管理',
    subType: '删除',
    bizId: 3,
    action: '删除用户',
    extra: '{}',
    requestMethod: 'DELETE',
    requestUrl: '/admin-api/system/user/delete',
    userIp: '127.0.0.1',
    userAgent: 'Chrome/126',
    creator: '1',
    creatorName: '系统管理员',
    createTime: '2026-09-11 16:40:09'
  }
])

/** ---------- 登录日志 ---------- */
export interface LoginLogRow {
  id: number
  logType: number
  traceId: string
  userId: number
  userType: number
  username: string
  result: number
  status: number
  userIp: string
  userAgent: string
  createTime: string
}

export const loginLogTable = defineTable<LoginLogRow>('system.loginLog', [
  {
    id: 1,
    logType: 1,
    traceId: 'b1c2d3e4f5a60001',
    userId: 2,
    userType: 2,
    username: 'filler',
    result: 0,
    status: 0,
    userIp: '10.1.1.21',
    userAgent: 'Chrome/126',
    createTime: '2026-09-12 08:31:00'
  },
  {
    id: 2,
    logType: 1,
    traceId: 'b1c2d3e4f5a60002',
    userId: 3,
    userType: 2,
    username: 'reviewer',
    result: 0,
    status: 0,
    userIp: '10.1.1.31',
    userAgent: 'Chrome/126',
    createTime: '2026-09-12 08:45:00'
  },
  {
    id: 3,
    logType: 1,
    traceId: 'b1c2d3e4f5a60003',
    userId: 4,
    userType: 2,
    username: 'auditor',
    result: 0,
    status: 0,
    userIp: '10.1.1.41',
    userAgent: 'Chrome/126',
    createTime: '2026-09-12 08:52:00'
  },
  {
    id: 4,
    logType: 1,
    traceId: 'b1c2d3e4f5a60004',
    userId: 0,
    userType: 2,
    username: 'unknown',
    result: 10,
    status: 1,
    userIp: '116.24.11.8',
    userAgent: 'Chrome/120',
    createTime: '2026-09-12 03:12:44'
  },
  {
    id: 5,
    logType: 1,
    traceId: 'b1c2d3e4f5a60005',
    userId: 1,
    userType: 2,
    username: 'admin',
    result: 0,
    status: 0,
    userIp: '127.0.0.1',
    userAgent: 'Chrome/126',
    createTime: '2026-09-12 09:00:00'
  },
  {
    id: 6,
    logType: 2,
    traceId: 'b1c2d3e4f5a60006',
    userId: 1,
    userType: 2,
    username: 'admin',
    result: 0,
    status: 0,
    userIp: '127.0.0.1',
    userAgent: 'Chrome/126',
    createTime: '2026-09-12 09:05:00'
  }
])

/** ---------- 通知公告 ---------- */
export interface NoticeRow {
  id: number
  title: string
  type: number
  content: string
  status: number
  remark: string
  creator: string
  createTime: string
}

export const noticeTable = defineTable<NoticeRow>('system.notice', [
  {
    id: 1,
    title: '关于开展 2026 年 8 月新统信数据报送工作的通知',
    type: 2,
    content:
      '<p>各分公司、总公司各部门：</p><p>2026 年 8 月新统信数据报送工作现已启动，请各单位于 <strong>9 月 15 日前</strong>完成数据填报、校验与提交。</p><p>风险提示：本期新增"出境地区"字段校验规则，请重点关注。</p>',
    status: 0,
    remark: '',
    creator: 'admin',
    createTime: '2026-09-01 09:00:00'
  },
  {
    id: 2,
    title: '2026 年 7 月报送质量通报',
    type: 1,
    content:
      '<p>7 月全公司校验出错率 0.31%，较上月下降 0.12 个百分点，北京分公司报送及时率排名第一。</p>',
    status: 0,
    remark: '',
    creator: 'admin',
    createTime: '2026-08-20 15:30:00'
  },
  {
    id: 3,
    title: '监管报送系统停机维护通知',
    type: 1,
    content: '<p>系统将于 9 月 14 日 22:00 - 23:00 进行升级维护，期间暂停报文生成服务。</p>',
    status: 0,
    remark: '',
    creator: 'admin',
    createTime: '2026-09-10 17:00:00'
  }
])

/** ---------- 站内信 ---------- */
export interface NotifyMessageRow {
  id: number
  userId: number
  userType: number
  templateCode: string
  templateNickname: string
  templateContent: string
  templateType: number
  readStatus: boolean
  readTime: string
  createTime: string
}

export const notifyMessageTable = defineTable<NotifyMessageRow>('system.notifyMessage', [
  {
    id: 1,
    userId: 2,
    userType: 2,
    templateCode: 'cr_deadline_remind',
    templateNickname: '报送截止提醒',
    templateContent:
      '您负责的 2026 年 8 月新统信报表将于 9 月 15 日截止，当前仍有 3 张报表未提交。',
    templateType: 1,
    readStatus: false,
    readTime: '',
    createTime: '2026-09-12 09:00:00'
  },
  {
    id: 2,
    userId: 2,
    userType: 2,
    templateCode: 'cr_check_fail',
    templateNickname: '校验不通过通知',
    templateContent: '人身险公司商保年金业务统计表存在 12 条校验错误，请及时处理。',
    templateType: 1,
    readStatus: false,
    readTime: '',
    createTime: '2026-09-12 09:13:00'
  },
  {
    id: 3,
    userId: 3,
    userType: 2,
    templateCode: 'cr_review_todo',
    templateNickname: '复核待办通知',
    templateContent: '个险业务部提交的 2026 年 8 月报表待您复核。',
    templateType: 1,
    readStatus: true,
    readTime: '2026-09-12 09:50:00',
    createTime: '2026-09-12 09:20:00'
  }
])
