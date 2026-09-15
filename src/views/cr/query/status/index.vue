<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="请选择期次" clearable class="!w-160px">
          <el-option
            v-for="period in periodOptions"
            :key="period"
            :label="period"
            :value="period"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="机构" prop="orgIds">
        <el-select
          v-model="queryParams.orgIds"
          placeholder="请选择机构（可多选）"
          multiple
          collapse-tags
          clearable
          class="!w-260px"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          filterable
          clearable
          class="!w-260px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.name"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="填报状态" prop="fillStatus">
        <el-select
          v-model="queryParams.fillStatus"
          placeholder="请选择填报状态"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_FILL_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="校验状态" prop="checkStatus">
        <el-select
          v-model="queryParams.checkStatus"
          placeholder="请选择校验状态"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_CHECK_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:query-status:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 小结卡片 -->
  <ContentWrap>
    <el-row :gutter="16">
      <el-col v-for="card in summaryCards" :key="card.title" :xs="24" :sm="12" :md="6">
        <SummaryCard
          :title="card.title"
          :tooltip="card.tooltip"
          :icon="card.icon"
          :icon-color="card.iconColor"
          :icon-bg-color="card.iconBgColor"
          :value="card.value"
        />
      </el-col>
    </el-row>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="按「机构 × 报表 × 期次」展示报送状态总览，点击任意行可下钻查看数据表拆分、校验问题与处理轨迹。"
    />
    <el-table
      v-loading="loading"
      :data="list"
      :row-class-name="rowClassName"
      @row-click="openDetail"
    >
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column label="报表编码" align="center" prop="reportCode" width="110" />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="报送期次" align="center" prop="period" width="100" />
      <el-table-column label="填报状态" align="center" prop="fillStatus" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="scope.row.fillStatus" />
        </template>
      </el-table-column>
      <el-table-column label="校验状态" align="center" prop="checkStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_CHECK_STATUS" :value="scope.row.checkStatus" />
        </template>
      </el-table-column>
      <el-table-column label="报送状态" align="center" prop="submitStatus" width="100">
        <template #default="scope">
          <el-tag :type="submitStatusType(scope.row.submitStatus)" effect="plain">
            {{ submitStatusLabel(scope.row.submitStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="数据行数" align="right" prop="dataRows" width="120">
        <template #default="scope">{{ formatNumber(scope.row.dataRows) }}</template>
      </el-table-column>
      <el-table-column
        label="最后修改人"
        align="center"
        prop="lastModifier"
        width="110"
        show-overflow-tooltip
      >
        <template #default="scope">{{ scope.row.lastModifier || '-' }}</template>
      </el-table-column>
      <el-table-column label="最后修改时间" align="center" prop="lastModifyTime" width="170">
        <template #default="scope">{{ scope.row.lastModifyTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="90" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click.stop="openDetail(scope.row)"
            v-hasPermi="['cr:query-status:query']"
          >
            明细
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 抽屉：报送明细下钻 -->
  <StatusDetailDrawer ref="detailDrawerRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ReportStatusApi from '@/api/cr/query/status'
import * as QueryCommonApi from '@/api/cr/query/common'
import StatusDetailDrawer from './StatusDetailDrawer.vue'

defineOptions({ name: 'CrQueryStatus' })

/** el-tag 主题色 */
type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const message = useMessage()
const route = useRoute()

const loading = ref(true)
const exportLoading = ref(false)
const total = ref(0)
const list = ref<ReportStatusApi.ReportStatusVO[]>([])
const periodOptions = ref<string[]>([])
const orgOptions = ref<QueryCommonApi.OrgOptionVO[]>([])
const reportOptions = ref<QueryCommonApi.ReportOptionVO[]>([])

const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '',
  orgIds: [] as number[],
  reportId: undefined as number | undefined,
  fillStatus: undefined as number | undefined,
  checkStatus: undefined as number | undefined
})
const queryFormRef = ref()
const summary = ref<ReportStatusApi.ReportStatusSummaryVO>({
  shouldReport: 0,
  filled: 0,
  checked: 0,
  submitted: 0
})

/** 报送状态：本域约定，无对应字典 */
const SUBMIT_STATUS: Record<number, { label: string; type: TagType }> = {
  0: { label: '未报送', type: 'info' },
  1: { label: '报送中', type: 'warning' },
  2: { label: '已报送', type: 'success' }
}
const submitStatusLabel = (value: number) => SUBMIT_STATUS[Number(value)]?.label || '-'
const submitStatusType = (value: number): TagType => SUBMIT_STATUS[Number(value)]?.type || 'info'

/** 千分位格式化 */
const formatNumber = (value?: number) =>
  value === undefined || value === null ? '-' : Number(value).toLocaleString('zh-CN')

/** 小结卡片 */
const summaryCards = computed(() => [
  {
    title: '应报报表数',
    tooltip: '按当前查询条件统计的应报报表数量',
    icon: 'ep:document',
    iconColor: 'text-blue-500',
    iconBgColor: 'bg-blue-100',
    value: summary.value.shouldReport
  },
  {
    title: '已填报',
    tooltip: '填报状态为「已提交」的报表数量',
    icon: 'ep:edit-pen',
    iconColor: 'text-cyan-500',
    iconBgColor: 'bg-cyan-100',
    value: summary.value.filled
  },
  {
    title: '已校验通过',
    tooltip: '校验状态为「校验通过」的报表数量',
    icon: 'ep:circle-check',
    iconColor: 'text-purple-500',
    iconBgColor: 'bg-purple-100',
    value: summary.value.checked
  },
  {
    title: '已报送',
    tooltip: '已完成监管报送的报表数量',
    icon: 'ep:upload-filled',
    iconColor: 'text-green-500',
    iconBgColor: 'bg-green-100',
    value: summary.value.submitted
  }
])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ReportStatusApi.getReportStatusPage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** 查询小结卡片 */
const getSummary = async () => {
  summary.value = await ReportStatusApi.getReportStatusSummary({
    period: queryParams.period,
    orgIds: queryParams.orgIds,
    reportId: queryParams.reportId,
    fillStatus: queryParams.fillStatus,
    checkStatus: queryParams.checkStatus
  })
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
  getSummary()
}

/** 重置 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  queryParams.orgIds = []
  queryParams.reportId = undefined
  queryParams.period = periodOptions.value[periodOptions.value.length - 1] || ''
  handleQuery()
}

/** 抽屉明细 */
const detailDrawerRef = ref()
const openDetail = (row: ReportStatusApi.ReportStatusVO) => {
  if (!row?.orgId) return
  detailDrawerRef.value.open(row)
}

/** 行样式：可点击下钻 */
const rowClassName = () => 'cursor-pointer'

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ReportStatusApi.exportReportStatus(queryParams)
    download.excel(data, '报表报送状态.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/**
 * 读取路由上的上下文参数（机构 / 报表 / 期次）：
 * 「我的任务 → 查看」等入口会把该任务的上下文带在 query 上，命中下拉选项时作为初始筛选条件。
 */
const applyRouteContext = () => {
  const pick = (value: unknown) => (Array.isArray(value) ? value[0] : value)
  const orgId = Number(pick(route.query.orgId) || pick(route.query.orgIds) || 0)
  const reportId = Number(pick(route.query.reportId) || 0)
  const period = String(pick(route.query.period) || '').trim()
  if (period && periodOptions.value.includes(period)) queryParams.period = period
  if (orgId && orgOptions.value.some((org) => org.id === orgId)) queryParams.orgIds = [orgId]
  if (reportId && reportOptions.value.some((report) => report.id === reportId)) {
    queryParams.reportId = reportId
  }
}

/** 初始化：加载下拉数据后再查询，保证默认期次口径正确 */
const init = async () => {
  const [periods, orgs, reports] = await Promise.all([
    QueryCommonApi.getQueryPeriodOptions(),
    QueryCommonApi.getQueryOrgOptions(),
    QueryCommonApi.getQueryReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  queryParams.period = periodOptions.value[periodOptions.value.length - 1] || ''
  // 入口带过来的上下文优先于默认值
  applyRouteContext()
  await Promise.all([getList(), getSummary()])
}

onMounted(() => {
  init()
})
</script>
