/**
 * xlsx 读取（纯函数，零依赖，供 ImportDialog 调用）
 *
 * 为什么自己解包：本项目是纯前端 Demo，硬约束是不新增 npm 依赖，而 xlsx/exceljs/jszip 都没装，
 * 所以只用浏览器原生能力：DecompressionStream('deflate-raw') 解 ZIP 的 deflate 流，
 * TextDecoder 解 XML 文本，其余（EOCD / 中央目录 / 单元格还原）都手写。
 *
 * 为什么用正则而不是 DOMParser：DOMParser 会把命名空间（例如 <x:worksheet>）与
 * 自闭合标签的写法差异带进来，行为随文档变形而变；xlsx 的这几份 XML 结构固定，
 * 正则更可预测，也方便在内联 Str / 富文本上做「按需取文本」。
 *
 * 只做演示需要的部分：不处理 ZIP64、不处理加密工作簿、不做公式计算（只取缓存结果 <v>）、
 * 不还原样式（除日期判定外）。任何解包 / 解析失败都抛中文 Error，绝不吞异常返回空数组，
 * 避免页面把「解析失败」当成「文件里没有数据」。
 */

/** 解析上限：与 parseFile.ts 的 MAX_IMPORT_ROWS 对齐，避免一个几十万行的文件把页面写爆 */
export const XLSX_MAX_ROWS = 300

export interface XlsxSheetResult {
  sheetName: string
  /** 行 → 列 的文本矩阵；不足的单元格补空字符串；日期单元格已归一化成 YYYY-MM-DD */
  rows: string[][]
}

/** 中央目录里一条条目的元信息（大小取中央目录的，不用 local header 的） */
interface ZipEntryMeta {
  name: string
  method: number
  size: number
  localOffset: number
}

/** 一个工作表在 workbook.xml.rels 里登记的位置 */
interface SheetRef {
  name: string
  path: string
}

/** 工作表列号（0 起）与目标行号（1 起） */
interface CellPosition {
  col: number
  row: number
}

/** 已解析出的一个单元格文本 */
interface CellValue {
  position: CellPosition
  value: string
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
/** EOCD 固定 22 字节；再往前多扫 64KB，兼容有注释的 ZIP */
const EOCD_MAX_SCAN = 22 + 65536

/**
 * 浏览器能力判断：页面先问这个再决定提示，避免点了上传才白屏。
 * 两个能力缺一不可：DecompressionStream 解 deflate，TextDecoder 解 XML。
 */
export const isXlsxSupported = (): boolean =>
  typeof DecompressionStream === 'function' && typeof TextDecoder === 'function'

/** 表格里的数字单元格：只有确认是日期格式才转日期，其余一律原样输出（不猜） */
const formatNumberCell = (raw: string, isDateStyle: boolean, useDate1904: boolean): string => {
  if (!isDateStyle) return raw
  const serial = Number(raw)
  if (!Number.isFinite(serial)) return raw
  return excelSerialToDate(serial, useDate1904)
}

/**
 * 日期序列号 → YYYY-MM-DD
 * 1900 系统基准是 1899-12-30，隐含处理了 Excel 的 1900-02-29 历史 bug（序列号 60 及以后减掉的 1 天）。
 * 取整用 round 而不是 floor，避免浮点误差把 45000 存成 44999.999999 时差一天。
 */
const excelSerialToDate = (serial: number, useDate1904: boolean): string => {
  const days = Math.round(serial)
  if (!Number.isFinite(days)) return ''
  const ms = useDate1904
    ? Date.UTC(1904, 0, 1) + days * 86400000
    : Date.UTC(1899, 11, 30) + days * 86400000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return date.getUTCFullYear() + '-' + month + '-' + day
}

// ---------------------------------------------------------------- ZIP 解包

/** 前向读 4 字节小端（Uint8Array 上没有 getUint32，必须走 DataView 才能指定 littleEndian） */
const u32 = (view: DataView, offset: number): number => view.getUint32(offset, true)
/** 前向读 2 字节小端 */
const u16 = (view: DataView, offset: number): number => view.getUint16(offset, true)

/** 从 ZIP 尾部往前找 EOCD，拿到中央目录偏移与条目数 */
const findEndOfCentralDirectory = (view: DataView): { count: number; offset: number } => {
  const start = Math.max(0, view.byteLength - EOCD_MAX_SCAN)
  for (let i = view.byteLength - 22; i >= start; i--) {
    if (u32(view, i) !== EOCD_SIGNATURE) continue
    const diskNo = u16(view, i + 4)
    const centralDiskNo = u16(view, i + 6)
    if (diskNo !== 0 || centralDiskNo !== 0) {
      throw new Error('暂不支持分卷（多磁盘）xlsx 文件')
    }
    const count = u16(view, i + 10)
    const size = u32(view, i + 12)
    const offset = u32(view, i + 16)
    // ZIP64 的哨兵值：真实值写在 ZIP64 EOCD 里，这里不支持，明确报错而不是解析出错乱数据
    if (count === 0xffff || offset === 0xffffffff) {
      throw new Error('暂不支持 ZIP64 格式的 xlsx 文件（文件过大或由特殊工具生成）')
    }
    // 偏移是相对 ZIP 起点的，若文件前面被拼过数据（自解压 stub / 被截取过），实际位置会整体后移；
    // 中央目录「末尾 + 注释长度」应正好落在 EOCD 上，差出来的这段就是要补的位移
    const shift = i - 22 - (offset + size) - u16(view, i + 20)
    return { count, offset: shift > 0 ? offset + shift : offset }
  }
  // 连 EOCD 都没有，基本可以断定不是 ZIP（xlsx 本质就是 ZIP）
  throw new Error('不是有效的 xlsx 文件（缺少 ZIP 结构）')
}

/** 解析中央目录：条目名、压缩方法、压缩后大小与 local header 偏移 */
const readCentralDirectory = (buffer: ArrayBuffer): ZipEntryMeta[] => {
  const view = new DataView(buffer)
  const eocd = findEndOfCentralDirectory(view)
  const entries: ZipEntryMeta[] = []
  let pointer = eocd.offset
  for (let i = 0; i < eocd.count; i++) {
    if (pointer + 46 > view.byteLength || u32(view, pointer) !== CENTRAL_SIGNATURE) {
      throw new Error('xlsx 中央目录已损坏（条目头签名不正确）')
    }
    const method = u16(view, pointer + 10)
    // 大小一律取中央目录里的值：流式写入的文件在 local header 里可能写 0（general purpose flag bit 3）
    const size = u32(view, pointer + 20)
    const nameLength = u16(view, pointer + 28)
    const extraLength = u16(view, pointer + 30)
    const commentLength = u16(view, pointer + 32)
    const localOffset = u32(view, pointer + 42)
    if (pointer + 46 + nameLength > view.byteLength) {
      throw new Error('xlsx 中央目录已损坏（文件名超出文件范围）')
    }
    // xlsx 内部条目名都是 ascii，工作簿自己的中文表名在 workbook.xml 里，不受这里影响
    const name = new TextDecoder('utf-8').decode(new Uint8Array(buffer, pointer + 46, nameLength))
    entries.push({ name, method, size, localOffset })
    pointer += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/**
 * 解一个 ZIP 条目：先读 local header 拿到文件名 / extra 长度，
 * 真正的数据起点必须是「local header 起点 + 30 + 名称长度 + extra 长度」——
 * local header 里的 extra 字段长度常常和中央目录里的不一样，不能拿中央目录的值来算。
 */
const inflateEntry = async (buffer: ArrayBuffer, entry: ZipEntryMeta): Promise<Uint8Array> => {
  const view = new DataView(buffer)
  if (
    entry.localOffset + 30 > view.byteLength ||
    u32(view, entry.localOffset) !== LOCAL_SIGNATURE
  ) {
    throw new Error('xlsx 条目数据已损坏（local header 签名不正确）')
  }
  const nameLength = u16(view, entry.localOffset + 26)
  const extraLength = u16(view, entry.localOffset + 28)
  const bodyOffset = entry.localOffset + 30 + nameLength + extraLength
  if (bodyOffset + entry.size > view.byteLength) {
    throw new Error('xlsx 条目数据已损坏（数据超出文件范围）')
  }
  const body = new Uint8Array(buffer, bodyOffset, entry.size)
  // 0 = 不压缩，直接切片；8 = deflate，交给浏览器原生解压
  if (entry.method === 0) return body
  if (entry.method !== 8) {
    throw new Error('xlsx 使用了不支持的压缩方式（编号 ' + entry.method + '）')
  }
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前浏览器不支持解压 xlsx（缺少 DecompressionStream），请改用较新的 Chrome')
  }
  try {
    const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    throw new Error('xlsx 解压失败（文件可能已损坏或被截断）')
  }
}

/**
 * 把 xlsx 解包成「路径 → 数据」。
 * 只解压解析真正会用到的条目，避免一个带图片 / 主题的大文件白解一堆二进制。
 */
const unzipXlsx = async (buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> => {
  const wanted =
    /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/styles\.xml|xl\/worksheets\/[^/]+\.xml)$/
  const files = new Map<string, Uint8Array>()
  const entries = readCentralDirectory(buffer)
  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue
    if (!wanted.test(entry.name)) continue
    files.set(entry.name, await inflateEntry(buffer, entry))
  }
  return files
}

// ---------------------------------------------------------------- XML 小工具

/** 按需解码 XML 文本 */
const decodeXml = (bytes?: Uint8Array): string =>
  bytes ? new TextDecoder('utf-8').decode(bytes) : ''

/** 取某个标签的内部文本；没有这个标签返回空串（不是每个工作簿都有共享串 / 样式） */
const innerXml = (xml: string, tag: string): string => {
  const hit = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>').exec(xml)
  return hit ? hit[1] : ''
}

/**
 * XML 实体解码：&amp; &lt; &gt; &quot; &apos; 与数字实体（&#38; / &#x26;）
 * 单元格里出现「&」时原文一定是 &amp;，这里不还原就会把「A&B」读成「A&amp;B」。
 */
const decodeEntities = (text: string): string =>
  text.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g, (whole, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16))
    if (dec) return String.fromCodePoint(parseInt(dec, 10))
    if (name === 'amp') return '&'
    if (name === 'lt') return '<'
    if (name === 'gt') return '>'
    if (name === 'quot') return '"'
    if (name === 'apos') return "'"
    // 其它实体（&#xNNNN; 之外的罕见命名实体）保持原样，不猜
    return whole
  })

/** 取 <t> 标签的文本：不是 xml:space="preserve" 的要两端去空白（Excel 会在格式里塞缩进） */
const extractTextRuns = (xml: string, tag: string): string => {
  const runs = new RegExp('<' + tag + '(\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'g')
  let result = ''
  let hit: RegExpExecArray | null
  while ((hit = runs.exec(xml)) !== null) {
    const preserve = /xml:space\s*=\s*"preserve"/.test(hit[1] || '')
    const text = decodeEntities(hit[2])
    result += preserve ? text : text.trim()
  }
  return result
}

/** 兼容属性顺序的取值：numFmtId="14" 与 formatCode="..." 都可能写在别的属性前后 */
const attrValue = (tag: string, name: string): string => {
  const hit = new RegExp(name + '\\s*=\\s*"([^"]*)"').exec(tag)
  return hit ? hit[1] : ''
}

// ---------------------------------------------------------------- 共享字符串

/**
 * 共享字符串表：<si> 里可能是 <t> 直出，也可能是多个 <r><t> 富文本片段，两者都要拼起来；
 * <rPh>（拼音）不是内容，不取。
 */
const parseSharedStrings = (xml: string): string[] => {
  const table: string[] = []
  const items = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g
  let hit: RegExpExecArray | null
  while ((hit = items.exec(xml)) !== null) {
    table.push(hit[1] === undefined ? '' : extractTextRuns(hit[1], 't'))
  }
  return table
}

// ---------------------------------------------------------------- 样式（只用于判断日期）

/** Excel 内置的日期 / 时间格式编号（见 ECMA-376 第 18.8.30 节） */
const BUILTIN_DATE_FORMATS = new Set<number>([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58
])

/**
 * 自定义格式串是不是日期：去掉引号里的字面量再找 y/m/d/h/s。
 * 只看 y/m/d/h/s 不区分大小写；纯时间格式（h:mm）也按日期处理，
 * 因为它的值同样不能当普通数字用（会还原成 1899-12-30 这类日期）。
 */
const isDateFormatCode = (code: string): boolean => {
  const literal = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
  return /[ymdhs]/i.test(literal)
}

/** 读 <cellXfs>：每个 <xf> 一条，下标就是单元格 s 属性的值 */
const parseCellXfs = (stylesXml: string): boolean[] => {
  const customFormats = new Map<number, string>()
  const numFmts = innerXml(stylesXml, 'numFmts')
  const numFmtTag = /<numFmt\b([^>]*)\/?>/g
  let hit: RegExpExecArray | null
  while ((hit = numFmtTag.exec(numFmts)) !== null) {
    const id = Number(attrValue(hit[1], 'numFmtId'))
    if (Number.isFinite(id)) customFormats.set(id, decodeEntities(attrValue(hit[1], 'formatCode')))
  }
  const xfs: boolean[] = []
  const xfTag = /<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g
  while ((hit = xfTag.exec(innerXml(stylesXml, 'cellXfs'))) !== null) {
    const numFmtId = Number(attrValue(hit[1], 'numFmtId'))
    if (!Number.isFinite(numFmtId)) {
      xfs.push(false)
      continue
    }
    xfs.push(
      BUILTIN_DATE_FORMATS.has(numFmtId) || isDateFormatCode(customFormats.get(numFmtId) || '')
    )
  }
  return xfs
}

// ---------------------------------------------------------------- 定位工作表

/** 关系文件里的相对路径要拼成 ZIP 内的绝对路径（xl/workbook.xml → xl/worksheets/sheet1.xml） */
const resolvePartPath = (baseDir: string, target: string): string =>
  (baseDir + '/' + target.replace(/^\.?\//, ''))
    .split('/')
    .reduce<string[]>((parts, segment) => {
      if (segment === '' || segment === '.') return parts
      if (segment === '..') parts.pop()
      else parts.push(segment)
      return parts
    }, [])
    .join('/')

/** 从 workbook.xml.rels 读 rId → 路径 */
const parseWorkbookRels = (relsXml: string): Map<string, string> => {
  const map = new Map<string, string>()
  const tag = /<Relationship\b([^>]*)\/?>/g
  let hit: RegExpExecArray | null
  while ((hit = tag.exec(relsXml)) !== null) {
    const id = attrValue(hit[1], 'Id')
    const target = attrValue(hit[1], 'Target')
    if (!id || !target) continue
    // TargetMode="External" 是外部链接，不是工作簿内部部件，跳过
    if (/External/i.test(attrValue(hit[1], 'TargetMode'))) continue
    map.set(id, target.startsWith('/') ? target.replace(/^\//, '') : resolvePartPath('xl', target))
  }
  return map
}

/**
 * 定位第 sheetIndex 个工作表：
 * 优先按 workbook.xml 里 <sheet> 的顺序取 r:id，再去 rels 里换真实路径；
 * 解析不出来（老工具写的关系不规整）时退化成 xl/worksheets/sheet{N}.xml。
 */
const locateSheet = (workbookXml: string, relsXml: string, sheetIndex: number): SheetRef => {
  const sheets: Array<{ name: string; rid: string }> = []
  const tag = /<sheet\b([^>]*)\/?>/g
  let hit: RegExpExecArray | null
  while ((hit = tag.exec(workbookXml)) !== null) {
    // r:id 的前缀在不同生成器里可能是 r / rel，这里只按本地名 id 取
    const rid = attrValue(hit[1], '(?:[A-Za-z0-9_.-]+:)?id')
    if (rid) sheets.push({ name: decodeEntities(attrValue(hit[1], 'name')), rid })
  }
  if (sheetIndex < 0 || (sheets.length > 0 && sheetIndex >= sheets.length)) {
    throw new Error(
      'xlsx 里没有第 ' + (sheetIndex + 1) + ' 个工作表（共 ' + sheets.length + ' 个）'
    )
  }
  const fallback = {
    name: '工作表' + (sheetIndex + 1),
    path: 'xl/worksheets/sheet' + (sheetIndex + 1) + '.xml'
  }
  if (!sheets.length) return fallback
  const target = parseWorkbookRels(relsXml).get(sheets[sheetIndex].rid)
  if (!target) return { name: sheets[sheetIndex].name, path: fallback.path }
  return { name: sheets[sheetIndex].name || fallback.name, path: target }
}

// ---------------------------------------------------------------- 单元格 / 行

/** 单元格引用 "AB12" → 列号 11、行号 12 */
const parseCellRef = (ref: string): CellPosition | null => {
  const hit = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim())
  if (!hit) return null
  let col = 0
  const letters = hit[1].toUpperCase()
  for (let i = 0; i < letters.length; i++) col = col * 26 + (letters.charCodeAt(i) - 64)
  return { col: col - 1, row: Number(hit[2]) }
}

/** 从 <c> 的内部 XML 里取指定标签的文本（<v> 或 <is>） */
const innerTextOf = (xml: string, tag: string): string => {
  const hit = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>').exec(xml)
  return hit ? hit[1] : ''
}

/**
 * 取一个单元格的文本。
 * 各类型处理：s 共享串下标 / inlineStr 内联串 / str 公式结果文本 / b 布尔 / e 错误原文 / 其余按数字。
 */
const parseCell = (
  attrs: string,
  inner: string,
  sharedStrings: string[],
  styleDateFlags: boolean[],
  useDate1904: boolean
): CellValue | null => {
  // 自闭合 <c r="A1"/> 与无 r 的写法都会走到这里，统一返回 null 由调用方跳过
  const position = parseCellRef(attrValue(attrs, 'r'))
  if (!position) return null
  const type = attrValue(attrs, 't')
  let value = ''
  if (type === 's') {
    const index = Number(innerTextOf(inner, 'v'))
    value = Number.isInteger(index) && index >= 0 ? (sharedStrings[index] ?? '') : ''
  } else if (type === 'inlineStr') {
    value = extractTextRuns(innerTextOf(inner, 'is'), 't')
  } else if (type === 'b') {
    value = innerTextOf(inner, 'v').trim() === '1' ? 'TRUE' : 'FALSE'
  } else if (type === 'e') {
    value = decodeEntities(innerTextOf(inner, 'v'))
  } else {
    // str（公式结果文本）与无 t / t="n"（数字）都取 <v>
    const raw = decodeEntities(innerTextOf(inner, 'v'))
    if (type === 'str' || raw === '') {
      value = raw
    } else {
      const styleIndex = Number(attrValue(attrs, 's'))
      const isDateStyle =
        Number.isInteger(styleIndex) && styleIndex >= 0 && styleIndex < styleDateFlags.length
          ? styleDateFlags[styleIndex]
          : false
      value = formatNumberCell(raw, isDateStyle, useDate1904)
    }
  }
  return { position, value }
}

/** 解析 <sheetData>：行号与列号都按 r 属性还原，跳过的空行 / 空列补空串占位 */
const parseSheetRows = (
  sheetXml: string,
  sharedStrings: string[],
  styleDateFlags: boolean[],
  useDate1904: boolean
): string[][] => {
  const matrix: string[][] = []
  const rowTag = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
  let rowHit: RegExpExecArray | null
  while ((rowHit = rowTag.exec(sheetXml)) !== null) {
    const declared = Number(attrValue(rowHit[1], 'r'))
    // 行号缺失或非正数时顺延到下一行；保证只往前不回头
    const rowNo =
      Number.isInteger(declared) && declared > matrix.length ? declared : matrix.length + 1
    const row: string[] = []
    let cursor = 0
    const cellTag = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    const body = rowHit[2] || ''
    let cellHit: RegExpExecArray | null
    while ((cellHit = cellTag.exec(body)) !== null) {
      const cell = parseCell(
        cellHit[1],
        cellHit[2] || '',
        sharedStrings,
        styleDateFlags,
        useDate1904
      )
      if (!cell) continue
      // Excel 会省略空单元格，所以要按 r 里的列字母落位，中间的列补空串；列号不前进就顺延一格
      const col = cell.position.col >= cursor ? cell.position.col : cursor
      while (row.length < col) row.push('')
      row[col] = cell.value
      cursor = col + 1
    }
    while (matrix.length < rowNo - 1) matrix.push([])
    matrix[rowNo - 1] = row
  }
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0)
  return matrix.map((row) => {
    while (row.length < width) row.push('')
    return row
  })
}

// ---------------------------------------------------------------- 对外入口

/**
 * 读取 xlsx 的某个工作表，返回文本矩阵。
 * @param file 浏览器 File / Blob
 * @param sheetIndex 第几个工作表（默认 0）
 */
export const readXlsxSheet = async (file: Blob, sheetIndex = 0): Promise<XlsxSheetResult> => {
  if (!isXlsxSupported()) {
    throw new Error(
      '当前浏览器不支持读取 xlsx（缺少 DecompressionStream），请改用较新的 Chrome 或先另存为 CSV'
    )
  }
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength < 22) {
    throw new Error('不是有效的 xlsx 文件（缺少 ZIP 结构）')
  }
  const files = await unzipXlsx(buffer)
  const workbookXml = decodeXml(files.get('xl/workbook.xml'))
  if (!workbookXml) {
    throw new Error('xlsx 缺少工作簿描述（xl/workbook.xml）')
  }
  // 1904 日期系统的工作簿（多为 Mac Excel 生成）序列号基准不同，必须跟着 workbookPr 走
  const useDate1904 = /<workbookPr\b[^>]*\bdate1904\s*=\s*"(?:1|true)"/i.test(workbookXml)
  const sheet = locateSheet(
    workbookXml,
    decodeXml(files.get('xl/_rels/workbook.xml.rels')),
    sheetIndex
  )
  const sheetXml = decodeXml(files.get(sheet.path))
  if (!sheetXml) {
    throw new Error('xlsx 缺少工作表数据（' + sheet.path + '）')
  }
  const rows = parseSheetRows(
    sheetXml,
    parseSharedStrings(decodeXml(files.get('xl/sharedStrings.xml'))),
    parseCellXfs(decodeXml(files.get('xl/styles.xml'))),
    useDate1904
  )
  // 行数上限只数「有内容的行」：Excel 常留一堆只带样式的空行，按物理行数算会误报超限
  let usedRows = rows.length
  while (usedRows > 0 && rows[usedRows - 1].every((cell) => cell === '')) usedRows--
  if (usedRows > XLSX_MAX_ROWS) {
    throw new Error('文件行数超过演示环境上限（' + XLSX_MAX_ROWS + ' 行），请拆分后导入')
  }
  return { sheetName: sheet.name, rows }
}
