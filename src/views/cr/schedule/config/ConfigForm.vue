<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="680">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="任务" prop="taskId">
        <el-select
          v-model="formData.taskId"
          filterable
          placeholder="请选择要调度的采集任务"
          class="!w-100%"
        >
          <el-option
            v-for="item in taskOptions"
            :key="item.id"
            :label="item.code + ' ' + item.name"
            :value="item.id"
          />
        </el-select>
        <div class="text-12px text-[#909399] leading-18px">
          修改时也允许换任务，但一个任务只保留一条调度：换成已有调度的任务会被接口拦下并说明是哪个任务
        </div>
      </el-form-item>

      <el-form-item label="Cron 表达式" prop="cron">
        <!-- 脚手架内置的 crontab 组件（全局已注册，直接写小写标签） -->
        <crontab v-model="formData.cron" />
        <div class="text-12px text-[#909399] leading-18px">
          Quartz 六段：秒 分 时 日 月 周；例：0 0 2 * * ? 表示每天 02:00 执行。段数不对（如只写 5
          段）接口会拦下并说明缺哪一段
        </div>
      </el-form-item>

      <el-form-item label="调度状态" prop="enabled">
        <el-switch
          v-model="formData.enabled"
          :active-value="1"
          :inactive-value="0"
          active-text="已开启"
          inactive-text="已关闭"
        />
        <div class="text-12px text-[#909399] leading-18px">
          关闭只是不参与自动调度，任务仍可在「手工调度」页手动执行
        </div>
      </el-form-item>

      <el-form-item label="是否有状态" prop="stateful">
        <el-switch
          v-model="formData.stateful"
          :active-value="true"
          :inactive-value="false"
          active-text="有状态"
          inactive-text="无状态"
        />
        <div class="text-12px text-[#909399] leading-18px">
          有状态的任务串行执行（上一次没跑完不会起第二次），无状态的任务可以并发
        </div>
      </el-form-item>

      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 每日 02:00 跑保单基础信息采集，出问题联系数据平台组"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import {
  getSchedule,
  createSchedule,
  updateSchedule,
  type ScheduleVO
} from '@/api/cr/schedule/config'
import { getCollectTaskOptions, type CollectTaskOptionVO } from '@/api/cr/schedule/task'

defineOptions({ name: 'CrScheduleConfigForm' })

const { t } = useI18n()
const message = useMessage()

interface ScheduleFormModel {
  id?: number
  taskId?: number
  /** Quartz 六段（秒 分 时 日 月 周），默认每天 02:00 */
  cron: string
  /** 0 已关闭 / 1 已开启：只影响自动调度 */
  enabled: number
  /** 有状态任务串行执行 */
  stateful: boolean
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')

const defaultForm = (): ScheduleFormModel => ({
  id: undefined,
  taskId: undefined,
  cron: '0 0 2 * * ?',
  enabled: 1,
  stateful: true,
  remark: ''
})

const formData = ref<ScheduleFormModel>(defaultForm())

const formRules = reactive({
  taskId: [{ required: true, message: '请选择要调度的采集任务', trigger: 'change' }],
  // 段数 / 非法字符的校验由接口给出（它会说明缺哪一段），这里只拦空值
  cron: [{ required: true, message: 'Cron 表达式不能为空', trigger: 'blur' }]
})

const formRef = ref()

/** 任务下拉：每次打开都取一次，任务维护页刚新增的任务要能立刻选到 */
const taskOptions = ref<CollectTaskOptionVO[]>([])
const getTaskOptions = async () => {
  try {
    taskOptions.value = (await getCollectTaskOptions()) || []
  } catch {}
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增调度配置' : '修改调度配置'
  formType.value = type
  resetForm()
  getTaskOptions()
  if (id) {
    formLoading.value = true
    try {
      const data = await getSchedule(id)
      formData.value = { ...defaultForm(), ...data }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  formLoading.value = true
  try {
    const payload = { ...formData.value } as ScheduleVO
    if (formType.value === 'create') {
      await createSchedule(payload)
      message.success(t('common.createSuccess'))
    } else {
      await updateSchedule(payload)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置 */
const resetForm = () => {
  formData.value = defaultForm()
  formRef.value?.resetFields()
}
</script>
