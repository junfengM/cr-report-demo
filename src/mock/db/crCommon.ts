/**
 * 报送业务跨域共享常量
 *
 * 各业务域的 mock 种子数据都从这里取机构/报表/期次，保证全系统口径一致。
 * 只读不写：不要在本文件里放可变的业务表。
 */
import { orgTable } from './org'
import { reportTable, subjectTable, metaTableTable } from './cr'

/** 当前报送期次 */
export const PERIOD = '202608'

/** 最近若干期次（用于查询条件、上期/同期对比） */
export const PERIODS = ['202603', '202604', '202605', '202606', '202607', '202608']

/** 报送机构（总公司 + 分公司，不含中心支公司） */
export const reportOrgs = () =>
  orgTable
    .all()
    .filter((org) => org.orgLevel <= 2)
    .map((org) => ({
      id: org.id,
      orgCode: org.orgCode,
      orgName: org.orgName,
      orgLevel: org.orgLevel,
      regulator: org.regulator
    }))

/** 全部机构（含中心支公司），用于树选择 */
export const allOrgs = () =>
  orgTable.all().map((org) => ({
    id: org.id,
    orgCode: org.orgCode,
    orgName: org.orgName,
    parentId: org.parentId,
    orgLevel: org.orgLevel,
    regulator: org.regulator
  }))

/** 分公司机构名列表（种子数据里最常用的口径） */
export const BRANCH_NAMES = ['北京分公司', '上海分公司', '江苏分公司', '广东分公司']

/** 报表清单（id / 报表名 / 频度 / 所属主题域） */
export const reportOptions = () =>
  reportTable.all().map((report) => ({
    id: report.id,
    reportCode: report.reportCode,
    reportName: report.reportName,
    freq: report.freq,
    subjectId: report.subjectId,
    subjectName: report.subjectName
  }))

/** 主题域清单 */
export const subjectOptions = () =>
  subjectTable.all().map((row) => ({
    id: row.id,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName
  }))

/** 数据表清单 */
export const tableOptions = () =>
  metaTableTable.all().map((row) => ({
    id: row.id,
    tableCode: row.tableCode,
    tableName: row.tableName,
    cnName: row.cnName,
    subjectId: row.subjectId
  }))

/** 演示用填报人 / 复核人 / 审核人（与 src/mock/db/system.ts 的用户对应） */
export const FILL_USERS = [
  { id: 2, name: '李思远', orgName: '北京分公司', duty: '数据填报人' },
  { id: 3, name: '王雅琴', orgName: '上海分公司', duty: '数据填报人' },
  { id: 4, name: '张明浩', orgName: '江苏分公司', duty: '数据填报人' },
  { id: 5, name: '刘婉婷', orgName: '广东分公司', duty: '数据填报人' }
]

export const REVIEW_USERS = [
  { id: 6, name: '陈志强', orgName: '北京分公司', duty: '复核人' },
  { id: 7, name: '赵敏', orgName: '上海分公司', duty: '复核人' }
]

export const AUDIT_USERS = [
  { id: 8, name: '孙建国', orgName: '总公司', duty: '审核人' },
  { id: 9, name: '周文彬', orgName: '总公司', duty: '审核人' }
]

/** 错误级别：见字典 cr_error_level */
export const ERROR_LEVEL = { WARN: 1, ERROR: 2 } as const

/** 规则类型：见字典 cr_rule_type */
export const RULE_TYPE = {
  NOT_NULL: 1,
  LENGTH: 2,
  RANGE: 3,
  LOGIC: 4,
  INTER_TABLE: 5,
  ENUM: 6
} as const

/** 脱敏规则：见字典 cr_desensitize_type */
export const DESENSITIZE_TYPE = {
  NONE: 0,
  MASK: 1,
  HASH: 2,
  REPLACE: 3,
  TRUNCATE: 4
} as const
