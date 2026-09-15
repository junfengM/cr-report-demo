/**
 * 数据导入的文件解析（纯函数，供 ImportDialog 调用）
 *
 * 为什么单独抽出来：解析规则（分隔符 / 表头行数 / 列映射 / 必填与格式校验）是这个页面的核心业务，
 * 放在组件里既难测也难复用（以后要做服务端解析，规则可以直接搬）。
 * 这里只依赖「生效导入设置」这个结构，不依赖任何 Vue 或 DOM。
 */

/** 演示环境单批入库上限：避免一个几十万行的文件把 localStorage 写爆 */
export const MAX_IMPORT_ROWS = 300

/** 生效导入设置里的字段映射项 */
export interface ParseMappingItem {
  column: number
  field: string
  label: string
}

/** 解析用的配置（/cr/import-config/effective 返回的 config 里被用到的字段） */
export interface ParseConfig {
  separator: string
  charset: string
  headerRows: number
  startRow: number
  dateFormat: string
  mapping: ParseMappingItem[]
}

/** 错误行 / 警告行 */
export interface ParseErrorRow {
  rowNo: number
  content: string
  errorField: string
  errorMsg: string
  /** 1 错误（严格校验下整批失败、否则转待审核），2 警告（可入库但记录在案） */
  level: number
}

export interface ParseResult {
  validRows: Array<Record<string, any>>
  errorRows: ParseErrorRow[]
  totalRows: number
}

/** 分隔符兜底：XLSX 模板里分隔符写着「—」，不参与切列 */
export const effectiveSeparator = (config: ParseConfig): string =>
  config.separator && config.separator !== '—' ? config.separator : ','

/**
 * 读文件文本：编码按生效模板来（GBK 走 TextDecoder('gbk')，Chrome 支持）
 * 解码失败不抛错，退回 UTF-8，避免一个编码不对的文件把导入整个卡死。
 */
export const decodeFile = async (file: File, charset: string): Promise<string> => {
  const buffer = await file.arrayBuffer()
  const name = String(charset || 'UTF-8').toLowerCase()
  try {
    return new TextDecoder(name === 'utf-8' ? 'utf-8' : name).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

/** 按生效模板的日期格式生成校验正则 */
export const dateRegExpOf = (dateFormat: string): RegExp => {
  if (dateFormat === 'yyyyMMdd') return /^\d{8}$/
  if (dateFormat === 'yyyy/MM/dd') return /^\d{4}\/\d{2}\/\d{2}$/
  return /^\d{4}-\d{2}-\d{2}$/
}

/**
 * 解析「已经切好的二维表」——CSV 文本切出来的列、XLSX 读出来的单元格矩阵都走这里。
 *
 * 为什么要把核心抽成二维表入参：Excel 与 CSV 的业务规则（必填 / 重复 / 数值 / 日期 / 列数）
 * 必须完全一致，各写一套迟早会漂移。文件怎么变成行是各自的适配器的事。
 *
 * 四条校验规则（演示口径，页面上也写给用户看）：
 *   1. 列数要够（少于映射列数说明分隔符或模板不对）
 *   2. 保单号必填、且同一批次内不重复
 *   3. 金额类字段必须是数字
 *   4. 生效日期要匹配生效模板里的日期格式
 * 数据状态为空只给警告（按「正常」处理），不拦行。
 */
export const parseImportRows = (sheetRows: string[][], config: ParseConfig): ParseResult => {
  const separator = effectiveSeparator(config)
  const startRow = Number(config.startRow) || Number(config.headerRows || 0) + 1
  const mapping = config.mapping || []
  const dateRegExp = dateRegExpOf(config.dateFormat || 'yyyy-MM-dd')
  const validRows: Array<Record<string, any>> = []
  const errorRows: ParseErrorRow[] = []
  const seenPolicy = new Set<string>()

  ;(sheetRows || []).forEach((rawCells, index) => {
    const lineNo = index + 1
    // 表头与前导行直接跳过
    if (lineNo < startRow) return
    const cells = (rawCells || []).map((cell) =>
      String(cell ?? '')
        .trim()
        .replace(/^"|"$/g, '')
    )
    // 空行跳过，但**不重排行号**：行号要等于文件里的真实行号（Excel 里看到第几行就是第几行）
    if (!cells.length || cells.every((cell) => cell === '')) return
    const pushError = (errorField: string, errorMsg: string, level = 1) => {
      errorRows.push({
        rowNo: lineNo,
        content: cells.join(separator).slice(0, 200),
        errorField,
        errorMsg,
        level
      })
    }
    if (cells.length < mapping.length) {
      pushError(
        'separator',
        '字段个数与字段映射不一致（期望 ' + mapping.length + ' 列，实际 ' + cells.length + ' 列）'
      )
      return
    }
    const row: Record<string, any> = {}
    mapping.forEach((item) => {
      row[item.field] = cells[item.column - 1] === undefined ? '' : cells[item.column - 1]
    })
    if (!row.policyNo) {
      pushError('policyNo', '保单号不能为空')
      return
    }
    if (seenPolicy.has(row.policyNo)) {
      pushError('policyNo', '保单号在同一批次内重复')
      return
    }
    if (row.premiumAmount !== '' && isNaN(Number(row.premiumAmount))) {
      pushError('premiumAmount', '保费金额必须为数字')
      return
    }
    if (row.rate !== '' && isNaN(Number(row.rate))) {
      pushError('rate', '费率必须为数字')
      return
    }
    if (row.effectDate && !dateRegExp.test(String(row.effectDate))) {
      pushError('effectDate', '保单生效日期格式应为 ' + (config.dateFormat || 'yyyy-MM-dd'))
      return
    }
    if (!row.dataStatus) {
      row.dataStatus = '正常'
      pushError('dataStatus', '数据状态为空，已按「正常」处理', 2)
    }
    seenPolicy.add(row.policyNo)
    validRows.push(row)
  })

  return { validRows, errorRows, totalRows: validRows.length + errorRows.length }
}

/**
 * 解析 CSV / TXT 文本：按生效模板的分隔符切列后交给 parseImportRows。
 * 空行在这里保留（不预过滤），由 parseImportRows 按内容跳过，这样行号与文件真实行号一致。
 */
export const parseImportText = (text: string, config: ParseConfig): ParseResult => {
  const separator = effectiveSeparator(config)
  const rows = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.split(separator))
  return parseImportRows(rows, config)
}

/**
 * XLSX 单元格矩阵 → 与 CSV 同构的二维表。
 *
 * xlsx 里的日期被读取器归一化成 yyyy-MM-dd，而生效模板的日期格式可能是 yyyyMMdd / yyyy/MM/dd，
 * 这里按模板把 ISO 日期改写成模板要求的写法，后面就能和 CSV 走同一套校验。
 */
export const rowsFromXlsxSheet = (sheetRows: string[][], config: ParseConfig): string[][] => {
  const dateFormat = config.dateFormat || 'yyyy-MM-dd'
  if (dateFormat === 'yyyy-MM-dd') return sheetRows
  return (sheetRows || []).map((cells) =>
    (cells || []).map((cell) => {
      const value = String(cell ?? '')
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!match) return value
      if (dateFormat === 'yyyyMMdd') return match[1] + match[2] + match[3]
      if (dateFormat === 'yyyy/MM/dd') return match[1] + '/' + match[2] + '/' + match[3]
      return value
    })
  )
}

/**
 * 生成导入模板 CSV：按生效模板的字段映射出表头 + 3 行示例数据，
 * 演示时「下载模板 → 填几行 → 上传」就能跑通，不用猜分隔符与列顺序。
 */
export const buildTemplateCsv = (config: ParseConfig, period?: string): string => {
  const separator = effectiveSeparator(config)
  const header = (config.mapping || []).map((item) => item.label).join(separator)
  const prefix = 'HX' + (period || '202608')
  const samples = [
    [
      prefix + '000001',
      '王芳',
      '110101199001011234',
      '安康重疾险',
      '2600.00',
      '0.032',
      '81250.00',
      '2026-08-01',
      '银保',
      '正常'
    ],
    [
      prefix + '000002',
      '李强',
      '110101198801013456',
      '百万医疗险',
      '1800.00',
      '0.050',
      '36000.00',
      '2026-08-02',
      '网销',
      '正常'
    ],
    [
      prefix + '000003',
      '周婷',
      '110101199507081234',
      '终身寿险',
      '5400.00',
      '0.020',
      '270000.00',
      '2026-08-03',
      '个险',
      '正常'
    ]
  ]
  const lines = [header].concat(
    samples.map((row) => row.slice(0, (config.mapping || []).length).join(separator))
  )
  // 带 BOM，Excel 打开不乱码
  return '\ufeff' + lines.join('\n')
}

/** 模板文件名 */
export const templateFileName = (reportId?: number, period?: string): string =>
  '导入模板_' + (reportId || 0) + '_' + (period || '') + '.csv'
