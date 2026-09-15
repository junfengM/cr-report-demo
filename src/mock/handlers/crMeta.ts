/**
 * Mock Handler — 报送配置管理（机构维护 / 机构上报配置 / 机构主机配置 / 机构联系人配置）
 *
 * 数据表来自 `src/mock/db/org.ts`（报送机构树 + 三张机构侧配置表），
 * 主题域 / 表 / 列 的接口在 `src/mock/handlers/cr.ts` 中已注册，这里不重复注册。
 */
import { onGet } from '../route'
import { registerResource } from '../resource'
import { formatDateTime, likeAny, toTree } from '../util'
import { orgContactTable, orgHostTable, orgReportConfigTable, orgTable } from '../db/org'

/** 通用状态过滤：0 正常 / 1 停用 */
const matchStatus = (row: { status: number }, params: Record<string, any>) =>
  params.status === undefined ||
  params.status === '' ||
  Number(row.status) === Number(params.status)

/* ==================================================================
 * 机构维护（报送机构树）
 * ================================================================== */
registerResource({
  prefix: '/cr/organization',
  table: orgTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.orgLevel && Number(row.orgLevel) !== Number(params.orgLevel)) return false
    if (
      params.parentId !== undefined &&
      params.parentId !== '' &&
      Number(row.parentId) !== Number(params.parentId)
    ) {
      return false
    }
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['orgCode', 'orgName', 'leader', 'regulator'],
      params.keyword || params.orgName
    )
  },
  beforeCreate: (body) => ({ ...body, createTime: formatDateTime() }),
  toSimple: (row) => ({ id: row.id, name: row.orgName, code: row.orgCode }),
  exportColumns: [
    { field: 'orgCode', label: '机构编码' },
    { field: 'orgName', label: '机构名称' },
    { field: 'orgLevel', label: '机构层级' },
    { field: 'orgType', label: '机构类型' },
    { field: 'regulator', label: '所属监管局' },
    { field: 'leader', label: '负责人' },
    { field: 'phone', label: '联系电话' },
    { field: 'status', label: '状态' }
  ]
})

/** 机构树（覆盖通用资源的扁平 /list，返回带 children 的树） */
onGet('/cr/organization/list', (ctx) => {
  const rows = orgTable
    .all()
    .filter((row) => {
      if (ctx.params.orgLevel && Number(row.orgLevel) !== Number(ctx.params.orgLevel)) return false
      if (!matchStatus(row, ctx.params)) return false
      return likeAny(row, ['orgCode', 'orgName'], ctx.params.keyword || ctx.params.orgName)
    })
    .sort((a, b) => a.id - b.id)
  return toTree(rows)
})

/** 机构下拉列表（扁平） */
onGet('/cr/organization/simple-list', () =>
  orgTable
    .all()
    .sort((a, b) => a.id - b.id)
    .map((row) => ({ id: row.id, name: row.orgName, code: row.orgCode }))
)

/* ==================================================================
 * 机构上报配置
 * ================================================================== */
registerResource({
  prefix: '/cr/org-report',
  table: orgReportConfigTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
    if (params.reportType && String(row.reportType) !== String(params.reportType)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['orgName', 'regulator', 'uploadPath', 'downloadPath', 'fileRule'],
      params.keyword || params.regulator
    )
  },
  beforeCreate: (body) => ({ ...body, createTime: formatDateTime() }),
  exportColumns: [
    { field: 'orgName', label: '报送机构' },
    { field: 'reportType', label: '上报方式' },
    { field: 'regulator', label: '监管局' },
    { field: 'uploadPath', label: '上报路径' },
    { field: 'downloadPath', label: '下载路径' },
    { field: 'fileRule', label: '文件命名规则' },
    { field: 'status', label: '状态' }
  ]
})

/* ==================================================================
 * 机构主机配置
 * ================================================================== */
registerResource({
  prefix: '/cr/org-host',
  table: orgHostTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.protocol && String(row.protocol) !== String(params.protocol)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['orgName', 'remoteHost', 'username', 'reportRule'],
      params.keyword || params.orgName
    )
  },
  beforeCreate: (body) => ({ ...body, createTime: formatDateTime() }),
  exportColumns: [
    { field: 'orgName', label: '机构 / 监管局' },
    { field: 'remoteHost', label: '主机地址' },
    { field: 'port', label: '端口' },
    { field: 'protocol', label: '协议' },
    { field: 'reportRule', label: '上报规则' },
    { field: 'username', label: '用户名' },
    { field: 'status', label: '状态' }
  ]
})

/* ==================================================================
 * 机构联系人配置
 * ================================================================== */
registerResource({
  prefix: '/cr/org-contact',
  table: orgContactTable,
  sort: (a, b) => a.id - b.id,
  filter: (row, params) => {
    if (params.duty && String(row.duty) !== String(params.duty)) return false
    if (!matchStatus(row, params)) return false
    return likeAny(
      row,
      ['orgName', 'contactName', 'contactPhone', 'contactEmail'],
      params.keyword || params.orgName
    )
  },
  beforeCreate: (body) => ({ ...body, createTime: formatDateTime() }),
  exportColumns: [
    { field: 'orgName', label: '所属机构' },
    { field: 'contactName', label: '联系人' },
    { field: 'contactPhone', label: '联系电话' },
    { field: 'contactEmail', label: '联系邮箱' },
    { field: 'duty', label: '职责' },
    { field: 'status', label: '状态' }
  ]
})
