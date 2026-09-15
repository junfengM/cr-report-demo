import request from '@/config/axios'

/** 一个报送包 */
export interface SplitPackageVO {
  pkgNo: number
  pkgName: string
  rows: number
  /** 按字段值分组时的分组值 */
  fieldValue: string
  firstPolicyNo: string
  lastPolicyNo: string
  /** 包文件名（与一键报送同一命名口径，只多一段包名） */
  fileName: string
  /** 包文件真实字节数（下载到的就是这个大小） */
  fileSize: number
  samples: Array<{
    rowNo: number
    policyNo: string
    holderName: string
    channel: string
    premiumAmount: number
  }>
}

/** 拆分范围 */
export interface SplitScopeVO {
  orgId: number
  reportId: number
  period: string
  operator?: string
}

/** 拆分预检结果（只算不动） */
export interface SplitPrecheckVO {
  orgId: number
  orgName: string
  reportId: number
  reportCode: string
  reportName: string
  period: string
  rule: {
    id: number
    ruleCode: string
    ruleName: string
    mode: number
    rowsPerPackage: number
    splitFieldLabel: string
    pkgPrefix: string
  } | null
  mode: number
  modeLabel: string
  totalRows: number
  pkgCount: number
  packages: SplitPackageVO[]
  warnings: string[]
}

/** 拆分结果 */
export interface SplitRunResultVO {
  id: number
  batchNo: string
  status: number
  totalRows: number
  pkgCount: number
  cost: number
  message: string
  packages: SplitPackageVO[]
}

// 拆分预检（只算不动）
export const precheckSplit = (data: SplitScopeVO) => {
  return request.post({ url: '/cr/split-execute/precheck', data })
}

// 执行拆分（落批次 + 包清单，只读填报数据）
export const runSplit = (data: SplitScopeVO) => {
  return request.post({ url: '/cr/split-execute/run', data })
}
