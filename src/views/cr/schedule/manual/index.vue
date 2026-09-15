<template>
  <!-- 顶部边界说明：手工调度只写跑批日志、不改填报数据；这段不做权限隐藏，进页面就该看到 -->
  <ContentWrap>
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="手工调度 = 重新执行历史批次的采集任务，不会改动填报数据"
    >
      <div class="text-13px leading-20px">
        执行顺序固定为「优先级 → 任务编号」，不是勾选顺序，页面上也不提供调序。
        数据日期按期次自动推导（202608 → 2026-08-31），本次执行的就是这一天。
        前置任务没成功的任务会落「等待前置任务」而不是照跑：前置任务在本次批次里跑过的看本次结果，不在本次批次里的看它同期次最近一次的执行结果；
        本期次还没有任何执行记录时不做判定。
        这一步只写跑批日志（执行完在「批量监控」按期次即可查到），不会改写填报数据里的任何字段值。
        执行结果只在本次手工执行后展示，刷新页面就清空（不做持久化），留痕以批量监控为准。
      </div>
    </el-alert>
  </ContentWrap>

  <!-- 第一步：勾选分组。用多选表格而不是复选框列表：勾了哪几行在表格里一眼可见 -->
  <ContentWrap title="第一步：勾选要执行的任务分组">
    <el-table
      v-loading="optionsLoading"
      :data="groups"
      @selection-change="handleGroupSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column label="分组编码" prop="groupCode" width="110" />
      <el-table-column label="分组名称" prop="groupName" width="170" show-overflow-tooltip />
      <el-table-column label="分组说明" prop="description" min-width="240" show-overflow-tooltip />
      <el-table-column label="组内任务数" align="center" width="110">
        <template #default="scope">{{ scope.row.taskCount }} 个</template>
      </el-table-column>
      <el-table-column label="高优先级任务数" align="center" width="140">
        <template #default="scope">
          <el-tag
            v-if="scope.row.highPriorityCount > 0"
            type="danger"
            size="small"
            effect="plain"
            disable-transitions
          >
            {{ scope.row.highPriorityCount }} 个
          </el-tag>
          <span v-else class="text-[#909399]">0 个</span>
        </template>
      </el-table-column>
    </el-table>
    <!-- 已勾选的分组再写一遍：表格滚动或重新加载后，勾选框本身看不全到底选了哪几组 -->
    <div class="mt-10px text-13px">
      <span class="text-[#909399]">已勾选 {{ selectedGroups.length }} 组：</span>
      <template v-if="selectedGroups.length">
        <el-tag
          v-for="group in selectedGroups"
          :key="group.id"
          class="mr-5px"
          size="small"
          effect="plain"
          disable-transitions
        >
          {{ group.groupCode }} {{ group.groupName }}
        </el-tag>
      </template>
      <span v-else class="text-[#e6a23c]">尚未勾选，请至少勾选一个任务分组</span>
    </div>
  </ContentWrap>

  <!-- 第二步：选期次并执行 -->
  <ContentWrap title="第二步：选择数据期次并执行">
    <el-form label-width="100px">
      <el-form-item label="数据期次">
        <el-select
          v-model="period"
          placeholder="请选择数据期次"
          clearable
          :loading="optionsLoading"
          class="!w-260px"
        >
          <el-option
            v-for="item in periods"
            :key="item.period"
            :label="item.period + ' ' + item.periodName"
            :value="item.period"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="数据日期">
        <template v-if="selectedPeriod">
          <span class="text-14px font-700">{{ selectedPeriod.dataDate }}</span>
          <span class="ml-15px text-13px text-[#909399]">该期次状态：{{ periodStatusLabel }}</span>
          <dict-tag
            class="ml-5px"
            :type="DICT_TYPE.CR_PERIOD_STATUS"
            :value="selectedPeriod.status"
          />
        </template>
        <span v-else class="text-[#909399]">
          选择期次后在这里显示推导出的数据日期（如 202608 → 2026-08-31）
        </span>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :loading="running"
          @click="handleRun"
          v-hasPermi="['cr:schedule-manual:run']"
        >
          <Icon icon="ep:video-play" class="mr-5px" /> 批量执行
        </el-button>
        <!-- 缺什么就写在按钮旁边：灰按钮点不动、也不解释原因，用户只会以为页面坏了 -->
        <span v-if="missingTip" class="ml-10px text-12px text-[#e6a23c]">{{ missingTip }}</span>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 执行结果：只在本次手工执行后展示，刷新即清空 -->
  <ContentWrap v-if="result" title="本次执行结果">
    <el-alert
      class="mb-10px"
      type="success"
      :closable="false"
      show-icon
      title="这批记录已写入批量监控"
    >
      <div class="text-12px leading-18px">
        本次期次 {{ result.period }}、数据日期 {{ result.dataDate }}、执行方式「手工调度」。
        <el-button link type="primary" @click="goMonitor">去批量监控查看</el-button>
        <span class="ml-5px text-[#909399]">（结果只在本次手工执行后展示，刷新页面即清空）</span>
      </div>
    </el-alert>
    <div class="flex gap-15px">
      <el-card class="flex-1" shadow="never">
        <div class="text-13px text-gray-500">生成记录数</div>
        <div class="mt-5px text-22px font-700">{{ result.generated }}</div>
        <div class="mt-5px text-12px text-gray-500">本次写入跑批日志的行数</div>
      </el-card>
      <el-card class="flex-1" shadow="never">
        <div class="text-13px text-gray-500">执行成功</div>
        <div class="mt-5px text-22px font-700 text-green-600">{{ result.success }}</div>
        <div class="mt-5px text-12px text-gray-500">只有成功的任务才有新增数据量</div>
      </el-card>
      <el-card class="flex-1" shadow="never">
        <div class="text-13px text-gray-500">执行失败</div>
        <div class="mt-5px text-22px font-700" :class="result.failed > 0 ? 'text-red-500' : ''">
          {{ result.failed }}
        </div>
        <div class="mt-5px text-12px text-gray-500">失败原因见下方表格红字</div>
      </el-card>
      <el-card class="flex-1" shadow="never">
        <div class="text-13px text-gray-500">等待前置任务</div>
        <div class="mt-5px text-22px font-700" :class="result.waiting > 0 ? 'text-orange-500' : ''">
          {{ result.waiting }}
        </div>
        <div class="mt-5px text-12px text-gray-500">前置任务未成功，本次没有真的跑</div>
      </el-card>
      <el-card class="flex-1" shadow="never">
        <div class="text-13px text-gray-500">新增数据量</div>
        <div class="mt-5px text-22px font-700 text-blue-600">{{ result.rowsAdded }} 行</div>
        <div class="mt-5px text-12px text-gray-500">按本次日志的 rowsAdded 累加</div>
      </el-card>
    </div>
    <el-table class="mt-15px" :data="result.logs" max-height="440">
      <el-table-column label="任务编码" prop="taskCode" width="200" show-overflow-tooltip />
      <el-table-column label="任务名称" prop="taskName" min-width="160" show-overflow-tooltip />
      <el-table-column label="执行状态" align="center" width="120">
        <template #default="scope">
          <span :class="statusClass(scope.row.status)">{{ scope.row.statusLabel }}</span>
        </template>
      </el-table-column>
      <el-table-column label="新增数据量" align="right" prop="rowsAdded" width="110" />
      <el-table-column label="执行时长(秒)" align="right" prop="duration" width="120" />
      <el-table-column label="错误信息" min-width="260" show-overflow-tooltip>
        <template #default="scope">
          <!-- 失败 / 等待前置的行才有 errorMsg：红字是报错，橙字是依赖没就绪 -->
          <span :class="errorClass(scope.row)">{{ scope.row.errorMsg || '-' }}</span>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import {
  getManualOptions,
  manualRun,
  type ManualPeriodVO,
  type ManualRunResultVO
} from '@/api/cr/schedule/manual'
import type { CollectTaskGroupVO } from '@/api/cr/schedule/task'
import type { CollectTaskLogVO } from '@/api/cr/schedule/monitor'

defineOptions({ name: 'CrScheduleManual' })

const message = useMessage()
const router = useRouter()

const optionsLoading = ref(false)
const running = ref(false)
const groups = ref<CollectTaskGroupVO[]>([])
const periods = ref<ManualPeriodVO[]>([])
const selectedGroups = ref<CollectTaskGroupVO[]>([])
const period = ref<string | undefined>('')
/** 本次手工执行的结果：只留在内存里，刷新即清空 —— 跑批留痕以批量监控为准 */
const result = ref<ManualRunResultVO | null>(null)

/** 当前选中的期次：数据日期与状态都用接口给的期次选项，页面不再推一遍 */
const selectedPeriod = computed(() => periods.value.find((item) => item.period === period.value))

/** 期次状态中文：走字典翻译，避免页面再维护一套 0/1/2 的映射 */
const periodStatusLabel = computed(() => {
  if (!selectedPeriod.value) return '-'
  const hit = getIntDictOptions(DICT_TYPE.CR_PERIOD_STATUS).find(
    (item) => Number(item.value) === Number(selectedPeriod.value?.status)
  )
  return hit ? hit.label : '未知状态'
})

/** 还缺什么条件：缺的时候直接写在按钮旁边，点下去也会再提示一次 */
const missingTip = computed(() => {
  const missing: string[] = []
  if (!selectedGroups.value.length) missing.push('勾选任务分组')
  if (!period.value) missing.push('选择数据期次')
  return missing.length ? '还需：' + missing.join('、') : ''
})

/** 状态文字配色：1 运行中 / 2 执行成功 / 3 执行失败 / 4 等待前置任务 / 5 已跳过 */
const statusClass = (status: number) => {
  if (status === 2) return 'text-green-600'
  if (status === 3) return 'text-red-500'
  if (status === 4) return 'text-orange-500'
  if (status === 1) return 'text-blue-600'
  return 'text-[#909399]'
}

/** 错误信息配色：失败是红字，等待前置是橙字（它不是报错，是依赖没就绪） */
const errorClass = (row: CollectTaskLogVO) => {
  if (row.status === 3) return 'text-red-500'
  if (row.status === 4) return 'text-orange-500'
  return 'text-[#909399]'
}

/** 拉选项：任务分组与期次都由接口给（期次自带推导好的数据日期） */
const getOptions = async () => {
  optionsLoading.value = true
  try {
    const data = await getManualOptions()
    groups.value = data.groups || []
    periods.value = data.periods || []
  } finally {
    optionsLoading.value = false
  }
}

/** 勾选变化：只留勾选的行，确认弹窗里要写出分组名 */
const handleGroupSelectionChange = (rows: CollectTaskGroupVO[]) => {
  selectedGroups.value = rows
}

/** 批量执行：先自证条件齐全，再确认，最后调接口（结果直接展示接口返回值，前端不再算一遍） */
const handleRun = async () => {
  // 按钮不做灰置：灰按钮点不动也不说原因，等于静默失败；缺什么在这里讲清楚
  if (!selectedGroups.value.length) {
    message.warning('请先勾选要执行的任务分组')
    return
  }
  const periodValue = period.value
  if (!periodValue) {
    message.warning('请先选择数据期次')
    return
  }
  const dataDate = selectedPeriod.value?.dataDate || ''
  const groupNames = selectedGroups.value
    .map((item) => item.groupCode + ' ' + item.groupName)
    .join('、')
  try {
    await message.confirm(
      '将对 ' +
        selectedGroups.value.length +
        ' 个分组（' +
        groupNames +
        '）、期次 ' +
        periodValue +
        '（数据日期 ' +
        dataDate +
        '）执行采集任务。执行顺序为「优先级 → 任务编号」，只写跑批日志、不改动填报数据。确认执行？'
    )
  } catch {
    return
  }
  running.value = true
  try {
    const data = await manualRun(
      selectedGroups.value.map((item) => item.id),
      periodValue
    )
    result.value = data
    message.success(
      '批量执行完成：成功 ' +
        data.success +
        ' 个 / 失败 ' +
        data.failed +
        ' 个 / 等待前置 ' +
        data.waiting +
        ' 个'
    )
  } finally {
    running.value = false
  }
}

/** 去批量监控：带上期次，落到那页就能筛到本次生成的行 */
const goMonitor = () => {
  router.push({
    path: '/cr-schedule/monitor',
    query: { period: result.value ? result.value.period : '' }
  })
}

onMounted(() => {
  getOptions()
})
</script>
