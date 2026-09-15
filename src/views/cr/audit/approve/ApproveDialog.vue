<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="1080">
    <el-alert
      v-if="batch && batch.auditStatus !== 0"
      type="info"
      :closable="false"
      show-icon
      title="该批次已完成审核，以下为审核时的批次概要与脱敏明细，仅供查看。"
      class="mb-12px"
    />
    <el-alert
      v-else-if="batch && batch.submitStatus !== 2"
      type="warning"
      :closable="false"
      show-icon
      title="该批次尚在填报中（未提交），需填报机构提交后才能审核，当前可先核对脱敏明细。"
      class="mb-12px"
    />
    <el-descriptions
      v-if="batch"
      v-loading="loading"
      :column="3"
      border
      size="small"
      label-width="90px"
      class="mb-14px"
    >
      <el-descriptions-item label="批次号">{{ batch.batchNo }}</el-descriptions-item>
      <el-descriptions-item label="机构">{{ batch.orgName }}</el-descriptions-item>
      <el-descriptions-item label="报送期次">{{ batch.period }}</el-descriptions-item>
      <el-descriptions-item label="报表名称" :span="2">
        {{ batch.reportCode }} {{ batch.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="数据行数">{{ batch.rowCount }} 行</el-descriptions-item>
      <el-descriptions-item label="校验情况" :span="3">
        <el-tag type="success" disable-transitions>通过 {{ batch.passCount }}</el-tag>
        <el-tag type="warning" class="ml-6px" disable-transitions
          >警告 {{ batch.warnCount }}</el-tag
        >
        <el-tag type="danger" class="ml-6px" disable-transitions
          >错误 {{ batch.errorCount }}</el-tag
        >
        <span class="ml-8px text-12px text-[#909399]">
          错误级问题阻断上报，必须整改或说明后才能审核通过
        </span>
      </el-descriptions-item>
      <el-descriptions-item label="报送状态">
        <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="batch.submitStatus" />
      </el-descriptions-item>
      <el-descriptions-item label="提交时间">{{ batch.submitTime }}</el-descriptions-item>
      <el-descriptions-item label="提交人">{{ batch.submitUser || '-' }}</el-descriptions-item>
      <el-descriptions-item label="审核结论">
        <dict-tag :type="DICT_TYPE.CR_AUDIT_STATUS" :value="batch.auditStatus" />
      </el-descriptions-item>
      <el-descriptions-item label="审核人">{{ batch.auditor || '-' }}</el-descriptions-item>
      <el-descriptions-item label="审核时间">{{ batch.auditTime || '-' }}</el-descriptions-item>
      <el-descriptions-item v-if="batch.auditOpinion" label="审核意见" :span="3">
        {{ batch.auditOpinion }}
      </el-descriptions-item>
    </el-descriptions>

    <!-- 数据明细：审核人看到的敏感字段均为脱敏后的值 -->
    <div class="mb-8px flex items-center justify-between">
      <span class="font-bold">数据明细（脱敏后）</span>
      <span class="text-12px text-[#909399]">
        共 {{ detailList.length }} 行，其中问题行 {{ issueRowCount }} 行（错误 {{ errorRowCount }} /
        警告 {{ warnRowCount }}），问题行已高亮；个人敏感字段按脱敏规则展示
      </span>
    </div>
    <el-table
      v-loading="loading"
      :data="detailList"
      :row-class-name="rowClassName"
      max-height="330"
      size="small"
      border
    >
      <el-table-column label="行号" align="center" prop="rowNo" width="80" />
      <el-table-column label="保单号" align="center" prop="policyNo" width="130" />
      <el-table-column label="投保人名称" align="center" prop="holderName" width="110" />
      <el-table-column label="证件号码" align="center" prop="certNo" width="170" />
      <el-table-column label="手机号码" align="center" prop="mobile" width="120" />
      <el-table-column label="保险金额（元）" align="right" prop="sumAssured" width="140">
        <template #default="scope">{{ money(scope.row.sumAssured) }}</template>
      </el-table-column>
      <el-table-column label="保费金额（元）" align="right" prop="premium" width="130">
        <template #default="scope">{{ money(scope.row.premium) }}</template>
      </el-table-column>
      <el-table-column label="生效日期" align="center" prop="effectDate" width="110" />
      <el-table-column label="校验问题" align="left" prop="issueMessage" min-width="240">
        <template #default="scope">
          <el-tag
            v-if="scope.row.issueLevel"
            :type="levelTag(scope.row.issueLevel)"
            size="small"
            disable-transitions
          >
            {{ levelLabel(scope.row.issueLevel) }}
          </el-tag>
          <span :class="scope.row.issueLevel === 2 ? 'ml-6px text-[#f56c6c]' : 'ml-6px'">
            {{ scope.row.issueMessage || '校验通过' }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 审核结论 -->
    <el-form
      v-if="!readonly"
      ref="formRef"
      v-loading="loading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
      class="mt-16px"
    >
      <el-form-item label="审核结论" prop="auditStatus">
        <el-radio-group v-model="formData.auditStatus">
          <el-radio :value="1">审核通过</el-radio>
          <el-radio :value="2">审核不通过</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="审核意见" prop="opinion">
        <el-input
          v-model="formData.opinion"
          type="textarea"
          :rows="3"
          maxlength="300"
          show-word-limit
          :placeholder="
            formData.auditStatus === 2
              ? '审核不通过必须填写意见：请说明退回原因与整改要求'
              : '可选：补充审核说明'
          "
        />
      </el-form-item>
      <el-form-item label="快捷意见">
        <el-select
          v-model="quickOpinion"
          placeholder="选择常用意见快速填充"
          clearable
          class="w-full"
          @change="handleQuickOpinion"
        >
          <el-option v-for="item in quickOpinions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button
        v-if="!readonly"
        :disabled="formLoading"
        type="primary"
        @click="submitAudit"
        v-hasPermi="['cr:audit-approve:pass']"
      >
        提交审核
      </el-button>
      <el-button @click="dialogVisible = false">{{ readonly ? '关 闭' : '取 消' }}</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as ApproveApi from '@/api/cr/audit/approve'

defineOptions({ name: 'CrAuditApproveDialog' })

const emit = defineEmits(['success'])
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('数据审核')
const loading = ref(false)
const formLoading = ref(false)
const formRef = ref()
const batch = ref<ApproveApi.AuditApproveVO>()
/** 已完成审核或尚未提交的批次只能查看 */
const readonly = computed(
  () => !batch.value || batch.value.auditStatus !== 0 || batch.value.submitStatus !== 2
)
const detailList = ref<ApproveApi.AuditApproveDetailVO[]>([])
const formData = reactive({
  auditStatus: 1,
  opinion: ''
})
const quickOpinion = ref('')
const quickOpinions = [
  '数据完整、勾稽关系核对无误，同意通过并进入上报环节。',
  '校验告警已由填报机构说明原因，同意通过。',
  '存在错误级校验问题（证件号码校验位不正确），退回填报机构核实后重新报送。',
  '保费金额存在负值，退回填报机构修正后重报。',
  '个人敏感字段脱敏不完整，请按脱敏规则处理后重新报送。'
]

const formRules = reactive({
  opinion: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (formData.auditStatus === 2 && !String(value || '').trim()) {
          callback(new Error('审核不通过必须填写审核意见'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
})

const issueRowCount = computed(() => detailList.value.filter((row) => row.issueLevel > 0).length)
const errorRowCount = computed(() => detailList.value.filter((row) => row.issueLevel === 2).length)
const warnRowCount = computed(() => detailList.value.filter((row) => row.issueLevel === 1).length)

const money = (value?: number) =>
  value === undefined || value === null
    ? '-'
    : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const levelLabel = (level: number) => (level === 2 ? '错误' : level === 1 ? '警告' : '正常')
const levelTag = (level: number) => (level === 2 ? 'danger' : level === 1 ? 'warning' : 'info')
/** 问题行高亮：错误红色底、警告黄色底 */
const rowClassName = ({ row }: { row: ApproveApi.AuditApproveDetailVO }) =>
  row.issueLevel === 2 ? 'row-error' : row.issueLevel === 1 ? 'row-warning' : ''

const handleQuickOpinion = (value: string) => {
  if (value) formData.opinion = value
}

/** 打开审核面板 */
const open = async (row: ApproveApi.AuditApproveVO) => {
  batch.value = row
  dialogTitle.value = row.auditStatus !== 0 ? '查看审核批次' : '数据审核'
  detailList.value = []
  formData.auditStatus = 1
  formData.opinion = ''
  quickOpinion.value = ''
  dialogVisible.value = true
  loading.value = true
  try {
    const [detail, list] = await Promise.all([
      ApproveApi.getAuditApprove(row.id!),
      ApproveApi.getAuditApproveDetail(row.id!)
    ])
    batch.value = detail
    detailList.value = list || []
  } finally {
    loading.value = false
  }
  await nextTick()
  formRef.value?.clearValidate?.()
}

/** 提交审核：通过 / 不通过 */
const submitAudit = async () => {
  await formRef.value.validate()
  const id = batch.value?.id
  if (!id) return
  formLoading.value = true
  try {
    if (formData.auditStatus === 2) {
      await ApproveApi.rejectAuditApprove([id], formData.opinion.trim())
      message.success('已提交审核不通过，数据已退回填报机构')
    } else {
      await ApproveApi.passAuditApprove([id], formData.opinion.trim())
      message.success('已提交审核通过')
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
:deep(.row-warning) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}

:deep(.row-error) {
  --el-table-tr-bg-color: var(--el-color-danger-light-9);
}
</style>
