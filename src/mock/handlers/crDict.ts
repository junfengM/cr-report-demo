/**
 * Mock Handler — 监管码值配置：码值字典维护 / 码值管理 / 本地字典 / 本地枚举 / 本地标准映射
 *
 * 一组接口（前缀 /cr/...）：
 *   local-dict       本地字典的增删改查 + 导出（写操作仅系统管理员）
 *   local-code       本地枚举（码值）的增删改查 + 导出；simple-list 给映射页当下拉
 *   reg-dict         监管字典（码值字典维护）的增删改查 + 导出
 *   reg-code         监管码值的增删改查 + 导出；simple-list 给映射页当下拉
 *   local-map        映射关系的增删改查 + 导出（写操作仅系统管理员）
 *   reg-code         监管码值下拉（按监管字典取）
 *   local-map/validate   映射完整性校验（只算不写，返回问题清单）
 *   local-map/decisions  每条映射的生效判断（生效中 / 被覆盖 / 已停用）
 *
 * 为什么把校验放在接口层：映射错了会在报文生成时才炸，那时已经过了填报与审核两道关。
 * 这里让页面随时能"先算一遍"，并把"哪条在生效、哪条被盖住"直接讲清楚 ——
 * 与脱敏字段配置页同一套防误会设计（以为配了其实没配是最危险的结果）。
 * 删除同样放在接口层拦：删掉被码值引用的字典、或删掉被映射引用的码值，都会让映射页出现悬空数据。
 */
import { onDelete, onGet, onPut } from '../route'
import { parseIds, registerResource } from '../resource'
import { formatDateTime, likeAny } from '../util'
import {
  effectiveLocalMap,
  localCodeTable,
  localDictNames,
  localDictOptions,
  localDictTable,
  localMapDecisions,
  regDictTable,
  localMapReport,
  localMapTable,
  regCodeTable,
  regDictOptions,
  type LocalCodeRow,
  type LocalDictRow,
  type RegCodeRow,
  type RegDictRow,
  type LocalMapRow
} from '../db/crDict'
import { assertAdmin } from './guards'
import { currentUser } from './auth'

/**
 * 同一条「本地码值 → 监管码值」是否已有一条**启用中**的映射（用于新建/编辑时的重复提示）。
 * 只看启用行：映射可以停用，停用后重新加一条同样的映射是合法操作；
 * 以前把停用行也算进来，导致「未映射」校验建议的「新增一条」反而被拒（只能去编辑那条停用行）。
 */
const hasSameMapping = (row: Partial<LocalMapRow>, excludeId?: number) =>
  localMapTable
    .all()
    .some(
      (item) =>
        item.id !== excludeId &&
        item.status === 1 &&
        item.localDict === row.localDict &&
        item.localCode === row.localCode &&
        item.regDict === row.regDict &&
        item.regCode === row.regCode
    )

/** 建 / 改之前把名称补齐并把明显写错的取值拦下来（报错用中文，adapter 会原样弹给用户） */
const fillMapRow = (body: any): Partial<LocalMapRow> => {
  const localDict = String(body.localDict || '').trim()
  const localCode = String(body.localCode || '').trim()
  const regDict = String(body.regDict || '').trim()
  const regCode = String(body.regCode || '').trim()
  if (!localDict || !localCode) throw new Error('请先选择本地码值（本地字典 + 本地码值）')
  if (!regDict || !regCode) throw new Error('请先选择监管码值（监管字典 + 监管码值）')

  const local = localCodeTable
    .all()
    .find((row) => row.localDict === localDict && row.localCode === localCode)
  if (!local) throw new Error('本地码值不存在：' + localDict + ' / ' + localCode)
  if (local.status !== 1) throw new Error('本地码值「' + local.localName + '」已停用，不能新建映射')

  const reg = regCodeTable.all().find((row) => row.regDict === regDict && row.regCode === regCode)
  if (!reg)
    throw new Error('监管码值不存在：' + regDict + ' / ' + regCode + '（请核对监管方码值表）')
  if (reg.status !== 1) throw new Error('监管码值「' + reg.regName + '」已停用，不能建立映射')

  const priority = Number(body.priority === undefined || body.priority === '' ? 50 : body.priority)
  if (!Number.isInteger(priority) || priority < 0 || priority > 999) {
    throw new Error('优先级必须是 0~999 之间的整数（数字小的先生效）')
  }

  const status = Number(body.status === undefined || body.status === '' ? 1 : body.status)
  if (status !== 0 && status !== 1) throw new Error('状态只能是启用或停用')

  const payload: Partial<LocalMapRow> = {
    localDict,
    localDictName: local.localDictName,
    localCode: local.localCode,
    localName: local.localName,
    regDict,
    regDictName: reg.regDictName,
    regCode: reg.regCode,
    regName: reg.regName,
    priority,
    status,
    remark: String(body.remark || '')
  }
  if (hasSameMapping(payload, body.id ? Number(body.id) : undefined)) {
    throw new Error(
      '该本地码值已经映射到监管码值「' + reg.regCode + ' ' + reg.regName + '」，请勿重复添加'
    )
  }
  return payload
}

registerResource<LocalMapRow>({
  prefix: '/cr/local-map',
  table: localMapTable,
  // 映射表决定报文的码值取数，写操作只允许系统管理员
  guard: (ctx, action) => assertAdmin(ctx, '本地标准映射' + action),
  sort: (a, b) =>
    a.localDict.localeCompare(b.localDict) ||
    a.localCode.localeCompare(b.localCode) ||
    Number(a.priority || 50) - Number(b.priority || 50) ||
    a.id - b.id,
  filter: (row, params) =>
    (params.localDict === undefined ||
      params.localDict === '' ||
      row.localDict === params.localDict) &&
    (params.regDict === undefined || params.regDict === '' || row.regDict === params.regDict) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['localCode', 'localName', 'regCode', 'regName', 'remark'], params.keyword),
  beforeCreate: (body) => ({
    ...fillMapRow(body),
    updateUser: '系统管理员',
    updateTime: formatDateTime(),
    createTime: formatDateTime()
  }),
  beforeUpdate: (body) => ({ ...fillMapRow(body), updateTime: formatDateTime() }),
  exportColumns: [
    { field: 'localDictName', label: '本地字典' },
    { field: 'localCode', label: '本地码值' },
    { field: 'localName', label: '本地名称' },
    { field: 'regDictName', label: '监管字典' },
    { field: 'regCode', label: '监管码值' },
    { field: 'regName', label: '监管名称' },
    { field: 'priority', label: '优先级' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    {
      field: 'stateLabel',
      label: '覆盖情况',
      formatter: (row) => MAP_STATE_LABEL[row.state as never] || row.state || ''
    },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '备注' }
  ]
})

/* ==================================================================
 * 本地字典管理 / 本地枚举管理（文档「监管码值配置」章节的前两页）
 * ================================================================== */

/** 建 / 改本地字典前的清洗与校验：编码是码值与映射的关联键，不允许重复 */
const fillLocalDict = (body: any, ctx: any): Partial<LocalDictRow> => {
  const code = String(body.code || '')
    .trim()
    .toUpperCase()
  const name = String(body.name || '').trim()
  if (!code) throw new Error('请填写本地字典编码')
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    throw new Error('字典编码只能用大写字母、数字与下划线，且以字母开头')
  }
  if (!name) throw new Error('请填写本地字典名称')
  const same = localDictTable
    .all()
    .find((row) => row.code === code && row.id !== Number(body.id || 0))
  if (same) throw new Error('字典编码已存在：' + code + '（' + same.name + '）')
  return {
    code,
    name,
    status: Number(body.status) === 0 ? 0 : 1,
    updateUser: currentUser(ctx)?.nickname || '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 字典改名后同步码值与映射行上的冗余名称（两张表都存了 localDictName 供列表直接展示） */
const syncLocalDictName = (code: string, name: string) => {
  localCodeTable
    .all()
    .filter((row) => row.localDict === code)
    .forEach((row) => localCodeTable.update({ id: row.id, localDictName: name }))
  localMapTable
    .all()
    .filter((row) => row.localDict === code)
    .forEach((row) => localMapTable.update({ id: row.id, localDictName: name }))
}

/** 字典下还有码值就不让删：删了码值会变成没有字典的孤儿数据 */
const assertDictDeletable = (id: number) => {
  const dict = localDictTable.get(id)
  if (!dict) throw new Error('记录不存在：id=' + id)
  const codes = localCodeTable.all().filter((row) => row.localDict === dict.code)
  if (codes.length) {
    throw new Error(
      '字典「' +
        dict.name +
        '」下还有 ' +
        codes.length +
        ' 条本地码值（如 ' +
        codes[0].localCode +
        ' ' +
        codes[0].localName +
        '），不能删除；请先删除或停用这些码值'
    )
  }
  return dict
}

registerResource<LocalDictRow>({
  prefix: '/cr/local-dict',
  table: localDictTable,
  // 本地字典决定报文取数时用哪套码值，写操作只允许系统管理员
  guard: (ctx, action) => assertAdmin(ctx, '本地字典' + action),
  sort: (a, b) => a.code.localeCompare(b.code),
  filter: (row, params) =>
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['code', 'name', 'remark'], params.keyword),
  beforeCreate: (body, ctx) => ({ ...fillLocalDict(body, ctx), createTime: formatDateTime() }),
  beforeUpdate: (body, ctx) => fillLocalDict(body, ctx),
  toListRow: (row) => ({
    ...row,
    codeCount: localCodeTable.all().filter((item) => item.localDict === row.code).length
  }),
  toSimple: (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    label: row.code + ' ' + row.name
  }),
  exportColumns: [
    { field: 'code', label: '字典编码' },
    { field: 'name', label: '字典名称' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    {
      field: 'codeCount',
      label: '码值条数',
      formatter: (row) => localCodeTable.all().filter((item) => item.localDict === row.code).length
    },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '备注' }
  ]
})

/** 改名要把码值与映射上的冗余名称一起同步，所以自己接管 update（校验仍是同一份 fillLocalDict） */
onPut('/cr/local-dict/update', (ctx) => {
  assertAdmin(ctx, '本地字典修改')
  const body = { ...(ctx.body || {}) }
  const id = Number(body.id)
  if (!id) throw new Error('缺少 id')
  const before = localDictTable.get(id)
  if (!before) throw new Error('记录不存在：id=' + id)
  const payload = fillLocalDict(body, ctx)
  localDictTable.update({ ...payload, id })
  if (payload.name && payload.name !== before.name) syncLocalDictName(before.code, payload.name)
  return true
})

onDelete('/cr/local-dict/delete', (ctx) => {
  assertAdmin(ctx, '本地字典删除')
  const id = Number(ctx.params.id)
  if (Number.isNaN(id)) throw new Error('缺少 id')
  assertDictDeletable(id)
  localDictTable.remove(id)
  return true
})

onDelete('/cr/local-dict/delete-list', (ctx) => {
  assertAdmin(ctx, '本地字典批量删除')
  const ids = parseIds(ctx.params.ids)
  if (!ids.length) throw new Error('缺少 ids')
  ids.forEach((id) => assertDictDeletable(id))
  localDictTable.removeBatch(ids)
  return true
})

/** 建 / 改本地枚举前的清洗与校验：字典必须存在且启用，同字典内码值不重复 */
const fillLocalCode = (body: any): Partial<LocalCodeRow> => {
  const localDict = String(body.localDict || '').trim()
  const localCode = String(body.localCode || '').trim()
  const localName = String(body.localName || '').trim()
  if (!localDict) throw new Error('请选择所属本地字典')
  if (!localCode) throw new Error('请填写本地码值')
  if (!localName) throw new Error('请填写本地名称')
  const dict = localDictTable.all().find((row) => row.code === localDict)
  if (!dict) throw new Error('本地字典不存在：' + localDict)
  if (dict.status !== 1) throw new Error('本地字典「' + dict.name + '」已停用，不能再维护它的码值')
  const same = localCodeTable
    .all()
    .find(
      (row) =>
        row.localDict === localDict &&
        row.localCode === localCode &&
        row.id !== Number(body.id || 0)
    )
  if (same) throw new Error('该字典下已存在码值「' + localCode + ' ' + same.localName + '」')
  return {
    localDict,
    localDictName: dict.name,
    localCode,
    localName,
    status: Number(body.status) === 0 ? 0 : 1,
    remark: String(body.remark || '')
  }
}

/** 码值被映射引用就不让删：删了映射页会留下取不到值的悬空映射 */
const assertLocalCodeDeletable = (id: number) => {
  const code = localCodeTable.get(id)
  if (!code) throw new Error('记录不存在：id=' + id)
  const maps = localMapTable
    .all()
    .filter((row) => row.localDict === code.localDict && row.localCode === code.localCode)
  if (maps.length) {
    throw new Error(
      '码值「' +
        code.localCode +
        ' ' +
        code.localName +
        '」已被 ' +
        maps.length +
        ' 条本地标准映射引用（如 → ' +
        maps[0].regCode +
        '），不能删除；请先删除那几条映射'
    )
  }
  return code
}

registerResource<LocalCodeRow>({
  prefix: '/cr/local-code',
  table: localCodeTable,
  guard: (ctx, action) => assertAdmin(ctx, '本地枚举' + action),
  sort: (a, b) => a.localDict.localeCompare(b.localDict) || a.localCode.localeCompare(b.localCode),
  filter: (row, params) =>
    (params.localDict === undefined ||
      params.localDict === '' ||
      row.localDict === params.localDict) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['localCode', 'localName', 'remark'], params.keyword),
  beforeCreate: (body) => ({ ...fillLocalCode(body), createTime: formatDateTime() }),
  beforeUpdate: (body) => fillLocalCode(body),
  // 「映射情况」列：这条码值最终取到哪个监管码值（没有就是未映射），与映射页同一套生效判定
  toListRow: (row) => {
    const maps = localMapTable
      .all()
      .filter((item) => item.localDict === row.localDict && item.localCode === row.localCode)
    const effective = effectiveLocalMap(row.localDict, row.localCode)
    return {
      ...row,
      mappingCount: maps.length,
      enabledMappingCount: maps.filter((item) => item.status === 1).length,
      effectiveRegCode: effective ? effective.regCode + ' ' + effective.regName : ''
    }
  },
  exportColumns: [
    { field: 'localDictName', label: '本地字典' },
    { field: 'localDict', label: '字典编码' },
    { field: 'localCode', label: '本地码值' },
    { field: 'localName', label: '本地名称' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    {
      field: 'effectiveRegCode',
      label: '生效监管码值',
      formatter: (row) => {
        const effective = effectiveLocalMap(row.localDict, row.localCode)
        return effective ? effective.regCode + ' ' + effective.regName : '未映射'
      }
    },
    { field: 'createTime', label: '创建时间' },
    { field: 'remark', label: '备注' }
  ]
})

onDelete('/cr/local-code/delete', (ctx) => {
  assertAdmin(ctx, '本地枚举删除')
  const id = Number(ctx.params.id)
  if (Number.isNaN(id)) throw new Error('缺少 id')
  assertLocalCodeDeletable(id)
  localCodeTable.remove(id)
  return true
})

onDelete('/cr/local-code/delete-list', (ctx) => {
  assertAdmin(ctx, '本地枚举批量删除')
  const ids = parseIds(ctx.params.ids)
  if (!ids.length) throw new Error('缺少 ids')
  ids.forEach((id) => assertLocalCodeDeletable(id))
  localCodeTable.removeBatch(ids)
  return true
})

/** 建 / 改监管字典前的清洗与校验（与本地字典同一套规则，编码同样是关联键） */
const fillRegDict = (body: any, ctx: any): Partial<RegDictRow> => {
  const code = String(body.code || '')
    .trim()
    .toUpperCase()
  const name = String(body.name || '').trim()
  if (!code) throw new Error('请填写监管字典编码')
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    throw new Error('字典编码只能用大写字母、数字与下划线，且以字母开头')
  }
  if (!name) throw new Error('请填写监管字典名称')
  const same = regDictTable
    .all()
    .find((row) => row.code === code && row.id !== Number(body.id || 0))
  if (same) throw new Error('字典编码已存在：' + code + '（' + same.name + '）')
  return {
    code,
    name,
    status: Number(body.status) === 0 ? 0 : 1,
    updateUser: currentUser(ctx)?.nickname || '系统管理员',
    updateTime: formatDateTime(),
    remark: String(body.remark || '')
  }
}

/** 监管字典改名后同步监管码值与映射行上的冗余名称 */
const syncRegDictName = (code: string, name: string) => {
  regCodeTable
    .all()
    .filter((row) => row.regDict === code)
    .forEach((row) => regCodeTable.update({ id: row.id, regDictName: name }))
  localMapTable
    .all()
    .filter((row) => row.regDict === code)
    .forEach((row) => localMapTable.update({ id: row.id, regDictName: name }))
}

/** 字典下还有监管码值就不让删 */
const assertRegDictDeletable = (id: number) => {
  const dict = regDictTable.get(id)
  if (!dict) throw new Error('记录不存在：id=' + id)
  const codes = regCodeTable.all().filter((row) => row.regDict === dict.code)
  if (codes.length) {
    throw new Error(
      '字典「' +
        dict.name +
        '」下还有 ' +
        codes.length +
        ' 条监管码值（如 ' +
        codes[0].regCode +
        ' ' +
        codes[0].regName +
        '），不能删除；请先删除或停用这些码值'
    )
  }
  return dict
}

registerResource<RegDictRow>({
  prefix: '/cr/reg-dict',
  table: regDictTable,
  // 监管字典决定报文里能取到哪些监管码值，写操作只允许系统管理员
  guard: (ctx, action) => assertAdmin(ctx, '监管码值字典' + action),
  sort: (a, b) => a.code.localeCompare(b.code),
  filter: (row, params) =>
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['code', 'name', 'remark'], params.keyword),
  beforeCreate: (body, ctx) => ({ ...fillRegDict(body, ctx), createTime: formatDateTime() }),
  beforeUpdate: (body, ctx) => fillRegDict(body, ctx),
  toListRow: (row) => ({
    ...row,
    codeCount: regCodeTable.all().filter((item) => item.regDict === row.code).length
  }),
  toSimple: (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    label: row.code + ' ' + row.name
  }),
  exportColumns: [
    { field: 'code', label: '字典编码' },
    { field: 'name', label: '字典名称' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    {
      field: 'codeCount',
      label: '码值条数',
      formatter: (row) => regCodeTable.all().filter((item) => item.regDict === row.code).length
    },
    { field: 'updateUser', label: '更新人' },
    { field: 'updateTime', label: '更新时间' },
    { field: 'remark', label: '备注' }
  ]
})

onPut('/cr/reg-dict/update', (ctx) => {
  assertAdmin(ctx, '监管码值字典修改')
  const body = { ...(ctx.body || {}) }
  const id = Number(body.id)
  if (!id) throw new Error('缺少 id')
  const before = regDictTable.get(id)
  if (!before) throw new Error('记录不存在：id=' + id)
  const payload = fillRegDict(body, ctx)
  regDictTable.update({ ...payload, id })
  if (payload.name && payload.name !== before.name) syncRegDictName(before.code, payload.name)
  return true
})

onDelete('/cr/reg-dict/delete', (ctx) => {
  assertAdmin(ctx, '监管码值字典删除')
  const id = Number(ctx.params.id)
  if (Number.isNaN(id)) throw new Error('缺少 id')
  assertRegDictDeletable(id)
  regDictTable.remove(id)
  return true
})

onDelete('/cr/reg-dict/delete-list', (ctx) => {
  assertAdmin(ctx, '监管码值字典批量删除')
  const ids = parseIds(ctx.params.ids)
  if (!ids.length) throw new Error('缺少 ids')
  ids.forEach((id) => assertRegDictDeletable(id))
  regDictTable.removeBatch(ids)
  return true
})

/** 建 / 改监管码值前的清洗与校验：字典必须存在且启用，同字典内码值不重复 */
const fillRegCode = (body: any): Partial<RegCodeRow> => {
  const regDict = String(body.regDict || '').trim()
  const regCode = String(body.regCode || '').trim()
  const regName = String(body.regName || '').trim()
  if (!regDict) throw new Error('请选择所属监管字典')
  if (!regCode) throw new Error('请填写监管码值')
  if (!regName) throw new Error('请填写监管名称')
  const dict = regDictTable.all().find((row) => row.code === regDict)
  if (!dict) throw new Error('监管字典不存在：' + regDict)
  if (dict.status !== 1) throw new Error('监管字典「' + dict.name + '」已停用，不能再维护它的码值')
  const same = regCodeTable
    .all()
    .find(
      (row) => row.regDict === regDict && row.regCode === regCode && row.id !== Number(body.id || 0)
    )
  if (same) throw new Error('该字典下已存在码值「' + regCode + ' ' + same.regName + '」')
  return {
    regDict,
    regDictName: dict.name,
    regCode,
    regName,
    status: Number(body.status) === 0 ? 0 : 1,
    remark: String(body.remark || '')
  }
}

/** 监管码值被映射引用就不让删（映射会指向一个监管方不存在的码值） */
const assertRegCodeDeletable = (id: number) => {
  const code = regCodeTable.get(id)
  if (!code) throw new Error('记录不存在：id=' + id)
  const maps = localMapTable
    .all()
    .filter((row) => row.regDict === code.regDict && row.regCode === code.regCode)
  if (maps.length) {
    throw new Error(
      '码值「' +
        code.regCode +
        ' ' +
        code.regName +
        '」已被 ' +
        maps.length +
        ' 条本地标准映射引用（如 ← ' +
        maps[0].localCode +
        '），不能删除；请先删除那几条映射'
    )
  }
  return code
}

registerResource<RegCodeRow>({
  prefix: '/cr/reg-code',
  table: regCodeTable,
  guard: (ctx, action) => assertAdmin(ctx, '监管码值' + action),
  sort: (a, b) => a.regDict.localeCompare(b.regDict) || a.regCode.localeCompare(b.regCode),
  filter: (row, params) =>
    (params.regDict === undefined || params.regDict === '' || row.regDict === params.regDict) &&
    (params.status === undefined ||
      params.status === '' ||
      Number(row.status) === Number(params.status)) &&
    likeAny(row, ['regCode', 'regName', 'remark'], params.keyword),
  beforeCreate: (body) => ({ ...fillRegCode(body), createTime: formatDateTime() }),
  beforeUpdate: (body) => fillRegCode(body),
  // 「被哪些本地码值映射」列：监管码值是监管下发的清单，页面上要能看清谁在用它
  toListRow: (row) => {
    const maps = localMapTable
      .all()
      .filter((item) => item.regDict === row.regDict && item.regCode === row.regCode)
    return {
      ...row,
      mappingCount: maps.length,
      enabledMappingCount: maps.filter((item) => item.status === 1).length,
      mappedLocal: maps
        .slice(0, 3)
        .map((item) => item.localCode + ' ' + item.localName)
        .join('、')
    }
  },
  exportColumns: [
    { field: 'regDictName', label: '监管字典' },
    { field: 'regDict', label: '字典编码' },
    { field: 'regCode', label: '监管码值' },
    { field: 'regName', label: '监管名称' },
    {
      field: 'status',
      label: '状态',
      formatter: (row) => (Number(row.status) === 1 ? '启用' : '停用')
    },
    {
      field: 'mappingCount',
      label: '被映射条数',
      formatter: (row) =>
        localMapTable
          .all()
          .filter((item) => item.regDict === row.regDict && item.regCode === row.regCode).length
    },
    { field: 'createTime', label: '创建时间' },
    { field: 'remark', label: '备注' }
  ]
})

onDelete('/cr/reg-code/delete', (ctx) => {
  assertAdmin(ctx, '监管码值删除')
  const id = Number(ctx.params.id)
  if (Number.isNaN(id)) throw new Error('缺少 id')
  assertRegCodeDeletable(id)
  regCodeTable.remove(id)
  return true
})

onDelete('/cr/reg-code/delete-list', (ctx) => {
  assertAdmin(ctx, '监管码值批量删除')
  const ids = parseIds(ctx.params.ids)
  if (!ids.length) throw new Error('缺少 ids')
  ids.forEach((id) => assertRegCodeDeletable(id))
  regCodeTable.removeBatch(ids)
  return true
})

/** 本地字典 / 监管字典下拉（带码值条数） */
onGet('/cr/local-map/dict-options', () => ({
  localDicts: localDictOptions(),
  regDicts: regDictOptions()
}))

/** 本地码值下拉：按本地字典过滤，只给启用中的（停用码值不允许新建映射） */
onGet('/cr/local-code/simple-list', (ctx) =>
  localCodeTable
    .all()
    .filter((row) => row.status === 1)
    .filter((row) => !ctx.params.localDict || row.localDict === ctx.params.localDict)
    .map((row) => ({
      id: row.id,
      name: row.localCode + ' ' + row.localName,
      localDict: row.localDict,
      localCode: row.localCode,
      localName: row.localName
    }))
)

/** 监管码值下拉：按监管字典过滤 */
onGet('/cr/reg-code/simple-list', (ctx) =>
  regCodeTable
    .all()
    .filter((row) => row.status === 1)
    .filter((row) => !ctx.params.regDict || row.regDict === ctx.params.regDict)
    .map((row) => ({
      id: row.id,
      name: row.regCode + ' ' + row.regName,
      regDict: row.regDict,
      regCode: row.regCode,
      regName: row.regName
    }))
)

/** 每条映射的生效判断（页面列表逐行标注；不返回则无法解释"我配了为什么不生效"） */
onGet('/cr/local-map/decisions', () => {
  const decisions = localMapDecisions()
  const byCode: Record<string, number> = {}
  localMapTable
    .all()
    .filter((row) => row.status === 1)
    .forEach((row) => {
      const decision = decisions[row.id]
      if (decision && decision.state === 'EFFECTIVE') {
        byCode[row.localDict + '|' + row.localCode] = row.id
      }
    })
  return { decisions, effectiveByCode: byCode, localDictNames: localDictNames() }
})

/** 映射完整性校验：只算不写，返回统计 + 问题清单 + 一句话结论 */
onGet('/cr/local-map/validate', () => localMapReport())
