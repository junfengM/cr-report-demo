<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="680">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="任务编码" prop="templateCode">
            <el-input v-model="formData.templateCode" placeholder="请输入任务编码" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据频度" prop="freq">
            <el-select
              v-model="formData.freq"
              placeholder="请选择数据频度"
              class="w-full"
              @change="handleFreqChange"
            >
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="任务名称" prop="templateName">
        <el-input v-model="formData.templateName" placeholder="请输入任务名称" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="报送期次" prop="period">
            <el-input v-model="formData.period" placeholder="如 202608" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-select v-model="formData.status" class="w-full">
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.COMMON_STATUS)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="起始日期" prop="startDate">
            <el-date-picker
              v-model="formData.startDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择起始日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="截止日期" prop="deadline">
            <el-date-picker
              v-model="formData.deadline"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择截止日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
      <el-alert
        v-if="freqHint"
        type="warning"
        :closable="false"
        show-icon
        :title="freqHint"
        class="mb-10px"
      />
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { CommonStatusEnum } from '@/utils/constants'
import * as TaskTemplateApi from '@/api/cr/task/template'

defineOptions({ name: 'CrTaskTemplateForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const originalFreq = ref<number>()

const formData = ref<TaskTemplateApi.TaskTemplateVO>({
  id: undefined,
  templateCode: '',
  templateName: '',
  freq: 3,
  period: '',
  startDate: '',
  deadline: '',
  reportIds: [],
  reportCount: 0,
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formRules = reactive({
  templateCode: [{ required: true, message: '任务编码不能为空', trigger: 'blur' }],
  templateName: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
  freq: [{ required: true, message: '数据频度不能为空', trigger: 'change' }],
  period: [{ required: true, message: '报送期次不能为空', trigger: 'blur' }],
  deadline: [{ required: true, message: '截止日期不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 频度被修改且已有报表时给出提醒（对齐附件文档的频度一致性约束） */
const freqHint = computed(() => {
  if (formType.value !== 'update') return ''
  if (originalFreq.value === undefined || originalFreq.value === formData.value.freq) return ''
  if (!formData.value.reportCount) return ''
  return `该任务下已有 ${formData.value.reportCount} 张报表，修改频度后可能导致报表与任务频度不一致，请在"添加报表"中重新确认。`
})

const handleFreqChange = () => {
  // 触发 computed 重新计算
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增报表任务' : '修改报表任务'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await TaskTemplateApi.getTaskTemplate(id)
      formData.value = data
      originalFreq.value = data.freq
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await TaskTemplateApi.createTaskTemplate(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await TaskTemplateApi.updateTaskTemplate(formData.value)
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
  formData.value = {
    id: undefined,
    templateCode: '',
    templateName: '',
    freq: 3,
    period: '',
    startDate: '',
    deadline: '',
    reportIds: [],
    reportCount: 0,
    status: CommonStatusEnum.ENABLE,
    remark: ''
  }
  originalFreq.value = undefined
  formRef.value?.resetFields()
}
</script>
