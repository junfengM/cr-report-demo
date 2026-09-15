<template>
  <Dialog v-model="dialogVisible" title="任务下发" width="720">
    <el-alert
      class="mb-10px"
      type="warning"
      :closable="false"
      show-icon
      title="任务下发将按「模板下的报表 × 所选机构」批量生成填报任务，已下发过的组合会自动跳过。"
    />
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-form-item label="任务模板" prop="templateId">
        <el-select
          v-model="formData.templateId"
          placeholder="请选择任务模板"
          class="w-full"
          @change="handleTemplateChange"
        >
          <el-option
            v-for="item in templateList"
            :key="item.id"
            :label="`${item.templateCode} ${item.templateName}`"
            :value="item.id!"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表数量">
        <el-tag type="info" effect="plain">{{ selectedTemplate?.reportCount ?? 0 }} 张报表</el-tag>
        <span class="ml-10px color-#909399 text-13px">
          数据频度：{{ freqLabel(selectedTemplate?.freq) }}
        </span>
      </el-form-item>
      <el-form-item label="下发机构" prop="orgIds">
        <el-select
          v-model="formData.orgIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择下发机构"
          class="w-full"
        >
          <el-option v-for="org in orgList" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="报送期次" prop="period">
            <el-input v-model="formData.period" placeholder="如 202608" />
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
      <el-form-item label="预计生成">
        <span class="color-#409eff font-bold">
          {{ (selectedTemplate?.reportCount ?? 0) * formData.orgIds.length }} 条填报任务
        </span>
        <span class="ml-10px color-#909399 text-13px">
          下发后按机构生成任务，状态为「已下发」，由填报人开始填报。
        </span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确认下发</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as TaskApi from '@/api/cr/task/manage'
import * as TaskTemplateApi from '@/api/cr/task/template'

defineOptions({ name: 'CrTaskDispatchDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const formLoading = ref(false)
const formRef = ref()
const templateList = ref<TaskTemplateApi.TaskTemplateVO[]>([])
const orgList = ref<Array<{ id: number; name: string }>>([])

const formData = reactive({
  templateId: undefined as number | undefined,
  orgIds: [] as number[],
  period: '202608',
  deadline: ''
})

const formRules = reactive({
  templateId: [{ required: true, message: '请选择任务模板', trigger: 'change' }],
  orgIds: [{ required: true, message: '请至少选择一个下发机构', trigger: 'change' }],
  period: [{ required: true, message: '报送期次不能为空', trigger: 'blur' }],
  deadline: [{ required: true, message: '截止日期不能为空', trigger: 'change' }]
})

const selectedTemplate = computed(() =>
  templateList.value.find((item) => item.id === formData.templateId)
)

const freqLabel = (freq?: number) =>
  getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ).find((dict) => dict.value === freq)?.label || '—'

/** 打开弹窗：从行内「下发」进入时带上该行的模板与机构 */
const open = async (row?: TaskApi.CrTaskVO) => {
  dialogVisible.value = true
  formData.templateId = row?.templateId
  formData.orgIds = row?.orgId ? [row.orgId] : []
  formData.period = row?.period || '202608'
  formData.deadline = row?.deadline || ''
  formLoading.value = true
  try {
    const [templates, orgs] = await Promise.all([
      TaskTemplateApi.getTaskTemplatePage({ pageNo: 1, pageSize: 100 }),
      TaskApi.getTaskOrgOptions()
    ])
    templateList.value = templates.list || []
    orgList.value = orgs || []
    if (!formData.templateId && templateList.value.length) {
      const first = templateList.value.find((item) => item.reportCount > 0)
      if (first) handleTemplateChange(first.id!)
    }
  } finally {
    formLoading.value = false
  }
}
defineExpose({ open })

/** 切模板时带出模板的期次与截止日期 */
const handleTemplateChange = (templateId: number) => {
  const template = templateList.value.find((item) => item.id === templateId)
  if (template) {
    formData.period = template.period || formData.period
    formData.deadline = template.deadline || formData.deadline
  }
}

/** 提交下发 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  await formRef.value.validate()
  if (!selectedTemplate.value?.reportCount) {
    message.warning('所选模板下还没有报表，请先在任务模板中添加报表')
    return
  }
  try {
    await message.confirm(
      `将向 ${formData.orgIds.length} 家机构下发《${selectedTemplate.value?.templateName}》，` +
        `预计生成 ${(selectedTemplate.value?.reportCount ?? 0) * formData.orgIds.length} 条填报任务，是否继续？`,
      '任务下发确认'
    )
  } catch {
    return
  }
  formLoading.value = true
  try {
    const data = await TaskApi.dispatchTask({
      templateId: formData.templateId!,
      orgIds: formData.orgIds,
      period: formData.period,
      deadline: formData.deadline
    })
    message.success(`任务下发成功：新增 ${data.count} 条，跳过已下发 ${data.skipped} 条`)
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
