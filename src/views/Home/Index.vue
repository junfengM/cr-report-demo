<template>
  <div class="page">
    <!-- 报送概况 -->
    <ContentWrap>
      <div class="mb-16px flex flex-wrap items-center justify-between gap-10px">
        <div class="flex items-center gap-10px">
          <span class="text-16px font-bold">报送工作台</span>
          <el-tag type="primary" effect="dark">期次 {{ period }}</el-tag>
          <el-tag v-if="overview.doneOrgCount === overview.orgCount" type="success">
            全部机构已完成
          </el-tag>
          <el-tag v-else type="warning">
            已完成 {{ overview.doneOrgCount }} / {{ overview.orgCount }} 个机构
          </el-tag>
        </div>
        <div class="flex items-center gap-10px">
          <el-select v-model="period" class="!w-140px" @change="loadAll">
            <el-option v-for="p in periods" :key="p" :label="p" :value="p" />
          </el-select>
          <el-button @click="loadAll"><Icon icon="ep:refresh" class="mr-5px" /> 刷新</el-button>
        </div>
      </div>

      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="8" :lg="4" class="mb-16px">
          <SummaryCard
            title="应报报表"
            icon="ep:document"
            icon-color="text-blue-500"
            icon-bg-color="bg-blue-100"
            :value="overview.shouldReport"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="4" class="mb-16px">
          <SummaryCard
            title="已填报"
            icon="ep:edit-pen"
            icon-color="text-cyan-500"
            icon-bg-color="bg-cyan-100"
            :value="overview.filled"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="4" class="mb-16px">
          <SummaryCard
            title="已校验"
            icon="ep:circle-check"
            icon-color="text-purple-500"
            icon-bg-color="bg-purple-100"
            :value="overview.checked"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="4" class="mb-16px">
          <SummaryCard
            title="已报送"
            icon="ep:upload-filled"
            icon-color="text-green-500"
            icon-bg-color="bg-green-100"
            :value="overview.submitted"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="4" class="mb-16px">
          <SummaryCard
            title="逾期未报"
            tooltip="超过截止日期仍未报送的报表数"
            icon="ep:warning-filled"
            icon-color="text-red-500"
            icon-bg-color="bg-red-100"
            :value="overview.overdue"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="4" class="mb-16px">
          <SummaryCard
            title="报送完成率(%)"
            icon="ep:trend-charts"
            icon-color="text-orange-500"
            icon-bg-color="bg-orange-100"
            :value="overview.submitRate"
            :decimals="1"
          />
        </el-col>
      </el-row>
    </ContentWrap>

    <!-- 报送节点跟踪 -->
    <ContentWrap>
      <div class="mb-16px font-bold">报送节点跟踪</div>
      <el-steps :active="activeNode" align-center finish-status="success" process-status="process">
        <el-step v-for="node in nodes" :key="node.name" :title="node.name">
          <template #description>
            <div class="text-12px text-gray-500">
              {{ node.done }} / {{ node.total }}
              <span
                class="ml-5px"
                :class="node.percent >= 100 ? 'text-green-500' : 'text-orange-500'"
              >
                {{ node.percent }}%
              </span>
            </div>
          </template>
        </el-step>
      </el-steps>
    </ContentWrap>

    <el-row :gutter="16">
      <!-- 趋势 -->
      <el-col :xs="24" :lg="16" class="mb-16px">
        <ContentWrap>
          <div class="mb-10px font-bold">近 6 期报送完成率趋势</div>
          <Echart :options="trendOptions" :height="300" />
        </ContentWrap>
      </el-col>
      <!-- 待办 -->
      <el-col :xs="24" :lg="8" class="mb-16px">
        <ContentWrap>
          <div class="mb-10px flex items-center justify-between">
            <span class="font-bold">我的待办</span>
            <el-tag type="danger" size="small" effect="plain">{{ todoList.length }} 项</el-tag>
          </div>
          <el-empty v-if="!todoList.length" :image-size="60" description="暂无待办" />
          <!-- 待办来自当期未完成任务，条数可能较多：限高滚动，避免把整行撑高 -->
          <div v-else class="max-h-360px overflow-y-auto pr-4px">
            <div
              v-for="item in todoList"
              :key="item.id"
              class="mb-8px cursor-pointer rounded border border-solid border-[var(--el-border-color-lighter)] p-10px hover:bg-[var(--el-fill-color-light)]"
              @click="handleTodo(item)"
            >
              <div class="flex items-center justify-between">
                <span class="text-13px font-bold">{{ item.title }}</span>
                <el-tag :type="urgencyType(item.urgency)" size="small">
                  {{ urgencyText(item.urgency) }}
                </el-tag>
              </div>
              <div class="mt-5px text-12px text-gray-500">
                {{ item.orgName }} · {{ item.stage }} · 截止 {{ item.deadline }}
              </div>
            </div>
          </div>
        </ContentWrap>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 机构进度 -->
      <el-col :xs="24" :lg="12" class="mb-16px">
        <ContentWrap>
          <div class="mb-10px font-bold">各机构本期推进情况</div>
          <el-table :data="orgProgress">
            <el-table-column label="机构" prop="orgName" min-width="140" />
            <el-table-column label="已报 / 应报" align="center" width="110">
              <template #default="scope">
                {{ scope.row.submitted }} / {{ scope.row.shouldReport }}
              </template>
            </el-table-column>
            <el-table-column label="完成率" align="center" min-width="160">
              <template #default="scope">
                <el-progress
                  :percentage="scope.row.submitRate"
                  :status="scope.row.submitRate >= 100 ? 'success' : undefined"
                  :stroke-width="12"
                />
              </template>
            </el-table-column>
            <el-table-column label="逾期" align="center" width="80">
              <template #default="scope">
                <el-tag v-if="scope.row.overdue" type="danger" size="small">
                  {{ scope.row.overdue }}
                </el-tag>
                <span v-else class="text-gray-400">—</span>
              </template>
            </el-table-column>
          </el-table>
        </ContentWrap>
      </el-col>
      <!-- 最近动态 -->
      <el-col :xs="24" :lg="12" class="mb-16px">
        <ContentWrap>
          <div class="mb-10px font-bold">最近动态</div>
          <el-timeline>
            <el-timeline-item
              v-for="item in activityList"
              :key="item.id"
              :timestamp="item.time"
              :type="timelineType(item.type)"
              placement="top"
            >
              <div class="text-13px">
                <span class="font-bold">{{ item.operator }}</span>
                <span class="mx-5px text-gray-400">{{ item.orgName }}</span>
                <span>{{ item.action }}</span>
              </div>
              <div class="text-12px text-gray-500">{{ item.target }}</div>
            </el-timeline-item>
          </el-timeline>
        </ContentWrap>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import * as DashboardApi from '@/api/cr/dashboard'

defineOptions({ name: 'Home' })

const router = useRouter()

const periods = ref<string[]>([])
const period = ref('')

const overview = ref<DashboardApi.DashboardOverviewVO>({
  period: '',
  shouldReport: 0,
  filled: 0,
  checked: 0,
  submitted: 0,
  overdue: 0,
  fillRate: 0,
  checkRate: 0,
  submitRate: 0,
  orgCount: 0,
  doneOrgCount: 0
})
const nodes = ref<DashboardApi.DashboardNodeVO[]>([])
const trend = ref<DashboardApi.DashboardTrendVO[]>([])
const orgProgress = ref<DashboardApi.DashboardOrgProgressVO[]>([])
const todoList = ref<DashboardApi.DashboardTodoVO[]>([])
const activityList = ref<DashboardApi.DashboardActivityVO[]>([])

/** el-steps 的 active：第一个未完成的节点 */
const activeNode = computed(() => {
  const index = nodes.value.findIndex((node) => node.percent < 100)
  return index === -1 ? nodes.value.length : index
})

const trendOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['填报完成率', '校验完成率', '报送完成率'], bottom: 0 },
  grid: { left: 45, right: 20, top: 30, bottom: 50 },
  xAxis: { type: 'category', data: trend.value.map((item) => item.period) },
  yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  series: [
    { name: '填报完成率', type: 'line', smooth: true, data: trend.value.map((i) => i.fillRate) },
    { name: '校验完成率', type: 'line', smooth: true, data: trend.value.map((i) => i.checkRate) },
    { name: '报送完成率', type: 'line', smooth: true, data: trend.value.map((i) => i.submitRate) }
  ]
}))

const urgencyType = (urgency: number) =>
  urgency === 3 ? 'danger' : urgency === 2 ? 'warning' : 'info'
const urgencyText = (urgency: number) =>
  urgency === 3 ? '已逾期' : urgency === 2 ? '临近截止' : '进行中'
const timelineType = (type: string) =>
  ((({ success: 'success', danger: 'danger', warning: 'warning' }) as Record<string, string>)[
    type
  ] || 'primary') as any

/** 待办所属环节 → 对应处理页面（环节由 /cr/dashboard/todo 按任务状态映射） */
const TODO_ROUTE: Record<string, string> = {
  待复核: '/cr-task/review',
  待本级审核: '/cr-task/audit-local',
  待上级审核: '/cr-task/audit-upper',
  待填报: '/cr-data/fill'
}

const handleTodo = (item: DashboardApi.DashboardTodoVO) => {
  // 点待办直接跳到该环节的处理页面；环节异常时兜底到任务管理
  router.push(TODO_ROUTE[item.stage] || '/cr-task/manage')
}

const loadAll = async () => {
  const [overviewData, nodeData, trendData, orgData, todoData, activityData] = await Promise.all([
    DashboardApi.getOverview(period.value),
    DashboardApi.getNodes(period.value),
    DashboardApi.getTrend(),
    DashboardApi.getOrgProgress(period.value),
    DashboardApi.getTodo(),
    DashboardApi.getActivity()
  ])
  overview.value = overviewData
  nodes.value = nodeData || []
  trend.value = trendData || []
  orgProgress.value = orgData || []
  todoList.value = todoData || []
  activityList.value = activityData || []
  if (!periods.value.length) {
    periods.value = trend.value.map((item) => item.period)
    if (!period.value)
      period.value = overview.value.period || periods.value[periods.value.length - 1]
  }
}

onMounted(() => {
  loadAll()
})
</script>
