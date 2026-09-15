<template>
  <ContentWrap :title="pageTitle" :message="payload.description">
    <!-- 筛选栏：机构 / 报表 / 期次，全部可空 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="填报机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="全部机构"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="org in filterOptions.orgs"
            :key="org.id"
            :label="org.orgName"
            :value="org.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="全部报表"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="report in filterOptions.reports"
            :key="report.id"
            :label="report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="全部期次" clearable class="!w-160px">
          <el-option
            v-for="period in filterOptions.periods"
            :key="period"
            :label="period"
            :value="period"
          />
        </el-select>
      </el-form-item>
      <!-- 时点数据查询专用：截止时点（留空 = 当前时间，口径说明里写清了） -->
      <el-form-item v-if="showFilter('asOf')" label="截止时点" prop="asOf">
        <el-date-picker
          v-model="queryParams.asOf"
          type="datetime"
          placeholder="留空 = 当前时间"
          value-format="YYYY-MM-DD HH:mm:ss"
          class="!w-220px"
        />
      </el-form-item>
      <!-- 历史数据查询专用：归档月份（取自「上报时间的年月」） -->
      <el-form-item v-if="showFilter('archiveMonth')" label="归档月份" prop="archiveMonth">
        <el-date-picker
          v-model="queryParams.archiveMonth"
          type="month"
          placeholder="全部月份"
          value-format="YYYY-MM"
          class="!w-180px"
        />
      </el-form-item>
      <el-form-item>
        <el-button :disabled="!canQuery" @click="handleQuery">
          <Icon icon="ep:search" class="mr-5px" /> 查询
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 口径说明：这一页最值钱的区块，演示时照着念 -->
  <ContentWrap title="口径说明">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="payload.note || '正在加载口径说明，请稍候…'"
    />
    <div class="mt-10px text-13px text-gray-500">
      <span>当前筛选：{{ payload.filterText || '全部机构 / 全部报表 / 全部期次' }}</span>
      <span class="ml-20px">生成时间：{{ payload.generatedAt || '-' }}</span>
    </div>
  </ContentWrap>

  <!-- 指标卡：summary 每项一张卡，带 tip 的用 tooltip -->
  <el-row v-if="payload.summary.length" :gutter="16">
    <el-col
      v-for="(item, index) in payload.summary"
      :key="item.label + index"
      :xs="12"
      :sm="8"
      :md="6"
      class="mb-16px"
    >
      <el-card shadow="never">
        <div class="flex items-center justify-between text-13px text-gray-500">
          <span>{{ item.label }}</span>
          <el-tooltip v-if="item.tip" effect="dark" :content="item.tip" placement="top">
            <Icon icon="ep:question-filled" :size="14" />
          </el-tooltip>
        </div>
        <div class="mt-8px flex items-baseline">
          <span class="text-24px font-bold">{{ item.value }}</span>
          <span v-if="item.unit" class="ml-5px text-13px text-gray-500">{{ item.unit }}</span>
        </div>
      </el-card>
    </el-col>
  </el-row>

  <!-- 图表：接口返回 chart 才渲染，系列条数不限（1~3 条都由 series 决定） -->
  <ContentWrap v-if="payload.chart" title="图形分布">
    <Echart :options="chartOptions" :height="360" />
  </ContentWrap>

  <!-- 明细表：列由接口 columns 动态决定 -->
  <ContentWrap>
    <div class="mb-10px flex flex-wrap items-center justify-between gap-10px">
      <span class="font-bold">明细数据（共 {{ payload.rows.length }} 行）</span>
      <el-button type="success" plain :disabled="!canExport" @click="handleExport">
        <Icon icon="ep:download" class="mr-5px" /> 导出
      </el-button>
    </div>
    <el-table v-loading="loading" :data="pagedRows" empty-text="暂无数据">
      <el-table-column
        v-for="column in payload.columns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :width="column.width"
        :min-width="column.minWidth"
        :align="columnAlign(column)"
        show-overflow-tooltip
      />
    </el-table>
    <!-- 接口一次返回全部行，这里做前端分页，避免行数多时页面过长 -->
    <Pagination :total="payload.rows.length" v-model:page="page" v-model:limit="limit" />
  </ContentWrap>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { getStatData, getStatMeta } from '@/api/cr/stat'
import type { StatColumnVO, StatDefVO, StatFilterOptionsVO, StatPayloadVO } from '@/api/cr/stat'
import { checkPermi } from '@/utils/permission'
import download from '@/utils/download'

defineOptions({ name: 'CrStatPage' })

/** mock 的列定义里还带了 minWidth（接口类型未声明），这里补上 */
type StatColumn = StatColumnVO & { minWidth?: number }
type StatView = Omit<StatPayloadVO, 'columns'> & { columns: StatColumn[] }

const props = defineProps({
  code: { type: String, required: true }
})

const message = useMessage()

const loading = ref(false)
const queryFormRef = ref()
const defs = ref<StatDefVO[]>([])
const filterOptions = ref<StatFilterOptionsVO>({ orgs: [], reports: [], periods: [] })

const queryParams = reactive<{
  orgId?: number
  reportId?: number
  period?: string
  /** 时点数据查询：截止时点 */
  asOf?: string
  /** 历史数据查询：归档月份 */
  archiveMonth?: string
}>({
  orgId: undefined,
  reportId: undefined,
  period: undefined,
  asOf: undefined,
  archiveMonth: undefined
})

/** 当前查询特有的附加筛选（由接口的 def.filters 声明，页面不写死哪一页有哪个控件） */
const showFilter = (name: string) =>
  (defs.value.find((item) => item.code === props.code)?.filters || []).indexOf(name) >= 0

/** 空载荷：接口返回 0 行 / 请求失败时页面照常渲染 */
const emptyPayload = (): StatView => ({
  code: props.code,
  title: '',
  description: '',
  note: '',
  generatedAt: '',
  filterText: '',
  columns: [],
  rows: [],
  summary: [],
  chart: null
})

const payload = ref<StatView>(emptyPayload())

/** 标题：接口 title → 元数据 title → code 兜底 */
const metaTitle = computed(() => defs.value.find((item) => item.code === props.code)?.title || '')
const pageTitle = computed(() => payload.value.title || metaTitle.value || props.code)

/** 按钮权限：code 由 props 拼接，用 checkPermi 而不是 v-hasPermi（指令只认字符串字面量） */
const canQuery = computed(() => checkPermi(['cr:stat:' + props.code + ':query']))
const canExport = computed(() => checkPermi(['cr:stat:' + props.code + ':export']))

/* ---------- 前端分页 ---------- */
const page = ref(1)
const limit = ref(20)
const pagedRows = computed(() => {
  const rows = payload.value.rows
  if (rows.length <= limit.value) return rows
  const start = (page.value - 1) * limit.value
  return rows.slice(start, start + limit.value)
})

/** 列对齐：接口给了 align 就用，否则按首个非空值的类型判断（数字右对齐） */
const columnAlign = (column: StatColumn) => {
  if (column.align) return column.align
  const sample = payload.value.rows.find(
    (row) => row[column.prop] !== undefined && row[column.prop] !== null
  )
  return sample && typeof sample[column.prop] === 'number' ? 'right' : 'left'
}

/* ---------- 图表：categories + 任意条数 series ---------- */
const chartOptions = computed<EChartsOption>(() => {
  const chart = payload.value.chart
  if (!chart || !chart.series?.length) return {}
  const categories = chart.categories || []
  // 横轴是期次（YYYYMM）时用折线看趋势，否则用柱状对比
  const seriesType = (
    categories.length > 0 && categories.every((item) => /^\d{6}$/.test(String(item)))
      ? 'line'
      : 'bar'
  ) as 'line' | 'bar'
  return {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0, data: chart.series.map((item) => item.name) },
    grid: { left: 60, right: 30, top: 48, bottom: 70 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { interval: 0, rotate: categories.length > 6 ? 25 : 0 }
    },
    yAxis: { type: 'value' },
    series: chart.series.map((item) => ({
      name: item.name,
      type: seriesType,
      smooth: true,
      barMaxWidth: 32,
      data: item.data
    }))
  } as EChartsOption
})

/* ---------- 数据加载 ---------- */
const normalize = (data: any): StatView => ({
  code: data?.code || props.code,
  title: data?.title || '',
  description: data?.description || '',
  note: data?.note || '',
  generatedAt: data?.generatedAt || '',
  filterText: data?.filterText || '',
  columns: data?.columns || [],
  rows: data?.rows || [],
  summary: data?.summary || [],
  chart: data?.chart || null
})

const loadMeta = async () => {
  try {
    const meta = await getStatMeta()
    defs.value = meta?.defs || []
    filterOptions.value = meta?.filterOptions || { orgs: [], reports: [], periods: [] }
  } catch (e) {
    // 下拉选项取不到不阻塞统计结果；服务端返回的中文原因由 axios 拦截器统一提示
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const data = await getStatData(props.code, {
      orgId: queryParams.orgId,
      reportId: queryParams.reportId,
      period: queryParams.period,
      asOf: queryParams.asOf,
      archiveMonth: queryParams.archiveMonth
    })
    payload.value = normalize(data)
    page.value = 1
  } catch (e) {
    // 失败原因由 axios 拦截器统一提示（服务端中文 message），这里只清空旧数据，不自己编提示
    payload.value = emptyPayload()
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  loadData()
}

const resetQuery = () => {
  queryParams.orgId = undefined
  queryParams.reportId = undefined
  queryParams.period = undefined
  queryParams.asOf = undefined
  queryParams.archiveMonth = undefined
  loadData()
}

/* ---------- 前端导出（数据已在手，直接拼 CSV，不依赖后端） ---------- */
const escapeCsv = (value: any) => {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

const handleExport = () => {
  const { columns, rows, generatedAt } = payload.value
  if (!columns.length) {
    message.warning('暂无可导出的列')
    return
  }
  const lines = [
    columns.map((column) => escapeCsv(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column.prop])).join(','))
  ]
  const stamp = (generatedAt || '').replace(/[^\d]/g, '') || 'export'
  download.file(
    new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    props.code + '_' + stamp + '.csv'
  )
  message.success('已导出 ' + rows.length + ' 行')
}

onMounted(async () => {
  await loadMeta()
  await loadData()
})
</script>
