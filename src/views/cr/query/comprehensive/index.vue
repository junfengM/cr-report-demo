<template>
  <ContentWrap>
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- ============ 高级对比 ============ -->
      <el-tab-pane label="高级对比" name="compare">
        <el-form class="-mb-15px" :inline="true" :model="compareForm" label-width="80px">
          <el-form-item label="报表">
            <el-select
              v-model="compareForm.reportId"
              placeholder="请选择报表"
              filterable
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
          <el-form-item label="机构">
            <el-select v-model="compareForm.orgId" placeholder="请选择机构" class="!w-200px">
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.orgName"
                :value="org.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="对比期次">
            <el-select
              v-model="compareForm.periods"
              placeholder="请选择期次（可多选）"
              multiple
              collapse-tags
              class="!w-320px"
            >
              <el-option
                v-for="period in periodOptions"
                :key="period"
                :label="period"
                :value="period"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="compareLoading"
              @click="handleCompare"
              v-hasPermi="['cr:query-comprehensive:compare']"
            >
              <Icon icon="ep:data-analysis" class="mr-5px" /> 对比
            </el-button>
            <el-button
              type="success"
              plain
              :loading="exportLoading"
              @click="handleExport"
              v-hasPermi="['cr:query-comprehensive:export']"
            >
              <Icon icon="ep:download" class="mr-5px" /> 导出
            </el-button>
          </el-form-item>
        </el-form>

        <el-alert
          class="mt-16px"
          type="info"
          :closable="false"
          show-icon
          title="环比 =（本期 - 上期）/ 上期；同比 =（本期 - 去年同期的期次）/ 去年同期。除数为 0 或缺失时显示 -。"
        />

        <div v-loading="compareLoading" class="mt-10px">
          <Echart :options="chartOptions" :height="320" />
        </div>

        <el-table v-loading="compareLoading" :data="compareResult.rows" class="mt-10px" border>
          <el-table-column
            label="指标名称"
            align="left"
            prop="indicator"
            min-width="220"
            fixed="left"
            show-overflow-tooltip
          />
          <el-table-column label="单位" align="center" prop="unit" width="80" />
          <el-table-column
            v-for="period in compareResult.periods"
            :key="period"
            :label="period"
            align="right"
            min-width="140"
          >
            <template #default="scope">{{ formatValue(scope.row.values[period]) }}</template>
          </el-table-column>
          <el-table-column
            :label="`环比(vs ${compareResult.momPeriod || '-'})`"
            align="right"
            width="150"
          >
            <template #default="scope">
              <span :class="ratioClass(scope.row.mom)">{{ formatRatio(scope.row.mom) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="`同比(vs ${compareResult.yoyPeriod || '-'})`"
            align="right"
            width="150"
          >
            <template #default="scope">
              <span :class="ratioClass(scope.row.yoy)">{{ formatRatio(scope.row.yoy) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ============ 数据追溯 ============ -->
      <el-tab-pane label="数据追溯" name="trace">
        <el-form class="-mb-15px" :inline="true" :model="traceForm" label-width="80px">
          <el-form-item label="报表">
            <el-select
              v-model="traceForm.reportId"
              placeholder="请选择报表"
              filterable
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
          <el-form-item label="机构">
            <el-select v-model="traceForm.orgId" placeholder="请选择机构" class="!w-200px">
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.orgName"
                :value="org.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="报送期次">
            <el-select v-model="traceForm.period" placeholder="请选择期次" class="!w-160px">
              <el-option
                v-for="period in periodOptions"
                :key="period"
                :label="period"
                :value="period"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="traceLoading"
              @click="handleTrace"
              v-hasPermi="['cr:query-comprehensive:trace']"
            >
              <Icon icon="ep:search" class="mr-5px" /> 追溯
            </el-button>
          </el-form-item>
        </el-form>

        <el-descriptions v-if="traceResult.reportId" class="mt-16px" :column="3" border>
          <el-descriptions-item label="机构">{{ traceResult.orgName }}</el-descriptions-item>
          <el-descriptions-item label="报表">{{ traceResult.reportName }}</el-descriptions-item>
          <el-descriptions-item label="报送期次">{{ traceResult.period }}</el-descriptions-item>
        </el-descriptions>

        <div v-loading="traceLoading">
          <el-timeline v-if="traceResult.nodes?.length" class="mt-16px">
            <el-timeline-item
              v-for="node in traceResult.nodes"
              :key="node.node"
              :timestamp="node.nodeTime"
              :type="resultType(node.result)"
              placement="top"
              size="large"
            >
              <div class="flex items-center gap-2">
                <span class="font-bold">{{ node.node }}</span>
                <el-tag :type="resultType(node.result)" effect="plain">{{ node.result }}</el-tag>
              </div>
              <div class="mt-4px text-3.5 text-gray-500">
                操作人：{{ node.operator }}｜耗时：{{ node.costSeconds }} 秒｜影响行数：{{
                  formatNumber(node.affectRows)
                }}
              </div>
              <div class="text-3.5 text-gray-500">{{ node.remark }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无追溯数据，请调整报表 / 机构 / 期次后重试" />
        </div>
      </el-tab-pane>

      <!-- ============ 报表备注 ============ -->
      <el-tab-pane label="报表备注" name="remark">
        <el-form class="-mb-15px" :inline="true" :model="remarkQuery" label-width="80px">
          <el-form-item label="报表">
            <el-select
              v-model="remarkQuery.reportId"
              placeholder="请选择报表"
              filterable
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
          <el-form-item label="机构">
            <el-select v-model="remarkQuery.orgId" placeholder="请选择机构" class="!w-200px">
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.orgName"
                :value="org.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="报送期次">
            <el-select v-model="remarkQuery.period" placeholder="请选择期次" class="!w-160px">
              <el-option
                v-for="period in periodOptions"
                :key="period"
                :label="period"
                :value="period"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="handleRemarkQuery" v-hasPermi="['cr:query-comprehensive:query']">
              <Icon icon="ep:search" class="mr-5px" /> 搜索
            </el-button>
            <el-button @click="resetRemarkQuery">
              <Icon icon="ep:refresh" class="mr-5px" /> 重置
            </el-button>
            <el-button type="primary" plain @click="openRemarkForm">
              <Icon icon="ep:plus" class="mr-5px" /> 新增备注
            </el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="remarkLoading" :data="remarkList" class="mt-16px">
          <el-table-column
            label="机构"
            align="left"
            prop="orgName"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column
            label="报表名称"
            align="left"
            prop="reportName"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column label="报送期次" align="center" prop="period" width="100" />
          <el-table-column label="备注人" align="center" prop="creator" width="100" />
          <el-table-column label="备注时间" align="center" prop="createTime" width="170" />
          <el-table-column
            label="备注内容"
            align="left"
            prop="content"
            min-width="320"
            show-overflow-tooltip
          />
        </el-table>
        <Pagination
          :total="remarkTotal"
          v-model:page="remarkQuery.pageNo"
          v-model:limit="remarkQuery.pageSize"
          @pagination="getRemarkList"
        />
      </el-tab-pane>
    </el-tabs>
  </ContentWrap>

  <!-- 新增备注弹窗 -->
  <RemarkForm ref="remarkFormRef" @success="getRemarkList" />
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import download from '@/utils/download'
import * as ComprehensiveApi from '@/api/cr/query/comprehensive'
import * as QueryCommonApi from '@/api/cr/query/common'
import RemarkForm from './RemarkForm.vue'

defineOptions({ name: 'CrQueryComprehensive' })

const message = useMessage()

const activeTab = ref('compare')
const periodOptions = ref<string[]>([])
const orgOptions = ref<QueryCommonApi.OrgOptionVO[]>([])
const reportOptions = ref<QueryCommonApi.ReportOptionVO[]>([])

/* ---------- 高级对比 ---------- */
const compareLoading = ref(false)
const exportLoading = ref(false)
const compareForm = reactive({
  reportId: undefined as number | undefined,
  orgId: undefined as number | undefined,
  periods: [] as string[]
})
const compareResult = ref<ComprehensiveApi.CompareResultVO>({
  reportId: 0,
  reportCode: '',
  reportName: '',
  freq: 0,
  orgId: 0,
  orgName: '',
  periods: [],
  momPeriod: '',
  yoyPeriod: '',
  rows: []
})
const chartOptions = shallowRef<EChartsOption>({})

/** 千分位格式化，最多保留 2 位小数 */
const formatValue = (value?: number | null) => {
  if (value === undefined || value === null) return '-'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const formatNumber = (value?: number | null) => {
  if (value === undefined || value === null) return '-'
  return Number(value).toLocaleString('zh-CN')
}

/** 环比 / 同比：百分比文案，null 显示 - */
const formatRatio = (value?: number | null) => {
  if (value === undefined || value === null) return '-'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

/** 增长为红、下降为绿（与工作台口径一致） */
const ratioClass = (value?: number | null) => {
  if (value === undefined || value === null) return 'text-gray-400'
  if (value > 0) return 'text-red-500'
  if (value < 0) return 'text-green-500'
  return 'text-gray-500'
}

/** 趋势折线图：每个指标一条线，横轴为对比期次 */
const buildChart = () => {
  const { periods, rows } = compareResult.value
  chartOptions.value = {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0, data: rows.map((row) => row.indicator) },
    grid: { left: 70, right: 30, top: 48, bottom: 32 },
    xAxis: { type: 'category', boundaryGap: false, data: periods },
    yAxis: { type: 'value', name: rows[0]?.unit || '' },
    series: rows.map((row) => ({
      name: row.indicator,
      type: 'line',
      smooth: true,
      showSymbol: true,
      data: periods.map((period) => row.values[period] ?? null)
    }))
  }
}

/** 高级对比查询 */
const handleCompare = async () => {
  if (!compareForm.reportId) {
    message.warning('请选择报表')
    return
  }
  if (!compareForm.orgId) {
    message.warning('请选择机构')
    return
  }
  if (!compareForm.periods.length) {
    message.warning('请至少选择一个报送期次')
    return
  }
  compareLoading.value = true
  try {
    compareResult.value = await ComprehensiveApi.getCompareData({
      reportId: compareForm.reportId,
      orgId: compareForm.orgId,
      periods: compareForm.periods.join(',')
    })
    buildChart()
  } finally {
    compareLoading.value = false
  }
}

/** 导出对比结果 */
const handleExport = async () => {
  if (!compareResult.value.rows.length) {
    message.warning('请先执行对比查询')
    return
  }
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ComprehensiveApi.exportCompareData({
      reportId: compareForm.reportId,
      orgId: compareForm.orgId,
      periods: compareForm.periods.join(',')
    })
    download.excel(data, `综合查询-多期对比-${compareResult.value.reportCode || ''}.xls`)
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/* ---------- 数据追溯 ---------- */
const traceLoading = ref(false)
const traceForm = reactive({
  reportId: undefined as number | undefined,
  orgId: undefined as number | undefined,
  period: ''
})
const traceResult = ref<Partial<ComprehensiveApi.TraceResultVO>>({})

const resultType = (result?: string) => {
  if (result === '成功') return 'success'
  if (result === '失败') return 'danger'
  if (result === '进行中') return 'primary'
  return 'info'
}

/** 数据追溯查询 */
const handleTrace = async () => {
  if (!traceForm.reportId || !traceForm.orgId || !traceForm.period) {
    message.warning('请选择报表、机构与报送期次')
    return
  }
  traceLoading.value = true
  try {
    traceResult.value = await ComprehensiveApi.getTraceData({
      reportId: traceForm.reportId,
      orgId: traceForm.orgId,
      period: traceForm.period
    })
  } finally {
    traceLoading.value = false
  }
}

/* ---------- 报表备注 ---------- */
const remarkLoading = ref(false)
const remarkList = ref<ComprehensiveApi.RemarkVO[]>([])
const remarkTotal = ref(0)
const remarkQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  reportId: undefined as number | undefined,
  orgId: undefined as number | undefined,
  period: ''
})

const getRemarkList = async () => {
  if (!remarkQuery.reportId || !remarkQuery.orgId || !remarkQuery.period) return
  remarkLoading.value = true
  try {
    const data = await ComprehensiveApi.getRemarkPage({
      pageNo: remarkQuery.pageNo,
      pageSize: remarkQuery.pageSize,
      reportId: remarkQuery.reportId,
      orgId: remarkQuery.orgId,
      period: remarkQuery.period
    })
    remarkList.value = data.list
    remarkTotal.value = data.total
  } finally {
    remarkLoading.value = false
  }
}

const handleRemarkQuery = () => {
  if (!remarkQuery.reportId || !remarkQuery.orgId || !remarkQuery.period) {
    message.warning('请选择报表、机构与报送期次')
    return
  }
  remarkQuery.pageNo = 1
  getRemarkList()
}

const resetRemarkQuery = () => {
  remarkQuery.reportId = compareForm.reportId
  remarkQuery.orgId = compareForm.orgId
  remarkQuery.period = periodOptions.value[periodOptions.value.length - 1] || ''
  handleRemarkQuery()
}

/** 新增备注 */
const remarkFormRef = ref()
const openRemarkForm = () => {
  if (!remarkQuery.reportId || !remarkQuery.orgId || !remarkQuery.period) {
    message.warning('请先选择报表、机构与报送期次，再新增备注')
    return
  }
  remarkFormRef.value.open({
    orgId: remarkQuery.orgId,
    orgName: orgOptions.value.find((org) => org.id === remarkQuery.orgId)?.orgName || '',
    reportId: remarkQuery.reportId,
    reportName:
      reportOptions.value.find((report) => report.id === remarkQuery.reportId)?.name || '',
    period: remarkQuery.period
  })
}

/* ---------- 页签切换（首次进入时加载） ---------- */
const loadedTabs = reactive<Record<string, boolean>>({ compare: true })
const handleTabChange = (name: string | number) => {
  const tab = String(name)
  if (loadedTabs[tab]) return
  loadedTabs[tab] = true
  if (tab === 'trace') handleTrace()
  if (tab === 'remark') handleRemarkQuery()
}

/** 初始化：下拉数据 + 默认查询条件（默认取最近 3 期） */
const init = async () => {
  const [periods, orgs, reports] = await Promise.all([
    QueryCommonApi.getQueryPeriodOptions(),
    QueryCommonApi.getQueryOrgOptions(),
    QueryCommonApi.getQueryReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []

  const defaultReport =
    reportOptions.value.find((report) => report.name.includes('保费收入')) ||
    reportOptions.value.find((report) => report.freq === 3) ||
    reportOptions.value[0]
  compareForm.reportId = defaultReport?.id
  compareForm.orgId = orgOptions.value[0]?.id
  compareForm.periods = periodOptions.value.slice(-3)

  traceForm.reportId = compareForm.reportId
  traceForm.orgId = compareForm.orgId
  traceForm.period = periodOptions.value[periodOptions.value.length - 1] || ''

  remarkQuery.reportId = compareForm.reportId
  remarkQuery.orgId = compareForm.orgId
  remarkQuery.period = traceForm.period

  await handleCompare()
}

onMounted(() => {
  init()
})
</script>
