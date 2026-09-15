<template>
  <Dialog v-model="dialogVisible" title="生成报文" width="620">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="报文按「机构 × 报表 × 期次」生成，仅当该组合已存在填报数据时才允许生成。"
    />
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-form-item label="报送机构" prop="orgId">
        <el-select v-model="formData.orgId" placeholder="请选择报送机构" class="w-full">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="formData.period" placeholder="请选择报送期次" class="w-full">
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select v-model="formData.reportId" filterable placeholder="请选择报表" class="w-full">
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="`${report.code} ${report.name}`"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="文件类型" prop="fileType">
        <el-radio-group v-model="formData.fileType">
          <el-radio-button v-for="type in FILE_TYPES" :key="type" :value="type">
            {{ type }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">生成报文</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as MessageApi from '@/api/cr/data/message'

defineOptions({ name: 'CrDataMessageGenerateForm' })

const emit = defineEmits(['success'])
const message = useMessage()

const FILE_TYPES = ['TXT', 'XML', 'CSV']

const dialogVisible = ref(false)
const formLoading = ref(false)
const formRef = ref()
const orgOptions = ref<{ id: number; name: string }[]>([])
const reportOptions = ref<{ id: number; name: string; code: string }[]>([])
const periodOptions = ref<string[]>([])

const formData = reactive({
  orgId: undefined as number | undefined,
  period: '202608',
  reportId: undefined as number | undefined,
  fileType: 'TXT'
})

const formRules = reactive({
  orgId: [{ required: true, message: '请选择报送机构', trigger: 'change' }],
  period: [{ required: true, message: '请选择报送期次', trigger: 'change' }],
  reportId: [{ required: true, message: '请选择报表', trigger: 'change' }],
  fileType: [{ required: true, message: '请选择文件类型', trigger: 'change' }]
})

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  formLoading.value = true
  try {
    const data = await MessageApi.generateMessage({
      orgId: formData.orgId!,
      reportId: formData.reportId!,
      period: formData.period,
      fileType: formData.fileType
    })
    message.success(`报文生成任务已提交：${data.messageName}`)
    dialogVisible.value = false
    emit('success', data)
  } finally {
    formLoading.value = false
  }
}

/** 打开弹窗：加载机构 / 报表 / 期次下拉 */
const open = async () => {
  dialogVisible.value = true
  const [orgs, reports, periods] = await Promise.all([
    MessageApi.getMessageOrgOptions(),
    MessageApi.getMessageReportOptions(),
    MessageApi.getMessagePeriodOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  periodOptions.value = periods || []
  formData.period = periodOptions.value.includes('202608')
    ? '202608'
    : periodOptions.value[periodOptions.value.length - 1]
}

defineExpose({ open })
</script>
