<template>
  <Dialog v-model="dialogVisible" title="流转轨迹" width="720">
    <div v-loading="loading">
      <el-descriptions v-if="task" :column="2" border size="small" class="mb-12px">
        <el-descriptions-item label="任务编号">{{ task.taskCode }}</el-descriptions-item>
        <el-descriptions-item label="填报机构">{{ task.orgName }}</el-descriptions-item>
        <el-descriptions-item label="任务名称" :span="2">{{ task.taskName }}</el-descriptions-item>
        <el-descriptions-item label="报送期次">{{ task.period }}</el-descriptions-item>
        <el-descriptions-item label="截止日期">{{ task.deadline }}</el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="task.status" />
        </el-descriptions-item>
        <el-descriptions-item label="当前环节">
          <el-tag :type="tagTypeOf(task.status)" effect="plain">{{ currentStage }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-steps :active="activeStep" align-center finish-status="success" class="mb-18px">
        <el-step v-for="step in FLOW_STEPS" :key="step" :title="step" />
      </el-steps>

      <el-timeline v-if="list.length">
        <el-timeline-item
          v-for="item in list"
          :key="item.id"
          :timestamp="item.operateTime"
          :type="item.result === AUDIT_RESULT.REJECT ? 'danger' : 'success'"
          placement="top"
        >
          <div class="flex items-center justify-between">
            <div>
              <el-tag size="small" effect="plain" class="mr-6px">{{ item.stage }}</el-tag>
              <span class="font-bold">{{ item.action }}</span>
              <span class="ml-8px color-#909399">操作人：{{ item.operator }}</span>
            </div>
            <el-tag size="small" :type="item.result === AUDIT_RESULT.REJECT ? 'danger' : 'success'">
              {{ item.result === AUDIT_RESULT.REJECT ? '不通过' : '通过' }}
            </el-tag>
          </div>
          <div v-if="item.opinion" class="mt-6px color-#606266 text-13px">
            意见：{{ item.opinion }}
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else-if="!loading" description="该任务暂无流转记录" />
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as TaskApi from '@/api/cr/task/manage'
import { AUDIT_RESULT, FLOW_STEPS, STATUS_STEP, tagTypeOf } from '../constants'

defineOptions({ name: 'CrTaskTraceDialog' })

const dialogVisible = ref(false)
const loading = ref(false)
const task = ref<TaskApi.CrTaskVO>()
const currentStage = ref('')
const list = ref<TaskApi.TaskTraceItemVO[]>([])

/** 已完成 / 已打回的任务直接把进度条走满，其余按状态映射 */
const activeStep = computed(() => {
  const status = task.value?.status
  if (status === undefined) return 0
  if (status === 100) return 0
  return STATUS_STEP[status] ?? 0
})

/** 打开弹窗 */
const open = async (id: number) => {
  dialogVisible.value = true
  loading.value = true
  task.value = undefined
  list.value = []
  try {
    const data: TaskApi.TaskTraceVO = await TaskApi.getTaskTrace(id)
    task.value = data.task
    currentStage.value = data.currentStage
    list.value = data.list || []
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
