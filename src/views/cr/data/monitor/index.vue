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
        <el-select v-model="queryParams.period" clearable placeholder="请选择期次" class="!w-150px">
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="报送机构" prop="orgId">
        <el-select v-model="queryParams.orgId" clearable placeholder="请选择机构" class="!w-180px">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="任务类型" prop="taskType">
        <el-select
          v-model="queryParams.taskType"
          clearable
          placeholder="请选择类型"
          class="!w-160px"
        >
          <el-option
            v-for="(label, value) in TASK_TYPE_LABEL"
            :key="value"
            :label="label"
            :value="Number(value)"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="执行状态" prop="status">
        <el-select v-model="queryParams.status" clearable placeholder="请选择状态" class="!w-150px">
          <el-option
            v-for="(label, value) in TASK_STATUS_LABEL"
            :key="value"
            :label="label"
            :value="Number(value)"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="批处理任务由数据校验 / 计算 / 汇总 / 报文生成 / 批量提交等动作触发，列表每 3 秒自动刷新一次，运行中的任务进度实时推进。"
    />

    <div class="mb-10px flex items-center justify-between">
      <div>
        <el-button :loading="loading" @click="getList">
          <Icon icon="ep:refresh" class="mr-5px" /> 立即刷新
        </el-button>
        <span class="ml-10px text-13px text-[#909399]">
          上次刷新：{{ lastRefresh || '-' }}（{{
            autoRefresh ? '每 3 秒自动刷新' : '已暂停自动刷新'
          }}）
        </span>
      </div>
      <el-switch v-model="autoRefresh" active-text="自动刷新" @change="handleAutoRefreshChange" />
    </div>

    <el-row :gutter="16" class="mb-10px">
      <el-col :span="8">
        <div class="task-summary task-summary--running">
          <div class="task-summary__label">运行中</div>
          <div class="task-summary__value">{{ runningCount }} 个</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="task-summary task-summary--success">
          <div class="task-summary__label">执行成功</div>
          <div class="task-summary__value">{{ successCount }} 个</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="task-summary task-summary--fail">
          <div class="task-summary__label">执行失败</div>
          <div class="task-summary__value">{{ failCount }} 个</div>
        </div>
      </el-col>
    </el-row>

    <el-table v-loading="loading" :data="list">
      <el-table-column label="任务号" align="center" prop="taskNo" width="150" />
      <el-table-column label="任务类型" align="center" prop="taskType" width="110">
        <template #default="scope">
          <el-tag size="small" effect="plain">{{ TASK_TYPE_LABEL[scope.row.taskType] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="机构" align="left" prop="orgName" width="140" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.orgName || '全部机构' }}</template>
      </el-table-column>
      <el-table-column label="报表" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.reportCode ? `${scope.row.reportCode} ${scope.row.reportName}` : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="95" />
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <el-tag :type="STATUS_TAG[scope.row.status]" size="small" effect="dark">
            {{ TASK_STATUS_LABEL[scope.row.status] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" align="center" prop="percent" width="180">
        <template #default="scope">
          <el-progress
            :percentage="scope.row.percent"
            :status="PROGRESS_STATUS[scope.row.status]"
            :stroke-width="12"
          />
        </template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" prop="startTime" width="170" />
      <el-table-column label="耗时" align="center" prop="costTime" width="90">
        <template #default="scope">{{ scope.row.costTime }} 秒</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="110" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="handleViewLog(scope.row)"
            v-hasPermi="['cr:data-monitor:query']"
          >
            查看日志
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

  <!-- 任务日志抽屉 -->
  <el-drawer v-model="logVisible" :title="`任务日志 - ${logDetail?.taskNo || ''}`" size="620px">
    <el-descriptions v-if="logDetail" :column="2" border size="small" class="mb-10px">
      <el-descriptions-item label="任务类型">{{ logDetail.taskTypeName }}</el-descriptions-item>
      <el-descriptions-item label="执行状态">
        <el-tag :type="STATUS_TAG[logDetail.status]" size="small">
          {{ logDetail.statusName }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="机构">{{
        logDetail.orgName || '全部机构'
      }}</el-descriptions-item>
      <el-descriptions-item label="报表">{{ logDetail.reportName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="期次">{{ logDetail.period }}</el-descriptions-item>
      <el-descriptions-item label="进度">{{ logDetail.percent }}%</el-descriptions-item>
      <el-descriptions-item label="开始时间">{{ logDetail.startTime }}</el-descriptions-item>
      <el-descriptions-item label="耗时">{{ logDetail.costTime }} 秒</el-descriptions-item>
    </el-descriptions>

    <el-timeline v-if="logDetail?.logs?.length">
      <el-timeline-item
        v-for="(log, index) in logDetail.logs"
        :key="index"
        :timestamp="log.time"
        :type="LOG_TAG[log.level]"
        placement="top"
      >
        <span :class="`log-${log.level}`">{{ log.text }}</span>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else description="暂无日志" :image-size="60" />
  </el-drawer>
</template>

<script lang="ts" setup>
import * as MonitorApi from '@/api/cr/data/monitor'

defineOptions({ name: 'CrDataMonitor' })

/** 自动刷新间隔（毫秒） */
const REFRESH_INTERVAL = 3000

const TASK_TYPE_LABEL: Record<number, string> = {
  1: '数据校验',
  2: '数据计算',
  3: '数据汇总',
  4: '报文生成',
  5: '批量提交'
}
const TASK_STATUS_LABEL: Record<number, string> = { 1: '运行中', 2: '成功', 3: '失败' }
const STATUS_TAG: Record<number, 'primary' | 'success' | 'danger'> = {
  1: 'primary',
  2: 'success',
  3: 'danger'
}
const PROGRESS_STATUS: Record<number, 'success' | 'exception' | undefined> = {
  1: undefined,
  2: 'success',
  3: 'exception'
}
const LOG_TAG: Record<string, 'primary' | 'success' | 'warning' | 'danger'> = {
  info: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'danger'
}

const loading = ref(false)
const total = ref(0)
const runningCount = ref(0)
const successCount = ref(0)
const failCount = ref(0)
const lastRefresh = ref('')
const autoRefresh = ref(true)
const list = ref<MonitorApi.BatchTaskVO[]>([])
const periodOptions = ref<string[]>([])
const orgOptions = ref<{ id: number; name: string }[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  taskType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()

const logVisible = ref(false)
const logDetail = ref<MonitorApi.BatchTaskLogVO | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

/** 查询列表（silent = 自动刷新时不显示 loading，避免闪烁） */
const getList = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const data: MonitorApi.BatchTaskPageVO = await MonitorApi.getMonitorPage(queryParams)
    list.value = data.list
    total.value = data.total
    runningCount.value = data.runningCount
    successCount.value = data.successCount
    failCount.value = data.failCount
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    lastRefresh.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  } finally {
    if (!silent) loading.value = false
  }
}

const startTimer = () => {
  stopTimer()
  timer = setInterval(() => {
    getList(true)
  }, REFRESH_INTERVAL)
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const handleAutoRefreshChange = (value: boolean) => {
  if (value) {
    startTimer()
  } else {
    stopTimer()
  }
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

const resetQuery = () => {
  queryFormRef.value.resetFields()
  queryParams.period = '202608'
  queryParams.orgId = undefined
  queryParams.taskType = undefined
  queryParams.status = undefined
  handleQuery()
}

/** 查看日志 */
const handleViewLog = async (row: MonitorApi.BatchTaskVO) => {
  logDetail.value = await MonitorApi.getMonitorLog(row.id)
  logVisible.value = true
}

/** 初始化下拉选项 */
const initOptions = async () => {
  const [periods, orgs] = await Promise.all([
    MonitorApi.getMonitorPeriodOptions(),
    MonitorApi.getMonitorOrgOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  await getList()
  startTimer()
}

onMounted(() => {
  initOptions()
})

// 页面卸载 / keep-alive 切走时必须清掉定时器，避免后台持续轮询
onBeforeUnmount(() => {
  stopTimer()
})
onDeactivated(() => {
  stopTimer()
})
onActivated(() => {
  if (autoRefresh.value) startTimer()
})
</script>

<style lang="scss" scoped>
.task-summary {
  padding: 10px 16px;
  text-align: center;
  border-radius: 4px;
  background-color: var(--el-fill-color-light);
}

.task-summary__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.task-summary__value {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 700;
}

.task-summary--running .task-summary__value {
  color: #409eff;
}

.task-summary--success .task-summary__value {
  color: #67c23a;
}

.task-summary--fail .task-summary__value {
  color: #f56c6c;
}

.log-info {
  color: var(--el-text-color-primary);
}

.log-success {
  color: #67c23a;
}

.log-warning {
  color: #e6a23c;
}

.log-error {
  color: #f56c6c;
}
</style>
