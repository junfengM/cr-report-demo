/**
 * Mock Handler — 数据审核业务接口
 *
 * - /cr/audit-reason       错误原因填报：分页 / 详情 / 提交原因 / 确认 / 状态计数 / 导出
 * - /cr/audit-approve      数据审核：分页 / 详情 / 明细（脱敏后）/ 通过 / 不通过 / 批量通过 / 导出
 * - /cr/audit-result       审核结果：分页 / 详情（审核意见 + 问题清单）/ 导出
 * - /cr/audit-desensitize  脱敏结果查询：分页 / 详情（同一条数据的多字段脱敏）/ 数据项下拉 / 导出
 *
 * 业务失败统一 `throw new Error('中文提示')`，adapter 会包成 400 由拦截器原样提示。
 */
import { onGet, onPut } from '../route'
import { parseIds, registerResource } from '../resource'
import { betweenDate, csvBlob, formatDateTime, likeAny } from '../util'
import {
  AUDIT_REASON_STATUS,
  AUDIT_REASON_STATUS_LABEL,
  AUDIT_STATUS,
  AUDIT_STATUS_LABEL,
  DESENSITIZE_LABEL,
  SUBMIT_STATUS,
  SUBMIT_STATUS_LABEL,
  crAuditApproveDetailTable,
  crAuditApproveTable,
  crAuditReasonTable,
  crAuditResultTable,
  crDesensitizeTable,
  type CrAuditApproveRow,
  type CrAuditReasonRow
} from '../db/crAudit'
import { AUDIT_USERS, FILL_USERS, reportOptions, reportOrgs } from '../db/crCommon'

/** 当前审核人（Demo 无后端，取演示用户：总公司审核人） */
const AUDIT_USER = AUDIT_USERS[0].name

/** 错误原因说明的最少字数 */
const REASON_MIN_LENGTH = 10

/** 字典中文名（导出用） */
const RULE_TYPE_LABEL: Record<number, string> = {
  1: '非空校验',
  2: '长度校验',
  3: '值域校验',
  4: '逻辑校验',
  5: '表间校验',
  6: '枚举校验'
}
const ERROR_LEVEL_LABEL: Record<number, string> = { 1: '警告', 2: '错误' }
const ISSUE_LEVEL_LABEL: Record<number, string> = { 0: '正常', 1: '警告', 2: '错误' }

/** 填报人：按机构匹配演示用户 */
const fillUserOf = (orgName: string): string =>
  FILL_USERS.find((user) => user.orgName === orgName)?.name || FILL_USERS[0].name

/** 机构下拉：总公司 + 分公司 */
const orgOptionList = () =>
  reportOrgs().map((org) => ({
    id: org.id,
    name: org.orgName,
    code: org.orgCode,
    level: org.orgLevel
  }))

/** 报表下拉 */
const reportOptionList = () =>
  reportOptions().map((report) => ({
    id: report.id,
    name: report.reportName,
    code: report.reportCode,
    freq: report.freq,
    subjectName: report.subjectName
  }))

/** 从请求体解析一批 id（支持 ids: [1,2] / ids: '1,2' / id: 1） */
const bodyIds = (body: any): number[] => parseIds(body?.ids ?? body?.id)

/** 批量处理结果（与报表任务流转的口径一致） */
interface BatchResult {
  successCount: number
  failCount: number
  messages: string[]
}

/* ==================================================================
 * 一、错误原因填报
 * ================================================================== */
const filterReason = (row: CrAuditReasonRow, params: Record<string, any>) => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (
    params.errorLevel !== undefined &&
    params.errorLevel !== '' &&
    Number(row.errorLevel) !== Number(params.errorLevel)
  ) {
    return false
  }
  if (
    params.status !== undefined &&
    params.status !== '' &&
    Number(row.status) !== Number(params.status)
  ) {
    return false
  }
  return likeAny(
    row,
    ['location', 'policyNo', 'columnName', 'auditOpinion', 'orgName', 'reportName'],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/audit-reason',
  table: crAuditReasonTable,
  // 待填报在前，便于填报人先处理未完成的
  sort: (a, b) => a.status - b.status || a.id - b.id,
  filter: filterReason
})

/** 处理状态计数（tabs 徽标）：受除状态外的其它筛选条件影响 */
onGet('/cr/audit-reason/status-count', (ctx) => {
  const rows = crAuditReasonTable
    .all()
    .filter((row) => filterReason(row, { ...ctx.params, status: undefined }))
  return [
    { status: '', count: rows.length },
    {
      status: AUDIT_REASON_STATUS.PENDING,
      count: rows.filter((row) => row.status === AUDIT_REASON_STATUS.PENDING).length
    },
    {
      status: AUDIT_REASON_STATUS.FILLED,
      count: rows.filter((row) => row.status === AUDIT_REASON_STATUS.FILLED).length
    },
    {
      status: AUDIT_REASON_STATUS.CONFIRMED,
      count: rows.filter((row) => row.status === AUDIT_REASON_STATUS.CONFIRMED).length
    }
  ]
})

/** 提交错误原因（填报人）：少于 10 个字直接报错 */
onPut('/cr/audit-reason/submit', (ctx) => {
  const { id, reason } = ctx.body || {}
  const row = crAuditReasonTable.get(Number(id))
  if (!row) throw new Error('错误原因填报任务不存在')
  if (row.status === AUDIT_REASON_STATUS.CONFIRMED) {
    throw new Error('该条错误原因已由审核人确认，不能再修改')
  }
  const text = String(reason ?? '').trim()
  if (text.length < REASON_MIN_LENGTH) {
    throw new Error(`错误原因说明至少 ${REASON_MIN_LENGTH} 个字，请补充具体原因`)
  }
  crAuditReasonTable.update({
    id: row.id,
    reason: text,
    status: AUDIT_REASON_STATUS.FILLED,
    fillUser: fillUserOf(row.orgName),
    fillTime: formatDateTime(),
    confirmUser: '',
    confirmTime: ''
  })
  return true
})

/** 审核人确认填报内容（可批量） */
onPut('/cr/audit-reason/confirm', (ctx) => {
  const ids = bodyIds(ctx.body)
  if (!ids.length) throw new Error('请先选择需要确认的记录')
  const result: BatchResult = { successCount: 0, failCount: 0, messages: [] }
  ids.forEach((id) => {
    const row = crAuditReasonTable.get(id)
    if (!row) {
      result.failCount++
      result.messages.push(`记录 ${id} 不存在`)
      return
    }
    if (row.status === AUDIT_REASON_STATUS.PENDING) {
      result.failCount++
      result.messages.push(`「${row.columnName}」尚未填写错误原因，不能确认`)
      return
    }
    if (row.status === AUDIT_REASON_STATUS.CONFIRMED) {
      result.failCount++
      result.messages.push(`「${row.columnName}」已确认，请勿重复操作`)
      return
    }
    crAuditReasonTable.update({
      id,
      status: AUDIT_REASON_STATUS.CONFIRMED,
      confirmUser: AUDIT_USER,
      confirmTime: formatDateTime()
    })
    result.successCount++
  })
  if (!result.successCount) throw new Error(result.messages[0] || '没有可确认的记录')
  return result
})

onGet('/cr/audit-reason/export-excel', (ctx) =>
  csvBlob(
    crAuditReasonTable
      .all()
      .filter((row) => filterReason(row, ctx.params))
      .sort((a, b) => a.status - b.status || a.id - b.id)
      .map((row) => ({
        ...row,
        statusName: AUDIT_REASON_STATUS_LABEL[row.status] || '',
        issueTypeName: RULE_TYPE_LABEL[row.issueType] || '',
        errorLevelName: ERROR_LEVEL_LABEL[row.errorLevel] || ''
      })),
    [
      { field: 'orgName', label: '机构' },
      { field: 'reportName', label: '报表名称' },
      { field: 'period', label: '期次' },
      { field: 'location', label: '数据定位' },
      { field: 'columnName', label: '字段名称' },
      { field: 'originalValue', label: '原值' },
      { field: 'issueTypeName', label: '问题类型' },
      { field: 'errorLevelName', label: '错误级别' },
      { field: 'auditOpinion', label: '审核意见' },
      { field: 'auditUser', label: '审核人' },
      { field: 'deadline', label: '要求回复期限' },
      { field: 'statusName', label: '处理状态' },
      { field: 'reason', label: '错误原因说明' },
      { field: 'fillUser', label: '填报人' },
      { field: 'fillTime', label: '填报时间' }
    ]
  )
)

onGet('/cr/audit-reason/org-options', orgOptionList)
onGet('/cr/audit-reason/report-options', reportOptionList)

/* ==================================================================
 * 二、数据审核
 * ================================================================== */
const filterApprove = (row: CrAuditApproveRow, params: Record<string, any>) => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (
    params.auditStatus !== undefined &&
    params.auditStatus !== '' &&
    Number(row.auditStatus) !== Number(params.auditStatus)
  ) {
    return false
  }
  if (
    params.submitStatus !== undefined &&
    params.submitStatus !== '' &&
    Number(row.submitStatus) !== Number(params.submitStatus)
  ) {
    return false
  }
  return likeAny(
    row,
    ['batchNo', 'orgName', 'reportName', 'reportCode', 'submitUser'],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/audit-approve',
  table: crAuditApproveTable,
  // 待审核批次在前；同为待审核时已提交的排在填报中的前面（填报中的批次不能审核）
  sort: (a, b) =>
    a.auditStatus - b.auditStatus ||
    b.submitStatus - a.submitStatus ||
    b.submitTime.localeCompare(a.submitTime),
  filter: filterApprove
})

/** 批次明细：返回脱敏后的数据行（问题行带 issueLevel，供页面高亮） */
onGet('/cr/audit-approve/detail', (ctx) => {
  const batchId = Number(ctx.params.batchId)
  if (!batchId) throw new Error('缺少批次 id')
  const batch = crAuditApproveTable.get(batchId)
  if (!batch) throw new Error(`审核批次不存在：id=${batchId}`)
  return crAuditApproveDetailTable
    .all()
    .filter((row) => row.batchId === batchId)
    .sort((a, b) => a.rowNo - b.rowNo)
})

/**
 * 审核动作：更新批次结论并写入「审核结果」留痕。
 * 只有「已提交且待审核」的批次可以被审核。
 */
const applyAudit = (body: any, auditStatus: number): BatchResult => {
  const ids = bodyIds(body)
  const opinion = String(body?.opinion ?? '').trim()
  if (!ids.length) throw new Error('请先选择需要审核的批次')
  if (auditStatus === AUDIT_STATUS.REJECT && !opinion) {
    throw new Error('审核不通过必须填写审核意见')
  }
  const result: BatchResult = { successCount: 0, failCount: 0, messages: [] }
  const time = formatDateTime()
  ids.forEach((id) => {
    const batch = crAuditApproveTable.get(id)
    if (!batch) {
      result.failCount++
      result.messages.push(`批次 ${id} 不存在`)
      return
    }
    if (batch.auditStatus !== AUDIT_STATUS.PENDING) {
      result.failCount++
      result.messages.push(`${batch.batchNo} 已完成审核，不能重复审核`)
      return
    }
    if (batch.submitStatus !== SUBMIT_STATUS.SUBMITTED) {
      result.failCount++
      result.messages.push(`${batch.batchNo} 尚未提交，不能审核`)
      return
    }
    const finalOpinion =
      opinion ||
      (auditStatus === AUDIT_STATUS.PASS ? '数据核对无误，校验告警已确认，同意通过。' : '')
    crAuditApproveTable.update({
      id,
      auditStatus,
      auditor: AUDIT_USER,
      auditTime: time,
      auditOpinion: finalOpinion
    })
    // 审核结论留痕：审核结果页可查到本轮结论
    const lastRound = crAuditResultTable
      .all()
      .filter((row) => row.batchId === id)
      .reduce((max, row) => Math.max(max, row.auditRound), 0)
    crAuditResultTable.insert({
      batchId: batch.id,
      batchNo: batch.batchNo,
      orgId: batch.orgId,
      orgName: batch.orgName,
      reportId: batch.reportId,
      reportCode: batch.reportCode,
      reportName: batch.reportName,
      period: batch.period,
      auditStatus,
      auditor: AUDIT_USER,
      auditTime: time,
      auditOpinion: finalOpinion,
      issueCount: batch.warnCount + batch.errorCount,
      warnCount: batch.warnCount,
      errorCount: batch.errorCount,
      rowCount: batch.rowCount,
      auditRound: lastRound + 1,
      submitTime: batch.submitTime,
      createTime: time
    })
    result.successCount++
  })
  if (!result.successCount) throw new Error(result.messages[0] || '没有可审核的批次')
  return result
}

onPut('/cr/audit-approve/pass', (ctx) => applyAudit(ctx.body, AUDIT_STATUS.PASS))
onPut('/cr/audit-approve/batch-pass', (ctx) => applyAudit(ctx.body, AUDIT_STATUS.PASS))
onPut('/cr/audit-approve/reject', (ctx) => applyAudit(ctx.body, AUDIT_STATUS.REJECT))

onGet('/cr/audit-approve/export-excel', (ctx) =>
  csvBlob(
    crAuditApproveTable
      .all()
      .filter((row) => filterApprove(row, ctx.params))
      .sort((a, b) => a.auditStatus - b.auditStatus || b.submitTime.localeCompare(a.submitTime))
      .map((row) => ({
        ...row,
        submitStatusName: SUBMIT_STATUS_LABEL[row.submitStatus] || '',
        auditStatusName: AUDIT_STATUS_LABEL[row.auditStatus] || ''
      })),
    [
      { field: 'batchNo', label: '批次号' },
      { field: 'orgName', label: '机构' },
      { field: 'reportName', label: '报表名称' },
      { field: 'period', label: '期次' },
      { field: 'rowCount', label: '数据行数' },
      { field: 'passCount', label: '校验通过行数' },
      { field: 'warnCount', label: '警告行数' },
      { field: 'errorCount', label: '错误行数' },
      { field: 'submitStatusName', label: '报送状态' },
      { field: 'submitTime', label: '提交时间' },
      { field: 'submitUser', label: '提交人' },
      { field: 'auditStatusName', label: '审核结论' },
      { field: 'auditor', label: '审核人' },
      { field: 'auditTime', label: '审核时间' },
      { field: 'auditOpinion', label: '审核意见' }
    ]
  )
)

onGet('/cr/audit-approve/org-options', orgOptionList)
onGet('/cr/audit-approve/report-options', reportOptionList)

/* ==================================================================
 * 三、审核结果
 * ================================================================== */
const filterResult = (row: Record<string, any>, params: Record<string, any>) => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (
    params.auditStatus !== undefined &&
    params.auditStatus !== '' &&
    Number(row.auditStatus) !== Number(params.auditStatus)
  ) {
    return false
  }
  const range = Array.isArray(params.auditTime) ? params.auditTime : []
  if (
    !betweenDate(row.auditTime, params.auditTimeBegin ?? range[0], params.auditTimeEnd ?? range[1])
  ) {
    return false
  }
  if (params.auditRound && Number(row.auditRound) !== Number(params.auditRound)) return false
  return likeAny(
    row,
    ['batchNo', 'orgName', 'reportName', 'reportCode', 'auditor', 'auditOpinion'],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/audit-result',
  table: crAuditResultTable,
  sort: (a, b) => b.auditTime.localeCompare(a.auditTime) || b.id - a.id,
  filter: filterResult
})

/** 审核结果详情：审核意见全文 + 关联问题清单（优先取该批次的错误原因填报任务） */
onGet('/cr/audit-result/get', (ctx) => {
  const id = Number(ctx.params.id)
  const row = crAuditResultTable.get(id)
  if (!row) throw new Error(`审核结果不存在：id=${id}`)
  const reasons = crAuditReasonTable
    .all()
    .filter((item) => item.batchId === row.batchId)
    .map((item) => ({
      location: item.location,
      columnName: item.columnName,
      originalValue: item.originalValue,
      issueType: item.issueType,
      issueTypeName: RULE_TYPE_LABEL[item.issueType] || '',
      errorLevel: item.errorLevel,
      errorLevelName: ERROR_LEVEL_LABEL[item.errorLevel] || '',
      auditOpinion: item.auditOpinion,
      status: item.status,
      statusName: AUDIT_REASON_STATUS_LABEL[item.status] || '',
      reason: item.reason
    }))
  const problems = reasons.length
    ? reasons
    : crAuditApproveDetailTable
        .all()
        .filter((item) => item.batchId === row.batchId && item.issueLevel > 0)
        .sort((a, b) => a.rowNo - b.rowNo)
        .map((item) => ({
          location: `第 ${item.rowNo} 行 / 保单号 ${item.policyNo}`,
          columnName: '数据明细',
          originalValue: '',
          issueType: 0,
          issueTypeName: '',
          errorLevel: item.issueLevel,
          errorLevelName: ISSUE_LEVEL_LABEL[item.issueLevel] || '',
          auditOpinion: item.issueMessage,
          status: 0,
          statusName: '',
          reason: ''
        }))
  return { ...row, problems }
})

onGet('/cr/audit-result/export-excel', (ctx) =>
  csvBlob(
    crAuditResultTable
      .all()
      .filter((row) => filterResult(row, ctx.params))
      .sort((a, b) => b.auditTime.localeCompare(a.auditTime) || b.id - a.id)
      .map((row) => ({ ...row, auditStatusName: AUDIT_STATUS_LABEL[row.auditStatus] || '' })),
    [
      { field: 'orgName', label: '机构' },
      { field: 'reportName', label: '报表名称' },
      { field: 'period', label: '期次' },
      { field: 'batchNo', label: '批次号' },
      { field: 'auditRound', label: '审核轮次' },
      { field: 'auditStatusName', label: '审核结论' },
      { field: 'auditor', label: '审核人' },
      { field: 'auditTime', label: '审核时间' },
      { field: 'auditOpinion', label: '审核意见' },
      { field: 'issueCount', label: '问题数量' },
      { field: 'errorCount', label: '错误行数' },
      { field: 'warnCount', label: '警告行数' },
      { field: 'rowCount', label: '数据行数' },
      { field: 'submitTime', label: '提交时间' }
    ]
  )
)

onGet('/cr/audit-result/org-options', orgOptionList)
onGet('/cr/audit-result/report-options', reportOptionList)

/* ==================================================================
 * 四、脱敏结果查询
 * ================================================================== */
const filterDesensitize = (row: Record<string, any>, params: Record<string, any>) => {
  if (params.period && !String(row.period).includes(String(params.period))) return false
  if (params.orgId && Number(row.orgId) !== Number(params.orgId)) return false
  if (params.reportId && Number(row.reportId) !== Number(params.reportId)) return false
  if (params.ruleType && String(row.ruleType) !== String(params.ruleType)) return false
  if (params.columnCode && String(row.columnCode) !== String(params.columnCode)) return false
  return likeAny(
    row,
    [
      'dataKey',
      'policyNo',
      'columnName',
      'columnCode',
      'originalValue',
      'maskedValue',
      'orgName',
      'reportName'
    ],
    params.keyword
  )
}

registerResource({
  prefix: '/cr/audit-desensitize',
  table: crDesensitizeTable,
  sort: (a, b) =>
    b.processTime.localeCompare(a.processTime) || a.dataKey.localeCompare(b.dataKey) || a.id - b.id,
  filter: filterDesensitize,
  // 脱敏对照表是审计证据：只由脱敏执行 / 还原接口（服务端）写入，任何角色都不许手工增删改，
  // 否则"某个值被脱敏过"这条线索可以被伪造或抹掉
  guard: () => {
    throw new Error('脱敏对照表由「执行脱敏 / 还原本批次」维护，不支持手工新增、修改或删除')
  }
})

/** 脱敏详情：同一条数据（投保人编号）在多个字段上的脱敏情况 */
onGet('/cr/audit-desensitize/get', (ctx) => {
  const id = Number(ctx.params.id)
  const row = crDesensitizeTable.get(id)
  if (!row) throw new Error(`脱敏记录不存在：id=${id}`)
  const siblings = crDesensitizeTable
    .all()
    .filter((item) => item.dataKey === row.dataKey)
    .sort((a, b) => a.id - b.id)
    .map((item) => ({ ...item, ruleTypeName: DESENSITIZE_LABEL[item.ruleType] || '' }))
  return { ...row, ruleTypeName: DESENSITIZE_LABEL[row.ruleType] || '', siblings }
})

/** 数据项（字段）下拉：按字段去重 */
onGet('/cr/audit-desensitize/column-options', () => {
  const seen = new Map<string, { columnCode: string; columnName: string }>()
  crDesensitizeTable.all().forEach((row) => {
    if (!seen.has(row.columnCode)) {
      seen.set(row.columnCode, { columnCode: row.columnCode, columnName: row.columnName })
    }
  })
  return [...seen.values()]
})

onGet('/cr/audit-desensitize/export-excel', (ctx) =>
  csvBlob(
    crDesensitizeTable
      .all()
      .filter((row) => filterDesensitize(row, ctx.params))
      .sort((a, b) => b.processTime.localeCompare(a.processTime) || a.id - b.id)
      .map((row) => ({ ...row, ruleTypeName: DESENSITIZE_LABEL[row.ruleType] || '' })),
    [
      { field: 'orgName', label: '机构' },
      { field: 'reportName', label: '报表名称' },
      { field: 'period', label: '期次' },
      { field: 'dataKey', label: '投保人编号' },
      { field: 'policyNo', label: '保单号' },
      { field: 'rowNo', label: '数据行号' },
      { field: 'columnCode', label: '字段编码' },
      { field: 'columnName', label: '数据项名称' },
      { field: 'originalValue', label: '脱敏前原文' },
      { field: 'maskedValue', label: '脱敏后结果' },
      { field: 'ruleTypeName', label: '脱敏规则' },
      { field: 'ruleParam', label: '脱敏参数' },
      { field: 'processTime', label: '处理时间' }
    ]
  )
)

onGet('/cr/audit-desensitize/org-options', orgOptionList)
onGet('/cr/audit-desensitize/report-options', reportOptionList)
