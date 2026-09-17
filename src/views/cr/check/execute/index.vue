<template>
  <ContentWrap>
    <!-- 校验条件 -->
    <el-form class="-mb-15px" :model="formData" :inline="true" label-width="80px">
      <el-form-item label="报送期次" prop="period">
        <el-select
          v-model="formData.period"
          placeholder="请选择期次"
          class="!w-160px"
          :disabled="running"
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
          v-hasPermi="['cr:check-execute:run']"
        >
          <Icon icon="ep:video-play" class="mr-5px" /> 执行校验
        </el-button>
        <el-button :disabled="running" @click="handleSelectAll">全选</el-button>
        <el-button :disabled="running" @click="handleClear">清空</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 执行进度区 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="校验按「校验规则维护」中已启用的规则执行；错误级问题将阻断报送，警告级问题仅提示不阻断。"
    />
    <div class="mb-10px flex items-center justify-between">
      <span class="font-bold">执行进度</span>
      <span class="text-12px text-[#909399]">{{ progressText }}</span>
    </div>
    <el-progress :percentage="percent" :status="progressStatus" :stroke-width="14" />
    <div ref="logBoxRef" class="check-log mt-10px">
      <template v-if="shownLogs.length">
        <div v-for="(log, index) in shownLogs" :key="index" :class="`log-${log.level}`">
          [{{ log.time }}] {{ log.text }}
        </div>
      </template>
      <el-empty
        v-else
        description="尚未执行校验，请选择期次、机构与报表后点击「执行校验」"
        :image-size="60"
      />
    </div>

    <!-- 校验汇总 -->
    <div v-if="finished && result" class="mt-15px">
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="check-summary">
            <div class="check-summary__label">校验通过</div>
            <div class="check-summary__value text-[#67c23a]">{{ result.passCount }} 条</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="check-summary">
            <div class="check-summary__label">警告</div>
            <div class="check-summary__value text-[#e6a23c]">{{ result.warnCount }} 条</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="check-summary">
            <div class="check-summary__label">错误</div>
            <div class="check-summary__value text-[#f56c6c]">{{ result.errorCount }} 条</div>
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
      <el-button class="mt-10px" type="primary" @click="viewResult">
        <Icon icon="ep:document-checked" class="mr-5px" /> 查看结果
      </el-button>
    </div>
  </ContentWrap>
</template>

<script lang="ts" setup>
import * as CheckExecuteApi from '@/api/cr/check/execute'

defineOptions({ name: 'CrCheckExecute' })

/** 日志播放间隔：每条日志推进一步进度 */
const LOG_INTERVAL = 50

const message = useMessage()
const router = useRouter()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']
const orgOptions = ref<CheckExecuteApi.CheckOrgOptionVO[]>([])
const reportOptions = ref<CheckExecuteApi.CheckReportOptionVO[]>([])

const formData = reactive({
  period: '202608',
  orgIds: [] as number[],
  reportIds: [] as number[]
})

const running = ref(false)
const finished = ref(false)
const percent = ref(0)
const shownLogs = ref<CheckExecuteApi.CheckLogVO[]>([])
const result = ref<CheckExecuteApi.CheckExecuteResultVO | null>(null)
const logBoxRef = ref<HTMLElement>()
let timer: ReturnType<typeof setInterval> | null = null

const progressText = computed(() => {
  if (running.value) return `校验进行中…… 已完成 ${percent.value}%`
  if (finished.value && result.value) {
    return `任务号 ${result.value.taskNo}｜${result.value.orgCount} 个机构 × ${result.value.reportCount} 张报表`
  }
  return '等待执行'
})

const progressStatus = computed<'success' | 'warning' | 'exception' | undefined>(() => {
  if (!finished.value || !result.value) return undefined
  if (result.value.errorCount > 0) return 'exception'
  if (result.value.warnCount > 0) return 'warning'
  return 'success'
})

const summaryType = computed<'success' | 'warning' | 'error' | 'info'>(() => {
  if (!result.value) return 'info'
  if (result.value.errorCount > 0) return 'error'
  if (result.value.warnCount > 0) return 'warning'
  return 'success'
})

const summaryTitle = computed(() => {
  if (!result.value) return ''
  const { total, passCount, warnCount, errorCount } = result.value
  let tail = '未发现异常，可继续报送。'
  if (errorCount > 0) {
    tail = `存在 ${errorCount} 条错误级问题，已阻断报送，请处理后重新校验。`
  } else if (warnCount > 0) {
    tail = '警告级问题不阻断报送，可确认后继续。'
  }
  return `本次共校验 ${total} 条数据：校验通过 ${passCount} 条 / 警告 ${warnCount} 条 / 错误 ${errorCount} 条。${tail}`
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

/** 逐条播放校验日志，每条日志推进一次进度 */
const playLogs = (logs: CheckExecuteApi.CheckLogVO[]) => {
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

/** 执行校验 */
const handleRun = async () => {
  if (!formData.orgIds.length) {
    message.warning('请至少选择一个报送机构')
    return
  }
  if (!formData.reportIds.length) {
    message.warning('请至少选择一张报表')
    return
  }
  running.value = true
  finished.value = false
  result.value = null
  shownLogs.value = []
  percent.value = 0
  stopTimer()
  try {
    const data = await CheckExecuteApi.runCheckExecute({
      period: formData.period,
      orgIds: formData.orgIds,
      reportIds: formData.reportIds
    })
    result.value = data
    playLogs(data.logs || [])
  } catch {
    running.value = false
    percent.value = 0
  }
}

const handleSelectAll = () => {
  formData.orgIds = orgOptions.value.map((org) => org.id)
  formData.reportIds = reportOptions.value.map((report) => report.id)
}

const handleClear = () => {
  formData.orgIds = []
  formData.reportIds = []
}

/** 跳转校验结果查询（带期次，结果页可直接沿用筛选条件） */
const viewResult = () => {
  router.push({ path: '/new-unified/cr-check/result', query: { period: formData.period } })
}

/** 加载机构与报表下拉选项，并给出一个可直接运行的默认选择 */
const initOptions = async () => {
  const [orgs, reports] = await Promise.all([
    CheckExecuteApi.getCheckExecuteOrgOptions(),
    CheckExecuteApi.getCheckExecuteReportOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  formData.orgIds = orgOptions.value.map((org) => org.id)
  formData.reportIds = reportOptions.value.slice(0, 3).map((report) => report.id)
}

onMounted(() => {
  initOptions()
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
.check-log {
  height: 260px;
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

.check-summary {
  padding: 12px 16px;
  text-align: center;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.check-summary__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.check-summary__value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
}
</style>
