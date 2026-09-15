/**
 * Mock 种子数据 — 报文配置域（菜单「报文配置」/cr-message 下 5 个页面）
 *
 * | 页面           | 数据表                                        |
 * | -------------- | --------------------------------------------- |
 * | 报表定制       | cr.reportCustom + cr.reportCustomItem         |
 * | 报文信息管理   | cr.messageInfo                                |
 * | 口径信息配置   | cr.caliber                                    |
 * | 报文集配置     | cr.reportSet                                  |
 * | 填报人管理     | cr.fillerAssign                               |
 *
 * 与已有域的关系：
 * - 报表 / 数据表 / 字段全部取自 db/cr.ts（报表 18 张、数据表 27 张、字段 41 个），不另起一套。
 * - 报文集「生成报文」会真实写入 db/crSubmit.ts 的 cr.submitStatus（报文状态查询可见）。
 *
 * 已知简化：27 张数据表里只有 7 张（T01/T05/T06/T08/T15/T18/T27）在「列管理」中铺了完整字段，
 * 其余表在本文件用 GENERIC_COLUMNS 生成一组通用演示字段，保证报表定制对任意报表都可演示。
 */
import { defineTable } from '../store'
import { metaColumnTable, metaTableTable, reportTable } from './cr'
import { PERIOD, reportOrgs } from './crCommon'

/* ==================================================================
 * 公共取数辅助
 * ================================================================== */

/** 通用演示字段（仅用于「列管理」里没有铺字段的数据表） */
const GENERIC_COLUMNS: Array<[string, string, string, boolean]> = [
  ['org_code', '机构代码', 'VARCHAR', true],
  ['data_date', '数据日期', 'DATE', true],
  ['biz_no', '业务主键', 'VARCHAR', true],
  ['biz_type', '业务类型', 'VARCHAR', true],
  ['product_code', '险种编码', 'VARCHAR', false],
  ['amount', '金额', 'DECIMAL', true],
  ['quantity', '笔数', 'INT', false],
  ['biz_status', '业务状态', 'VARCHAR', false]
]

export interface ColumnOption {
  columnCode: string
  columnName: string
  cnName: string
  dataType: string
  required: boolean
}

/** 某张数据表可定制的字段（优先取「列管理」的真实字段，缺失时退回通用演示字段） */
export const columnsOfTable = (tableId: number): ColumnOption[] => {
  const real = metaColumnTable
    .all()
    .filter((column) => Number(column.tableId) === Number(tableId))
    .sort((a, b) => a.id - b.id)
  if (real.length) {
    return real.map((column) => ({
      columnCode: column.columnCode,
      columnName: column.columnName,
      cnName: column.cnName,
      dataType: column.dataType,
      required: column.required
    }))
  }
  const prefix = 900 + Number(tableId)
  return GENERIC_COLUMNS.map(([columnName, cnName, dataType, required], index) => ({
    columnCode: 'DE' + prefix + String(index + 1).padStart(2, '0'),
    columnName,
    cnName,
    dataType,
    required
  }))
}

/** 数据表名称信息 */
export const tableNameOf = (tableId: number) => {
  const table = metaTableTable.get(Number(tableId))
  return {
    cnName: table?.cnName || '',
    tableCode: table?.tableCode || '',
    tableName: table?.tableName || ''
  }
}

/* ==================================================================
 * 一、报表定制（cr.reportCustom）+ 定制字段明细（cr.reportCustomItem）
 * ================================================================== */

export interface ReportCustomRow {
  id: number
  /** 定制编码 */
  customCode: string
  /** 定制名称 */
  customName: string
  reportId: number
  reportCode: string
  reportName: string
  /** 数据频度，见字典 cr_report_freq */
  freq: number
  /** 取数数据表 */
  dataTableId: number
  dataTableCode: string
  dataTableName: string
  /** 定制字段数 */
  columnCount: number
  /** 取数范围说明 */
  dataScope: string
  /** 版本号 */
  version: string
  /** 生效日期 */
  effectDate: string
  status: number
  remark: string
  createTime: string
}

export interface ReportCustomItemRow {
  id: number
  customId: number
  columnCode: string
  columnName: string
  cnName: string
  dataType: string
  required: boolean
  /** 加工方式：DIRECT 直接取值 / SUM 汇总 / COUNT 计数 / CODE 码值转换 */
  transform: string
  sortNo: number
  remark: string
}

interface CustomSpec {
  customCode: string
  customName: string
  reportId: number
  dataScope: string
  version: string
  effectDate: string
  status: number
  remark: string
  createTime: string
}

const customSpecs: CustomSpec[] = [
  {
    customCode: 'DZ20260801',
    customName: '商保年金业务月度取数定制',
    reportId: 1,
    dataScope: '全部报送机构',
    version: 'V1.2',
    effectDate: '2026-08-01',
    status: 0,
    remark: '按保单生效日期切分，含年金给付与准备金余额',
    createTime: '2026-08-01 09:20:00'
  },
  {
    customCode: 'DZ20260802',
    customName: '保单状态变更月度取数定制',
    reportId: 2,
    dataScope: '全部报送机构',
    version: 'V1.1',
    effectDate: '2026-08-01',
    status: 0,
    remark: '仅取当期发生状态变更的保单',
    createTime: '2026-08-01 09:26:00'
  },
  {
    customCode: 'DZ20260803',
    customName: '保单贷款业务取数定制',
    reportId: 3,
    dataScope: '北京、上海分公司',
    version: 'V1.0',
    effectDate: '2026-08-05',
    status: 0,
    remark: '贷款本金与利息分列，未还余额取期末值',
    createTime: '2026-08-05 10:02:00'
  },
  {
    customCode: 'DZ20260804',
    customName: '退保业务取数定制',
    reportId: 4,
    dataScope: '全部报送机构',
    version: 'V1.0',
    effectDate: '2026-08-05',
    status: 0,
    remark: '含退保原因与犹豫期退保标识',
    createTime: '2026-08-05 10:08:00'
  },
  {
    customCode: 'DZ20260805',
    customName: '投保人信息月度取数定制',
    reportId: 5,
    dataScope: '全部报送机构',
    version: 'V2.0',
    effectDate: '2026-07-01',
    status: 0,
    remark: '手机号 / 证件号按监管要求脱敏后报送',
    createTime: '2026-07-01 09:40:00'
  },
  {
    customCode: 'DZ20260806',
    customName: '保费收入月度取数定制',
    reportId: 11,
    dataScope: '全部报送机构',
    version: 'V1.3',
    effectDate: '2026-08-01',
    status: 0,
    remark: '区分新单与续期，按收费日期归集',
    createTime: '2026-08-01 10:15:00'
  },
  {
    customCode: 'DZ20260807',
    customName: '赔案信息月度取数定制',
    reportId: 13,
    dataScope: '全部报送机构',
    version: 'V1.0',
    effectDate: '2026-08-01',
    status: 0,
    remark: '按出险日期归集，含未决赔案',
    createTime: '2026-08-01 10:22:00'
  },
  {
    customCode: 'DZ2026Q301',
    customName: '责任准备金余额季报定制',
    reportId: 15,
    dataScope: '总公司本级',
    version: 'V1.1',
    effectDate: '2026-07-01',
    status: 0,
    remark: '精算部出具，按季末评估口径取数',
    createTime: '2026-07-02 09:05:00'
  },
  {
    customCode: 'DZ2026N001',
    customName: '从业人员信息年度定制',
    reportId: 18,
    dataScope: '全部报送机构',
    version: 'V1.0',
    effectDate: '2026-01-10',
    status: 0,
    remark: '含姓名、证件号（脱敏）与所属机构',
    createTime: '2026-01-10 09:30:00'
  },
  {
    customCode: 'DZ20260810',
    customName: '中介机构合作情况取数定制',
    reportId: 17,
    dataScope: '全部报送机构',
    version: 'V0.9',
    effectDate: '2026-09-01',
    status: 1,
    remark: '试运行版本，暂未启用',
    createTime: '2026-09-01 15:40:00'
  }
]

/** 加工方式轮转，保证每份定制里各种加工方式都有样例 */
const TRANSFORMS = ['DIRECT', 'SUM', 'COUNT', 'CODE']

const customRows: ReportCustomRow[] = customSpecs.map((spec, index) => {
  const report = reportTable.get(spec.reportId)!
  const tableId = Number(report.tableId)
  const table = tableNameOf(tableId)
  return {
    id: index + 1,
    customCode: spec.customCode,
    customName: spec.customName,
    reportId: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName,
    freq: report.freq,
    dataTableId: tableId,
    dataTableCode: table.tableCode,
    dataTableName: table.cnName,
    columnCount: columnsOfTable(tableId).length,
    dataScope: spec.dataScope,
    version: spec.version,
    effectDate: spec.effectDate,
    status: spec.status,
    remark: spec.remark,
    createTime: spec.createTime
  }
})

export const reportCustomTable = defineTable<ReportCustomRow>('cr.reportCustom', customRows)

let customItemId = 1
const customItemSeed: ReportCustomItemRow[] = []
customRows.forEach((custom) => {
  columnsOfTable(custom.dataTableId).forEach((column, index) => {
    customItemSeed.push({
      id: customItemId++,
      customId: custom.id,
      columnCode: column.columnCode,
      columnName: column.columnName,
      cnName: column.cnName,
      dataType: column.dataType,
      required: column.required,
      transform: TRANSFORMS[index % TRANSFORMS.length],
      sortNo: index + 1,
      remark: index % 4 === 2 ? '需按机构维度汇总后报送' : ''
    })
  })
})

export const reportCustomItemTable = defineTable<ReportCustomItemRow>(
  'cr.reportCustomItem',
  customItemSeed
)

/* ==================================================================
 * 二、报文信息（cr.messageInfo）
 * ================================================================== */

export interface MessageInfoRow {
  id: number
  /** 报文编码 */
  messageCode: string
  /** 报文名称 */
  messageName: string
  /** 报文类型：TXT / XML / CSV，见字典 cr_message_type */
  messageType: string
  /** 数据频度 */
  freq: number
  /** 适用期次 */
  period: string
  /** 关联报表 */
  reportIds: number[]
  reportCount: number
  /** 涉及数据表数量 */
  tableCount: number
  /** 涉及字段数量 */
  columnCount: number
  /** 报文版本 */
  version: string
  /** 监管文号 */
  regulatoryRef: string
  /** 表头行数 */
  headerRows: number
  /** 是否含报尾（报尾含总记录数校验） */
  tailFlag: boolean
  effectDate: string
  status: number
  remark: string
  createTime: string
}

interface MessageSpec {
  messageCode: string
  messageName: string
  messageType: string
  freq: number
  period: string
  reportIds: number[]
  version: string
  regulatoryRef: string
  headerRows: number
  tailFlag: boolean
  effectDate: string
  status: number
  remark: string
  createTime: string
}

const messageSpecs: MessageSpec[] = [
  {
    messageCode: 'MB20260801',
    messageName: '人身险业务月报报文',
    messageType: 'TXT',
    freq: 3,
    period: PERIOD,
    reportIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13],
    version: 'V1.2',
    regulatoryRef: '金融监管总局统信〔2026〕12号',
    headerRows: 1,
    tailFlag: true,
    effectDate: '2026-08-01',
    status: 0,
    remark: '竖线分隔、UTF-8、首行表头，报尾含记录数校验位',
    createTime: '2026-08-01 09:00:00'
  },
  {
    messageCode: 'MB20260802',
    messageName: '人身险业务月报报文（XML 版）',
    messageType: 'XML',
    freq: 3,
    period: PERIOD,
    reportIds: [1, 2, 5, 11, 13],
    version: 'V1.0',
    regulatoryRef: '金融监管总局统信〔2026〕12号',
    headerRows: 0,
    tailFlag: false,
    effectDate: '2026-08-10',
    status: 0,
    remark: '供监管前置机 XML 校验通道使用，字段名与列管理一致',
    createTime: '2026-08-10 14:20:00'
  },
  {
    messageCode: 'MB2026Q301',
    messageName: '责任准备金季报报文',
    messageType: 'XML',
    freq: 4,
    period: '2026Q3',
    reportIds: [15],
    version: 'V1.0',
    regulatoryRef: '金融监管总局统信〔2026〕31号',
    headerRows: 0,
    tailFlag: false,
    effectDate: '2026-10-01',
    status: 0,
    remark: '精算部出具，随季报一并报送',
    createTime: '2026-09-05 11:05:00'
  },
  {
    messageCode: 'MB2026N001',
    messageName: '年度全量报文',
    messageType: 'CSV',
    freq: 6,
    period: '2026',
    reportIds: [10, 16],
    version: 'V1.0',
    regulatoryRef: '金融监管总局统信〔2026〕05号',
    headerRows: 1,
    tailFlag: false,
    effectDate: '2027-01-10',
    status: 1,
    remark: '年报任务启动后启用',
    createTime: '2026-09-05 11:12:00'
  },
  {
    messageCode: 'MB20260804',
    messageName: '从业人员信息专项报文',
    messageType: 'TXT',
    freq: 3,
    period: PERIOD,
    reportIds: [18],
    version: 'V1.1',
    regulatoryRef: '金融监管总局人身险司函〔2026〕88号',
    headerRows: 1,
    tailFlag: true,
    effectDate: '2026-08-01',
    status: 0,
    remark: '姓名与证件号按列管理的脱敏规则处理后报送',
    createTime: '2026-08-02 09:35:00'
  },
  {
    messageCode: 'MB20260805',
    messageName: '中介机构合作情况报文',
    messageType: 'TXT',
    freq: 3,
    period: PERIOD,
    reportIds: [17],
    version: 'V1.0',
    regulatoryRef: '金融监管总局中介监管〔2026〕17号',
    headerRows: 1,
    tailFlag: true,
    effectDate: '2026-08-01',
    status: 0,
    remark: '含手续费与合作协议有效期',
    createTime: '2026-08-02 09:42:00'
  }
]

const messageRows: MessageInfoRow[] = messageSpecs.map((spec, index) => {
  const tableIds = new Set(
    spec.reportIds.map((reportId) => Number(reportTable.get(reportId)?.tableId || 0))
  )
  const columnCount = [...tableIds].reduce(
    (total, tableId) => total + columnsOfTable(tableId).length,
    0
  )
  return {
    id: index + 1,
    messageCode: spec.messageCode,
    messageName: spec.messageName,
    messageType: spec.messageType,
    freq: spec.freq,
    period: spec.period,
    reportIds: spec.reportIds,
    reportCount: spec.reportIds.length,
    tableCount: tableIds.size,
    columnCount,
    version: spec.version,
    regulatoryRef: spec.regulatoryRef,
    headerRows: spec.headerRows,
    tailFlag: spec.tailFlag,
    effectDate: spec.effectDate,
    status: spec.status,
    remark: spec.remark,
    createTime: spec.createTime
  }
})

export const messageInfoTable = defineTable<MessageInfoRow>('cr.messageInfo', messageRows)

/* ==================================================================
 * 三、口径信息（cr.caliber）
 * ================================================================== */

export interface CaliberRow {
  id: number
  /** 口径编码 */
  caliberCode: string
  /** 口径名称 */
  caliberName: string
  /** 口径类型：1 取数口径 / 2 计算口径 / 3 汇总口径 / 4 折算口径，见字典 cr_caliber_type */
  caliberType: number
  reportId: number
  reportCode: string
  reportName: string
  /** 指标编码 */
  targetCode: string
  /** 指标名称 */
  targetName: string
  /** 来源表 */
  sourceTable: string
  /** 来源字段 */
  sourceField: string
  /** 取数规则 / 计算公式 */
  formula: string
  /** 责任部门 */
  owner: string
  version: string
  effectDate: string
  status: number
  remark: string
  createTime: string
}

interface CaliberSpec {
  caliberCode: string
  caliberName: string
  caliberType: number
  reportId: number
  targetCode: string
  targetName: string
  sourceTable: string
  sourceField: string
  formula: string
  owner: string
  version: string
  effectDate: string
  status: number
  remark: string
  createTime: string
}

const caliberSpecs: CaliberSpec[] = [
  {
    caliberCode: 'KJ001',
    caliberName: '新单保费收入口径',
    caliberType: 1,
    reportId: 11,
    targetCode: 'ZB001',
    targetName: '本期新单保费收入',
    sourceTable: '保费信息表',
    sourceField: 'premium_amount',
    formula: "SUM(premium_amount) WHERE premium_type = 'NB' AND charge_date BETWEEN 期初 AND 期末",
    owner: '财务部',
    version: 'V1.2',
    effectDate: '2026-08-01',
    status: 0,
    remark: '不含批退与契撤件，单位：元，保留两位小数',
    createTime: '2026-08-01 10:30:00'
  },
  {
    caliberCode: 'KJ002',
    caliberName: '续期保费收入口径',
    caliberType: 1,
    reportId: 11,
    targetCode: 'ZB002',
    targetName: '本期续期保费收入',
    sourceTable: '保费信息表',
    sourceField: 'premium_amount',
    formula: "SUM(premium_amount) WHERE premium_type = 'RN' AND charge_date BETWEEN 期初 AND 期末",
    owner: '财务部',
    version: 'V1.1',
    effectDate: '2026-08-01',
    status: 0,
    remark: '与业务系统「收费确认」口径保持一致',
    createTime: '2026-08-01 10:34:00'
  },
  {
    caliberCode: 'KJ003',
    caliberName: '退保率口径',
    caliberType: 2,
    reportId: 4,
    targetCode: 'ZB003',
    targetName: '当期退保率',
    sourceTable: '保单退保信息表',
    sourceField: 'surrender_amount',
    formula: '当期退保金额 / 期初责任准备金余额 × 100%',
    owner: '精算部',
    version: 'V2.0',
    effectDate: '2026-07-01',
    status: 0,
    remark: '分母取上季度末评估口径的责任准备金余额',
    createTime: '2026-07-01 11:00:00'
  },
  {
    caliberCode: 'KJ004',
    caliberName: '综合赔付率口径',
    caliberType: 2,
    reportId: 14,
    targetCode: 'ZB004',
    targetName: '综合赔付率',
    sourceTable: '赔付信息表',
    sourceField: 'claim_amount',
    formula: '(赔付支出 + 未决赔款准备金变动) / 已赚保费 × 100%',
    owner: '精算部',
    version: 'V1.3',
    effectDate: '2026-08-01',
    status: 0,
    remark: '年化处理后方可与监管口径对比',
    createTime: '2026-08-01 11:08:00'
  },
  {
    caliberCode: 'KJ005',
    caliberName: '13 个月保单继续率口径',
    caliberType: 2,
    reportId: 1,
    targetCode: 'ZB005',
    targetName: '13 个月继续率',
    sourceTable: '人身险保单基本信息表',
    sourceField: 'policy_status',
    formula: '13 个月后仍有效的保单件数 / 13 个月前承保件数 × 100%',
    owner: '个险业务部',
    version: 'V1.0',
    effectDate: '2026-06-01',
    status: 0,
    remark: '剔除死亡、全残等责任终止件',
    createTime: '2026-06-01 09:50:00'
  },
  {
    caliberCode: 'KJ006',
    caliberName: '责任准备金余额口径',
    caliberType: 1,
    reportId: 15,
    targetCode: 'ZB006',
    targetName: '期末责任准备金余额',
    sourceTable: '责任准备金计提表',
    sourceField: 'reserve_amount',
    formula: '按评估日取最近一次计提结果，不做跨期累加',
    owner: '精算部',
    version: 'V1.1',
    effectDate: '2026-07-01',
    status: 0,
    remark: '与偿付能力报告口径一致',
    createTime: '2026-07-01 13:20:00'
  },
  {
    caliberCode: 'KJ007',
    caliberName: '手续费及佣金支出口径',
    caliberType: 1,
    reportId: 17,
    targetCode: 'ZB007',
    targetName: '当期手续费及佣金支出',
    sourceTable: '机构合作信息表',
    sourceField: 'commission_amount',
    formula: 'SUM(commission_amount) WHERE settle_date BETWEEN 期初 AND 期末',
    owner: '银保业务部',
    version: 'V1.0',
    effectDate: '2026-08-01',
    status: 0,
    remark: '含直接佣金与附加佣金',
    createTime: '2026-08-02 09:15:00'
  },
  {
    caliberCode: 'KJ008',
    caliberName: '有效保单件数口径',
    caliberType: 3,
    reportId: 2,
    targetCode: 'ZB008',
    targetName: '期末有效保单件数',
    sourceTable: '保单状态变更表',
    sourceField: 'policy_no',
    formula: 'COUNT(DISTINCT policy_no) WHERE policy_status IN (有效 / 交费期内)',
    owner: '运营管理部',
    version: 'V1.0',
    effectDate: '2026-08-01',
    status: 0,
    remark: '按保单号去重，不含失效与终止件',
    createTime: '2026-08-02 09:22:00'
  },
  {
    caliberCode: 'KJ009',
    caliberName: '平均保额口径',
    caliberType: 2,
    reportId: 1,
    targetCode: 'ZB009',
    targetName: '件均保险金额',
    sourceTable: '人身险保单基本信息表',
    sourceField: 'sum_assured',
    formula: 'SUM(sum_assured) / COUNT(policy_no)',
    owner: '个险业务部',
    version: 'V1.0',
    effectDate: '2026-06-01',
    status: 0,
    remark: '新增件均与存量件均分列报送',
    createTime: '2026-06-01 10:05:00'
  },
  {
    caliberCode: 'KJ010',
    caliberName: '销售渠道保费占比口径',
    caliberType: 3,
    reportId: 16,
    targetCode: 'ZB010',
    targetName: '各渠道保费占比',
    sourceTable: '销售渠道信息表',
    sourceField: 'premium_amount',
    formula: '按 channel_code 分组汇总后 / 全部渠道合计 × 100%',
    owner: '银保业务部',
    version: 'V1.0',
    effectDate: '2026-06-01',
    status: 0,
    remark: '渠道编码须与监管码值表一致',
    createTime: '2026-06-01 10:12:00'
  }
]

const caliberRows: CaliberRow[] = caliberSpecs.map((spec, index) => {
  const report = reportTable.get(spec.reportId)!
  return {
    id: index + 1,
    ...spec,
    reportCode: report.reportCode,
    reportName: report.reportName
  }
})

export const caliberTable = defineTable<CaliberRow>('cr.caliber', caliberRows)

/* ==================================================================
 * 四、报文集（cr.reportSet）
 * ================================================================== */

export interface ReportSetRow {
  id: number
  /** 报文集编码 */
  setCode: string
  /** 报文集名称 */
  setName: string
  /** 数据频度 */
  freq: number
  /** 适用期次 */
  period: string
  /** 报送机构范围：ALL 或机构 id 逗号串 */
  orgScope: string
  /** 机构范围展示名 */
  orgNames: string
  /** 关联报文信息 */
  messageId?: number
  messageCode: string
  /** 报表集合 */
  reportIds: number[]
  reportCount: number
  /** 是否压缩后报送 */
  compress: boolean
  status: number
  remark: string
  createTime: string
}

interface ReportSetSpec {
  setCode: string
  setName: string
  freq: number
  period: string
  orgScope: string
  messageCode: string
  reportIds: number[]
  compress: boolean
  status: number
  remark: string
  createTime: string
}

const reportSetSpecs: ReportSetSpec[] = [
  {
    setCode: 'BWJ20260801',
    setName: '2026年8月人身险月报报文集',
    freq: 3,
    period: PERIOD,
    orgScope: '11,12,13,14',
    messageCode: 'MB20260801',
    reportIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13],
    compress: false,
    status: 0,
    remark: '当期主报送批次，四家分公司按机构分别生成报文',
    createTime: '2026-08-28 09:00:00'
  },
  {
    setCode: 'BWJ20260802',
    setName: '2026年8月资产类报表报文集',
    freq: 3,
    period: PERIOD,
    orgScope: '11,12',
    messageCode: 'MB20260802',
    reportIds: [1, 2, 5, 11],
    compress: true,
    status: 0,
    remark: '北京 / 上海先行试点 XML 报文',
    createTime: '2026-08-28 09:12:00'
  },
  {
    setCode: 'BWJ20260803',
    setName: '2026年8月从业人员专项报文集',
    freq: 3,
    period: PERIOD,
    orgScope: '11,12,13,14',
    messageCode: 'MB20260804',
    reportIds: [18],
    compress: false,
    status: 0,
    remark: '按人力条线单独报送，与月报并行',
    createTime: '2026-08-28 09:20:00'
  },
  {
    setCode: 'BWJ2026Q301',
    setName: '2026年三季度责任准备金报文集',
    freq: 4,
    period: '2026Q3',
    orgScope: '1',
    messageCode: 'MB2026Q301',
    reportIds: [15],
    compress: false,
    status: 0,
    remark: '总公司本级报送，精算部出具',
    createTime: '2026-09-05 11:20:00'
  },
  {
    setCode: 'BWJ2026N001',
    setName: '2026年度全量报文集',
    freq: 6,
    period: '2026',
    orgScope: 'ALL',
    messageCode: 'MB2026N001',
    reportIds: [10, 16],
    compress: true,
    status: 1,
    remark: '年报任务启动后启用',
    createTime: '2026-09-05 11:26:00'
  }
]

const orgNameMap = (scope: string): string => {
  if (scope === 'ALL') return '全部报送机构'
  return scope
    .split(',')
    .map((id) => reportOrgs().find((org) => String(org.id) === String(id.trim()))?.orgName || '')
    .filter(Boolean)
    .join('、')
}

const reportSetRows: ReportSetRow[] = reportSetSpecs.map((spec, index) => {
  const message = messageRows.find((row) => row.messageCode === spec.messageCode)
  return {
    id: index + 1,
    setCode: spec.setCode,
    setName: spec.setName,
    freq: spec.freq,
    period: spec.period,
    orgScope: spec.orgScope,
    orgNames: orgNameMap(spec.orgScope),
    messageId: message?.id,
    messageCode: spec.messageCode,
    reportIds: spec.reportIds,
    reportCount: spec.reportIds.length,
    compress: spec.compress,
    status: spec.status,
    remark: spec.remark,
    createTime: spec.createTime
  }
})

export const reportSetTable = defineTable<ReportSetRow>('cr.reportSet', reportSetRows)

/* ==================================================================
 * 五、填报人管理（cr.fillerAssign）
 * ================================================================== */

export interface FillerAssignRow {
  id: number
  orgId: number
  orgName: string
  /** 报表 id；0 表示该机构全部报表 */
  reportId: number
  reportCode: string
  reportName: string
  /** 数据频度；0 表示不限频度 */
  freq: number
  fillerId: number
  fillerName: string
  reviewerId: number
  reviewerName: string
  effectiveDate: string
  expireDate: string
  status: number
  remark: string
  createTime: string
}

interface FillerSpec {
  orgId: number
  reportId: number
  freq: number
  fillerId: number
  fillerName: string
  reviewerId: number
  reviewerName: string
  effectiveDate: string
  expireDate: string
  status: number
  remark: string
  createTime: string
}

const fillerSpecs: FillerSpec[] = [
  {
    orgId: 11,
    reportId: 0,
    freq: 0,
    fillerId: 9,
    fillerName: '周北京',
    reviewerId: 8,
    reviewerName: '孙风险',
    effectiveDate: '2026-01-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '北京分公司全部报表统一由个险业务部填报',
    createTime: '2026-01-05 09:10:00'
  },
  {
    orgId: 12,
    reportId: 0,
    freq: 0,
    fillerId: 10,
    fillerName: '吴上海',
    reviewerId: 8,
    reviewerName: '孙风险',
    effectiveDate: '2026-01-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '',
    createTime: '2026-01-05 09:12:00'
  },
  {
    orgId: 13,
    reportId: 0,
    freq: 0,
    fillerId: 11,
    fillerName: '郑江苏',
    reviewerId: 12,
    reviewerName: '黄粤生',
    effectiveDate: '2026-01-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '',
    createTime: '2026-01-05 09:14:00'
  },
  {
    orgId: 14,
    reportId: 0,
    freq: 0,
    fillerId: 2,
    fillerName: '张天报',
    reviewerId: 3,
    reviewerName: '李复华',
    effectiveDate: '2026-01-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '广东分公司暂由总公司填报岗代填',
    createTime: '2026-01-05 09:16:00'
  },
  {
    orgId: 1,
    reportId: 11,
    freq: 3,
    fillerId: 5,
    fillerName: '李银芬',
    reviewerId: 6,
    reviewerName: '陈精算',
    effectiveDate: '2026-08-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '银保条线保费收入由银保业务部填报',
    createTime: '2026-08-01 10:40:00'
  },
  {
    orgId: 1,
    reportId: 15,
    freq: 4,
    fillerId: 6,
    fillerName: '陈精算',
    reviewerId: 7,
    reviewerName: '赵财务',
    effectiveDate: '2026-07-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '责任准备金由精算部填报、财务部复核',
    createTime: '2026-07-01 14:05:00'
  },
  {
    orgId: 1,
    reportId: 18,
    freq: 3,
    fillerId: 7,
    fillerName: '赵财务',
    reviewerId: 6,
    reviewerName: '陈精算',
    effectiveDate: '2026-01-10',
    expireDate: '2026-12-31',
    status: 0,
    remark: '从业人员信息由人力资源条线归口',
    createTime: '2026-01-10 10:00:00'
  },
  {
    orgId: 1,
    reportId: 17,
    freq: 3,
    fillerId: 5,
    fillerName: '李银芬',
    reviewerId: 3,
    reviewerName: '李复华',
    effectiveDate: '2026-08-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '中介机构合作情况由银保业务部填报',
    createTime: '2026-08-01 10:48:00'
  },
  {
    orgId: 11,
    reportId: 1,
    freq: 3,
    fillerId: 9,
    fillerName: '周北京',
    reviewerId: 2,
    reviewerName: '张天报',
    effectiveDate: '2026-08-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '报表级指派覆盖机构级默认指派',
    createTime: '2026-08-01 11:02:00'
  },
  {
    orgId: 11,
    reportId: 18,
    freq: 3,
    fillerId: 2,
    fillerName: '张天报',
    reviewerId: 3,
    reviewerName: '李复华',
    effectiveDate: '2026-08-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '',
    createTime: '2026-08-01 11:06:00'
  },
  {
    orgId: 12,
    reportId: 15,
    freq: 4,
    fillerId: 10,
    fillerName: '吴上海',
    reviewerId: 8,
    reviewerName: '孙风险',
    effectiveDate: '2026-07-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '',
    createTime: '2026-07-02 09:30:00'
  },
  {
    orgId: 13,
    reportId: 12,
    freq: 3,
    fillerId: 11,
    fillerName: '郑江苏',
    reviewerId: 12,
    reviewerName: '黄粤生',
    effectiveDate: '2026-08-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '',
    createTime: '2026-08-01 11:15:00'
  },
  {
    orgId: 14,
    reportId: 13,
    freq: 3,
    fillerId: 12,
    fillerName: '黄粤生',
    reviewerId: 3,
    reviewerName: '李复华',
    effectiveDate: '2026-08-01',
    expireDate: '2026-12-31',
    status: 0,
    remark: '赔案信息由广东分公司自行填报',
    createTime: '2026-08-01 11:20:00'
  },
  {
    orgId: 14,
    reportId: 3,
    freq: 3,
    fillerId: 10,
    fillerName: '吴上海',
    reviewerId: 8,
    reviewerName: '孙风险',
    effectiveDate: '2026-08-01',
    expireDate: '2026-10-31',
    status: 1,
    remark: '临时支援期已结束，停用',
    createTime: '2026-08-01 11:26:00'
  }
]

const fillerRows: FillerAssignRow[] = fillerSpecs.map((spec, index) => {
  const org = reportOrgs().find((item) => item.id === spec.orgId)
  const report = spec.reportId ? reportTable.get(spec.reportId) : undefined
  return {
    id: index + 1,
    orgId: spec.orgId,
    orgName: org?.orgName || '',
    reportId: spec.reportId,
    reportCode: report?.reportCode || '',
    reportName: report?.reportName || '',
    freq: spec.freq,
    fillerId: spec.fillerId,
    fillerName: spec.fillerName,
    reviewerId: spec.reviewerId,
    reviewerName: spec.reviewerName,
    effectiveDate: spec.effectiveDate,
    expireDate: spec.expireDate,
    status: spec.status,
    remark: spec.remark,
    createTime: spec.createTime
  }
})

export const fillerAssignTable = defineTable<FillerAssignRow>('cr.fillerAssign', fillerRows)

/* ==================================================================
 * 六、公式 SQL 定制（报文配置章节的补充页，2026-09-13 补）
 *
 * 需求文档「系统配置操作」章只有一句「用于定义 SQL」，没有字段级说明 ——
 * 这里的字段与「试运行」校验规则都是**按通行做法提案**，页面上如实标注。
 * ================================================================== */
export interface SqlFormulaRow {
  id: number
  /** 公式编码（大写字母 / 数字 / 下划线） */
  code: string
  name: string
  /** 公式类型，见字典 cr_formula_type：1 取数公式 / 2 校验公式 / 3 指标计算 / 4 报表口径 */
  type: number
  /** SQL 正文（只允许 SELECT，试运行只解析不执行） */
  sqlText: string
  /** 应用对象：这条公式挂在哪张报表 / 数据集 / 校验规则上 */
  target: string
  /** 状态：0 停用 / 1 启用，见字典 cr_enable_status（注意 1 = 启用） */
  status: number
  remark: string
  createUser: string
  createTime: string
  updateUser: string
  updateTime: string
}

const formulaSeed: SqlFormulaRow[] = [
  {
    id: 1,
    code: 'F_PREMIUM_BY_CHANNEL',
    name: '保费收入按渠道汇总',
    type: 1,
    sqlText:
      'SELECT c.channel_name, SUM(p.premium) AS premium_sum\n  FROM premium_info p\n  JOIN channel_info c ON c.channel_code = p.channel_code\n WHERE p.data_date BETWEEN :beginDate AND :endDate\n GROUP BY c.channel_name',
    target: 'BX011 保费收入明细表',
    status: 1,
    remark: '取数公式：按销售渠道汇总保费，期次区间由调度参数传入',
    createUser: '系统管理员',
    createTime: '2026-08-28 10:00:00',
    updateUser: '系统管理员',
    updateTime: '2026-09-02 15:20:00'
  },
  {
    id: 2,
    code: 'F_CLAIM_RATIO',
    name: '赔付率指标计算',
    type: 3,
    sqlText:
      'SELECT org_code,\n       ROUND(SUM(paid_amount) / NULLIF(SUM(premium), 0) * 100, 2) AS claim_ratio\n  FROM claim_case\n WHERE period = :period\n GROUP BY org_code',
    target: '统计查询：报送数据量统计',
    status: 1,
    remark: '指标计算：赔付率 = 已决赔款 ÷ 保费收入，分母为 0 时返回 NULL',
    createUser: '系统管理员',
    createTime: '2026-08-28 10:06:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-28 10:06:00'
  },
  {
    id: 3,
    code: 'F_CHECK_POLICY_NO',
    name: '保单号非空与长度校验',
    type: 2,
    sqlText:
      'SELECT COUNT(*) AS error_count\n  FROM policy_base_info\n WHERE policy_no IS NULL OR LENGTH(policy_no) <> 22',
    target: '校验规则：R001 保单号格式校验',
    status: 1,
    remark: '校验公式：返回错误行数，>0 即校验不通过',
    createUser: '系统管理员',
    createTime: '2026-08-28 10:12:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-30 09:40:00'
  },
  {
    id: 4,
    code: 'F_SUM_PREMIUM_MONTH',
    name: '月度保费汇总口径',
    type: 4,
    sqlText:
      'SELECT org_code, product_code, SUM(premium) AS month_premium\n  FROM premium_info\n WHERE period = :period\n GROUP BY org_code, product_code',
    target: '口径信息：月度保费口径',
    status: 1,
    remark: '报表口径：与「口径信息配置」里的月度保费口径配套使用',
    createUser: '系统管理员',
    createTime: '2026-08-28 10:18:00',
    updateUser: '系统管理员',
    updateTime: '2026-08-28 10:18:00'
  },
  {
    id: 5,
    code: 'F_AGENT_ACTIVE',
    name: '在职从业人员统计',
    type: 1,
    sqlText:
      "SELECT a.agent_no, a.agent_name, a.agency_code\n  FROM employee_info a\n WHERE a.status = '1' AND a.entry_date <= :dataDate",
    target: 'BX041 从业人员明细表',
    status: 1,
    remark: '取数公式：执业状态为在职的销售人员',
    createUser: '系统管理员',
    createTime: '2026-08-28 10:24:00',
    updateUser: '系统管理员',
    updateTime: '2026-09-01 11:05:00'
  },
  {
    id: 6,
    code: 'F_RECEIPT_TIMELY',
    name: '回执及时率（待确认）',
    type: 3,
    sqlText:
      'SELECT org_code, COUNT(*) AS timely_count\n  FROM claim_payment\n WHERE receipt_time <= deadline',
    target: '统计查询：报送及时率统计',
    status: 0,
    remark: '停用：监管回执字段（receipt_time）尚未在表管理中定义，等字段确认后再启用',
    createUser: '系统管理员',
    createTime: '2026-08-28 10:30:00',
    updateUser: '系统管理员',
    updateTime: '2026-09-03 14:00:00'
  }
]

export const sqlFormulaTable = defineTable<SqlFormulaRow>('cr.sqlFormula', formulaSeed)

/** 公式编码规则：大写字母开头，可含数字与下划线（页面与接口共用一份） */
export const FORMULA_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

/** 公式类型中文名（导出用；页面上的标签走字典 cr_formula_type，两边同一套值） */
export const FORMULA_TYPE_LABEL: Record<number, string> = {
  1: '取数公式',
  2: '校验公式',
  3: '指标计算',
  4: '报表口径'
}

/**
 * SQL 试运行 —— **只解析、不执行**，结论必须是确定性的。
 *
 * 为什么不做"真跑一下"：Demo 没有数据库，任何"执行"都只能编一个结果；
 * 编出来的结果既不可信也没法复现。这里改成做四件能自证的事：
 * 1. 结构检查（有没有 SELECT / FROM、括号是否配对、是不是写操作）；
 * 2. 占位参数识别（冒号参数 / 美元花括号参数），把"要传哪些参数"列清楚；
 * 3. 引用表对照《报送配置 → 表管理》的物理表名，并给出中文表名；
 * 4. 给出确定性的结论串，页面上照原样展示。
 */
export interface FormulaCheckItem {
  name: string
  /** pass 通过 / warn 需要注意 / fail 不通过 */
  level: 'pass' | 'warn' | 'fail'
  detail: string
}

export const tryRunFormula = (sqlText: string) => {
  const text = String(sqlText || '').trim()
  const checks: FormulaCheckItem[] = []
  const push = (name: string, level: FormulaCheckItem['level'], detail: string) =>
    checks.push({ name, level, detail })

  if (!text) {
    push('正文非空', 'fail', 'SQL 正文为空，无法试运行')
    return {
      passed: false,
      conclusion: '试运行不通过：SQL 正文为空',
      checks,
      placeholders: [] as string[],
      tables: [] as Array<{ name: string; cnName: string; tableCode: string }>,
      unknownTables: [] as string[]
    }
  }
  push('正文非空', 'pass', '共 ' + text.split(/\n/).length + ' 行 / ' + text.length + ' 个字符')

  const upper = text.toUpperCase()
  const writeKeywords = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'TRUNCATE',
    'ALTER',
    'GRANT',
    'MERGE',
    'CREATE'
  ]
  const hitWrite = writeKeywords.filter((kw) => new RegExp('\\b' + kw + '\\b').test(upper))
  if (hitWrite.length) {
    push('只读检查', 'fail', '公式只允许 SELECT，检测到写操作关键字：' + hitWrite.join(' / '))
  } else {
    push('只读检查', 'pass', '未检测到写操作关键字（试运行本身也不会执行任何语句）')
  }

  if (/\bSELECT\b/.test(upper)) {
    push('SELECT 关键字', 'pass', '已找到 SELECT')
  } else {
    push('SELECT 关键字', 'fail', '缺少 SELECT：公式必须以查询语句返回结果集')
  }
  if (/\bFROM\b/.test(upper)) {
    push('FROM 子句', 'pass', '已找到 FROM')
  } else {
    push('FROM 子句', 'fail', '缺少 FROM：无法确定取数来源表')
  }

  const open = (text.match(/\(/g) || []).length
  const close = (text.match(/\)/g) || []).length
  push(
    '括号配对',
    open === close ? 'pass' : 'fail',
    open === close
      ? '左右括号各 ' + open + ' 个'
      : '左右括号不配对：' + open + ' 个左括号 / ' + close + ' 个右括号'
  )

  const placeholders = Array.from(
    new Set([
      ...(text.match(/:([A-Za-z_][A-Za-z0-9_]*)/g) || []).map((item) => item.slice(1)),
      ...(text.match(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g) || []).map((item) => item.slice(2, -1))
    ])
  )
  push(
    '占位参数',
    placeholders.length ? 'pass' : 'warn',
    placeholders.length
      ? '识别到 ' + placeholders.length + ' 个参数：' + placeholders.join('、')
      : '没有识别到占位参数（冒号参数或美元花括号参数），确认是常量查询再保存'
  )

  const fromMatches = Array.from(text.matchAll(/\bFROM\s+([A-Za-z_][A-Za-z0-9_.]*)/gi)).map(
    (match) => match[1].split('.').pop() as string
  )
  const joinMatches = Array.from(text.matchAll(/\bJOIN\s+([A-Za-z_][A-Za-z0-9_.]*)/gi)).map(
    (match) => match[1].split('.').pop() as string
  )
  const names = Array.from(new Set([...fromMatches, ...joinMatches]))
  const tables = names
    .map((name) =>
      metaTableTable.all().find((row) => row.tableName.toLowerCase() === name.toLowerCase())
    )
    .filter((row) => !!row)
    .map((row) => ({ name: row!.tableName, cnName: row!.cnName, tableCode: row!.tableCode }))
  const unknownTables = names.filter(
    (name) =>
      !metaTableTable.all().some((row) => row.tableName.toLowerCase() === name.toLowerCase())
  )
  if (!names.length) {
    push('引用表对照', 'warn', '没有从 FROM / JOIN 里解析出表名')
  } else if (unknownTables.length) {
    push(
      '引用表对照',
      'fail',
      '以下表不在《报送配置 → 表管理》的清单里：' +
        unknownTables.join('、') +
        '（先在表管理里登记，公式才能挂到报送链路上）'
    )
  } else {
    push(
      '引用表对照',
      'pass',
      tables.map((item) => item.name + '（' + item.tableCode + ' ' + item.cnName + '）').join('、')
    )
  }

  const failed = checks.filter((item) => item.level === 'fail')
  const warned = checks.filter((item) => item.level === 'warn')
  const conclusion = failed.length
    ? '试运行不通过：' + failed.map((item) => item.name + ' — ' + item.detail).join('；')
    : warned.length
      ? '语法占位检查通过（' +
        warned.length +
        ' 项提示）：' +
        warned.map((item) => item.name).join('、')
      : '语法占位检查通过：' + checks.length + ' 项检查全部通过（未执行 SQL，仅做静态解析）'
  return { passed: failed.length === 0, conclusion, checks, placeholders, tables, unknownTables }
}
