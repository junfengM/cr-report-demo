import { defineTable } from '../store'
import { formatDateTime, nextId } from '../util'
import { PERIODS, reportOptions, reportOrgs } from './crCommon'
import { fillRowsOfKey } from './crDesensitize'
// 包文件与「一键报送」共用同一套报文文件生成器：格式 / 分隔符 / 表头行数都取机构的《报送文件配置》，
// 所以拆出来的包就是同一份报文文件按包切出来的分片（文件名只多一段包名）。
import { fileExtOfOrg, planReportFile, reportFileName } from './crSubmit'
import { buildSubmitFile } from './crSubmitFile'

/* ==================================================================
 * 数据拆分（报送数据分包）
 *
 * 口径说明：需求附件不在工程里，这一块是**按通行做法提案**的实现 ——
 * 把「机构 × 报表 × 期次」的填报明细按规则拆成多个报送包（分包报送 / 分片交付），
 * 与「数据脱敏」同属报送前的数据准备动作。
 *   1 按行数均分：每包最多 N 行，适合"单包行数有上限"的报送要求；
 *   2 按字段值分组：按销售渠道 / 数据状态等拆包，适合分渠道交付；
 *   3 不拆分：整表一个包，用来对比与兜底。
 * 拆分只做分组与清单，不复制也不改写 cr.fillData —— 这一点在页面上有明确说明。
 * ================================================================== */

export const SPLIT_MODE = {
  BY_ROWS: 1,
  BY_FIELD: 2,
  NONE: 3
} as const

export const SPLIT_MODE_LABEL: Record<number, string> = {
  1: '按行数均分',
  2: '按字段值分组',
  3: '不拆分'
}

/** 按字段值分组时可用的拆分字段 */
export const SPLIT_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'channel', label: '销售渠道' },
  { field: 'dataStatus', label: '数据状态' },
  { field: 'productName', label: '险种名称' },
  { field: 'orgName', label: '报送机构' }
]

export const splitFieldLabel = (field: string): string => {
  const hit = SPLIT_FIELDS.find((item) => item.field === field)
  return hit ? hit.label : field
}

/** 单次拆分的包数上限：拆出几百个包对报送没有意义，属于配置错误 */
export const SPLIT_MAX_PACKAGES = 50

export interface SplitRuleRow {
  id: number
  /** 规则编码：SR + 三位序号 */
  ruleCode: string
  ruleName: string
  /** 0 = 全部机构 */
  orgId: number
  orgName: string
  /** 0 = 全部报表 */
  reportId: number
  reportCode: string
  reportName: string
  /** 1 按行数均分 / 2 按字段值分组 / 3 不拆分，见字典 cr_split_mode */
  mode: number
  /** 按行数均分时每包最多多少行 */
  rowsPerPackage: number
  /** 按字段值分组时的拆分字段（cr.fillData 字段名） */
  splitField: string
  splitFieldLabel: string
  /** 包名前缀，如 BJ-BX011 → BJ-BX011-P01 */
  pkgPrefix: string
  /** 优先级：数字小的先生效（同机构/报表范围多条规则时用它决定谁生效，缺省 50） */
  priority: number
  status: number
  updateUser: string
  updateTime: string
  remark: string
}

export interface SplitSampleRow {
  rowNo: number
  policyNo: string
  holderName: string
  channel: string
  premiumAmount: number
}

export interface SplitPackageRow {
  pkgNo: number
  pkgName: string
  rows: number
  /** 按字段值分组时的分组值（按行数拆分时为空） */
  fieldValue: string
  firstPolicyNo: string
  lastPolicyNo: string
  /** 包文件名（与一键报送同一命名口径，只多一段包名）：HX_机构码_报表码_期次_包名.后缀 */
  fileName: string
  /** 包文件真实字节数（由报文文件生成器算出，下载到的就是这个大小） */
  fileSize: number
  /** 每个包存前 3 行做核对样本（只放保单号/投保人/渠道/保费，不放证件号） */
  samples: SplitSampleRow[]
}

export interface SplitTaskRow {
  id: number
  /** 拆分批次号：SP + 期次 + 四位序号 */
  batchNo: string
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  scopeName: string
  ruleId: number
  ruleCode: string
  ruleName: string
  mode: number
  totalRows: number
  pkgCount: number
  /** 1 执行中 / 2 拆分成功 / 3 拆分失败，见字典 cr_split_status */
  status: number
  startTime: string
  endTime: string
  cost: number
  operator: string
  packages: SplitPackageRow[]
  message: string
  remark: string
}

export const SPLIT_TASK_STATUS = {
  RUNNING: 1,
  SUCCESS: 2,
  FAILED: 3
} as const

const SEED_TIME = '2026-09-11 10:10:00'

interface RuleSeed {
  ruleName: string
  orgName: string
  reportId: number
  mode: number
  rowsPerPackage?: number
  splitField?: string
  pkgPrefix: string
  remark: string
  /** 缺省 50；兜底规则给大值，保证机构级规则永远优先（范围本身也参与判断，这里是双保险） */
  priority?: number
}

const RULE_SEEDS: RuleSeed[] = [
  {
    ruleName: '北京分公司明细表按 20 行分包',
    orgName: '北京分公司',
    reportId: 11,
    mode: SPLIT_MODE.BY_ROWS,
    rowsPerPackage: 20,
    pkgPrefix: 'BJ-BX011',
    remark: '监管要求单包不超过 20 行，超出部分顺延到下一包'
  },
  {
    ruleName: '上海分公司按销售渠道拆包',
    orgName: '上海分公司',
    reportId: 11,
    mode: SPLIT_MODE.BY_FIELD,
    splitField: 'channel',
    pkgPrefix: 'SH-BX011',
    remark: '分渠道交付，个险/银保分别出包'
  },
  {
    ruleName: '江苏分公司保单状态表整表出包',
    orgName: '江苏分公司',
    reportId: 2,
    mode: SPLIT_MODE.NONE,
    pkgPrefix: 'JS-BX002',
    remark: '数据量小，整表一个包'
  },
  {
    ruleName: '广东分公司缴费信息表按 15 行分包',
    orgName: '广东分公司',
    reportId: 12,
    mode: SPLIT_MODE.BY_ROWS,
    rowsPerPackage: 15,
    pkgPrefix: 'GD-BX012',
    remark: '每包 15 行，便于分批发文'
  },
  {
    ruleName: '默认拆分规则（全部机构 / 全部报表）',
    orgName: '',
    reportId: 0,
    mode: SPLIT_MODE.BY_ROWS,
    rowsPerPackage: 30,
    pkgPrefix: 'DEF',
    remark: '没有机构级规则时兜底',
    priority: 90
  }
]

const orgIdOf = (orgName: string): number => {
  if (!orgName) return 0
  const hit = reportOrgs().find((org) => org.orgName === orgName)
  return hit ? Number(hit.id) : 0
}

const reportOfId = (reportId: number) =>
  reportOptions().find((report) => Number(report.id) === Number(reportId))

export const crSplitRuleTable = defineTable<SplitRuleRow>('cr.splitRule', () =>
  RULE_SEEDS.map((seed, index) => {
    const report = reportOfId(seed.reportId)
    return {
      id: index + 1,
      ruleCode: 'SR' + String(index + 1).padStart(3, '0'),
      ruleName: seed.ruleName,
      orgId: orgIdOf(seed.orgName),
      orgName: seed.orgName || '全部机构',
      reportId: seed.reportId,
      reportCode: report ? report.reportCode : '',
      reportName: report ? report.reportName : '全部报表',
      mode: seed.mode,
      rowsPerPackage: seed.rowsPerPackage || 0,
      splitField: seed.splitField || '',
      splitFieldLabel: seed.splitField ? splitFieldLabel(seed.splitField) : '',
      pkgPrefix: seed.pkgPrefix,
      priority: seed.priority === undefined ? 50 : seed.priority,
      status: 1,
      updateUser: '系统管理员',
      updateTime: SEED_TIME,
      remark: seed.remark
    }
  })
)

/**
 * 命中的拆分规则，三步定胜负：
 *   1. 范围：机构级 > 全部机构，报表级 > 全部报表；
 *   2. 优先级：数字小的先生效（显式配置，缺省 50）；
 *   3. 优先级也相同时，后建的先生效（最近一次配置优先，符合"我刚配的规则应该生效"的直觉）。
 * 把生效的规则停用后会自动回落到下一条。停用规则不参与判断（页面上会提示"没有可用规则"）。
 */
export const effectiveSplitRule = (orgId: number, reportId: number): SplitRuleRow | undefined => {
  return crSplitRuleTable
    .all()
    .filter((row) => row.status === 1)
    .filter((row) => Number(row.orgId) === Number(orgId) || Number(row.orgId) === 0)
    .filter((row) => Number(row.reportId) === Number(reportId) || Number(row.reportId) === 0)
    .sort(
      (a, b) =>
        (Number(a.orgId) === 0 ? 1 : 0) - (Number(b.orgId) === 0 ? 1 : 0) ||
        (Number(a.reportId) === 0 ? 1 : 0) - (Number(b.reportId) === 0 ? 1 : 0) ||
        Number(a.priority || 50) - Number(b.priority || 50) ||
        b.id - a.id
    )[0]
}

/** 批次号：SP + 期次 + 该期次已用过的最大序号 + 1 */
export const nextSplitBatchNo = (period: string): string => {
  const prefix = 'SP' + period
  const used = crSplitTaskTable
    .all()
    .filter((row) => row.period === period)
    .map((row) => {
      const text = String(row.batchNo || '')
      if (text.indexOf(prefix) !== 0) return 0
      const seq = Number(text.slice(prefix.length))
      return Number.isFinite(seq) ? seq : 0
    })
  return prefix + String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')
}

export const nextSplitRuleCode = (): string => {
  const used = crSplitRuleTable
    .all()
    .map((row) => Number(String(row.ruleCode || '').replace(/\D/g, '')))
    .filter((seq) => Number.isFinite(seq))
  return 'SR' + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')
}

/** 样例行：只带核对用的四个字段，明确不带证件号 */
const sampleOf = (row: any): SplitSampleRow => ({
  rowNo: Number(row.rowNo || 0),
  policyNo: String(row.policyNo || ''),
  holderName: String(row.holderName || ''),
  channel: String(row.channel || ''),
  premiumAmount: Number(row.premiumAmount || 0)
})

export interface SplitPlan {
  rule: SplitRuleRow | null
  mode: number
  modeLabel: string
  totalRows: number
  pkgCount: number
  packages: SplitPackageRow[]
  warnings: string[]
}

/**
 * 拆分方案（预检与执行共用同一套算法，避免"预检说 3 包、执行出 4 包"）。
 * 只做分组，不复制行、不改写 cr.fillData。
 */
export const buildSplitPlan = (orgId: number, reportId: number, period: string): SplitPlan => {
  const warnings: string[] = []
  const rule = effectiveSplitRule(orgId, reportId)
  const rows = fillRowsOfKey(orgId, reportId, period)
  if (!rule) {
    warnings.push(
      '该「机构 × 报表」没有启用的拆分规则，请先到「拆分规则配置」里配置（或启用默认规则）'
    )
    return {
      rule: null,
      mode: 0,
      modeLabel: '',
      totalRows: rows.length,
      pkgCount: 0,
      packages: [],
      warnings
    }
  }
  if (!rows.length) {
    warnings.push('该「机构 × 报表 × 期次」下还没有填报数据，请先导入或补录')
    return {
      rule,
      mode: rule.mode,
      modeLabel: SPLIT_MODE_LABEL[rule.mode] || '',
      totalRows: 0,
      pkgCount: 0,
      packages: [],
      warnings
    }
  }
  const prefix = rule.pkgPrefix || 'PKG'
  const org = reportOrgs().find((item) => Number(item.id) === Number(orgId))
  const report = reportOfId(reportId)
  const pkgFile = (pkgName: string, rows: number) => {
    const ext = fileExtOfOrg(orgId)
    // 期次后面拼包名 → HX_110000_BX011_202608_BJ-BX011-P01.txt
    const fileName = reportFileName(
      String((org || {}).orgCode || ''),
      String((report || {}).reportCode || ''),
      period + '_' + pkgName,
      ext
    )
    return planReportFile({
      orgId,
      orgCode: String((org || {}).orgCode || ''),
      orgName: org ? org.orgName : '',
      reportCode: String((report || {}).reportCode || ''),
      reportName: report ? report.reportName : '',
      period,
      dataRows: rows,
      fileName
    })
  }
  const toPackage = (pkgNo: number, group: any[], fieldValue: string): SplitPackageRow => {
    const pkgName = prefix + '-P' + String(pkgNo).padStart(2, '0')
    const plan = pkgFile(pkgName, group.length)
    return {
      pkgNo,
      pkgName,
      rows: group.length,
      fieldValue,
      firstPolicyNo: String((group[0] || {}).policyNo || ''),
      lastPolicyNo: String((group[group.length - 1] || {}).policyNo || ''),
      fileName: plan.fileName,
      fileSize: plan.bytes,
      samples: group.slice(0, 3).map(sampleOf)
    }
  }
  const packages: SplitPackageRow[] = []
  if (rule.mode === SPLIT_MODE.BY_ROWS) {
    const size = Number(rule.rowsPerPackage) > 0 ? Number(rule.rowsPerPackage) : 30
    for (let index = 0; index < rows.length; index += size) {
      packages.push(toPackage(packages.length + 1, rows.slice(index, index + size), ''))
    }
  } else if (rule.mode === SPLIT_MODE.BY_FIELD) {
    const field = rule.splitField
    if (!field) {
      warnings.push('规则配置为「按字段值分组」，但没有指定拆分字段，已按整表一个包处理')
      packages.push(toPackage(1, rows, ''))
    } else {
      const groups = new Map<string, any[]>()
      rows.forEach((row) => {
        const key = String((row as any)[field] || '（空）')
        const bucket = groups.get(key)
        if (bucket) bucket.push(row)
        else groups.set(key, [row])
      })
      if (groups.size > SPLIT_MAX_PACKAGES) {
        warnings.push(
          '「' +
            splitFieldLabel(field) +
            '」有 ' +
            groups.size +
            ' 个不同取值，超过单次 ' +
            SPLIT_MAX_PACKAGES +
            ' 包的上限，请改用「按行数均分」'
        )
      }
      ;[...groups.keys()].sort().forEach((key) => {
        packages.push(toPackage(packages.length + 1, groups.get(key) || [], key))
      })
    }
  } else {
    packages.push(toPackage(1, rows, ''))
  }
  const emptyPackages = packages.filter((item) => item.rows === 0).length
  if (emptyPackages) warnings.push('有 ' + emptyPackages + ' 个包没有数据行')
  if (rule.mode === SPLIT_MODE.BY_ROWS) {
    warnings.push(
      '按行数拆分只保证每包不超过 ' +
        (Number(rule.rowsPerPackage) || 30) +
        ' 行；包内不重新排序，行号顺序与填报数据一致'
    )
  }
  return {
    rule,
    mode: rule.mode,
    modeLabel: SPLIT_MODE_LABEL[rule.mode] || '',
    totalRows: rows.length,
    pkgCount: packages.length,
    packages,
    warnings
  }
}

/** 预检：只算不动（页面上点「预检」调它，执行前必须让用户看到包清单） */
export const precheckSplit = (orgId: number, reportId: number, period: string) => {
  const org = reportOrgs().find((item) => Number(item.id) === Number(orgId))
  const report = reportOfId(reportId)
  const plan = buildSplitPlan(orgId, reportId, period)
  return {
    orgId: Number(orgId),
    orgName: org ? org.orgName : '',
    reportId: Number(reportId),
    reportCode: report ? report.reportCode : '',
    reportName: report ? report.reportName : '',
    period,
    ...plan
  }
}

/**
 * 执行拆分：落一条拆分批次 + 每包清单（只读 cr.fillData，不复制也不改写数据）。
 * 没有可拆数据、没有规则、包数超上限时直接拦下，不留半成品批次。
 */
export const runSplit = (params: {
  orgId: number
  reportId: number
  period: string
  operator: string
}) => {
  const { orgId, reportId, period, operator } = params
  const plan = buildSplitPlan(orgId, reportId, period)
  if (!plan.rule) throw new Error('该「机构 × 报表」没有启用的拆分规则，请先配置拆分规则')
  if (!plan.totalRows) throw new Error('该「机构 × 报表 × 期次」下没有可拆分的填报数据')
  if (!plan.pkgCount) throw new Error('没有生成任何报送包，请检查拆分规则')
  if (plan.pkgCount > SPLIT_MAX_PACKAGES) {
    throw new Error(
      '本次会拆出 ' + plan.pkgCount + ' 个包，超过上限 ' + SPLIT_MAX_PACKAGES + '，请调整拆分规则'
    )
  }
  const rule = plan.rule
  const org = reportOrgs().find((item) => Number(item.id) === Number(orgId))
  const report = reportOfId(reportId)
  const startedAt = Date.now()
  const task = crSplitTaskTable.insert({
    id: nextId(crSplitTaskTable.all()),
    batchNo: nextSplitBatchNo(period),
    orgId: Number(orgId),
    orgName: org ? org.orgName : '',
    reportId: Number(reportId),
    reportCode: report ? report.reportCode : '',
    reportName: report ? report.reportName : '',
    period,
    scopeName:
      (org ? org.orgName : '') + ' / ' + (report ? report.reportName : '') + ' / ' + period,
    ruleId: rule.id,
    ruleCode: rule.ruleCode,
    ruleName: rule.ruleName,
    mode: rule.mode,
    totalRows: plan.totalRows,
    pkgCount: plan.pkgCount,
    status: SPLIT_TASK_STATUS.RUNNING,
    startTime: formatDateTime(),
    endTime: '',
    cost: 0,
    operator,
    packages: plan.packages,
    message: '拆分中',
    remark: ''
  } as any)
  const updated = crSplitTaskTable.update({
    id: task.id,
    status: SPLIT_TASK_STATUS.SUCCESS,
    endTime: formatDateTime(),
    cost: Date.now() - startedAt,
    message:
      '拆分成功：' +
      plan.totalRows +
      ' 行按「' +
      (SPLIT_MODE_LABEL[rule.mode] || '') +
      '」拆成 ' +
      plan.pkgCount +
      ' 个包（数据未被复制或改写）'
  })
  return updated || task
}

/**
 * 生成某个包的报文文件（下载接口用）。
 * 与包清单上的 fileName / fileSize 必须严格一致：对不上就按真实内容回写并告警
 * —— 与「一键报送」同一条纪律：列表显示的大小 = 真正下载到的字节数。
 */
export const buildSplitPackageFile = (taskId: number, pkgNo: number) => {
  const task = crSplitTaskTable.get(Number(taskId))
  if (!task) throw new Error('拆分批次不存在：id=' + taskId)
  const pkg = (task.packages || []).find((item) => Number(item.pkgNo) === Number(pkgNo))
  if (!pkg) throw new Error('该批次下没有第 ' + pkgNo + ' 个包')
  const org = reportOrgs().find((item) => Number(item.id) === Number(task.orgId))
  const plan = planReportFile({
    orgId: task.orgId,
    orgCode: String((org || {}).orgCode || ''),
    orgName: task.orgName,
    reportCode: task.reportCode,
    reportName: task.reportName,
    period: task.period,
    dataRows: pkg.rows,
    fileName: pkg.fileName
  })
  const file = buildSubmitFile(plan.meta, plan.options)
  if (file.dataRows !== pkg.rows || file.bytes !== pkg.fileSize) {
    console.warn(
      '[Mock] 拆分包 ' +
        pkg.pkgName +
        ' 的清单大小 ' +
        pkg.fileSize +
        ' / ' +
        pkg.rows +
        ' 行与实际生成 ' +
        file.bytes +
        ' / ' +
        file.dataRows +
        ' 行不一致，已按实际内容回写'
    )
    const packages = (task.packages || []).map((item) =>
      item.pkgNo === pkg.pkgNo ? { ...item, fileSize: file.bytes, rows: file.dataRows } : item
    )
    crSplitTaskTable.update({ id: task.id, packages })
  }
  return file
}

/** 种子拆分批次：包清单按当前规则现算，页面上看到的数字与真实数据一致 */
interface TaskSeed {
  orgName: string
  reportId: number
  period: string
  ruleCode: string
  time: string
  operator: string
}

const TASK_SEEDS: TaskSeed[] = [
  {
    orgName: '北京分公司',
    reportId: 11,
    period: '202608',
    ruleCode: 'SR001',
    time: '2026-09-11 10:20:15',
    operator: '系统管理员'
  },
  {
    orgName: '上海分公司',
    reportId: 11,
    period: '202608',
    ruleCode: 'SR002',
    time: '2026-09-11 10:16:42',
    operator: '系统管理员'
  },
  {
    orgName: '江苏分公司',
    reportId: 2,
    period: '202608',
    ruleCode: 'SR003',
    time: '2026-09-10 17:02:08',
    operator: '系统管理员'
  }
]

function buildSplitTasks(): SplitTaskRow[] {
  const seqOfPeriod = new Map<string, number>()
  return TASK_SEEDS.map((seed, index) => {
    const orgId = orgIdOf(seed.orgName)
    const period = PERIODS.indexOf(seed.period) >= 0 ? seed.period : PERIODS[PERIODS.length - 1]
    const plan = buildSplitPlan(orgId, seed.reportId, period)
    const seq = (seqOfPeriod.get(period) || 0) + 1
    seqOfPeriod.set(period, seq)
    return {
      id: index + 1,
      batchNo: 'SP' + period + String(seq).padStart(4, '0'),
      orgId,
      orgName: seed.orgName,
      reportId: seed.reportId,
      reportCode: plan.rule ? (reportOfId(seed.reportId) || {}).reportCode || '' : '',
      reportName: (reportOfId(seed.reportId) || {}).reportName || '',
      period,
      scopeName:
        seed.orgName +
        ' / ' +
        ((reportOfId(seed.reportId) || {}).reportName || '') +
        ' / ' +
        period,
      ruleId: plan.rule ? plan.rule.id : 0,
      ruleCode: seed.ruleCode,
      ruleName: plan.rule ? plan.rule.ruleName : '',
      mode: plan.mode,
      totalRows: plan.totalRows,
      pkgCount: plan.pkgCount,
      status: plan.pkgCount ? SPLIT_TASK_STATUS.SUCCESS : SPLIT_TASK_STATUS.FAILED,
      startTime: seed.time,
      endTime: seed.time,
      cost: 12 + index * 7,
      operator: seed.operator,
      packages: plan.packages,
      message: plan.pkgCount
        ? '拆分成功：' + plan.totalRows + ' 行拆成 ' + plan.pkgCount + ' 个包（数据未被复制或改写）'
        : '没有可拆分的填报数据',
      remark: '历史批次（种子数据）'
    }
  })
}

export const crSplitTaskTable = defineTable<SplitTaskRow>('cr.splitTask', buildSplitTasks)
