/**
 * Mock 种子数据 — 监管报送业务域
 *
 * 对齐附件文档：
 * - 主题域管理：系统初始化监管要求的 11 个主题域
 * - 表管理：系统初始化监管要求的 27 张数据表
 * - 列管理：监管数据项（含脱敏规则、是否必填）
 * - 报表/报表模板/任务/填报数据：报送主链路
 */
import { defineTable } from '../store'

/* ==================================================================
 * 主题域（11 个）
 * ================================================================== */
export interface SubjectRow {
  id: number
  subjectCode: string
  subjectName: string
  /** 主题域内表数量（由表管理自动统计，这里冗余一份便于列表展示） */
  tableCount: number
  remark: string
  createTime: string
}

export const subjectTable = defineTable<SubjectRow>('cr.subject', [
  {
    id: 1,
    subjectCode: 'S01',
    subjectName: '保单基本信息',
    tableCount: 4,
    remark: '保单主信息及状态',
    createTime: '2024-01-01 10:00:00'
  },
  {
    id: 2,
    subjectCode: 'S02',
    subjectName: '投保人信息',
    tableCount: 3,
    remark: '投保人主体信息',
    createTime: '2024-01-01 10:01:00'
  },
  {
    id: 3,
    subjectCode: 'S03',
    subjectName: '被保险人信息',
    tableCount: 3,
    remark: '被保险人主体信息',
    createTime: '2024-01-01 10:02:00'
  },
  {
    id: 4,
    subjectCode: 'S04',
    subjectName: '受益人信息',
    tableCount: 2,
    remark: '受益人及受益比例',
    createTime: '2024-01-01 10:03:00'
  },
  {
    id: 5,
    subjectCode: 'S05',
    subjectName: '险种信息',
    tableCount: 2,
    remark: '险种及责任定义',
    createTime: '2024-01-01 10:04:00'
  },
  {
    id: 6,
    subjectCode: 'S06',
    subjectName: '保费信息',
    tableCount: 3,
    remark: '保费、缴费及退保',
    createTime: '2024-01-01 10:05:00'
  },
  {
    id: 7,
    subjectCode: 'S07',
    subjectName: '赔付信息',
    tableCount: 3,
    remark: '赔案、赔付及拒赔',
    createTime: '2024-01-01 10:06:00'
  },
  {
    id: 8,
    subjectCode: 'S08',
    subjectName: '责任准备金',
    tableCount: 2,
    remark: '准备金计提与评估',
    createTime: '2024-01-01 10:07:00'
  },
  {
    id: 9,
    subjectCode: 'S09',
    subjectName: '销售渠道',
    tableCount: 2,
    remark: '渠道及网点',
    createTime: '2024-01-01 10:08:00'
  },
  {
    id: 10,
    subjectCode: 'S10',
    subjectName: '中介机构',
    tableCount: 2,
    remark: '代理机构及合作方',
    createTime: '2024-01-01 10:09:00'
  },
  {
    id: 11,
    subjectCode: 'S11',
    subjectName: '从业人员',
    tableCount: 1,
    remark: '销售及管理人员',
    createTime: '2024-01-01 10:10:00'
  }
])

/* ==================================================================
 * 数据表（27 张）
 * ================================================================== */
export interface MetaTableRow {
  id: number
  subjectId: number
  subjectName: string
  /** 表编码（英文） */
  tableCode: string
  /** 表名称（英文物理表名） */
  tableName: string
  /** 中文表名 */
  cnName: string
  /** 是否上报 */
  reportFlag: boolean
  /** 是否采集 */
  collectFlag: boolean
  /** 是否校验 */
  checkFlag: boolean
  /** 是否审核 */
  auditFlag: boolean
  /** 是否拆分报送 */
  splitFlag: boolean
  /** 增量方式：FULL 全量 / INC 增量 / DELTA 变化量 */
  incrementType: string
  /** 采集方式：AUTO 数据加工 / MANUAL 手工采集 */
  collectType: string
  status: number
  remark: string
  createTime: string
}

const tableRows: Array<[number, string, string, string, boolean, boolean, string, string]> = [
  // subjectId, tableCode, tableName, cnName, reportFlag, splitFlag, incrementType, collectType
  [1, 'T01', 'policy_base_info', '人身险保单基本信息表', true, true, 'INC', 'AUTO'],
  [1, 'T02', 'policy_status', '保单状态变更表', true, true, 'DELTA', 'AUTO'],
  [1, 'T03', 'policy_loan', '保单贷款信息表', true, true, 'INC', 'AUTO'],
  [1, 'T04', 'policy_surrender', '保单退保信息表', true, true, 'INC', 'AUTO'],
  [2, 'T05', 'holder_base_info', '投保人基本信息表', true, true, 'INC', 'AUTO'],
  [2, 'T06', 'holder_contact', '投保人联系方式表', true, true, 'FULL', 'MANUAL'],
  [2, 'T07', 'holder_relation', '投保人关系人表', false, true, 'FULL', 'MANUAL'],
  [3, 'T08', 'insured_base_info', '被保险人基本信息表', true, true, 'INC', 'AUTO'],
  [3, 'T09', 'insured_occupation', '被保险人职业信息表', true, true, 'FULL', 'MANUAL'],
  [3, 'T10', 'insured_health', '被保险人健康告知表', false, false, 'FULL', 'MANUAL'],
  [4, 'T11', 'beneficiary_info', '受益人信息表', true, true, 'INC', 'AUTO'],
  [4, 'T12', 'beneficiary_ratio', '受益比例信息表', true, true, 'FULL', 'MANUAL'],
  [5, 'T13', 'product_definition', '险种定义表', true, false, 'FULL', 'AUTO'],
  [5, 'T14', 'product_liability', '险种责任表', true, false, 'FULL', 'AUTO'],
  [6, 'T15', 'premium_info', '保费信息表', true, true, 'INC', 'AUTO'],
  [6, 'T16', 'premium_payment', '缴费信息表', true, true, 'INC', 'AUTO'],
  [6, 'T17', 'premium_refund', '退费信息表', true, true, 'INC', 'AUTO'],
  [7, 'T18', 'claim_case', '赔案信息表', true, true, 'INC', 'AUTO'],
  [7, 'T19', 'claim_payment', '赔付信息表', true, true, 'INC', 'AUTO'],
  [7, 'T20', 'claim_reject', '拒赔信息表', true, true, 'INC', 'AUTO'],
  [8, 'T21', 'reserve_calculation', '责任准备金计提表', true, false, 'FULL', 'AUTO'],
  [8, 'T22', 'reserve_assessment', '准备金评估表', true, false, 'FULL', 'AUTO'],
  [9, 'T23', 'channel_info', '销售渠道信息表', true, false, 'FULL', 'AUTO'],
  [9, 'T24', 'channel_branch', '渠道网点信息表', true, true, 'FULL', 'MANUAL'],
  [10, 'T25', 'agency_info', '中介机构信息表', true, false, 'FULL', 'MANUAL'],
  [10, 'T26', 'agency_cooperation', '机构合作信息表', true, false, 'FULL', 'MANUAL'],
  [11, 'T27', 'employee_info', '从业人员信息表', true, true, 'FULL', 'MANUAL']
]

export const metaTableTable = defineTable<MetaTableRow>(
  'cr.metaTable',
  tableRows.map((row, index) => {
    const [
      subjectId,
      tableCode,
      tableName,
      cnName,
      reportFlag,
      splitFlag,
      incrementType,
      collectType
    ] = row
    const subject = subjectTable.get(subjectId)
    return {
      id: index + 1,
      subjectId,
      subjectName: subject?.subjectName || '',
      tableCode,
      tableName,
      cnName,
      reportFlag,
      collectFlag: true,
      checkFlag: true,
      auditFlag: true,
      splitFlag,
      incrementType,
      collectType,
      status: 0,
      remark: '',
      createTime: '2024-01-01 11:00:00'
    }
  })
)

/* ==================================================================
 * 列 / 数据项
 * ================================================================== */
export interface MetaColumnRow {
  id: number
  tableId: number
  tableName: string
  cnTableName: string
  /** 字段编码（数据元编码） */
  columnCode: string
  /** 物理字段名 */
  columnName: string
  /** 字段中文名 */
  cnName: string
  /** 数据类型 */
  dataType: string
  /** 长度 */
  dataLength: number
  /** 是否必填 */
  required: boolean
  /** 是否主键 */
  primaryKey: boolean
  /** 脱敏规则：空 = 不脱敏；MASK/HASH/REPLACE/TRUNCATE */
  desensitizeRule: string
  /** 脱敏参数（如保留前 3 后 4） */
  desensitizeParam: string
  status: number
  remark: string
  createTime: string
}

const columnSpecs: Array<
  [number, string, string, string, string, number, boolean, boolean, string, string]
> = [
  // tableId, columnCode, columnName, cnName, dataType, len, required, pk, desensitizeRule, desensitizeParam
  [1, 'DE001', 'policy_no', '保单号', 'VARCHAR', 32, true, true, '', ''],
  [1, 'DE002', 'policy_holder_no', '投保人编号', 'VARCHAR', 32, true, false, '', ''],
  [1, 'DE003', 'insured_no', '被保险人编号', 'VARCHAR', 32, true, false, '', ''],
  [1, 'DE004', 'product_code', '险种编码', 'VARCHAR', 20, true, false, '', ''],
  [1, 'DE005', 'policy_effect_date', '保单生效日期', 'DATE', 8, true, false, '', ''],
  [1, 'DE006', 'policy_maturity_date', '保单满期日期', 'DATE', 8, false, false, '', ''],
  [1, 'DE007', 'policy_status', '保单状态', 'VARCHAR', 4, true, false, '', ''],
  [1, 'DE008', 'sum_assured', '保险金额', 'DECIMAL', 18, true, false, '', ''],
  [1, 'DE009', 'policy_term', '保险期间', 'INT', 8, true, false, '', ''],
  [1, 'DE010', 'out_country_flag', '出境地区境外标志', 'VARCHAR', 1, true, false, '', ''],
  [5, 'DE101', 'holder_no', '投保人编号', 'VARCHAR', 32, true, true, '', ''],
  [5, 'DE102', 'holder_name', '投保人名称', 'VARCHAR', 128, true, false, 'MASK', '前1后1'],
  [5, 'DE103', 'holder_type', '投保人类型', 'VARCHAR', 4, true, false, '', ''],
  [5, 'DE104', 'cert_type', '证件类型', 'VARCHAR', 4, true, false, '', ''],
  [5, 'DE105', 'cert_no', '证件号码', 'VARCHAR', 32, true, false, 'MASK', '前3后4'],
  [5, 'DE106', 'birth_date', '出生日期', 'DATE', 8, false, false, '', ''],
  [5, 'DE107', 'sex', '性别', 'VARCHAR', 2, false, false, '', ''],
  [6, 'DE121', 'holder_no', '投保人编号', 'VARCHAR', 32, true, true, '', ''],
  [6, 'DE122', 'mobile', '手机号码', 'VARCHAR', 20, true, false, 'MASK', '前3后4'],
  [6, 'DE123', 'email', '电子邮箱', 'VARCHAR', 64, false, false, 'MASK', '首字符'],
  [6, 'DE124', 'address', '联系地址', 'VARCHAR', 256, false, false, 'TRUNCATE', '保留前6位'],
  [8, 'DE141', 'insured_no', '被保险人编号', 'VARCHAR', 32, true, true, '', ''],
  [8, 'DE142', 'insured_name', '被保险人名称', 'VARCHAR', 128, true, false, 'MASK', '前1后1'],
  [8, 'DE143', 'cert_no', '证件号码', 'VARCHAR', 32, true, false, 'MASK', '前3后4'],
  [8, 'DE144', 'occupation_code', '职业编码', 'VARCHAR', 10, false, false, '', ''],
  [15, 'DE201', 'premium_no', '保费流水号', 'VARCHAR', 32, true, true, '', ''],
  [15, 'DE202', 'policy_no', '保单号', 'VARCHAR', 32, true, false, '', ''],
  [15, 'DE203', 'premium_amount', '保费金额', 'DECIMAL', 18, true, false, '', ''],
  [15, 'DE204', 'premium_type', '保费类型', 'VARCHAR', 4, true, false, '', ''],
  [15, 'DE205', 'charge_date', '收费日期', 'DATE', 8, true, false, '', ''],
  [18, 'DE231', 'claim_no', '赔案号', 'VARCHAR', 32, true, true, '', ''],
  [18, 'DE232', 'policy_no', '保单号', 'VARCHAR', 32, true, false, '', ''],
  [18, 'DE233', 'accident_date', '出险日期', 'DATE', 8, true, false, '', ''],
  [18, 'DE234', 'claim_amount', '赔付金额', 'DECIMAL', 18, true, false, '', ''],
  [18, 'DE235', 'claim_status', '赔案状态', 'VARCHAR', 4, true, false, '', ''],
  [27, 'DE271', 'employee_no', '从业人员编号', 'VARCHAR', 32, true, true, '', ''],
  [27, 'DE272', 'employee_name', '从业人员姓名', 'VARCHAR', 64, true, false, 'MASK', '前1后1'],
  [27, 'DE273', 'cert_no', '证件号码', 'VARCHAR', 32, true, false, 'MASK', '前3后4'],
  [27, 'DE274', 'mobile', '手机号码', 'VARCHAR', 20, true, false, 'MASK', '前3后4'],
  [27, 'DE275', 'branch_code', '所属机构编码', 'VARCHAR', 16, true, false, '', '']
]

export const metaColumnTable = defineTable<MetaColumnRow>(
  'cr.metaColumn',
  columnSpecs.map((spec, index) => {
    const [
      tableId,
      columnCode,
      columnName,
      cnName,
      dataType,
      dataLength,
      required,
      primaryKey,
      desensitizeRule,
      desensitizeParam
    ] = spec
    const table = metaTableTable.get(tableId)
    return {
      id: index + 1,
      tableId,
      tableName: table?.tableName || '',
      cnTableName: table?.cnName || '',
      columnCode,
      columnName,
      cnName,
      dataType,
      dataLength,
      required,
      primaryKey,
      desensitizeRule,
      desensitizeParam,
      status: 0,
      remark: '',
      createTime: '2024-01-01 11:30:00'
    }
  })
)

/* ==================================================================
 * 报表（表样）
 * ================================================================== */
export interface ReportRow {
  id: number
  reportCode: string
  reportName: string
  subjectId: number
  subjectName: string
  tableId: number
  tableName: string
  /** 数据频度：见字典 cr_report_freq */
  freq: number
  /** 报送业务口径 */
  caliber: string
  status: number
  remark: string
  createTime: string
}

const reportRows: Array<[string, string, number, number, number, string]> = [
  ['BX001', '人身险公司商保年金业务统计表', 1, 1, 3, '按保单生效日期统计，含年金给付与准备金余额'],
  ['BX002', '人身险保单状态统计表', 1, 2, 3, '按保单状态变更日期统计'],
  ['BX003', '保单贷款业务统计表', 1, 3, 3, '含贷款金额、利息与未还余额'],
  ['BX004', '保单退保业务统计表', 1, 4, 3, '含退保金额与退保原因'],
  ['BX005', '投保人基本信息表', 2, 5, 3, '按投保人编号去重上报'],
  ['BX006', '投保人联系方式表', 2, 6, 3, '手机号、邮箱需按监管要求脱敏'],
  ['BX007', '被保险人基本信息表', 3, 8, 3, '证件号码需脱敏后上报'],
  ['BX008', '被保险人职业信息表', 3, 9, 3, '含职业类别与风险等级'],
  ['BX009', '受益人信息表', 4, 11, 3, '含受益顺序与受益比例'],
  ['BX010', '险种定义表', 5, 13, 6, '按年度全量上报'],
  ['BX011', '保费收入统计表', 6, 15, 3, '按收费日期统计，区分新单与续期'],
  ['BX012', '缴费信息表', 6, 16, 3, '含缴费方式与缴费频率'],
  ['BX013', '赔案信息表', 7, 18, 3, '按出险日期统计'],
  ['BX014', '赔付支出统计表', 7, 19, 3, '含赔付金额与赔付方式'],
  ['BX015', '责任准备金余额表', 8, 21, 4, '按季计提，期末余额'],
  ['BX016', '销售渠道信息表', 9, 23, 6, '按年度全量上报'],
  ['BX017', '中介机构合作情况表', 10, 25, 3, '含手续费与合作协议信息'],
  ['BX018', '从业人员信息表', 11, 27, 3, '含姓名、证件号（脱敏）与所属机构']
]

export const reportTable = defineTable<ReportRow>(
  'cr.report',
  reportRows.map(([reportCode, reportName, subjectId, tableId, freq, caliber], index) => {
    const subject = subjectTable.get(subjectId)
    const table = metaTableTable.get(tableId)
    return {
      id: index + 1,
      reportCode,
      reportName,
      subjectId,
      subjectName: subject?.subjectName || '',
      tableId,
      tableName: table?.cnName || '',
      freq,
      caliber,
      status: 0,
      remark: '',
      createTime: '2024-01-02 09:00:00'
    }
  })
)

/* ==================================================================
 * 报表任务模板
 * ================================================================== */
export interface TaskTemplateRow {
  id: number
  templateCode: string
  templateName: string
  /** 数据频度 */
  freq: number
  /** 报送期次（如 202608） */
  period: string
  /** 开始日期 */
  startDate: string
  /** 截止日期 */
  deadline: string
  /** 关联报表 id 列表 */
  reportIds: number[]
  /** 报表数量（冗余，便于列表展示） */
  reportCount: number
  status: number
  remark: string
  createTime: string
}

export const taskTemplateTable = defineTable<TaskTemplateRow>('cr.taskTemplate', [
  {
    id: 1,
    templateCode: 'RW20260801',
    templateName: '2026年8月新统信月报任务',
    freq: 3,
    period: '202608',
    startDate: '2026-09-01',
    deadline: '2026-09-15',
    reportIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 17, 18],
    reportCount: 15,
    status: 0,
    remark: '按月报送，分两批：资产类 / 业务类',
    createTime: '2026-09-01 09:00:00'
  },
  {
    id: 2,
    templateCode: 'RW20260701',
    templateName: '2026年7月新统信月报任务',
    freq: 3,
    period: '202607',
    startDate: '2026-08-01',
    deadline: '2026-08-15',
    reportIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14],
    reportCount: 13,
    status: 0,
    remark: '',
    createTime: '2026-08-01 09:00:00'
  },
  {
    id: 3,
    templateCode: 'RJ2026Q301',
    templateName: '2026年三季度责任准备金季报任务',
    freq: 4,
    period: '2026Q3',
    startDate: '2026-10-01',
    deadline: '2026-10-20',
    reportIds: [15],
    reportCount: 1,
    status: 0,
    remark: '季报，仅责任准备金相关报表',
    createTime: '2026-09-05 09:00:00'
  },
  {
    id: 4,
    templateCode: 'RN20260101',
    templateName: '2026年度全量报送任务',
    freq: 6,
    period: '2026',
    startDate: '2027-01-10',
    deadline: '2027-02-28',
    reportIds: [10, 16],
    reportCount: 2,
    status: 1,
    remark: '年报任务，待 2027 年初启动',
    createTime: '2026-09-05 09:10:00'
  },
  {
    id: 5,
    templateCode: 'RW20260901',
    templateName: '2026年9月新统信月报任务',
    freq: 3,
    period: '202609',
    startDate: '2026-10-01',
    deadline: '2026-10-15',
    reportIds: [],
    reportCount: 0,
    status: 1,
    remark: '待添加报表',
    createTime: '2026-09-11 15:00:00'
  }
])
