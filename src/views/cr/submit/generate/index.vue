<template>
  <ContentWrap>
    <!-- 生成条件 -->
    <el-form class="-mb-15px" :model="formData" :inline="true" label-width="80px">
      <el-form-item label="报送期次" prop="period">
        <el-select
          v-model="formData.period"
          placeholder="请选择期次"
          class="!w-160px"
          :disabled="running"
          @change="refreshPreview"
        >
          <el-option
            v-for="period in periodOptions"
            :key="period"
            :label="period"
            :value="period"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报送机构" prop="orgIds">
        <el-select
          v-model="formData.orgIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择报送机构（可多选）"
          class="!w-300px"
          :disabled="running"
          @change="refreshPreview"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportIds">
        <el-select
          v-model="formData.reportIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择报表（可多选）"
          class="!w-360px"
          :disabled="running"
          @change="refreshPreview"
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
        <el-button
          type="primary"
          :loading="running"
          :disabled="running"
          @click="handleRun"
          v-hasPermi="['cr:submit-generate:run']"
        >
          <Icon icon="ep:video-play" class="mr-5px" /> 开始生成
        </el-button>
        <el-button :disabled="running" @click="handleSelectAll">全选</el-button>
        <el-button :disabled="running" @click="handleClear">清空</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 生成进度区 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="报文按「机构 × 报表 × 期次」生成：命名规则取「报送文件配置」中该机构的配置项；已上报（上报中 / 上报成功 / 已回执）的报文不会重复生成，会直接跳过。"
    >
      <template #default>
        <span v-if="preview">
          当前选择将生成
          <b>{{ preview.fileCount }}</b>
          个报文文件（{{ preview.orgCount }} 个机构 × {{ preview.reportCount }} 张报表，共
          {{ preview.totalCount }} 个组合），预计数据量 {{ formatNumber(preview.estimateRows) }} 行
          / {{ formatFileSize(preview.estimateSize)
          }}<span v-if="preview.skipCount > 0">
            ；其中 {{ preview.skipCount }} 个已上报，本次将跳过</span
          >。
        </span>
        <span v-else>请选择报送期次、机构与报表，页面会实时预估将生成的报文文件数量。</span>
      </template>
    </el-alert>
    <div class="mb-10px flex items-center justify-between">
      <span class="font-bold">生成进度</span>
      <span class="text-12px text-[#909399]">{{ progressText }}</span>
    </div>
    <el-progress :percentage="percent" :status="progressStatus" :stroke-width="14" />
    <div ref="logBoxRef" class="submit-log mt-10px">
      <template v-if="shownLogs.length">
        <div v-for="(log, index) in shownLogs" :key="index" :class="`log-${log.level}`">
          [{{ log.time }}] {{ log.text }}
        </div>
      </template>
      <el-empty
        v-else
        description="尚未生成报文，请选择期次、机构与报表后点击「开始生成」"
        :image-size="60"
      />
    </div>

    <!-- 生成汇总 -->
    <div v-if="finished && summary" class="mt-15px">
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="submit-summary">
            <div class="submit-summary__label">成功</div>
            <div class="submit-summary__value text-[#67c23a]">{{ summary.successCount }} 个</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="submit-summary">
            <div class="submit-summary__label">失败</div>
            <div class="submit-summary__value text-[#f56c6c]">{{ summary.failCount }} 个</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="submit-summary">
            <div class="submit-summary__label">跳过（已生成）</div>
            <div class="submit-summary__value text-[#e6a23c]">{{ summary.skipCount }} 个</div>
          </div>
        </el-col>
      </el-row>
      <el-alert
        class="mt-10px"
        :type="summaryType"
        :closable="false"
        show-icon
        :title="summaryTitle"
      />
      <el-button class="mt-10px" type="primary" @click="viewStatus">
        <Icon icon="ep:search" class="mr-5px" /> 查看报文状态
      </el-button>
    </div>
  </ContentWrap>

  <!-- 最近生成记录 -->
  <ContentWrap>
    <div class="mb-10px flex items-center justify-between">
      <span class="font-bold">最近生成记录</span>
      <span class="text-12px text-[#909399]">
        生成过的报文会在这里出现；状态为「上报中 / 上报成功 / 已回执」的不会重复生成
      </span>
    </div>
    <el-table v-loading="recentLoading" :data="recentList">
      <el-table-column
        label="报文文件名"
        align="left"
        prop="fileName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="130"
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
      <el-table-column label="数据行数" align="right" prop="dataRows" width="110">
        <template #default="scope">{{ formatNumber(scope.row.dataRows) }}</template>
      </el-table-column>
      <el-table-column label="文件大小" align="right" prop="fileSize" width="110">
        <template #default="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
      </el-table-column>
      <el-table-column label="上报状态" align="center" prop="submitStatus" width="110">
        <template #default="scope">
          <el-tag :type="submitStatusTag(scope.row.submitStatus)">
            {{ submitStatusName(scope.row.submitStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="生成时间" align="center" prop="generateTime" width="170">
        <template #default="scope">{{ scope.row.generateTime || '-' }}</template>
      </el-table-column>
      <el-table-column
        label="失败原因"
        align="left"
        prop="failReason"
        min-width="220"
        show-overflow-tooltip
      >
        <template #default="scope">
          <span v-if="scope.row.failReason" class="text-[#f56c6c]">{{ scope.row.failReason }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import * as SubmitGenerateApi from '@/api/cr/submit/generate'
import { formatFileSize, formatNumber, submitStatusName, submitStatusTag } from '../constants'

defineOptions({ name: 'CrSubmitGenerate' })

/** 日志播放间隔：每条日志推进一步进度 */
const LOG_INTERVAL = 50

const message = useMessage()
const router = useRouter()

const periodOptions = ref<string[]>([])
const orgOptions = ref<SubmitGenerateApi.SubmitOrgOptionVO[]>([])
const reportOptions = ref<SubmitGenerateApi.SubmitReportOptionVO[]>([])

const formData = reactive({
  period: '',
  orgIds: [] as number[],
  reportIds: [] as number[]
})

const preview = ref<SubmitGenerateApi.SubmitGeneratePreviewVO | null>(null)
const running = ref(false)
const finished = ref(false)
const percent = ref(0)
const shownLogs = ref<SubmitGenerateApi.SubmitGenerateLogVO[]>([])
const summary = ref<SubmitGenerateApi.SubmitGenerateSummaryVO | null>(null)
const logBoxRef = ref<HTMLElement>()
let timer: ReturnType<typeof setInterval> | null = null

const recentLoading = ref(false)
const recentList = ref<SubmitGenerateApi.SubmitRecentVO[]>([])

const progressText = computed(() => {
  if (running.value) return `报文生成中…… 已完成 ${percent.value}%`
  if (finished.value && summary.value) {
    return `批次号 ${summary.value.batchNo}｜${summary.value.orgCount} 个机构 × ${summary.value.reportCount} 张报表｜生成时间 ${summary.value.generateTime}`
  }
  return '等待生成'
})

const progressStatus = computed<'success' | 'warning' | 'exception' | undefined>(() => {
  if (!finished.value || !summary.value) return undefined
  if (summary.value.failCount > 0) return 'warning'
  return 'success'
})

const summaryType = computed<'success' | 'warning' | 'error' | 'info'>(() => {
  if (!summary.value) return 'info'
  if (summary.value.successCount === 0 && summary.value.failCount > 0) return 'error'
  if (summary.value.failCount > 0) return 'warning'
  return 'success'
})

const summaryTitle = computed(() => {
  if (!summary.value) return ''
  const { totalCount, successCount, failCount, skipCount, totalRows, totalSize } = summary.value
  const parts = [
    `本次共处理 ${totalCount} 个「机构 × 报表」组合：成功生成 ${successCount} 个 / 失败 ${failCount} 个 / 跳过 ${skipCount} 个。`,
    `新生成报文数据量 ${formatNumber(totalRows)} 行 / ${formatFileSize(totalSize)}。`
  ]
  if (failCount > 0) {
    parts.push('失败报文可在「报文状态查询」中查看失败原因，排查后重新生成或重新上报。')
  } else if (successCount > 0) {
    parts.push('可前往「报文状态查询」发起上报并跟踪监管回执。')
  } else {
    parts.push('所选组合均已生成过报文，无需重复生成。')
  }
  return parts.join('')
})

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const scrollLogToBottom = () => {
  nextTick(() => {
    const box = logBoxRef.value
    if (box) {
      box.scrollTop = box.scrollHeight
    }
  })
}

const result = ref<SubmitGenerateApi.SubmitGenerateResultVO | null>(null)

/** 日志播放结束（或被卸载打断时直接补全剩余日志） */
const finishPlayback = () => {
  stopTimer()
  if (result.value?.logs?.length) {
    shownLogs.value = result.value.logs
  }
  percent.value = 100
  running.value = false
  finished.value = true
  scrollLogToBottom()
}

/** 逐条播放生成日志，每条日志推进一次进度 */
const playLogs = (logs: SubmitGenerateApi.SubmitGenerateLogVO[]) => {
  stopTimer()
  shownLogs.value = []
  percent.value = 0
  const total = logs.length || 1
  let index = 0
  timer = setInterval(() => {
    if (index >= logs.length) {
      finishPlayback()
      return
    }
    shownLogs.value.push(logs[index])
    index += 1
    percent.value = Math.min(99, Math.round((index / total) * 100))
    scrollLogToBottom()
  }, LOG_INTERVAL)
}

/** 生成前预览（选择变化时实时刷新） */
const refreshPreview = async () => {
  if (running.value) return
  preview.value = await SubmitGenerateApi.previewSubmitGenerate({
    period: formData.period,
    orgIds: formData.orgIds,
    reportIds: formData.reportIds
  })
}

/** 最近生成记录 */
const getRecent = async () => {
  recentLoading.value = true
  try {
    recentList.value = await SubmitGenerateApi.getSubmitGenerateRecent(8)
  } finally {
    recentLoading.value = false
  }
}

/** 开始生成 */
const handleRun = async () => {
  if (!formData.orgIds.length) {
    message.warning('请至少选择一个报送机构')
    return
  }
  if (!formData.reportIds.length) {
    message.warning('请至少选择一张报表')
    return
  }
  if (preview.value && preview.value.fileCount === 0) {
    message.warning('所选组合在本期次均已生成报文，无需重复生成')
    return
  }
  running.value = true
  finished.value = false
  result.value = null
  summary.value = null
  shownLogs.value = []
  percent.value = 0
  stopTimer()
  try {
    const data = await SubmitGenerateApi.runSubmitGenerate({
      period: formData.period,
      orgIds: formData.orgIds,
      reportIds: formData.reportIds
    })
    result.value = data
    summary.value = data.summary
    playLogs(data.logs || [])
    // 生成即写入状态记录，刷新预览与最近记录
    getRecent()
    refreshPreview()
  } catch {
    running.value = false
    percent.value = 0
  }
}

const handleSelectAll = () => {
  formData.orgIds = orgOptions.value.map((org) => org.id)
  formData.reportIds = reportOptions.value.map((report) => report.id)
  refreshPreview()
}

const handleClear = () => {
  formData.orgIds = []
  formData.reportIds = []
  refreshPreview()
}

/** 跳转报文状态查询（带期次，状态页可直接沿用筛选条件） */
const viewStatus = () => {
  router.push({ path: '/cr-submit/status', query: { period: formData.period } })
}

/** 加载期次 / 机构 / 报表下拉，并给出一个可直接生成的默认选择 */
const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    SubmitGenerateApi.getSubmitGeneratePeriodOptions(),
    SubmitGenerateApi.getSubmitGenerateOrgOptions(),
    SubmitGenerateApi.getSubmitGenerateReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  formData.period = periodOptions.value[periodOptions.value.length - 1] || ''
  formData.orgIds = orgOptions.value.map((org) => org.id)
  formData.reportIds = reportOptions.value.slice(0, 3).map((report) => report.id)
  await refreshPreview()
}

onMounted(() => {
  initOptions()
  getRecent()
})

// 页面被卸载（或 keep-alive 切走）时必须清掉定时器，避免后台继续跑
onBeforeUnmount(() => {
  if (running.value) finishPlayback()
  stopTimer()
})
onDeactivated(() => {
  if (running.value) finishPlayback()
  stopTimer()
})
</script>

<style lang="scss" scoped>
.submit-log {
  height: 280px;
  padding: 10px 12px;
  overflow-y: auto;
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  color: #d4d4d4;
  background-color: #1e1e1e;
  border-radius: 4px;
}

.log-info {
  color: #d4d4d4;
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

.submit-summary {
  padding: 12px 16px;
  text-align: center;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.submit-summary__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.submit-summary__value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
}
</style>
