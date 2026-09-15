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
      <el-form-item label="机构" prop="orgId">
        <el-select v-model="queryParams.orgId" placeholder="请选择机构" clearable class="!w-180px">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          clearable
          filterable
          class="!w-280px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="`${report.code} ${report.name}`"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="检核结论" prop="result">
        <el-select
          v-model="queryParams.result"
          placeholder="请选择检核结论"
          clearable
          class="!w-140px"
        >
          <el-option label="通过" :value="1" />
          <el-option label="不通过" :value="0" />
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
          v-hasPermi="['cr:submit-quality:download']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 质量小结 -->
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
      title="质量检核结果为监管侧反馈：监管机构对已上报报文做数据质量检核后回写检核结论，不通过项需在下一期次报送前完成数据整改。"
    />
    <el-table v-loading="loading" :data="list" :row-class-name="rowClassName">
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column
        label="检核项目"
        align="left"
        prop="checkItem"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column label="检核结论" align="center" prop="result" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.result === QUALITY_RESULT.PASS ? 'success' : 'danger'">
            {{ scope.row.result === QUALITY_RESULT.PASS ? '通过' : '不通过' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="问题数量" align="right" prop="problemCount" width="100">
        <template #default="scope">
          <span :class="{ 'font-bold text-[#f56c6c]': scope.row.problemCount > 0 }">
            {{ scope.row.problemCount }}
          </span>
        </template>
      </el-table-column>
      <el-table-column
        label="问题描述"
        align="left"
        prop="problemDesc"
        min-width="300"
        show-overflow-tooltip
      >
        <template #default="scope">
          <span :class="{ 'text-[#f56c6c]': scope.row.result !== QUALITY_RESULT.PASS }">
            {{ scope.row.problemDesc }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="反馈时间" align="center" prop="feedbackTime" width="170" />
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>
</template>

<script lang="ts" setup>
import download from '@/utils/download'
import * as SubmitQualityApi from '@/api/cr/submit/quality'
import { QUALITY_RESULT } from '../constants'

defineOptions({ name: 'CrSubmitQuality' })

const message = useMessage()

const loading = ref(true)
const total = ref(0)
const list = ref<SubmitQualityApi.SubmitQualityVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  result: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<SubmitQualityApi.SubmitOrgOptionVO[]>([])
const reportOptions = ref<SubmitQualityApi.SubmitReportOptionVO[]>([])
const periodOptions = ref<string[]>([])

const summary = ref<SubmitQualityApi.SubmitQualitySummaryVO>({
  total: 0,
  passCount: 0,
  failCount: 0,
  problemCount: 0,
  passRate: 0
})

/** 小结卡片 */
const summaryCards = computed(() => [
  {
    title: '总检核项',
    tooltip: '按当前查询条件统计的监管检核项数量',
    icon: 'ep:document-checked',
    iconColor: 'text-blue-500',
    iconBgColor: 'bg-blue-100',
    value: summary.value.total
  },
  {
    title: '检核通过',
    tooltip: '检核结论为「通过」的检核项数量',
    icon: 'ep:circle-check',
    iconColor: 'text-green-500',
    iconBgColor: 'bg-green-100',
    value: summary.value.passCount
  },
  {
    title: '检核不通过',
    tooltip: '检核结论为「不通过」的检核项数量',
    icon: 'ep:circle-close',
    iconColor: 'text-red-500',
    iconBgColor: 'bg-red-100',
    value: summary.value.failCount
  },
  {
    title: '问题总数',
    tooltip: '监管反馈的问题数据条数合计',
    icon: 'ep:warning',
    iconColor: 'text-orange-500',
    iconBgColor: 'bg-orange-100',
    value: summary.value.problemCount
  }
])

/** 不通过行加浅红底色，便于一眼定位 */
const rowClassName = ({ row }: { row: SubmitQualityApi.SubmitQualityVO }) =>
  Number(row.result) === QUALITY_RESULT.FAIL ? 'quality-fail-row' : ''

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await SubmitQualityApi.getSubmitQualityPage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** 查询小结 */
const getSummary = async () => {
  summary.value = await SubmitQualityApi.getSubmitQualitySummary({
    period: queryParams.period,
    orgId: queryParams.orgId,
    reportId: queryParams.reportId,
    result: queryParams.result
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
  handleQuery()
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await SubmitQualityApi.exportSubmitQuality(queryParams)
    download.excel(data, '质量检核结果.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    SubmitQualityApi.getSubmitQualityPeriodOptions(),
    SubmitQualityApi.getSubmitQualityOrgOptions(),
    SubmitQualityApi.getSubmitQualityReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  initOptions()
  getList()
  getSummary()
})
</script>

<style lang="scss" scoped>
:deep(.quality-fail-row) {
  background-color: var(--el-color-danger-light-9);
}
</style>
