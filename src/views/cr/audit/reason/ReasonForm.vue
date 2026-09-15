<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-alert
      v-if="readonly"
      type="info"
      :closable="false"
      show-icon
      title="该条错误原因已由审核人确认，仅可查看，不能再修改。"
      class="mb-12px"
    />
    <el-alert
      v-else-if="row?.status === 1"
      type="warning"
      :closable="false"
      show-icon
      title="该条已填报过错误原因，重新提交将覆盖原说明并回到「待确认」状态。"
      class="mb-12px"
    />
    <el-descriptions
      v-loading="loading"
      :column="2"
      border
      size="small"
      label-width="100px"
      class="mb-14px"
    >
      <el-descriptions-item label="机构">{{ row?.orgName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="报送期次">{{ row?.period || '-' }}</el-descriptions-item>
      <el-descriptions-item label="报表名称" :span="2">
        {{ row?.reportCode }} {{ row?.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="数据定位" :span="2">
        {{ row?.location || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="字段名称">
        {{ row?.columnName }}（{{ row?.columnCode }}）
      </el-descriptions-item>
      <el-descriptions-item label="错误级别">
        <dict-tag v-if="row" :type="DICT_TYPE.CR_ERROR_LEVEL" :value="row.errorLevel" />
      </el-descriptions-item>
      <el-descriptions-item label="原值" :span="2">
        <span class="font-bold text-[#f56c6c] break-all">{{ row?.originalValue || '(空)' }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="审核意见" :span="2">
        {{ row?.auditOpinion || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="审核人">
        {{ row?.auditUser || '-'
        }}<span class="ml-6px text-12px text-[#909399]">{{ row?.auditTime }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="回复期限">{{ row?.deadline || '-' }}</el-descriptions-item>
      <el-descriptions-item label="处理状态">
        <el-tag v-if="row" :type="statusTagType(row.status)" disable-transitions>
          {{ statusLabel(row.status) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="填报人">
        {{ row?.fillUser || '-'
        }}<span class="ml-6px text-12px text-[#909399]">{{ row?.fillTime }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-form
      ref="formRef"
      v-loading="loading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="错误原因说明" prop="reason">
        <el-input
          v-model="formData.reason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          :disabled="readonly"
          placeholder="请说明数据错误的产生原因、核对过程与整改措施（至少 10 个字）"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button
        v-if="!readonly"
        :disabled="formLoading"
        type="primary"
        @click="submitForm"
        v-hasPermi="['cr:audit-reason:create']"
      >
        提 交
      </el-button>
      <el-button @click="dialogVisible = false">{{ readonly ? '关 闭' : '取 消' }}</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as ReasonApi from '@/api/cr/audit/reason'

defineOptions({ name: 'CrAuditReasonForm' })

const emit = defineEmits(['success'])
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('填写错误原因')
const loading = ref(false)
const formLoading = ref(false)
const formRef = ref()
const row = ref<ReasonApi.AuditReasonVO>()
const readonly = ref(false)
const formData = reactive({
  id: 0,
  reason: ''
})

const formRules = reactive({
  reason: [
    { required: true, message: '错误原因说明不能为空', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (String(value || '').trim().length < 10) {
          callback(new Error('错误原因说明至少 10 个字，请补充具体原因'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
})

const statusLabel = (status: number) =>
  status === 0 ? '待填报' : status === 1 ? '已填报' : '已确认'
const statusTagType = (status: number) =>
  status === 0 ? 'warning' : status === 1 ? 'primary' : 'success'

/** 打开弹窗：0 待填报 / 1 已填报（可修改重提）/ 2 已确认（只读） */
const open = async (data: ReasonApi.AuditReasonVO) => {
  row.value = data
  readonly.value = data.status === 2
  dialogTitle.value =
    data.status === 0 ? '填写错误原因' : data.status === 1 ? '查看 / 修改错误原因' : '查看错误原因'
  formData.id = data.id!
  formData.reason = data.reason || ''
  dialogVisible.value = true
  await nextTick()
  formRef.value?.clearValidate?.()
  // 拉取最新详情，避免列表数据过期
  loading.value = true
  try {
    const detail = await ReasonApi.getAuditReason(data.id!)
    row.value = detail
    formData.reason = detail.reason || ''
    readonly.value = detail.status === 2
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    await ReasonApi.submitAuditReason({ id: formData.id, reason: formData.reason.trim() })
    message.success('错误原因已提交，等待审核人确认')
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

defineExpose({ open })
</script>
