<template>
  <!-- 填报上下文：期次 + 机构 + 报表 -->
  <ContentWrap>
    <el-form class="-mb-15px" :model="context" :inline="true" label-width="80px">
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="context.period" class="!w-160px" @change="handleContextChange">
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="报送机构" prop="orgId">
        <el-select v-model="context.orgId" class="!w-200px" @change="handleContextChange">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="context.reportId"
          filterable
          class="!w-330px"
          @change="handleContextChange"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="`${report.code} ${report.name}`"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button :loading="loading" @click="loadData">
          <Icon icon="ep:refresh" class="mr-5px" /> 加载数据
        </el-button>
        <el-tag v-if="dirty" type="warning" effect="dark" class="ml-8px">有未保存的修改</el-tag>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <!-- 填报记录摘要 -->
    <el-descriptions v-if="recordLoaded" class="mb-10px" :column="4" border size="small">
      <el-descriptions-item label="报送机构">{{ record.orgName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="报表名称">
        {{ record.reportCode }} {{ record.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="报送期次">{{ record.period }}</el-descriptions-item>
      <el-descriptions-item label="截止日期">
        <span class="text-[#f56c6c]">{{ record.deadline || '-' }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="数据行数">{{ rows.length }} 行</el-descriptions-item>
      <el-descriptions-item label="填报状态">
        <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="record.fillStatus" />
      </el-descriptions-item>
      <el-descriptions-item label="校验状态">
        <dict-tag :type="DICT_TYPE.CR_CHECK_STATUS" :value="record.checkStatus" />
      </el-descriptions-item>
      <el-descriptions-item label="最后修改">
        {{ record.lastModifier || '-' }} {{ record.lastModifyTime || '' }}
      </el-descriptions-item>
    </el-descriptions>

    <!-- 工具条 -->
    <div class="mb-10px">
      <el-button
        type="primary"
        :disabled="loading"
        @click="handleSave"
        v-hasPermi="['cr:data-fill:save']"
      >
        <Icon icon="ep:check" class="mr-5px" /> 保存
      </el-button>
      <el-button
        type="warning"
        plain
        :loading="checking"
        @click="handleCheck"
        v-hasPermi="['cr:data-fill:check']"
      >
        <Icon icon="ep:finished" class="mr-5px" /> 数据校验
      </el-button>
      <el-button plain @click="handleSummary" v-hasPermi="['cr:data-fill:edit']">
        <Icon icon="ep:data-analysis" class="mr-5px" /> 汇总
      </el-button>
      <el-button
        plain
        :loading="calculating"
        @click="handleCalculate"
        v-hasPermi="['cr:data-fill:edit']"
      >
        <Icon icon="ep:magic-stick" class="mr-5px" /> 计算
      </el-button>
      <el-button plain @click="handleRestore" v-hasPermi="['cr:data-fill:edit']">
        <Icon icon="ep:refresh-left" class="mr-5px" /> 数据恢复
      </el-button>
      <el-button plain @click="handleHistory" v-hasPermi="['cr:data-fill:query']">
        <Icon icon="ep:clock" class="mr-5px" /> 修改历史
      </el-button>
      <el-button type="success" plain @click="handleAddRow" v-hasPermi="['cr:data-fill:edit']">
        <Icon icon="ep:plus" class="mr-5px" /> 新增行
      </el-button>
      <el-button plain @click="handleBatch" v-hasPermi="['cr:data-fill:batch']">
        <Icon icon="ep:operation" class="mr-5px" /> 批量操作
      </el-button>
      <el-button
        type="success"
        :loading="submitting"
        @click="handleSubmit"
        v-hasPermi="['cr:data-fill:submit']"
      >
        <Icon icon="ep:upload" class="mr-5px" /> 提交
      </el-button>
      <el-button
        type="success"
        plain
        :loading="exportLoading"
        @click="handleExport"
        v-hasPermi="['cr:data-fill:export']"
      >
        <Icon icon="ep:download" class="mr-5px" /> 导出
      </el-button>
    </div>

    <!-- 校验 / 汇总结果提示 -->
    <el-alert
      v-if="checkSummary"
      class="mb-10px"
      :type="
        checkSummary.errorCount > 0 ? 'error' : checkSummary.warnCount > 0 ? 'warning' : 'success'
      "
      :closable="true"
      show-icon
      @close="checkSummary = null"
      :title="checkTitle"
    />
    <el-alert
      v-if="showSummary"
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      :title="summaryTitle"
    />

    <!-- 可编辑表格 -->
    <el-table
      v-loading="loading"
      :data="pagedRows"
      border
      size="small"
      max-height="520"
      :row-class-name="rowClassName"
      :cell-class-name="cellClassName"
      :show-summary="showSummary"
      :summary-method="summaryMethod"
    >
      <el-table-column label="行号" width="64" fixed="left" align="center">
        <template #default="scope">
          {{ (query.pageNo - 1) * query.pageSize + scope.$index + 1 }}
        </template>
      </el-table-column>
      <el-table-column label="校验" width="80" fixed="left" align="center">
        <template #default="scope">
          <el-tooltip
            v-if="issueOf(scope.row)"
            placement="right"
            :content="issueOf(scope.row)!.messages.join('；')"
          >
            <el-tag :type="issueOf(scope.row)!.level === 2 ? 'danger' : 'warning'" size="small">
              {{ issueOf(scope.row)!.level === 2 ? '错误' : '警告' }}
            </el-tag>
          </el-tooltip>
          <span v-else class="text-12px text-[#67c23a]">通过</span>
        </template>
      </el-table-column>
      <el-table-column
        v-for="col in columns"
        :key="col.field"
        :prop="col.field"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :align="col.align"
      >
        <template #default="scope">
          <el-input
            v-if="col.editor === 'input'"
            v-model="scope.row[col.field]"
            size="small"
            placeholder="请输入"
            @change="markDirty"
          />
          <el-input-number
            v-else-if="col.editor === 'number'"
            v-model="scope.row[col.field]"
            :controls="false"
            :precision="2"
            size="small"
            style="width: 100%"
            @change="markDirty"
          />
          <el-date-picker
            v-else-if="col.editor === 'date'"
            v-model="scope.row[col.field]"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 100%"
            @change="markDirty"
          />
          <span v-else>{{ scope.row[col.field] }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right" align="center">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="insertRow(scope.$index)"
            v-hasPermi="['cr:data-fill:edit']"
          >
            插入
          </el-button>
          <el-button
            link
            type="primary"
            @click="copyRow(scope.$index)"
            v-hasPermi="['cr:data-fill:edit']"
          >
            复制
          </el-button>
          <el-button
            link
            type="danger"
            @click="removeRow(scope.$index)"
            v-hasPermi="['cr:data-fill:edit']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无填报数据，可点击「新增行」开始填报" :image-size="60" />
      </template>
    </el-table>

    <!-- 前端分页 -->
    <Pagination
      class="mt-10px"
      :total="rows.length"
      v-model:page="query.pageNo"
      v-model:limit="query.pageSize"
    />
  </ContentWrap>

  <!-- 修改历史弹窗 -->
  <FillHistoryDialog ref="historyRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import download from '@/utils/download'
import * as FillApi from '@/api/cr/data/fill'
import * as SubmitApi from '@/api/cr/data/submit'
import FillHistoryDialog from './FillHistoryDialog.vue'

defineOptions({ name: 'CrDataFill' })

type EditRow = FillApi.FillDataVO & { _rid: string }
interface RowIssue {
  level: number
  messages: string[]
  columns: string[]
}

const message = useMessage()
const router = useRouter()
const route = useRoute()

/** 当前已加载的上下文（用于未保存提醒时回滚下拉选择） */
const snapshot = reactive({ period: '202608', orgId: 0, reportId: 0 })
const context = reactive({ period: '202608', orgId: 0, reportId: 0 })
const periodOptions = ref<string[]>([])
const orgOptions = ref<FillApi.OrgOptionVO[]>([])
const reportOptions = ref<FillApi.ReportOptionVO[]>([])

const loading = ref(false)
const checking = ref(false)
const calculating = ref(false)
const submitting = ref(false)
const exportLoading = ref(false)
const dirty = ref(false)
const showSummary = ref(false)
const recordLoaded = ref(false)
const record = ref<FillApi.FillRecordVO>({
  orgId: 0,
  orgName: '',
  reportId: 0,
  reportCode: '',
  reportName: '',
  period: '',
  rowCount: 0,
  fillStatus: 0,
  checkStatus: 0,
  fillUser: '',
  lastModifier: '',
  lastModifyTime: '',
  deadline: '',
  submitTime: '',
  remark: ''
})
const columns = ref<FillApi.FillColumnVO[]>([])
const rows = ref<EditRow[]>([])
const checkSummary = ref<FillApi.FillCheckResultVO | null>(null)
const issueMap = ref<Record<string, RowIssue>>({})
const query = reactive({ pageNo: 1, pageSize: 20 })
const historyRef = ref()

let ridSeq = 0
const nextRid = () => `rid-${++ridSeq}`

const pagedRows = computed(() => {
  const start = (query.pageNo - 1) * query.pageSize
  return rows.value.slice(start, start + query.pageSize)
})

const numericColumns = computed(() => columns.value.filter((col) => col.numeric))

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const totalOf = (field: string) =>
  rows.value.reduce((sum, row) => sum + (Number((row as any)[field]) || 0), 0)

const checkTitle = computed(() => {
  const data = checkSummary.value
  if (!data) return ''
  const tail =
    data.errorCount > 0
      ? '错误行已标红（单元格红框），修改后请重新校验；校验不通过不允许提交。'
      : data.warnCount > 0
        ? '警告不阻断提交，请确认数据无误。'
        : '数据校验通过，可保存后提交。'
  return `校验完成：共 ${data.total} 行，通过 ${data.passCount} 行 / 警告 ${data.warnCount} 行 / 错误 ${data.errorCount} 行。${tail}`
})

const summaryTitle = computed(
  () =>
    `合计（全表 ${rows.value.length} 行）：` +
    numericColumns.value
      .map((col) => `${col.label} ${formatMoney(totalOf(col.field))}`)
      .join('　｜　')
)

const issueOf = (row: EditRow): RowIssue | undefined => issueMap.value[row._rid]

const rowClassName = ({ row }: { row: EditRow }) => {
  const issue = issueMap.value[row._rid]
  if (!issue) return ''
  return issue.level === 2 ? 'fill-row-error' : 'fill-row-warning'
}

const cellClassName = ({ row, column }: { row: EditRow; column: any }) => {
  const issue = issueMap.value[row._rid]
  if (!issue || !issue.columns.includes(column.property)) return ''
  return issue.level === 2 ? 'fill-cell-error' : 'fill-cell-warning'
}

/** el-table 合计行：数值列求和 */
const summaryMethod = ({ columns: tableColumns }: { columns: any[] }) => {
  return tableColumns.map((column, index) => {
    if (index === 0) return '合计'
    if (index === 1) return `${rows.value.length} 行`
    const def = columns.value.find((col) => col.field === column.property)
    if (def?.numeric) return formatMoney(totalOf(def.field))
    return ''
  })
}

const markDirty = () => {
  dirty.value = true
}

/** 去掉前端专用字段，提交给 mock */
const plainRows = (): FillApi.FillDataVO[] =>
  rows.value.map(({ _rid, ...rest }) => rest as FillApi.FillDataVO)

const createEmptyRow = (): EditRow => ({
  _rid: nextRid(),
  policyNo: '',
  holderName: '',
  certNo: '',
  productName: '',
  sumAssured: 0,
  premiumAmount: 0,
  rate: 0,
  effectDate: '',
  channel: '个险',
  dataStatus: '正常',
  remark: ''
})

const clearIssues = () => {
  issueMap.value = {}
  checkSummary.value = null
}

/** 加载当前上下文的填报表单 */
const loadData = async () => {
  if (!context.orgId || !context.reportId || !context.period) return
  loading.value = true
  try {
    const data = await FillApi.getFillData({
      orgId: context.orgId,
      reportId: context.reportId,
      period: context.period
    })
    record.value = data.record
    columns.value = data.columns || []
    rows.value = (data.rows || []).map((row) => ({ ...row, _rid: nextRid() }))
    recordLoaded.value = true
    Object.assign(snapshot, context)
    dirty.value = false
    showSummary.value = false
    query.pageNo = 1
    clearIssues()
  } finally {
    loading.value = false
  }
}

/** 切换期次 / 机构 / 报表：有未保存修改时先确认 */
const handleContextChange = async () => {
  if (
    context.period === snapshot.period &&
    context.orgId === snapshot.orgId &&
    context.reportId === snapshot.reportId
  ) {
    return
  }
  if (dirty.value) {
    try {
      await message.confirm('当前报表存在未保存的修改，切换后将丢失，是否继续？', '未保存提醒')
    } catch {
      Object.assign(context, snapshot)
      return
    }
  }
  await loadData()
}

/** 保存 */
const handleSave = async () => {
  try {
    await message.confirm(
      `确认保存【${record.value.orgName}｜${record.value.reportName}｜${context.period}】共 ${rows.value.length} 行数据？`
    )
  } catch {
    return
  }
  const data = await FillApi.saveFillData({
    orgId: context.orgId,
    reportId: context.reportId,
    period: context.period,
    rows: plainRows()
  })
  record.value.rowCount = data.rowCount
  record.value.fillStatus = 1
  record.value.lastModifier = record.value.fillUser
  record.value.lastModifyTime = data.saveTime
  dirty.value = false
  message.success(`保存成功：共 ${data.rowCount} 行，保存时间 ${data.saveTime}`)
}

/** 数据校验：错误行标红并给出提示 */
const handleCheck = async () => {
  if (!rows.value.length) {
    message.warning('当前报表暂无数据，请先新增行')
    return
  }
  checking.value = true
  try {
    const data = await FillApi.checkFillData({
      orgId: context.orgId,
      reportId: context.reportId,
      period: context.period,
      rows: plainRows()
    })
    checkSummary.value = data
    const map: Record<string, RowIssue> = {}
    ;(data.items || []).forEach((item) => {
      const row = rows.value[item.rowIndex]
      if (!row) return
      if (!map[row._rid]) map[row._rid] = { level: item.level, messages: [], columns: [] }
      const issue = map[row._rid]
      issue.level = Math.max(issue.level, item.level)
      issue.messages.push(`【${item.columnLabel}】${item.message}`)
      if (!issue.columns.includes(item.column)) issue.columns.push(item.column)
    })
    issueMap.value = map
    record.value.checkStatus = data.errorCount > 0 ? 3 : 2
    if (data.errorCount > 0) {
      message.error(`校验发现 ${data.errorCount} 行错误，已标红，请修改后重新校验`)
    } else if (data.warnCount > 0) {
      message.warning(`校验发现 ${data.warnCount} 行警告，不阻断提交，请确认数据`)
    } else {
      message.success('数据校验通过')
    }
  } finally {
    checking.value = false
  }
}

/** 汇总：显示底部合计行 */
const handleSummary = () => {
  if (!rows.value.length) {
    message.warning('当前报表暂无数据，无法汇总')
    return
  }
  showSummary.value = !showSummary.value
  if (showSummary.value)
    message.success(`汇总完成，共 ${rows.value.length} 行，合计已显示在表格底部`)
}

/** 计算：保险金额 = 保费金额 × 费率 */
const handleCalculate = async () => {
  if (!rows.value.length) {
    message.warning('当前报表暂无数据，无法计算')
    return
  }
  calculating.value = true
  try {
    const data = await FillApi.calculateFillData({
      orgId: context.orgId,
      reportId: context.reportId,
      period: context.period,
      rows: plainRows()
    })
    rows.value = (data.rows || []).map((row, index) => ({
      ...row,
      _rid: rows.value[index]?._rid || nextRid()
    }))
    markDirty()
    clearIssues()
    if (data.changedCount > 0) {
      message.success(`计算完成：按「${data.rule}」更新 ${data.changedCount} 行`)
    } else {
      message.info(`计算完成：所有数据已满足「${data.rule}」，无需调整`)
    }
  } finally {
    calculating.value = false
  }
}

/** 数据恢复：回滚到上次保存版本 */
const handleRestore = async () => {
  try {
    await message.confirm('确认放弃当前未保存的修改，恢复到上次保存的版本？', '数据恢复')
  } catch {
    return
  }
  const data = await FillApi.restoreFillData({
    orgId: context.orgId,
    reportId: context.reportId,
    period: context.period
  })
  rows.value = (data.rows || []).map((row) => ({ ...row, _rid: nextRid() }))
  dirty.value = false
  query.pageNo = 1
  clearIssues()
  message.success(`已恢复到最后保存版本：共 ${data.rowCount} 行（${data.restoreTime}）`)
}

/** 修改历史 */
const handleHistory = () => {
  historyRef.value.open({
    orgId: context.orgId,
    reportId: context.reportId,
    period: context.period,
    orgName: record.value.orgName,
    reportName: record.value.reportName
  })
}

/** 新增行（追加到末尾） */
const handleAddRow = () => {
  rows.value.push(createEmptyRow())
  query.pageNo = Math.max(1, Math.ceil(rows.value.length / query.pageSize))
  markDirty()
}

const absoluteIndex = (pageIndex: number) => (query.pageNo - 1) * query.pageSize + pageIndex

/** 插入行 */
const insertRow = (pageIndex: number) => {
  rows.value.splice(absoluteIndex(pageIndex) + 1, 0, createEmptyRow())
  markDirty()
}

/** 复制行 */
const copyRow = (pageIndex: number) => {
  const source = rows.value[absoluteIndex(pageIndex)]
  if (!source) return
  rows.value.splice(absoluteIndex(pageIndex) + 1, 0, {
    ...source,
    _rid: nextRid(),
    remark: source.remark ? `${source.remark}（复制）` : '复制行，请核对后修改'
  })
  markDirty()
}

/** 删除行 */
const removeRow = async (pageIndex: number) => {
  const index = absoluteIndex(pageIndex)
  try {
    await message.delConfirm('确认删除该行数据？')
  } catch {
    return
  }
  rows.value.splice(index, 1)
  const maxPage = Math.max(1, Math.ceil(rows.value.length / query.pageSize))
  if (query.pageNo > maxPage) query.pageNo = maxPage
  markDirty()
}

/** 批量操作（跳转手工批量操作页面） */
const handleBatch = () => {
  router.push({ path: '/new-unified/cr-data/batch', query: { period: context.period } })
}

/** 提交当前报表数据 */
const handleSubmit = async () => {
  try {
    await message.confirm(
      `确认提交【${record.value.orgName}｜${record.value.reportName}｜${context.period}】的填报数据？提交后不可直接修改。`,
      '提交确认'
    )
  } catch {
    return
  }
  submitting.value = true
  try {
    if (dirty.value) {
      await FillApi.saveFillData({
        orgId: context.orgId,
        reportId: context.reportId,
        period: context.period,
        rows: plainRows()
      })
      dirty.value = false
    }
    if (!record.value.id) {
      message.error('提交失败：请先保存填报数据后再提交')
      return
    }
    const data = await SubmitApi.submitFillRecords([record.value.id])
    record.value.fillStatus = 2
    record.value.submitTime = data.submitTime
    message.success(`提交成功：${data.successCount} 条记录已于 ${data.submitTime} 提交`)
  } finally {
    submitting.value = false
  }
}

/** 导出填报数据 */
const handleExport = async () => {
  if (!rows.value.length) {
    message.warning('当前报表暂无数据，无法导出')
    return
  }
  try {
    await message.exportConfirm()
  } catch {
    return
  }
  exportLoading.value = true
  try {
    const data = await FillApi.exportFillData({
      orgId: context.orgId,
      reportId: context.reportId,
      period: context.period
    })
    download.excel(data, `${record.value.orgName}_${record.value.reportName}_${context.period}.csv`)
  } finally {
    exportLoading.value = false
  }
}

/**
 * 读取路由上的上下文参数（机构 / 报表 / 期次）：
 * 「我的任务 → 去填报」等入口会把该任务的上下文带在 query 上，命中下拉选项时直接作为初始筛选条件。
 */
const applyRouteContext = () => {
  const pick = (value: unknown) => (Array.isArray(value) ? value[0] : value)
  const orgId = Number(pick(route.query.orgId) || 0)
  const reportId = Number(pick(route.query.reportId) || 0)
  const period = String(pick(route.query.period) || '').trim()
  if (period && periodOptions.value.includes(period)) context.period = period
  if (orgId && orgOptions.value.some((org) => org.id === orgId)) context.orgId = orgId
  if (reportId && reportOptions.value.some((report) => report.id === reportId)) {
    context.reportId = reportId
  }
}

/** 初始化下拉选项，并给出一个可直接演示的默认上下文 */
const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    FillApi.getFillPeriodOptions(),
    FillApi.getFillOrgOptions(),
    FillApi.getFillReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  context.period = periodOptions.value.includes('202608')
    ? '202608'
    : periodOptions.value[periodOptions.value.length - 1]
  // 默认落在有填报数据的分公司（总公司本期暂无明细，可直接新增行演示）
  context.orgId = (orgOptions.value.find((org) => org.level === 2) || orgOptions.value[0])?.id || 0
  context.reportId =
    reportOptions.value.find((report) => report.code === 'BX011')?.id ||
    reportOptions.value[0]?.id ||
    0
  // 入口带过来的上下文优先于默认值
  applyRouteContext()
  await loadData()
}

onMounted(() => {
  initOptions()
})

/** 本页被 keep-alive 缓存：再次进入时重新拉一次数据（否则脱敏执行 / 还原后回来看到的还是旧值） */
let firstActivate = true
onActivated(() => {
  if (firstActivate) {
    firstActivate = false
    return
  }
  if (!context.orgId || !context.reportId || !context.period) return
  applyRouteContext()
  loadData()
})
</script>

<style lang="scss" scoped>
:deep(.el-table .fill-row-error td.el-table__cell) {
  background-color: #fef0f0;
}

:deep(.el-table .fill-row-warning td.el-table__cell) {
  background-color: #fdf6ec;
}

:deep(.el-table .fill-cell-error) {
  box-shadow: inset 0 0 0 1px #f56c6c;
}

:deep(.el-table .fill-cell-warning) {
  box-shadow: inset 0 0 0 1px #e6a23c;
}

:deep(.el-input-number .el-input__inner) {
  text-align: right;
}
</style>
