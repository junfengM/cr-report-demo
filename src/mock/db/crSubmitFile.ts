/**
 * Mock 报文文件生成器 —— 「一键报送」域共用（列表口径与下载内容唯一来源）
 *
 * 为什么要有这个文件：
 * 「报文状态查询」列表上的文件名 / 数据行数 / 文件大小，必须与点「下载报文」真正拿到的
 * Blob 完全一致。因此本文件是唯一的生成口径：
 * - 列表 fileSize（报文状态、报文生成记录、报送清单明细）= submitFileBytes(...) 的真实字节数；
 * - 下载接口 buildSubmitFile(...) 生成同一份内容，bytes === blob.size；
 * - 不再有第二套“估算公式”，也不会把行数截断。
 *
 * 三种格式与文件名后缀一一对应（后缀即内容格式，后缀即页面提示）：
 * - TXT：监管常见的竖线分隔纯文本，首行字段名表头，没有 CSV 包装、没有「行号,报文内容」这种假列；
 * - CSV：真正的逗号分隔文件，带表头与 UTF-8 BOM（Excel 直接打开中文不乱码，字段无需引号包裹）；
 * - XML：声明 + 根节点 <report> + 每行一个 <record>，结构良好、可直接解析。
 *
 * 行内容按定宽构造（保单号 13 位、机构编码 6 位、金额 8 位整数 + 2 位小数、证件号 18 位脱敏 …），
 * 每行字节数恒定，所以
 *     文件大小 = 头部字节 + 数据行数 × 单行字节 + 尾部字节
 * 可以精确算出：上万行的种子数据无需真的拼出全文，也能得到与下载严格相等的字节数
 * （模块加载时会自检「公式 == 实际生成」，对不上直接抛错，避免再次出现列表与下载两张皮）。
 */

export type ReportFileFormat = 'TXT' | 'CSV' | 'XML'

export interface ReportFileOptions {
  /** 文件格式（缺省 TXT；一般由文件名后缀推导，见 formatOfFile） */
  format?: ReportFileFormat
  /** 字段分隔符：TXT 取机构配置里的分隔符，CSV 固定逗号 */
  separator?: string
  /** 表头行数：> 0 时输出一行字段名表头（XML 无表头行） */
  headerRows?: number
}

/** 报文文件元信息：同一条报文记录，列表、生成、下载三处必须传同一份 */
export interface ReportFileMeta {
  orgCode: string
  orgName?: string
  reportCode: string
  reportName?: string
  period: string
  /** 报文数据行数（列表展示的 dataRows，实际生成的行数就是它） */
  dataRows: number
  /** 报文生成时间 */
  generateTime?: string
  /** 上报方式（SFTP / FTP / MANUAL） */
  reportType?: string
}

export interface SubmitFile {
  format: ReportFileFormat
  /** 与格式匹配的后缀（不含点） */
  ext: string
  mime: string
  meta: ReportFileMeta
  /** 与下载完全一致的文本内容 */
  text: string
  /** UTF-8 字节数，等于 blob.size（列表 fileSize 用的就是它） */
  bytes: number
  /** 数据行数（= meta.dataRows，文件里一行一条业务数据） */
  dataRows: number
  /** 文件总行数（含表头 / XML 声明与根节点） */
  lineCount: number
  blob: Blob
}

/* ==================================================================
 * 格式与后缀
 * ================================================================== */
const EOL = '\n'
/** CSV 加 BOM：Excel 打开中文不乱码（字节数已计入 bytes） */
const BOM = '\ufeff'
const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>'

export const FORMAT_EXT: Record<ReportFileFormat, string> = { TXT: 'txt', CSV: 'csv', XML: 'xml' }

export const FORMAT_MIME: Record<ReportFileFormat, string> = {
  TXT: 'text/plain;charset=utf-8',
  CSV: 'text/csv;charset=utf-8',
  XML: 'application/xml;charset=utf-8'
}

/** 从命名规则里取扩展名：HX_{orgCode}_{reportCode}_{period}.xml → xml */
export const extOfRule = (rule: string, fallback = 'txt'): string => {
  const match = String(rule || '').match(/\.([A-Za-z0-9]+)\s*$/)
  return match ? match[1].toLowerCase() : fallback
}

/** 格式的规范分隔符：TXT 竖线分隔、CSV 逗号分隔（XML 无分隔符） */
export const defaultSeparatorOf = (format: ReportFileFormat): string =>
  format === 'CSV' ? ',' : '|'

/** 文件后缀 → 内容格式（列表上的文件名是权威口径：显示 .csv 就必须给 CSV） */
export const formatOfFile = (
  fileName?: string,
  fallback: ReportFileFormat = 'TXT'
): ReportFileFormat => {
  const ext = extOfRule(String(fileName || ''), '')
  if (ext === 'csv') return 'CSV'
  if (ext === 'xml') return 'XML'
  if (ext === 'txt') return 'TXT'
  return FORMAT_EXT[fallback] ? fallback : 'TXT'
}

/* ==================================================================
 * 字节与定宽
 * ================================================================== */
const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : undefined

/** UTF-8 字节数（Blob 里的字符串就是按 UTF-8 编码的，bytes === blob.size） */
export const utf8Bytes = (text: string): number => {
  if (encoder) return encoder.encode(text).length
  // 极端环境兜底：手算 UTF-8 长度
  let bytes = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

/** 定宽（不足左补 0，超长取低位），保证每行字节数恒定 */
const fixed = (value: string | number, width: number): string => {
  const text = String(value)
  if (text.length === width) return text
  return text.length < width ? text.padStart(width, '0') : text.slice(-width)
}

/* ==================================================================
 * 报文数据行（与页面其它域口径一致：保单号 P2026080012、脱敏证件号、机构编码、金额）
 * ================================================================== */
interface ColumnSpec {
  /** XML 标签名 */
  key: string
  /** TXT / CSV 表头列名 */
  label: string
  width: number
}

const COLUMNS: ColumnSpec[] = [
  { key: 'policyNo', label: '保单号/业务号', width: 13 },
  { key: 'orgCode', label: '机构编码', width: 6 },
  { key: 'reportCode', label: '报表编码', width: 5 },
  { key: 'dataDate', label: '数据日期', width: 10 },
  { key: 'bizType', label: '业务类型', width: 4 },
  { key: 'sumAssured', label: '保险金额(元)', width: 11 },
  { key: 'premium', label: '保费金额(元)', width: 9 },
  { key: 'certNo', label: '证件号码(脱敏)', width: 18 },
  { key: 'statusCode', label: '数据状态', width: 2 }
]

/** 证件号前 6 位（行政区划码，与机构编码同口径） */
const AREA_CODES = ['110101', '110105', '110108', '310104', '320105', '320505', '440103', '440304']

const hashOf = (text: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 确定性伪随机：同一条报文任何时候生成的明细完全一致（演示可复现） */
const rand = (base: number, index: number, salt: number): number => {
  let h = Math.imul(base ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ index, 0xc2b2ae35)
  h = Math.imul(h ^ salt, 0x27d4eb2f)
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491)
  return (h ^ (h >>> 13)) >>> 0
}

/** 第 index 行（从 0 开始）的字段值，全部定宽 ASCII */
const recordValues = (meta: ReportFileMeta, index: number): string[] => {
  const base = hashOf(`${meta.reportCode}|${meta.period}|${meta.orgCode}`)
  const period = fixed(meta.period, 6)
  return [
    // 保单号/业务号：P202608000123（P + 期次 6 位 + 序号 6 位）
    `P${period}${fixed(index + 1, 6)}`,
    fixed(meta.orgCode, 6),
    fixed(meta.reportCode, 5),
    // 数据日期：期次所在月的 1~28 日
    `${period.slice(0, 4)}-${period.slice(4, 6)}-${fixed(1 + (index % 28), 2)}`,
    `BT${fixed(1 + (rand(base, index, 11) % 9), 2)}`,
    // 保险金额：8 位整数 + 2 位小数（1000 万 ~ 1 亿）
    `${10000000 + (rand(base, index, 23) % 90000000)}.${fixed(rand(base, index, 37) % 100, 2)}`,
    // 保费金额：6 位整数 + 2 位小数（10 万 ~ 100 万）
    `${100000 + (rand(base, index, 41) % 900000)}.${fixed(rand(base, index, 53) % 100, 2)}`,
    // 证件号码（脱敏）：前 6 位区划码 + 8 位掩码 + 后 4 位
    `${AREA_CODES[rand(base, index, 61) % AREA_CODES.length]}********${fixed(
      rand(base, index, 67) % 10000,
      4
    )}`,
    `0${1 + (rand(base, index, 71) % 3)}`
  ]
}

/** XML 属性值转义（标签内容都是定宽 ASCII，无需转义） */
const xmlAttr = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/* ==================================================================
 * 三段式内容：头部（表头 / XML 声明与根节点）+ 数据行 + 尾部（XML 闭合）
 * ================================================================== */
interface FileParts {
  format: ReportFileFormat
  rows: number
  separator: string
  headerRows: number
  head: string
  tail: string
  /** 单行字节数：行内只有定宽 ASCII，任取一行即可代表所有行 */
  recordBytes: number
}

const normalize = (meta: ReportFileMeta, options: ReportFileOptions): FileParts => {
  const format = options.format || 'TXT'
  const rows = Math.max(0, Math.floor(Number(meta.dataRows) || 0))
  const separator = format === 'CSV' ? ',' : String(options.separator || '|')
  const headerRows =
    format === 'XML' ? 0 : Math.max(0, Math.min(1, Number(options.headerRows ?? 1)))

  const head =
    format === 'XML'
      ? `${XML_DECL}${EOL}<report${[
          ['orgCode', fixed(meta.orgCode, 6)],
          ['orgName', meta.orgName || ''],
          ['reportCode', fixed(meta.reportCode, 5)],
          ['reportName', meta.reportName || ''],
          ['period', fixed(meta.period, 6)],
          ['recordCount', String(rows)],
          ['generateTime', meta.generateTime || ''],
          ['reportType', meta.reportType || '']
        ]
          .filter(([, value]) => value !== '')
          .map(([name, value]) => ` ${name}="${xmlAttr(value)}"`)
          .join('')}>${EOL}`
      : `${format === 'CSV' ? BOM : ''}${
          headerRows > 0 ? COLUMNS.map((column) => column.label).join(separator) + EOL : ''
        }`

  const tail = format === 'XML' ? `</report>${EOL}` : ''

  return {
    format,
    rows,
    separator,
    headerRows,
    head,
    tail,
    recordBytes: utf8Bytes(recordLine(meta, format, separator, 0))
  }
}

/** 单行报文内容 */
const recordLine = (
  meta: ReportFileMeta,
  format: ReportFileFormat,
  separator: string,
  index: number
): string => {
  const values = recordValues(meta, index)
  if (format === 'XML') {
    const body = COLUMNS.map((column, i) => `    <${column.key}>${values[i]}</${column.key}>`).join(
      EOL
    )
    return `  <record seq="${fixed(index + 1, 6)}">${EOL}${body}${EOL}  </record>${EOL}`
  }
  // 字段值为定宽 ASCII（数字 / 字母 / 点 / 星号），不含逗号与引号，CSV 无需再加引号包裹
  return values.join(separator) + EOL
}

/**
 * 报文文件字节数 —— 列表 fileSize 的唯一来源。
 * 与 buildSubmitFile(...).bytes 严格相等（含 CSV 的 BOM 与 XML 的声明、根节点）。
 */
export const submitFileBytes = (meta: ReportFileMeta, options: ReportFileOptions = {}): number => {
  const parts = normalize(meta, options)
  return utf8Bytes(parts.head) + parts.rows * parts.recordBytes + utf8Bytes(parts.tail)
}

/** 生成完整报文文件（下载接口用），内容与 submitFileBytes 的口径完全一致 */
export const buildSubmitFile = (
  meta: ReportFileMeta,
  options: ReportFileOptions = {}
): SubmitFile => {
  const parts = normalize(meta, options)
  const lines: string[] = []
  for (let index = 0; index < parts.rows; index++) {
    lines.push(recordLine(meta, parts.format, parts.separator, index))
  }
  const text = parts.head + lines.join('') + parts.tail
  const blob = new Blob([text], { type: FORMAT_MIME[parts.format] })
  return {
    format: parts.format,
    ext: FORMAT_EXT[parts.format],
    mime: FORMAT_MIME[parts.format],
    meta,
    text,
    bytes: blob.size,
    dataRows: parts.rows,
    lineCount: text ? text.split(EOL).length - (text.endsWith(EOL) ? 1 : 0) : 0,
    blob
  }
}

/** 文件大小可读文案（日志 / 导出共用） */
export const fileSizeText = (size: number): string => {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

/* ==================================================================
 * 自检：公式口径必须等于实际生成（对不上直接抛错，避免列表与下载再次不一致）
 * ================================================================== */
const selfCheck = (): void => {
  const meta = (dataRows: number): ReportFileMeta => ({
    orgCode: '440000',
    orgName: '广东分公司',
    reportCode: 'BX012',
    reportName: '缴费信息表',
    period: '202608',
    dataRows,
    generateTime: '2026-09-12 10:20:30',
    reportType: 'SFTP'
  })
  const cases: Array<[ReportFileFormat, ReportFileOptions]> = [
    ['TXT', { format: 'TXT', separator: '|', headerRows: 1 }],
    ['CSV', { format: 'CSV', separator: ',', headerRows: 1 }],
    ['XML', { format: 'XML', headerRows: 0 }]
  ]
  cases.forEach(([format, options]) => {
    ;[0, 1, 3, 17, 4096].forEach((dataRows) => {
      const built = buildSubmitFile(meta(dataRows), options)
      const expected = submitFileBytes(meta(dataRows), options)
      if (built.bytes !== expected || built.dataRows !== dataRows) {
        throw new Error(
          `[Mock] 报文大小口径不一致：${format} ${dataRows} 行，实际生成 ${built.bytes} 字节 / 公式 ${expected} 字节`
        )
      }
      if (utf8Bytes(built.text) !== built.bytes) {
        throw new Error(
          `[Mock] ${format} 报文文本字节数 ${utf8Bytes(built.text)} 与 Blob 大小 ${built.bytes} 不一致`
        )
      }
    })
    // 定宽校验：首行与最后一行必须等长（否则公式外推不成立）
    const head = recordLine(meta(0), format, options.separator || '|', 0)
    const tail = recordLine(meta(0), format, options.separator || '|', 49999)
    if (head.length !== tail.length) {
      throw new Error(`[Mock] ${format} 报文明细行长度不固定：${head.length} != ${tail.length}`)
    }
  })
}
selfCheck()
