<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="1000">
    <div v-loading="loading">
      <template v-if="preview">
        <el-descriptions :column="3" border size="small" class="mb-10px">
          <el-descriptions-item label="报表名称">{{ preview.reportName }}</el-descriptions-item>
          <el-descriptions-item label="数据集">{{ preview.datasetName }}</el-descriptions-item>
          <el-descriptions-item label="展示方式">{{ preview.chartTypeLabel }}</el-descriptions-item>
          <el-descriptions-item label="维度字段">{{ preview.dimensionLabel }}</el-descriptions-item>
          <el-descriptions-item label="源数据行数"
            >{{ preview.sourceRows }} 行</el-descriptions-item
          >
          <el-descriptions-item label="生成时间">{{ preview.generatedAt }}</el-descriptions-item>
        </el-descriptions>
        <el-alert class="mb-10px" type="info" :closable="false" show-icon :title="preview.note" />
        <el-table :data="preview.rows" border size="small" max-height="340">
          <el-table-column
            v-for="col in preview.columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            min-width="150"
            show-overflow-tooltip
          />
          <template #empty>当前数据集没有可统计的数据</template>
        </el-table>
        <div v-if="preview.chartType !== 1" class="mt-15px">
          <div class="mb-5px text-14px font-bold">图表预览</div>
          <Echart :options="chartOptions" :height="340" />
        </div>
        <div v-else class="mt-10px text-12px text-[#909399]">
          展示方式为「表格」时只输出表格，不渲染图表。
        </div>
      </template>
      <el-empty v-else-if="!loading" description="暂无预览结果" />
    </div>
    <template #footer>
      <el-button :disabled="loading" @click="handleLoad">重新生成</el-button>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import * as DesignApi from '@/api/cr/report/design'

defineOptions({ name: 'CrReportDesignPreviewDialog' })

const dialogVisible = ref(false)
const dialogTitle = ref('报表预览')
const loading = ref(false)
const reportId = ref<number>()
const preview = ref<DesignApi.ReportPreviewVO>()
const chartOptions = shallowRef<EChartsOption>({})

/** 柱状图 / 折线图：多条度量各一条系列；饼图：取第一条度量的占比，legend 用维度取值 */
const buildChartOption = (data: DesignApi.ReportPreviewVO): EChartsOption => {
  const categories = data.chart?.categories || []
  const series = data.chart?.series || []
  if (data.chartType === 4) {
    const first = series[0]
    const values = (first && first.data) || []
    return {
      tooltip: { trigger: 'item' },
      legend: { type: 'scroll', top: 0, data: categories },
      series: [
        {
          name: (first && first.name) || '占比',
          type: 'pie',
          radius: ['38%', '64%'],
          center: ['50%', '56%'],
          avoidLabelOverlap: true,
          data: categories.map((name, index) => ({ name, value: Number(values[index] ?? 0) }))
        }
      ]
    }
  }
  const isLine = data.chartType === 3
  return {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0, data: series.map((item) => item.name) },
    grid: { left: 70, right: 30, top: 48, bottom: 56 },
    xAxis: {
      type: 'category',
      boundaryGap: !isLine,
      data: categories,
      axisLabel: { interval: 0, rotate: categories.length > 6 ? 25 : 0 }
    },
    yAxis: { type: 'value' },
    series: series.map((item) => ({
      name: item.name,
      type: isLine ? 'line' : 'bar',
      smooth: isLine,
      barMaxWidth: 42,
      data: item.data
    }))
  }
}

/** 现算：服务端拿数据集的真实行按维度分组、对度量求和 */
const handleLoad = async () => {
  if (!reportId.value) return
  loading.value = true
  try {
    const data = await DesignApi.previewReport(reportId.value)
    chartOptions.value = buildChartOption(data)
    preview.value = data
  } catch {
    preview.value = undefined
    chartOptions.value = {}
  } finally {
    loading.value = false
  }
}

/** 打开弹窗：传行数据或报表 id 都可以 */
const open = async (rowOrId: DesignApi.ReportDesignVO | number) => {
  const id = typeof rowOrId === 'number' ? rowOrId : rowOrId.id!
  dialogTitle.value =
    '报表预览 — ' + (typeof rowOrId === 'number' ? '报表 #' + id : rowOrId.reportName || '')
  reportId.value = id
  preview.value = undefined
  chartOptions.value = {}
  dialogVisible.value = true
  await handleLoad()
}
defineExpose({ open })
</script>
