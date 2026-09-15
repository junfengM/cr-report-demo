<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-alert
      class="mb-15px"
      type="info"
      :closable="false"
      show-icon
      title="前置任务没执行成功时，本任务会落「等待前置任务」而不是照跑；「立即执行」与「手工调度」都按同一规则判定。不允许配成自己，也不允许形成循环依赖（接口会拦下并说明是哪条链路）。"
    />
    <el-form v-loading="formLoading" label-width="100px">
      <el-form-item label="任务">
        <span class="font-bold">{{ task.code }}</span>
        <span class="ml-8px">{{ task.name }}</span>
        <el-tag class="ml-8px" type="info" size="small" disable-transitions>
          {{ task.groupName }}
        </el-tag>
      </el-form-item>
      <el-form-item label="前置任务">
        <el-select
          v-model="preTaskIds"
          multiple
          filterable
          clearable
          class="!w-100%"
          placeholder="不选表示没有前置任务（可以直接跑）"
        >
          <el-option
            v-for="option in options"
            :key="option.id"
            :label="option.code + ' ' + option.name + '（' + option.groupName + '）'"
            :value="option.id"
            :disabled="option.id === taskId"
          />
        </el-select>
        <div class="text-12px text-[#909399] leading-18px">
          执行顺序是「优先级 → 任务编号」；前置任务里只要有一个没成功，本任务这次就不跑
        </div>
      </el-form-item>
      <el-form-item label="谁依赖它">
        <div v-if="dependents.length" class="leading-24px">
          <el-tag
            v-for="item in dependents"
            :key="item.id"
            class="mr-5px"
            type="warning"
            size="small"
            effect="plain"
            disable-transitions
          >
            {{ item.code }} {{ item.name }}
          </el-tag>
        </div>
        <span v-else class="text-[#909399]">目前没有别的任务把它当前置任务</span>
      </el-form-item>
      <el-form-item label="改动影响">
        <div class="text-12px text-[#909399] leading-18px">
          改完只影响"下一次执行"的前置判定，不会回改已经跑过的历史批次（批量监控里的历史记录保持原样）。
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { getCollectTask, getCollectTaskOptions, updatePreTasks } from '@/api/cr/schedule/task'
import type { CollectTaskOptionVO } from '@/api/cr/schedule/task'

defineOptions({ name: 'CrSchedulePreTaskDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('配置前置任务')
const formLoading = ref(false)

const taskId = ref(0)
const task = ref({ id: 0, code: '', name: '', groupName: '' })
const options = ref<CollectTaskOptionVO[]>([])
const preTaskIds = ref<number[]>([])
/** 反向依赖：谁把当前任务当前置（只读展示，避免"改完不知道影响了谁"） */
const dependents = ref<CollectTaskOptionVO[]>([])

/** 打开弹窗：taskId 必传（从任务维护或批量监控的操作列进来） */
const open = async (id: number) => {
  if (!id) {
    message.warning('请先选择要配置的任务')
    return
  }
  dialogVisible.value = true
  formLoading.value = true
  taskId.value = id
  try {
    const [detail, all] = await Promise.all([getCollectTask(id), getCollectTaskOptions()])
    const list: CollectTaskOptionVO[] = all || []
    task.value = {
      id: detail.id,
      code: detail.code,
      name: detail.name,
      groupName: detail.groupName || ''
    }
    preTaskIds.value = [...(detail.preTaskIds || [])]
    options.value = list.filter((item) => item.id !== id)
    dependents.value = list.filter((item) => (item.preTaskIds || []).indexOf(id) >= 0)
    dialogTitle.value = '配置前置任务 — ' + detail.code
  } finally {
    formLoading.value = false
  }
}
defineExpose({ open })

const emit = defineEmits(['success'])
const submitForm = async () => {
  formLoading.value = true
  try {
    await updatePreTasks(taskId.value, preTaskIds.value)
    message.success('前置任务已保存（' + preTaskIds.value.length + ' 个）')
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
