/**
 * Mock 种子数据 — 数据查询域（/cr-query 三个页面）
 *
 * - 报表状态查询：机构 × 报表 × 期次的报送状态总览（含数据行数 / 最后修改人）
 * - 我的任务：当前登录用户的待办 / 已办填报任务
 * - 综合查询：多期数据值（高级对比）、数据追溯链路、报表备注
 *
 * 期次 / 机构 / 报表统一取自 crCommon，保证与任务模板等模块口径一致。
 * 数值类种子用「确定性散列 + 基准值」生成：同样的入参永远得到同样的数据，
 * 既能覆盖 4 机构 × 18 报表 × 12 期次，又不至于手写上千行常量。
 */
import { defineTable } from '../store'
import { BRANCH_NAMES, PERIOD, PERIODS, reportOrgs, reportOptions } from './crCommon'

/* ==================================================================
 * 通用工具
 * ================================================================== */
const pad = (value: number, width = 2) => String(value).padStart(width, '0')

/** 确定性散列：同样入参永远得到 [0,1) 的同一个小数 */
const hash01 = (seed: string): number => {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/** 上月（202608 → 202607），用于生成上期数据 */
const prevPeriod = (period: string): string => {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(4, 6))
  return month === 1 ? `${year - 1}12` : `${year}${pad(month - 1)}`
}

/** 去年同期（202608 → 202508） */
const lastYearPeriod = (period: string): string =>
  `${Number(period.slice(0, 4)) - 1}${period.slice(4, 6)}`

/** 报送机构：4 个分公司 */
const BRANCHES = reportOrgs().filter((org) => BRANCH_NAMES.includes(org.orgName))

/** 全部报表（18 张） */
const REPORTS = reportOptions()

/** 月报（15 张）—— 报表状态查询 / 我的任务的主口径 */
const MONTHLY_REPORTS = REPORTS.filter((report) => report.freq === 3)

/** 数据期次：本期 6 期 + 去年同期 6 期（用于同比） */
const DATA_PERIODS = [...PERIODS.map(lastYearPeriod), ...PERIODS]

/** 各机构的填报人 / 复核人 / 审核人（与 src/mock/db/system.ts 的用户对应） */
const ORG_OPERATORS: Record<string, { filler: string; reviewer: string; auditor: string }> = {
  北京分公司: { filler: '周北京', reviewer: '李复华', auditor: '王审核' },
  上海分公司: { filler: '吴上海', reviewer: '孙风险', auditor: '陈精算' },
  江苏分公司: { filler: '郑江苏', reviewer: '李复华', auditor: '赵财务' },
  广东分公司: { filler: '黄粤生', reviewer: '孙风险', auditor: '王审核' }
}

/** 各机构填报账号（我的任务的归属人） */
const ORG_OWNERS: Record<string, { id: number; name: string }> = {
  北京分公司: { id: 9, name: '周北京' },
  上海分公司: { id: 10, name: '吴上海' },
  江苏分公司: { id: 11, name: '郑江苏' },
  广东分公司: { id: 12, name: '黄粤生' }
}

/* ==================================================================
 * 1. 报表状态（4 机构 × 15 月报 × 2 期次 = 120 条）
 * ================================================================== */
export interface QueryReportStatusRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  subjectName: string
  period: string
  /** 数据填报状态：见字典 cr_fill_status */
  fillStatus: number
  /** 数据校验状态：见字典 cr_check_status */
  checkStatus: number
  /** 报送状态：0 未报送 / 1 报送中 / 2 已报送（本域约定，无对应字典） */
  submitStatus: number
  /** 数据行数 */
  dataRows: number
  lastModifier: string
  lastModifyTime: string
}

/** 各报表的基准数据行数（机构维度再做缩放） */
const REPORT_ROW_BASE: Record<number, number> = {
  1: 128600,
  2: 86420,
  3: 12680,
  4: 5420,
  5: 326800,
  6: 428600,
  7: 386200,
  8: 386200,
  9: 512600,
  10: 286,
  11: 486200,
  12: 186200,
  13: 26800,
  14: 24600,
  15: 4860,
  16: 1268,
  17: 862,
  18: 42680
}

/**
 * 报送进度阶段（0~9）：0/1 未填报、2/3 填报中、4 已提交待校验、5 校验不通过、
 * 6 校验通过待报送、7 报送中、8/9 已报送。
 * 用机构序号与报表序号做确定性散列，保证 60 条状态覆盖各个阶段。
 */
const progressStage = (orgIndex: number, reportIndex: number) =>
  (orgIndex * 7 + reportIndex * 3) % 10

const STAGE_FIELDS: Array<{ fillStatus: number; checkStatus: number; submitStatus: number }> = [
  { fillStatus: 0, checkStatus: 0, submitStatus: 0 },
  { fillStatus: 0, checkStatus: 0, submitStatus: 0 },
  { fillStatus: 1, checkStatus: 0, submitStatus: 0 },
  { fillStatus: 1, checkStatus: 0, submitStatus: 0 },
  { fillStatus: 2, checkStatus: 1, submitStatus: 0 },
  { fillStatus: 2, checkStatus: 3, submitStatus: 0 },
  { fillStatus: 2, checkStatus: 2, submitStatus: 0 },
  { fillStatus: 2, checkStatus: 2, submitStatus: 1 },
  { fillStatus: 2, checkStatus: 2, submitStatus: 2 },
  { fillStatus: 2, checkStatus: 2, submitStatus: 2 }
]

const statusSeed: QueryReportStatusRow[] = []
let statusId = 0
/** 本期（202608）混合进度；上期（202607）已全部报送完成，便于期次切换演示 */
const STATUS_PERIODS = [
  { period: PERIOD, month: '09', allDone: false },
  { period: prevPeriod(PERIOD), month: '08', allDone: true }
]
STATUS_PERIODS.forEach(({ period, month, allDone }) => {
  BRANCHES.forEach((org, orgIndex) => {
    const operator = ORG_OPERATORS[org.orgName]
    MONTHLY_REPORTS.forEach((report, reportIndex) => {
      const stage = progressStage(orgIndex, reportIndex)
      const fields = allDone
        ? { fillStatus: 2, checkStatus: 2, submitStatus: 2 }
        : STAGE_FIELDS[stage]
      const baseRows = REPORT_ROW_BASE[report.id] || 1200
      let dataRows = Math.round(baseRows * (0.58 + orgIndex * 0.13))
      if (fields.fillStatus === 0) {
        dataRows = 0
      } else if (fields.fillStatus === 1) {
        dataRows = Math.round(dataRows * 0.62)
      }
      const lastModifier =
        fields.fillStatus === 0
          ? ''
          : fields.submitStatus === 2
            ? operator.auditor
            : fields.checkStatus === 3
              ? operator.reviewer
              : operator.filler
      const lastModifyTime =
        fields.fillStatus === 0
          ? ''
          : `2026-${month}-${pad(2 + ((orgIndex * 3 + reportIndex) % 10))} ` +
            `${pad(9 + (reportIndex % 8))}:${pad((reportIndex * 7) % 60)}:${pad((reportIndex * 13) % 60)}`
      statusId += 1
      statusSeed.push({
        id: statusId,
        orgId: org.id,
        orgName: org.orgName,
        reportId: report.id,
        reportCode: report.reportCode,
        reportName: report.reportName,
        subjectName: report.subjectName,
        period,
        ...fields,
        dataRows,
        lastModifier,
        lastModifyTime
      })
    })
  })
})

export const crReportStatusTable = defineTable<QueryReportStatusRow>('cr.reportStatus', statusSeed)

/* ==================================================================
 * 2. 报表数据值（4 机构 × 18 报表 × 6 指标 × 12 期次）
 * ================================================================== */
export interface QueryReportDataRow {
  id: number
  orgId: number
  reportId: number
  /** 指标名称 */
  indicator: string
  period: string
  value: number
  unit: string
}

/** 指标定义：[指标名称, 基准值(北京分公司 202503), 单位, 每期增长率] */
type IndicatorSpec = [string, number, string, number]

const REPORT_INDICATORS: Record<number, IndicatorSpec[]> = {
  1: [
    ['期末有效保单件数', 128600, '件', 0.008],
    ['年金给付金额', 38600, '万元', 0.012],
    ['新单保费收入', 24800, '万元', 0.015],
    ['期末责任准备金余额', 486000, '万元', 0.006],
    ['退保金支出', 3260, '万元', 0.009],
    ['保单贷款余额', 18600, '万元', 0.007]
  ],
  2: [
    ['有效保单件数', 186200, '件', 0.006],
    ['失效保单件数', 8620, '件', 0.004],
    ['退保保单件数', 5420, '件', 0.011],
    ['复效保单件数', 1268, '件', 0.009],
    ['期末有效保险金额', 2860000, '万元', 0.005],
    ['保单质押贷款余额', 26400, '万元', 0.008]
  ],
  3: [
    ['保单贷款笔数', 12680, '笔', 0.01],
    ['贷款金额', 26800, '万元', 0.013],
    ['贷款利息收入', 862, '万元', 0.011],
    ['期末贷款余额', 18600, '万元', 0.009],
    ['逾期贷款笔数', 126, '笔', 0.006],
    ['贷款结清笔数', 9860, '笔', 0.007]
  ],
  4: [
    ['退保保单件数', 5420, '件', 0.012],
    ['退保金额', 3260, '万元', 0.014],
    ['犹豫期退保件数', 862, '件', 0.01],
    ['退保率', 2.86, '%', 0.003],
    ['平均退保金额', 0.6, '万元', 0.008],
    ['满期给付件数', 1268, '件', 0.006]
  ],
  5: [
    ['投保人数量', 426800, '人', 0.007],
    ['新增投保人', 8620, '人', 0.012],
    ['法人投保人', 1286, '人', 0.005],
    ['投保人平均年龄', 38.6, '岁', 0.001],
    ['证件信息完整率', 99.2, '%', 0.0005],
    ['联系方式缺失人数', 1260, '人', -0.004]
  ],
  6: [
    ['手机号码记录数', 428600, '条', 0.006],
    ['电子邮箱记录数', 186200, '条', 0.008],
    ['地址记录数', 396800, '条', 0.005],
    ['联系方式变更记录', 12680, '条', 0.011],
    ['脱敏处理记录数', 428600, '条', 0.006],
    ['空值记录数', 862, '条', -0.006]
  ],
  7: [
    ['被保险人数量', 386200, '人', 0.007],
    ['新增被保险人', 9260, '人', 0.012],
    ['未成年被保险人', 18620, '人', 0.008],
    ['被保险人平均年龄', 36.2, '岁', 0.001],
    ['职业信息缺失人数', 1268, '人', -0.005],
    ['高风险职业人数', 4268, '人', 0.006]
  ],
  8: [
    ['职业类别记录数', 386200, '条', 0.007],
    ['一类职业人数', 186200, '人', 0.006],
    ['四类及以上职业人数', 12680, '人', 0.009],
    ['职业变更记录', 3260, '条', 0.01],
    ['职业信息完整率', 98.6, '%', 0.0006],
    ['待核实职业记录', 862, '条', -0.007]
  ],
  9: [
    ['受益人记录数', 512600, '条', 0.008],
    ['法定受益人记录', 126800, '条', 0.006],
    ['指定受益人记录', 385800, '条', 0.009],
    ['受益比例异常记录', 86, '条', -0.01],
    ['受益人变更记录', 4260, '条', 0.012],
    ['平均受益人数', 1.32, '人', 0.002]
  ],
  10: [
    ['在售险种数量', 286, '个', 0.004],
    ['停售险种数量', 126, '个', 0.003],
    ['新增险种数量', 12, '个', 0.02],
    ['险种责任条款数', 2860, '条', 0.005],
    ['主险数量', 186, '个', 0.004],
    ['附加险数量', 100, '个', 0.005]
  ],
  11: [
    ['新单保费收入', 48600, '万元', 0.015],
    ['续期保费收入', 128600, '万元', 0.009],
    ['保费收入合计', 177200, '万元', 0.011],
    ['银保渠道保费', 62800, '万元', 0.012],
    ['个险渠道保费', 86400, '万元', 0.008],
    ['团险渠道保费', 28000, '万元', 0.007]
  ],
  12: [
    ['缴费笔数', 186200, '笔', 0.008],
    ['缴费金额', 177200, '万元', 0.011],
    ['期缴笔数', 128600, '笔', 0.009],
    ['趸缴笔数', 57600, '笔', 0.006],
    ['缴费失败笔数', 862, '笔', -0.006],
    ['平均缴费金额', 0.95, '万元', 0.004]
  ],
  13: [
    ['赔案件数', 26800, '件', 0.009],
    ['出险人次', 28600, '人次', 0.009],
    ['立案金额', 32800, '万元', 0.011],
    ['结案件数', 24600, '件', 0.008],
    ['平均结案时效', 12.6, '天', -0.004],
    ['拒赔件数', 1268, '件', -0.006]
  ],
  14: [
    ['赔付支出金额', 28600, '万元', 0.012],
    ['医疗险赔付金额', 12680, '万元', 0.014],
    ['重疾险赔付金额', 8620, '万元', 0.011],
    ['身故赔付金额', 4260, '万元', 0.008],
    ['赔付件数', 24600, '件', 0.008],
    ['平均赔付金额', 1.16, '万元', 0.005]
  ],
  15: [
    ['期末责任准备金余额', 486000, '万元', 0.006],
    ['未到期责任准备金', 326000, '万元', 0.005],
    ['未决赔款准备金', 86000, '万元', 0.007],
    ['寿险责任准备金', 426000, '万元', 0.006],
    ['长期健康险责任准备金', 60000, '万元', 0.008],
    ['准备金计提金额', 28600, '万元', 0.009]
  ],
  16: [
    ['销售渠道数量', 28, '个', 0.003],
    ['合作网点数量', 1268, '个', 0.005],
    ['银保网点数量', 862, '个', 0.004],
    ['个险营销服务部', 186, '个', 0.003],
    ['线上渠道数量', 12, '个', 0.02],
    ['渠道保费收入', 177200, '万元', 0.011]
  ],
  17: [
    ['合作中介机构数量', 186, '家', 0.006],
    ['新增合作机构', 12, '家', 0.015],
    ['终止合作机构', 6, '家', -0.01],
    ['代理手续费支出', 12680, '万元', 0.012],
    ['代理保费收入', 62800, '万元', 0.012],
    ['机构合作协议数', 196, '份', 0.007]
  ],
  18: [
    ['从业人员数量', 42680, '人', 0.005],
    ['销售人员数量', 38600, '人', 0.005],
    ['内勤人员数量', 4080, '人', 0.003],
    ['新增入职人数', 1268, '人', 0.01],
    ['离职人数', 986, '人', -0.008],
    ['持证人员比例', 96.8, '%', 0.001]
  ]
}

const dataSeed: QueryReportDataRow[] = []
let dataId = 0
REPORTS.forEach((report) => {
  const specs = REPORT_INDICATORS[report.id]
  if (!specs) return
  specs.forEach(([indicator, base, unit, growth]) => {
    BRANCHES.forEach((org, orgIndex) => {
      DATA_PERIODS.forEach((period, periodIndex) => {
        const orgFactor = 0.62 + orgIndex * 0.14 + hash01(`${org.orgName}|${indicator}`) * 0.05
        const trend = Math.pow(1 + growth, periodIndex)
        const noise = 0.97 + hash01(`${org.orgName}|${report.id}|${indicator}|${period}`) * 0.06
        dataId += 1
        dataSeed.push({
          id: dataId,
          orgId: org.id,
          reportId: report.id,
          indicator,
          period,
          value: Math.round(base * orgFactor * trend * noise * 100) / 100,
          unit
        })
      })
    })
  })
})

export const crReportDataTable = defineTable<QueryReportDataRow>('cr.reportData', dataSeed)

/* ==================================================================
 * 3. 报表备注
 * ================================================================== */
export interface QueryRemarkRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  content: string
  creator: string
  createTime: string
}

const remarkSpecs: Array<[number, number, string, string, string, string]> = [
  // orgId, reportId, period, content, creator, createTime
  [
    11,
    11,
    '202608',
    '本月新单保费环比增长 6.8%，主要来自银保渠道“鑫享福”产品开门红活动，已与银保业务部核对无误。',
    '周北京',
    '2026-09-10 09:42:00'
  ],
  [
    11,
    11,
    '202608',
    '团险渠道保费较上期下降 3.2%，系两家团体客户保单到期未续保，明细已附在报送说明中。',
    '李复华',
    '2026-09-10 14:05:00'
  ],
  [
    11,
    11,
    '202607',
    '7 月保费收入与财务系统总账差异 12.6 万元，已按要求做调节说明。',
    '周北京',
    '2026-08-08 10:20:00'
  ],
  [
    11,
    13,
    '202608',
    '赔案件数增长 8.9%，其中医疗险占比 46%，与三季度理赔高峰一致。',
    '李复华',
    '2026-09-09 16:31:00'
  ],
  [
    11,
    3,
    '202608',
    '保单贷款余额较上期上升 11.4%，已在备注中说明大额贷款保单号清单。',
    '周北京',
    '2026-09-11 09:15:00'
  ],
  [
    12,
    11,
    '202608',
    '续期保费收入同比提升 9.6%，保费继续率 92.4%，高于监管要求下限。',
    '吴上海',
    '2026-09-10 11:08:00'
  ],
  [
    12,
    11,
    '202608',
    '银保渠道手续费率调整已于本月生效，保费口径未发生变化。',
    '孙风险',
    '2026-09-11 10:47:00'
  ],
  [
    12,
    7,
    '202608',
    '被保险人证件号码已全部按“前 3 后 4”脱敏后报送。',
    '吴上海',
    '2026-09-08 15:52:00'
  ],
  [
    12,
    2,
    '202607',
    '7 月失效保单件数异常偏高，经核查为系统批量失效任务执行口径调整，已修正。',
    '孙风险',
    '2026-08-09 09:33:00'
  ],
  [
    13,
    11,
    '202608',
    '江苏地区新单保费同比下降 2.1%，主要受个险人力下滑影响。',
    '郑江苏',
    '2026-09-10 16:24:00'
  ],
  [
    13,
    5,
    '202608',
    '法人投保人数量新增 36 家，其中 12 家为集团客户关联投保。',
    '郑江苏',
    '2026-09-09 10:12:00'
  ],
  [
    13,
    14,
    '202607',
    '赔付支出金额与准备金计提匹配，无跨期调整事项。',
    '李复华',
    '2026-08-11 17:02:00'
  ],
  [
    14,
    11,
    '202608',
    '广东地区保费收入同比增长 12.3%，开门红预售保单在本月集中生效。',
    '黄粤生',
    '2026-09-11 08:58:00'
  ],
  [
    14,
    12,
    '202608',
    '趸缴笔数占比上升至 31%，已在报送说明中补充产品结构分析。',
    '黄粤生',
    '2026-09-10 13:36:00'
  ],
  [
    14,
    18,
    '202608',
    '本月新增入职 128 人，离职 96 人，持证人员比例 96.8%。',
    '孙风险',
    '2026-09-09 14:19:00'
  ],
  [
    14,
    17,
    '202607',
    '终止合作中介机构 2 家，均已办结协议解除手续。',
    '黄粤生',
    '2026-08-10 11:45:00'
  ]
]

const remarkSeed: QueryRemarkRow[] = remarkSpecs.map((spec, index) => {
  const [orgId, reportId, period, content, creator, createTime] = spec
  const org = BRANCHES.find((item) => item.id === orgId)
  const report = REPORTS.find((item) => item.id === reportId)
  return {
    id: index + 1,
    orgId,
    orgName: org?.orgName || '',
    reportId,
    reportCode: report?.reportCode || '',
    reportName: report?.reportName || '',
    period,
    content,
    creator,
    createTime
  }
})

export const crReportRemarkTable = defineTable<QueryRemarkRow>('cr.reportRemark', remarkSeed)

/* ==================================================================
 * 4. 数据追溯链路（源系统取数 → 数据采集 → 数据清洗 → 数据校验 → 数据报送）
 * ================================================================== */
export interface QueryTraceRow {
  id: number
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 环节名称 */
  node: string
  /** 环节顺序 1~5 */
  nodeOrder: number
  nodeTime: string
  operator: string
  /** 耗时（秒） */
  costSeconds: number
  /** 结果：成功 / 进行中 / 失败 / 待执行 */
  result: string
  /** 影响行数 */
  affectRows: number
  remark: string
}

const TRACE_NODES = [
  {
    node: '源系统取数',
    operator: '数据集成平台',
    base: 186,
    remark: '按增量标识抽取承保、理赔、财务源表'
  },
  { node: '数据采集', operator: '数据集成平台', base: 124, remark: '写入监管报送采集库并登记批次' },
  { node: '数据清洗', operator: '系统自动', base: 268, remark: '剔除重复、空值与不合规枚举值' },
  {
    node: '数据校验',
    operator: '复核人',
    base: 46,
    remark: '执行必填、长度、值域与跨表一致性规则'
  },
  { node: '数据报送', operator: '审核人', base: 18, remark: '生成报文并上传监管前置机' }
]

const traceSeed: QueryTraceRow[] = []
let traceId = 0
REPORTS.forEach((report, reportIndex) => {
  const baseRows = REPORT_ROW_BASE[report.id] || 1200
  BRANCHES.forEach((org, orgIndex) => {
    const operator = ORG_OPERATORS[org.orgName]
    // 本期（202608）按报送进度推进；上期（202607）与非月报已全部报送完成
    const monthlyIndex = MONTHLY_REPORTS.findIndex((item) => item.id === report.id)
    const isMonthly = monthlyIndex >= 0
    const stage = isMonthly ? progressStage(orgIndex, monthlyIndex) : 0
    const affectRows = Math.round(baseRows * (0.58 + orgIndex * 0.13))
    ;[PERIOD, prevPeriod(PERIOD)].forEach((period, periodIndex) => {
      const finished = periodIndex === 1 || !isMonthly
      const currentStage = periodIndex === 1 ? 8 : stage
      TRACE_NODES.forEach((node, nodeIndex) => {
        const day = periodIndex === 1 ? 1 + nodeIndex : 1 + Math.min(nodeIndex, 2)
        let result = '成功'
        let rows = affectRows
        let remark = node.remark
        if (isMonthly && !finished) {
          if (nodeIndex === 3) {
            // 数据校验：进度不足时未执行
            if (currentStage < 4) {
              result = '待执行'
              rows = 0
              remark = '等待填报提交后触发校验'
            } else if (currentStage === 4) {
              result = '进行中'
              rows = Math.round(affectRows * 0.35)
              remark = '校验任务执行中，已完成 35%'
            } else if (currentStage === 5) {
              result = '失败'
              rows = 26
              remark = '存在 26 条校验不通过记录，已生成校验结果待处理'
            }
          }
          if (nodeIndex === 4) {
            if (currentStage < 6) {
              result = '待执行'
              rows = 0
              remark = '校验通过后方可生成报文'
            } else if (currentStage === 7) {
              result = '进行中'
              rows = 0
              remark = '报文已生成，等待监管前置机回执'
            }
          }
        }
        const tracOperator =
          nodeIndex === 3 ? operator.reviewer : nodeIndex === 4 ? operator.auditor : node.operator
        traceId += 1
        traceSeed.push({
          id: traceId,
          orgId: org.id,
          orgName: org.orgName,
          reportId: report.id,
          reportCode: report.reportCode,
          reportName: report.reportName,
          period,
          node: node.node,
          nodeOrder: nodeIndex + 1,
          nodeTime:
            periodIndex === 1
              ? `2026-08-${pad(day + (nodeIndex === 4 ? 9 : 0))} ` +
                `${pad(1 + nodeIndex * 2 + (reportIndex % 3))}:${pad((reportIndex * 11 + nodeIndex * 7) % 60)}:00`
              : `2026-09-${pad(day)} ${pad(1 + nodeIndex * 2 + (reportIndex % 3))}:` +
                `${pad((reportIndex * 11 + nodeIndex * 7) % 60)}:00`,
          operator: tracOperator,
          costSeconds:
            result === '待执行'
              ? 0
              : Math.round(
                  node.base *
                    (0.7 + hash01(`${org.orgName}${report.id}${period}${node.node}`) * 0.8)
                ),
          result,
          affectRows: rows,
          remark
        })
      })
    })
  })
})

export const crDataTraceTable = defineTable<QueryTraceRow>('cr.dataTrace', traceSeed)

/* ==================================================================
 * 5. 我的任务（当前登录用户的填报待办 / 已办）
 * ================================================================== */
export interface QueryMyTaskRow {
  id: number
  taskCode: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  /** 任务状态：见字典 cr_task_status */
  status: number
  deadline: string
  ownerId: number
  ownerName: string
  orgId: number
  orgName: string
  /** 提交填报时间（未提交为空） */
  fillTime: string
  remark: string
}

/** 本期任务状态随报送进度推进：20 已下发 / 30 填报中 / 40 待复核 / 60 复核不通过 / 70 本级审核中 / 80 上级审核中 / 90 审核通过 / 100 已打回 / 50 复核通过 */
const TASK_STATUS_BY_STAGE = [20, 30, 30, 100, 40, 60, 70, 80, 90, 50]

/** 本期截止日期按批次分布：已过期 / 今天 / 临近 / 正常 */
const DEADLINE_BY_INDEX = ['2026-09-10', '2026-09-12', '2026-09-15', '2026-09-18', '2026-09-22']

const taskSeed: QueryMyTaskRow[] = []
let taskId = 0
BRANCHES.forEach((org, orgIndex) => {
  const owner = ORG_OWNERS[org.orgName]
  MONTHLY_REPORTS.forEach((report, reportIndex) => {
    const stage = progressStage(orgIndex, reportIndex)
    const status = TASK_STATUS_BY_STAGE[stage]
    const done = status === 50 || status === 90
    const deadline = DEADLINE_BY_INDEX[(reportIndex + orgIndex) % DEADLINE_BY_INDEX.length]
    taskId += 1
    taskSeed.push({
      id: taskId,
      taskCode: `RW${PERIOD}${org.orgCode.slice(0, 3)}${pad(report.id)}`,
      reportId: report.id,
      reportCode: report.reportCode,
      reportName: report.reportName,
      period: PERIOD,
      status,
      deadline,
      ownerId: owner.id,
      ownerName: owner.name,
      orgId: org.id,
      orgName: org.orgName,
      fillTime: done
        ? `2026-09-${pad(3 + (reportIndex % 8))} ${pad(9 + (reportIndex % 8))}:${pad((reportIndex * 9) % 60)}:00`
        : '',
      remark: done ? '已按监管要求完成报送' : '请在截止日期前完成数据填报与校验'
    })
    // 上期（202607）任务全部办结，供「已办」页签演示
    taskId += 1
    taskSeed.push({
      id: taskId,
      taskCode: `RW${prevPeriod(PERIOD)}${org.orgCode.slice(0, 3)}${pad(report.id)}`,
      reportId: report.id,
      reportCode: report.reportCode,
      reportName: report.reportName,
      period: prevPeriod(PERIOD),
      status: (reportIndex + orgIndex) % 4 === 0 ? 50 : 90,
      deadline: '2026-08-15',
      ownerId: owner.id,
      ownerName: owner.name,
      orgId: org.id,
      orgName: org.orgName,
      fillTime: `2026-08-${pad(4 + (reportIndex % 9))} ${pad(9 + (reportIndex % 8))}:${pad((reportIndex * 9) % 60)}:00`,
      remark: '上期报送已办结'
    })
  })
})

export const crMyTaskTable = defineTable<QueryMyTaskRow>('cr.myTask', taskSeed)
