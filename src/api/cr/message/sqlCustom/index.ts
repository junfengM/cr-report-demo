import request from '@/config/axios'

/** 公式 SQL 定制 VO */
export interface SqlFormulaVO {
  id?: number
  /** 公式编码（大写字母 / 数字 / 下划线，创建后仍可改但会校验唯一） */
  code: string
  name: string
  /** 公式类型，见字典 cr_formula_type：1 取数公式 / 2 校验公式 / 3 指标计算 / 4 报表口径 */
  type: number
  /** SQL 正文（只允许 SELECT） */
  sqlText: string
  /** 应用对象：挂在哪张报表 / 数据集 / 校验规则上 */
  target: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status */
  status: number
  remark: string
  createUser?: string
  createTime?: string
  updateUser?: string
  updateTime?: string
}

/** 试运行的单条检查结论 */
export interface FormulaCheckVO {
  name: string
  level: 'pass' | 'warn' | 'fail'
  detail: string
}

/** 试运行结果：只解析不执行，结论是确定性的 */
export interface FormulaTryRunVO {
  passed: boolean
  conclusion: string
  checks: FormulaCheckVO[]
  placeholders: string[]
  tables: Array<{ name: string; cnName: string; tableCode: string }>
  unknownTables: string[]
  formulaCode: string
  formulaName: string
  checkedAt: string
}

// 分页查询公式
export const getSqlFormulaPage = (params: any) =>
  request.get({ url: '/cr/message-formula/page', params })

// 查询公式详情
export const getSqlFormula = (id: number) =>
  request.get({ url: '/cr/message-formula/get?id=' + id })

// 新增公式
export const createSqlFormula = (data: SqlFormulaVO) =>
  request.post({ url: '/cr/message-formula/create', data })

// 修改公式
export const updateSqlFormula = (data: SqlFormulaVO) =>
  request.put({ url: '/cr/message-formula/update', data })

// 删除公式
export const deleteSqlFormula = (id: number) =>
  request.delete({ url: '/cr/message-formula/delete?id=' + id })

// 批量删除公式
export const deleteSqlFormulaList = (ids: number[]) =>
  request.delete({ url: '/cr/message-formula/delete-list', params: { ids: ids.join(',') } })

// 导出公式
export const exportSqlFormula = (params: any) =>
  request.download({ url: '/cr/message-formula/export-excel', params })

// 试运行（只解析不执行；可传 id，也可传未保存的 sqlText 草稿）
export const tryRunSqlFormula = (data: { id?: number; sqlText?: string }) =>
  request.post({ url: '/cr/message-formula/try-run', data })
