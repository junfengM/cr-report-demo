/**
 * Mock 种子数据 — 监管码值配置（本地标准映射）
 *
 * 业务背景：监管报送要求报文字段取「监管码值」，而各机构落地时用的是本地码值
 * （内部渠道代码、险种代码等）。这张映射表维护「本地码值 ↔ 监管码值」的对照关系，
 * 并在报送前做一次完整性校验，避免出现"本地有值、监管侧不认"的报文。
 *
 * 三张表：
 *   cr.localCode  本地码值（本地字典的码值清单）
 *   cr.regCode    监管码值（监管方发布的码值清单）
 *   cr.localMap   映射关系（本地码值 → 监管码值，带显式优先级与启停）
 *
 * 与「数据拆分规则」同一套判定顺序：**优先级小的生效 → 再按先建的生效**，
 * 被覆盖的那条会在页面上标出来（"以为生效其实没生效"这类误会必须由系统主动讲清楚）。
 */
import { defineTable } from '../store'

/** 本地码值 */
/** 本地字典（本地库的字典分类，文档「本地字典管理」页维护的就是它） */
export interface LocalDictRow {
  id: number
  /** 本地字典编码，如 LOCAL_CHANNEL（映射与码值都按它关联） */
  code: string
  name: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 监管字典（监管发布的码值分类，文档「码值字典维护」页维护的就是它） */
export interface RegDictRow {
  id: number
  /** 监管字典编码，如 REG_CHANNEL（监管码值与映射都按它关联） */
  code: string
  name: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

export interface LocalCodeRow {
  id: number
  /** 本地字典编码，如 LOCAL_CHANNEL */
  localDict: string
  /** 本地字典名称（冗余展示） */
  localDictName: string
  localCode: string
  localName: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  remark: string
  createTime: string
}

/** 监管码值 */
export interface RegCodeRow {
  id: number
  /** 监管字典编码，如 REG_CHANNEL */
  regDict: string
  regDictName: string
  regCode: string
  regName: string
  status: number
  remark: string
  createTime: string
}

/** 本地标准映射 */
export interface LocalMapRow {
  id: number
  localDict: string
  localDictName: string
  localCode: string
  localName: string
  regDict: string
  regDictName: string
  regCode: string
  regName: string
  /** 优先级 0~999，缺省 50：同一本地码值有多条启用映射时，数字小的生效 */
  priority: number
  status: number
  updateUser: string
  updateTime: string
  remark: string
  createTime: string
}

/** 字典编码 → 中文名（页面下拉与列表都用这里的口径，避免两边各写一份） */
const LOCAL_DICT: Array<{ code: string; name: string }> = [
  { code: 'LOCAL_CHANNEL', name: '本地销售渠道字典' },
  { code: 'LOCAL_CERT_TYPE', name: '本地证件类型字典' },
  { code: 'LOCAL_PRODUCT', name: '本地险种字典' },
  { code: 'LOCAL_ORG_TYPE', name: '本地机构类型字典' }
]

/** 本地字典种子：字典编码与名称（「本地字典管理」页可增删改，改了会同步码值与映射行上的冗余名称） */
const localDictSeed: LocalDictRow[] = LOCAL_DICT.map((item, index) => ({
  id: index + 1,
  code: item.code,
  name: item.name,
  status: 1,
  updateUser: '系统管理员',
  updateTime: '2026-09-08 10:00:00',
  remark: '',
  createTime: '2024-03-01 09:00:00'
}))

export const localDictTable = defineTable<LocalDictRow>('cr.localDict', localDictSeed)

const REG_DICT: Array<{ code: string; name: string }> = [
  { code: 'REG_CHANNEL', name: '监管销售渠道码值' },
  { code: 'REG_CERT_TYPE', name: '监管证件类型码值' },
  { code: 'REG_PRODUCT', name: '监管险种码值' },
  { code: 'REG_ORG_TYPE', name: '监管机构类型码值' }
]

/** 监管字典种子：与本地字典一一对应，映射页的「监管码值」下拉按它过滤 */
const regDictSeed: RegDictRow[] = REG_DICT.map((item, index) => ({
  id: index + 1,
  code: item.code,
  name: item.name,
  status: 1,
  updateUser: '系统管理员',
  updateTime: '2026-09-08 10:00:00',
  remark: '',
  createTime: '2024-03-01 10:00:00'
}))

export const regDictTable = defineTable<RegDictRow>('cr.regDict', regDictSeed)

const localCodeSeed: LocalCodeRow[] = []
const regCodeSeed: RegCodeRow[] = []

const pushLocal = (localDict: string, items: Array<[string, string]>) => {
  const dictName = LOCAL_DICT.find((item) => item.code === localDict)!.name
  items.forEach(([localCode, localName], index) => {
    localCodeSeed.push({
      id: localCodeSeed.length + 1,
      localDict,
      localDictName: dictName,
      localCode,
      localName,
      status: 1,
      remark: '',
      createTime: '2024-03-01 09:' + String(10 + index).padStart(2, '0') + ':00'
    })
  })
}

const pushReg = (regDict: string, items: Array<[string, string]>) => {
  const dictName = REG_DICT.find((item) => item.code === regDict)!.name
  items.forEach(([regCode, regName], index) => {
    regCodeSeed.push({
      id: regCodeSeed.length + 1,
      regDict,
      regDictName: dictName,
      regCode,
      regName,
      status: 1,
      remark: '',
      createTime: '2024-03-01 10:' + String(10 + index).padStart(2, '0') + ':00'
    })
  })
}

// 本地码值：与「数据填报」页里真实出现的渠道 / 险种取值对齐
pushLocal('LOCAL_CHANNEL', [
  ['L01', '个险'],
  ['L02', '团险'],
  ['L03', '银保'],
  ['L04', '经代'],
  ['L05', '网销'],
  ['L06', '其它']
])
pushLocal('LOCAL_CERT_TYPE', [
  ['L11', '身份证'],
  ['L12', '护照'],
  ['L13', '军官证'],
  ['L14', '港澳通行证']
])
pushLocal('LOCAL_PRODUCT', [
  ['L21', '年金保险'],
  ['L22', '终身寿险'],
  ['L23', '健康保险'],
  ['L24', '意外伤害保险']
])
pushLocal('LOCAL_ORG_TYPE', [
  ['L31', '总公司'],
  ['L32', '省级分公司'],
  ['L33', '中心支公司']
])

// 监管码值：监管方发布的码值清单
pushReg('REG_CHANNEL', [
  ['A01', '个人代理'],
  ['A02', '团体直销'],
  ['A03', '银行代理'],
  ['A04', '专业经代'],
  ['A05', '互联网'],
  ['A09', '其他']
])
pushReg('REG_CERT_TYPE', [
  ['C01', '居民身份证'],
  ['C02', '护照'],
  ['C03', '军人证件'],
  ['C04', '港澳台居民居住证']
])
pushReg('REG_PRODUCT', [
  ['P01', '年金保险'],
  ['P02', '人寿保险'],
  ['P03', '健康保险'],
  ['P04', '意外伤害保险']
])
pushReg('REG_ORG_TYPE', [
  ['G01', '法人机构'],
  ['G02', '省级分支机构'],
  ['G03', '中心支公司']
])

/** 本地字典编码 → 中文名（handler 直接返回给页面，避免前端再维护一份映射） */
/** 字典编码 → 中文名（现算：两类字典都可以在页面上改名，写死常量就会两处不一致） */
export const localDictNames = (): Record<string, string> =>
  localDictTable.all().reduce((acc, item) => ({ ...acc, [item.code]: item.name }), {})

export const regDictNames = (): Record<string, string> =>
  regDictTable.all().reduce((acc, item) => ({ ...acc, [item.code]: item.name }), {})

export const localCodeTable = defineTable<LocalCodeRow>('cr.localCode', localCodeSeed)
export const regCodeTable = defineTable<RegCodeRow>('cr.regCode', regCodeSeed)

/** 映射种子：刻意留了三类"不干净"的数据，让「映射校验」有真东西可报（演示用） */
const mapSeed: Array<{
  local: [string, string]
  reg: [string, string]
  priority?: number
  status?: number
  remark?: string
  user?: string
}> = [
  { local: ['LOCAL_CHANNEL', 'L01'], reg: ['REG_CHANNEL', 'A01'] },
  { local: ['LOCAL_CHANNEL', 'L02'], reg: ['REG_CHANNEL', 'A02'] },
  { local: ['LOCAL_CHANNEL', 'L03'], reg: ['REG_CHANNEL', 'A03'] },
  { local: ['LOCAL_CHANNEL', 'L04'], reg: ['REG_CHANNEL', 'A04'] },
  {
    local: ['LOCAL_CHANNEL', 'L05'],
    reg: ['REG_CHANNEL', 'A05'],
    remark: '互联网渠道按监管口径归入 A05'
  },
  // L06 其它：故意不配映射 → 校验报「未映射」
  { local: ['LOCAL_CERT_TYPE', 'L11'], reg: ['REG_CERT_TYPE', 'C01'] },
  { local: ['LOCAL_CERT_TYPE', 'L12'], reg: ['REG_CERT_TYPE', 'C02'] },
  { local: ['LOCAL_CERT_TYPE', 'L13'], reg: ['REG_CERT_TYPE', 'C03'] },
  // 港澳通行证配了两条：优先级 10 的生效，优先级 50 的被覆盖 → 校验报「重复映射」
  {
    local: ['LOCAL_CERT_TYPE', 'L14'],
    reg: ['REG_CERT_TYPE', 'C04'],
    priority: 10,
    remark: '监管口径按居住证报送'
  },
  {
    local: ['LOCAL_CERT_TYPE', 'L14'],
    reg: ['REG_CERT_TYPE', 'C02'],
    priority: 50,
    remark: '历史配置，已被优先级 10 的映射覆盖'
  },
  { local: ['LOCAL_PRODUCT', 'L21'], reg: ['REG_PRODUCT', 'P01'] },
  { local: ['LOCAL_PRODUCT', 'L22'], reg: ['REG_PRODUCT', 'P02'] },
  { local: ['LOCAL_PRODUCT', 'L23'], reg: ['REG_PRODUCT', 'P03'] },
  { local: ['LOCAL_PRODUCT', 'L24'], reg: ['REG_PRODUCT', 'P04'] },
  { local: ['LOCAL_ORG_TYPE', 'L31'], reg: ['REG_ORG_TYPE', 'G01'] },
  { local: ['LOCAL_ORG_TYPE', 'L32'], reg: ['REG_ORG_TYPE', 'G02'] },
  // 指向一个监管码值表里不存在的码值 → 校验报「指向的监管码值不存在」
  {
    local: ['LOCAL_ORG_TYPE', 'L33'],
    reg: ['REG_ORG_TYPE', 'G09'],
    remark: '监管方 2026 年新增码值，尚未同步'
  },
  // 已停用示例：停用不计入未映射，但会在校验报告里单列
  {
    local: ['LOCAL_CHANNEL', 'L06'],
    reg: ['REG_CHANNEL', 'A09'],
    status: 0,
    remark: '已停用示例：其它渠道暂不报送'
  }
]

const mapSeedRows: LocalMapRow[] = mapSeed.map((item, index) => {
  const local = localCodeSeed.find(
    (row) => row.localDict === item.local[0] && row.localCode === item.local[1]
  )!
  const reg = regCodeSeed.find((row) => row.regDict === item.reg[0] && row.regCode === item.reg[1])
  return {
    id: index + 1,
    localDict: local.localDict,
    localDictName: local.localDictName,
    localCode: local.localCode,
    localName: local.localName,
    regDict: item.reg[0],
    regDictName: REG_DICT.find((dict) => dict.code === item.reg[0])!.name,
    // 指向不存在的监管码值时也照样落库（校验报告要能报出来），名称留空
    regCode: item.reg[1],
    regName: reg ? reg.regName : '',
    priority: item.priority === undefined ? 50 : item.priority,
    status: item.status === undefined ? 1 : item.status,
    updateUser: item.user || '系统管理员',
    updateTime: '2026-09-05 1' + (index % 9) + ':20:00',
    remark: item.remark || '',
    createTime: '2024-03-02 09:' + String(10 + (index % 40)).padStart(2, '0') + ':00'
  }
})

export const localMapTable = defineTable<LocalMapRow>('cr.localMap', mapSeedRows)

/** 本地字典 / 监管字典下拉（带码值条数，页面上能看出字典规模） */
export const localDictOptions = () =>
  localDictTable.all().map((dict) => ({
    localDict: dict.code,
    dictName: dict.name,
    count: localCodeTable.all().filter((row) => row.localDict === dict.code && row.status === 1)
      .length
  }))

export const regDictOptions = () =>
  regDictTable.all().map((dict) => ({
    regDict: dict.code,
    dictName: dict.name,
    count: regCodeTable.all().filter((row) => row.regDict === dict.code && row.status === 1).length
  }))

/** 生效判断的三态：与脱敏字段配置页的写法保持一致（中文名由服务端给） */
export const MAP_STATE_LABEL = {
  EFFECTIVE: '生效中',
  COVERED: '被覆盖',
  DISABLED: '已停用'
} as const

/** 同一「本地字典 × 本地码值」的候选映射，按判定顺序排好（优先级小的 → 同优先级后建的） */
const candidatesOf = (localDict: string, localCode: string) =>
  localMapTable
    .all()
    .filter((row) => row.localDict === localDict && row.localCode === localCode && row.status === 1)
    .sort((a, b) => Number(a.priority || 50) - Number(b.priority || 50) || b.id - a.id)

/** 每条映射的生效判断：生效中 / 被覆盖（并指出被哪条盖住）/ 已停用 */
export const localMapDecisions = (): Record<
  number,
  { state: string; stateLabel: string; reason: string; effectiveId: number }
> => {
  const result: Record<
    number,
    { state: string; stateLabel: string; reason: string; effectiveId: number }
  > = {}
  const groups = new Map<string, LocalMapRow[]>()
  localMapTable.all().forEach((row) => {
    const key = row.localDict + '|' + row.localCode
    groups.set(key, (groups.get(key) || []).concat(row))
  })
  groups.forEach((rows) => {
    const enabled = rows.filter((row) => row.status === 1)
    const winner = enabled
      .slice()
      .sort((a, b) => Number(a.priority || 50) - Number(b.priority || 50) || b.id - a.id)[0]
    rows.forEach((row) => {
      if (row.status !== 1) {
        result[row.id] = {
          state: 'DISABLED',
          stateLabel: MAP_STATE_LABEL.DISABLED,
          reason: '本条映射已停用，不参与报送取数',
          effectiveId: winner ? winner.id : 0
        }
      } else if (winner && winner.id === row.id) {
        result[row.id] = {
          state: 'EFFECTIVE',
          stateLabel: MAP_STATE_LABEL.EFFECTIVE,
          reason:
            enabled.length > 1
              ? '同码值有 ' + enabled.length + ' 条启用映射，本条优先级最小（相同则后建的）'
              : '同码值唯一启用映射',
          effectiveId: row.id
        }
      } else {
        result[row.id] = {
          state: 'COVERED',
          stateLabel: MAP_STATE_LABEL.COVERED,
          reason:
            '被同一本地码值下的第 ' +
            (winner ? winner.id : '-') +
            ' 条映射盖住（优先级 ' +
            (winner ? winner.priority : '-') +
            (winner && Number(winner.priority) === Number(row.priority)
              ? '，与本条相同，后建的生效'
              : '，比本条小') +
            ' → ' +
            (winner ? winner.regCode : '-') +
            '）',
          effectiveId: winner ? winner.id : 0
        }
      }
    })
  })
  return result
}

/** 校验问题类型 */
export const MAP_ISSUE = {
  UNMAPPED: '未映射',
  DUPLICATE: '重复映射',
  MISSING_REG: '监管码值不存在',
  DISABLED_MAP: '已停用'
} as const

export interface LocalMapIssue {
  id: string
  type: string
  level: 'error' | 'warn'
  target: string
  message: string
  suggestion: string
}

/**
 * 映射完整性校验（只算不写）。
 *
 * 三类会拦下报送的错误 + 一类提示：
 *   1) 未映射：本地码值没有任何启用映射 → 报文取不到监管码值（error）
 *   2) 重复映射：同一本地码值有多条启用映射 → 取数结果取决于优先级，容易踩坑（warn）
 *   3) 监管码值不存在：映射指向的监管码值在监管码值表里查不到（error）
 *   4) 已停用：停用的映射单独列出，便于确认"是不是忘了启"（warn）
 */
export const localMapReport = () => {
  const locals = localCodeTable.all().filter((row) => row.status === 1)
  const regs = regCodeTable.all()
  const maps = localMapTable.all()
  const issues: LocalMapIssue[] = []

  locals.forEach((local) => {
    const enabled = maps.filter(
      (row) =>
        row.localDict === local.localDict && row.localCode === local.localCode && row.status === 1
    )
    const target = local.localDictName + ' / ' + local.localCode + ' ' + local.localName
    if (!enabled.length) {
      // 一条映射都没有 = error（必须新建）；只有停用的映射 = warn（启用即可，
      // 与种子注释「停用不计入未映射」一致：这类码值不再同时算进未映射错误）
      const onlyDisabled = maps.some(
        (row) =>
          row.localDict === local.localDict && row.localCode === local.localCode && row.status !== 1
      )
      issues.push({
        id: 'UNMAPPED-' + local.localDict + '-' + local.localCode,
        type: MAP_ISSUE.UNMAPPED,
        level: onlyDisabled ? 'warn' : 'error',
        target,
        message: onlyDisabled
          ? '该本地码值只有停用状态的映射，报文同样取不到监管码值'
          : '该本地码值没有任何启用中的映射，报文无法取到监管码值',
        suggestion: onlyDisabled
          ? '编辑那条停用映射并启用，或新增一条指向监管码值的映射'
          : '在「本地标准映射」里新增一条指向监管码值的映射'
      })
      return
    }
    if (enabled.length > 1) {
      const sorted = enabled
        .slice()
        .sort((a, b) => Number(a.priority || 50) - Number(b.priority || 50) || b.id - a.id)
      issues.push({
        id: 'DUPLICATE-' + local.localDict + '-' + local.localCode,
        type: MAP_ISSUE.DUPLICATE,
        level: 'warn',
        target,
        message:
          '有 ' +
          enabled.length +
          ' 条启用映射（' +
          sorted.map((row) => row.regCode + ' 优先级 ' + row.priority).join('、') +
          '），当前生效的是 ' +
          sorted[0].regCode,
        suggestion: '确认是否只需要保留一条；确实需要多条时把不生效的那条停用'
      })
    }
  })

  maps.forEach((row) => {
    const reg = regs.find((item) => item.regDict === row.regDict && item.regCode === row.regCode)
    if (row.status === 1 && !reg) {
      issues.push({
        id: 'MISSING-' + row.id,
        type: MAP_ISSUE.MISSING_REG,
        level: 'error',
        target:
          row.localDictName + ' / ' + row.localCode + ' ' + row.localName + ' → ' + row.regCode,
        message: '映射指向的监管码值「' + row.regCode + '」在' + row.regDictName + '里不存在',
        suggestion: '核对监管方最新码值表，改成存在的监管码值或补录监管码值'
      })
    }
    if (row.status !== 1) {
      issues.push({
        id: 'DISABLED-' + row.id,
        type: MAP_ISSUE.DISABLED_MAP,
        level: 'warn',
        target:
          row.localDictName + ' / ' + row.localCode + ' ' + row.localName + ' → ' + row.regCode,
        message: '这条映射处于停用状态，不会参与报送取数',
        suggestion: '如果只是临时调整，重新启用即可'
      })
    }
  })

  const unmapped = issues.filter((item) => item.type === MAP_ISSUE.UNMAPPED).length
  const duplicate = issues.filter((item) => item.type === MAP_ISSUE.DUPLICATE).length
  const missingReg = issues.filter((item) => item.type === MAP_ISSUE.MISSING_REG).length
  const disabled = issues.filter((item) => item.type === MAP_ISSUE.DISABLED_MAP).length
  const errorCount = issues.filter((item) => item.level === 'error').length
  // 「能取到监管码值」= 该本地码值至少有一条启用映射，且其中至少一条指向真实存在的监管码值。
  // 以前用 locals.length - unmapped，指向不存在监管码值的那条也算已映射，覆盖率虚高。
  const resolvable = (local: (typeof locals)[number]) =>
    maps.some(
      (row) =>
        row.localDict === local.localDict &&
        row.localCode === local.localCode &&
        row.status === 1 &&
        regs.some((reg) => reg.regDict === row.regDict && reg.regCode === row.regCode)
    )
  const mappedLocalCount = locals.filter(resolvable).length
  const unresolvableCount = locals.length - mappedLocalCount - unmapped

  return {
    checkedAt: '校验完成',
    stats: {
      localTotal: locals.length,
      mapTotal: maps.length,
      mappedLocalCount,
      unmappedCount: unmapped,
      // 有启用映射、但指向的监管码值都不存在：也取不到值，单列出来
      unresolvableCount,
      duplicateCount: duplicate,
      missingRegCount: missingReg,
      disabledCount: disabled,
      errorCount,
      // 覆盖率口径写清楚：启用中的本地码值里，能真正取到监管码值的比例
      coverRate: locals.length ? Math.round((mappedLocalCount / locals.length) * 1000) / 10 : 100
    },
    summary:
      errorCount === 0
        ? '校验通过：' + locals.length + ' 个启用本地码值全部能取到监管码值'
        : '发现 ' +
          errorCount +
          ' 个必须处理的问题（未映射 ' +
          unmapped +
          ' / 监管码值不存在 ' +
          missingReg +
          '）',
    issues
  }
}

/** 单个本地码值的生效映射（供其它模块取数用，页面不直接调） */
export const effectiveLocalMap = (localDict: string, localCode: string): LocalMapRow | undefined =>
  candidatesOf(localDict, localCode)[0]
