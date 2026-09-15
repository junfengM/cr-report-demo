<template>
  <ContentWrap>
    <!-- 统计卡片：进页面时调 /cr/desens-task/stats 填充 -->
    <el-row v-loading="statsLoading" :gutter="16" class="mb-15px">
      <el-col v-for="card in statCards" :key="card.label" :xs="12" :sm="8" :md="3">
        <el-card shadow="hover" class="h-full" :body-style="{ padding: '12px 16px' }">
          <div class="truncate text-13px text-[#909399]" :title="card.label">{{ card.label }}</div>
          <el-statistic
            :value="card.value"
            :value-style="{ fontSize: '22px', fontWeight: '600', color: card.color }"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="机构" prop="orgId">
        <el-select v-model="queryParams.orgId" placeholder="请选择机构" clearable class="!w-160px">
          <!-- id=0 是「全部机构」，查询时转成不带条件，避免被 mock 当成精确匹配 -->
          <el-option
            v-for="item in orgOptions"
            :key="item.id"
            :label="item.orgName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          clearable
          filterable
          class="!w-240px"
        >
          <el-option
            v-for="item in reportOptions"
            :key="item.id"
            :label="item.reportCode + ' ' + item.reportName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="请选择期次" clearable class="!w-140px">
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_DESENS_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 报表 / 操作人 / 结果说明"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:desens-log:query']"
          ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
        >
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:desens-log:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-table v-loading="loading" :data="list">
      <el-table-column label="批次号" align="center" width="150">
        <template #default="scope">
          <el-link
            type="primary"
            v-hasPermi="['cr:desens-log:detail']"
            @click="openDetail(scope.row)"
          >
            {{ scope.row.batchNo }}
          </el-link>
        </template>
      </el-table-column>
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表"
        align="left"
        prop="reportName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="字段数" align="right" prop="fieldCount" width="90" />
      <el-table-column label="涉及行数" align="right" prop="totalRows" width="100" />
      <el-table-column label="脱敏字段值" align="right" prop="maskedRows" width="110" />
      <el-table-column label="跳过" align="right" prop="skipRows" width="80" />
      <el-table-column label="条件跳过" align="right" width="100">
        <template #default="scope">
          <span :class="scope.row.conditionSkipped ? 'text-orange-500' : ''">
            {{ scope.row.conditionSkipped || 0 }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_DESENS_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" prop="startTime" width="170" />
      <el-table-column label="耗时" align="right" prop="cost" width="100">
        <template #default="scope">{{ scope.row.cost }} ms</template>
      </el-table-column>
      <el-table-column label="操作人" align="center" prop="operator" width="110" />
      <el-table-column
        label="执行结果"
        align="left"
        prop="message"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="90" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row)"
            v-hasPermi="['cr:desens-log:detail']"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <LogDetailDrawer ref="detailRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as DesensTaskApi from '@/api/cr/desensitize/task'
import * as DesensCommonApi from '@/api/cr/desensitize/common'
import LogDetailDrawer from './LogDetailDrawer.vue'

defineOptions({ name: 'CrDesensitizeLog' })

const message = useMessage()

const loading = ref(true)
const statsLoading = ref(false)
const stats = ref<DesensTaskApi.DesensTaskStatsVO>({
  total: 0,
  success: 0,
  partial: 0,
  failed: 0,
  restored: 0,
  pending: 0,
  rejected: 0,
  maskedRows: 0,
  fieldCount: 0,
  ruleCount: 0
})
const total = ref(0)
const list = ref<DesensTaskApi.DesensTaskVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 搜索下拉选项 */
const orgOptions = ref<DesensCommonApi.DesensOrgOptionVO[]>([])
const reportOptions = ref<DesensCommonApi.DesensReportOptionVO[]>([])
const periodOptions = ref<string[]>([])

/** 统计卡片：8 个口径与 /cr/desens-task/stats 的返回字段一一对应（待审核 / 已驳回是审批流引入的） */
const statCards = computed(() => [
  { label: '批次总数', value: stats.value.total, color: '#303133' },
  { label: '执行成功', value: stats.value.success, color: '#67c23a' },
  { label: '部分失败', value: stats.value.partial, color: '#e6a23c' },
  { label: '执行失败', value: stats.value.failed, color: '#f56c6c' },
  { label: '待审核', value: stats.value.pending, color: '#e6a23c' },
  { label: '已驳回', value: stats.value.rejected, color: '#f56c6c' },
  { label: '已还原', value: stats.value.restored, color: '#909399' },
  { label: '累计脱敏字段值', value: stats.value.maskedRows, color: '#409eff' }
])

/** 查询参数：机构 0（全部机构）与所有空值都不下发，避免被 mock 当成精确匹配 */
const buildQueryParams = () => ({
  pageNo: queryParams.pageNo,
  pageSize: queryParams.pageSize,
  orgId: queryParams.orgId || undefined,
  reportId: queryParams.reportId || undefined,
  period: queryParams.period || undefined,
  status: queryParams.status ?? undefined,
  keyword: queryParams.keyword || undefined
})

/** 下拉数据：加载失败不阻塞列表 */
const getOptions = async () => {
  try {
    const [orgs, reports, periods] = await Promise.all([
      DesensCommonApi.getDesensOrgOptions(),
      DesensCommonApi.getDesensReportOptions(),
      DesensCommonApi.getDesensPeriodOptions()
    ])
    orgOptions.value = orgs || []
    reportOptions.value = reports || []
    periodOptions.value = periods || []
  } catch (error) {
    console.warn('[脱敏日志] 搜索下拉加载失败', error)
  }
}

/** 统计卡片数据 */
const getStats = async () => {
  statsLoading.value = true
  try {
    const data = await DesensTaskApi.getTaskStats()
    if (data) stats.value = data
  } catch (error) {
    console.warn('[脱敏日志] 统计加载失败', error)
  } finally {
    statsLoading.value = false
  }
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DesensTaskApi.getTaskPage(buildQueryParams())
    list.value = data?.list ?? []
    total.value = data?.total ?? 0
  } finally {
    loading.value = false
  }
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 详情抽屉（批次号链接与操作列的「详情」都走这里） */
const detailRef = ref()
const openDetail = (row: DesensTaskApi.DesensTaskVO) => {
  detailRef.value.open(row)
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await DesensTaskApi.exportTask(buildQueryParams())
    download.excel(data, '脱敏日志.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getOptions()
  getStats()
  getList()
})
</script>
