<template>
  <ContentWrap>
    <!-- 跑批口径与「立即执行」的边界先写在最上面：演示时这两个分支都要能反复重放 -->
    <el-alert
      class="mb-15px"
      type="info"
      :closable="false"
      show-icon
      title="跑批结果是确定性的：同一个任务 + 同一个期次反复执行结果稳定，换期次才会变，「执行失败」与「等待前置任务」两条分支都能随时重放"
      description="「立即执行」会按这条记录的任务 / 期次 / 数据日期重跑一次，并新写一条跑批记录（历史记录保持原样）；正在运行中的任务不能重复触发，接口会拦下并说明原因。指标卡的数字用接口返回的 stats（与列表同一份筛选结果），不是页面自己数列表算的。"
    />

    <!-- 指标卡：6 个口径与 /cr/collect-task-log/page 返回的 stats 字段一一对应 -->
    <el-row v-loading="loading" :gutter="16" class="mb-15px">
      <el-col v-for="card in statCards" :key="card.label" :xs="12" :sm="8" :md="4">
        <el-card shadow="hover" class="h-full" :body-style="{ padding: '12px 16px' }">
          <div class="truncate text-13px text-[#909399]" :title="card.label">{{ card.label }}</div>
          <el-statistic
            :value="card.value"
            :value-style="{ fontSize: '22px', fontWeight: '600', color: card.color }"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索工作栏：数据日期 + 存储过程 + 运行状态 + 报表期次 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="数据日期" prop="dataDate">
        <el-date-picker
          v-model="queryParams.dataDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="全部日期"
          clearable
          class="!w-160px"
        />
      </el-form-item>
      <el-form-item label="存储过程" prop="taskCode">
        <!-- 选项 value 用 code：接口是按 taskCode 过滤的，不是按任务 id -->
        <el-select
          v-model="queryParams.taskCode"
          placeholder="全部存储过程"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="item in taskOptions"
            :key="item.id"
            :label="item.code + ' ' + item.name"
            :value="item.code"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="运行状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_TASK_RUN_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="全部期次" clearable class="!w-160px">
          <el-option
            v-for="item in periodOptions"
            :key="item.period"
            :label="item.period + ' ' + item.periodName"
            :value="item.period"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:collect-task-log:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:collect-task-log:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:collect-task-log:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 跑批记录 -->
  <ContentWrap v-hasPermi="['cr:collect-task-log:query']" title="跑批记录">
    <el-table v-loading="loading" :data="list">
      <el-table-column label="数据日期" align="center" prop="dataDate" width="110" />
      <el-table-column
        label="存储过程英文名"
        align="left"
        prop="taskCode"
        width="210"
        show-overflow-tooltip
      />
      <el-table-column
        label="存储过程中文名"
        align="left"
        prop="taskName"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column
        label="任务分组"
        align="left"
        prop="groupName"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column label="执行方式" align="center" width="100">
        <template #default="scope">{{ runTypeLabelOf(scope.row.runType) }}</template>
      </el-table-column>
      <el-table-column label="运行状态" align="center" prop="status" width="120">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_TASK_RUN_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" prop="startTime" width="170" />
      <el-table-column label="结束时间" align="center" prop="endTime" width="170" />
      <el-table-column label="执行时长(秒)" align="center" prop="duration" width="120" />
      <el-table-column label="新增数据量" align="center" prop="rowsAdded" width="110" />
      <el-table-column label="SQL执行返回值" align="center" prop="sqlReturn" width="130" />
      <!-- 报错原文（ORA-xxxxx）要能整段看到，列表里截断、悬停看全文 -->
      <el-table-column
        label="SQL执行错误信息"
        align="left"
        prop="errorMsg"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="操作人" align="center" prop="operator" width="110" />
      <el-table-column label="操作" align="center" width="200" fixed="right">
        <template #default="scope">
          <!-- 运行中的记录不禁用按钮：由接口拦下并说明原因，比灰按钮更能讲清楚为什么不能重跑 -->
          <el-button
            link
            type="primary"
            :loading="runLoadingId === scope.row.id"
            @click="handleRun(scope.row)"
            v-hasPermi="['cr:collect-task-log:run']"
          >
            立即执行
          </el-button>
          <el-button
            link
            type="primary"
            @click="openPreTask(scope.row)"
            v-hasPermi="['cr:collect-task:pre-task']"
          >
            前置任务
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页组件 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 前置任务弹窗：与任务维护页共用一份（配置结果影响「立即执行」的前置判定） -->
  <PreTaskDialog ref="preTaskRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import {
  getCollectTaskLogPage,
  exportCollectTaskLog,
  runCollectTaskLog,
  type CollectTaskLogVO,
  type CollectTaskLogStatsVO
} from '@/api/cr/schedule/monitor'
import {
  getCollectTaskOptions,
  getCollectTaskMeta,
  type CollectTaskOptionVO
} from '@/api/cr/schedule/task'
import { getCollectPeriodOptions, type CollectPeriodOptionVO } from '@/api/cr/collect/common'
import PreTaskDialog from '../task/PreTaskDialog.vue'

defineOptions({ name: 'CrScheduleMonitor' })

const message = useMessage()
const { t } = useI18n()
const route = useRoute()

/** 统计初值：列表还没回来时指标卡不能是 undefined（接口每次都返回 stats） */
const emptyStats = (): CollectTaskLogStatsVO => ({
  total: 0,
  success: 0,
  failed: 0,
  waiting: 0,
  running: 0,
  rowsAdded: 0
})

const loading = ref(true)
const total = ref(0)
const list = ref<CollectTaskLogVO[]>([])
const stats = ref<CollectTaskLogStatsVO>(emptyStats())
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在提交「立即执行」的记录 id：只用来给按钮转圈，避免同一行被连点两次 */
const runLoadingId = ref<number>()

/** 搜索下拉选项：存储过程来自任务下拉，期次复用采集域的期次表（任务调度不另建一份期次） */
const taskOptions = ref<CollectTaskOptionVO[]>([])
const periodOptions = ref<CollectPeriodOptionVO[]>([])

/** 执行方式映射：接口 meta 拿不到时回退到本地常量（mock 与页面必须是同一套中文） */
const RUN_TYPE: Record<number, string> = { 1: '自动调度', 2: '手工调度' }
const meta = ref<{
  runTypeLabels?: Record<number, string>
  runStatusLabels?: Record<number, string>
}>({})

const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  dataDate: undefined as string | undefined,
  taskCode: undefined as string | undefined,
  status: undefined as number | undefined,
  period: undefined as string | undefined
})

const statCards = computed(() => [
  { label: '总记录数', value: stats.value.total, color: '#303133' },
  { label: '执行成功', value: stats.value.success, color: '#67c23a' },
  { label: '执行失败', value: stats.value.failed, color: '#f56c6c' },
  { label: '等待前置', value: stats.value.waiting, color: '#e6a23c' },
  { label: '运行中', value: stats.value.running, color: '#409eff' },
  { label: '新增数据量合计', value: stats.value.rowsAdded, color: '#909399' }
])

const runTypeLabelOf = (value: number) =>
  meta.value.runTypeLabels?.[value] || RUN_TYPE[value] || '-'

/** 查询参数：空值一律不下发，避免被 mock 当成精确匹配（清空日期后会拿到 null） */
const buildQueryParams = () => ({
  pageNo: queryParams.pageNo,
  pageSize: queryParams.pageSize,
  dataDate: queryParams.dataDate || undefined,
  taskCode: queryParams.taskCode || undefined,
  status: queryParams.status ?? undefined,
  period: queryParams.period || undefined
})

/** 查询列表：stats 与 list 同源返回，指标卡直接用它 */
const getList = async () => {
  loading.value = true
  try {
    const data = await getCollectTaskLogPage(buildQueryParams())
    list.value = data.list || []
    total.value = data.total || 0
    stats.value = data.stats || emptyStats()
  } finally {
    loading.value = false
  }
}

/** 下拉与元数据：加载失败不阻塞列表，原因由拦截器统一提示 */
const getOptions = async () => {
  try {
    const [tasks, periods, metaData] = await Promise.all([
      getCollectTaskOptions(),
      getCollectPeriodOptions(),
      getCollectTaskMeta()
    ])
    taskOptions.value = tasks || []
    periodOptions.value = periods || []
    meta.value = metaData || {}
  } catch {}
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

/** 导出：导出的是当前筛选条件下的全量跑批记录（与列表同一套过滤） */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await exportCollectTaskLog(buildQueryParams())
    download.excel(data, '跑批日志.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/**
 * 立即执行：按这条记录的任务 / 期次 / 数据日期重跑一次。
 * 结果完全按接口返回的 status 分支提示，页面不自己推断跑批结果。
 */
const handleRun = async (row: CollectTaskLogVO) => {
  try {
    await message.confirm(
      '确认按 数据日期 ' +
        row.dataDate +
        ' / 期次 ' +
        row.period +
        ' 重新执行任务「' +
        row.taskCode +
        ' ' +
        row.taskName +
        '」？',
      '立即执行'
    )
  } catch {
    // 取消确认不算错误
    return
  }
  runLoadingId.value = row.id
  try {
    const result: {
      status: number
      rowsAdded: number
      duration: number
      errorMsg: string
      waitingFor?: string[]
    } = await runCollectTaskLog(row.id)
    if (result.status === 2) {
      message.success(
        '执行成功，新增 ' + (result.rowsAdded || 0) + ' 行，耗时 ' + (result.duration || 0) + ' 秒'
      )
    } else if (result.status === 3) {
      // 失败原因要原样给出来（ORA 错误码要能照抄给 DBA），所以不做任何截断或改写
      message.error('执行失败：' + result.errorMsg)
    } else if (result.status === 4) {
      // 接口把前置任务写进 errorMsg（形如「前置任务未成功：PKG_xxx（本期次最近一次执行失败）」），
      // 这里去掉它自带的同义前缀，避免提示里连念两遍「前置任务未成功」
      const reason = String(result.errorMsg || '').replace(/^前置任务未成功：/, '')
      message.warning('本次未执行，前置任务未成功：' + reason)
    } else {
      // 兜底分支（如「已跳过」）：状态中文用接口 meta，页面不再维护第二套映射
      message.warning(
        '本次未执行，执行状态：' + (meta.value.runStatusLabels?.[result.status] || result.status)
      )
    }
  } finally {
    runLoadingId.value = undefined
    // 无论成败都刷新：失败的原因与新记录都要立刻在列表里看到
    await getList()
  }
}

/** 前置任务：任务维护页共用同一个弹窗，改完刷新列表（前置判定变了，提示语也要跟着变） */
const preTaskRef = ref()
const openPreTask = (row: CollectTaskLogVO) => {
  preTaskRef.value.open(row.taskId)
}

/** 初始化：手工调度页跑完会带 ?period=202608 跳过来，直接筛到那一次批次 */
onMounted(() => {
  const period = String(route.query.period || '').trim()
  if (period) {
    queryParams.period = period
  }
  getOptions()
  getList()
})
</script>
