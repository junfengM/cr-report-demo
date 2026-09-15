<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="mb-10px"
      title="生成即写入「一键报送 — 报文上报状态」：待生成 / 已生成 / 上报失败的报文会被重新生成，已进入上报中 / 上报成功 / 已回执的报文会被跳过，避免覆盖监管已接收的文件。"
    />
    <el-descriptions v-loading="loading" :column="2" border>
      <el-descriptions-item label="报文集"
        >{{ preview?.setCode }} {{ preview?.setName }}</el-descriptions-item
      >
      <el-descriptions-item label="适用期次">{{ preview?.period }}</el-descriptions-item>
      <el-descriptions-item label="机构 × 报表">
        {{ preview?.orgCount }} 个机构 × {{ preview?.reportCount }} 张报表
      </el-descriptions-item>
      <el-descriptions-item label="本次生成文件数">
        <b class="text-[#409eff]">{{ preview?.fileCount ?? 0 }}</b> 个
      </el-descriptions-item>
      <el-descriptions-item label="新增 / 覆盖">
        {{ preview?.createCount ?? 0 }} 个新增 / {{ preview?.updateCount ?? 0 }} 个覆盖
      </el-descriptions-item>
      <el-descriptions-item label="跳过（已上报）"
        >{{ preview?.skipCount ?? 0 }} 个</el-descriptions-item
      >
      <el-descriptions-item label="预估数据行数">
        {{ (preview?.estimateRows ?? 0).toLocaleString() }} 行
      </el-descriptions-item>
      <el-descriptions-item label="预估报文大小">{{
        sizeText(preview?.estimateBytes)
      }}</el-descriptions-item>
    </el-descriptions>
    <div class="mt-10px text-[13px] text-[#606266]">
      <div><b>报送机构：</b>{{ (preview?.orgNames || []).join('、') || '-' }}</div>
      <div class="mt-5px"><b>包含报表：</b>{{ reportNames }}</div>
      <div v-if="preview?.skipNames?.length" class="mt-5px text-[#e6a23c]">
        <b>将被跳过：</b>{{ preview.skipNames.join('；') }}
        <span v-if="(preview?.skipCount ?? 0) > preview!.skipNames.length"> 等</span>
      </div>
    </div>
    <template #footer>
      <el-button :disabled="loading" type="primary" :loading="submitting" @click="submitForm">
        确认生成
      </el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as ReportSetApi from '@/api/cr/message/reportSet'

defineOptions({ name: 'CrMessageReportSetGenerateDialog' })

const message = useMessage()
const dialogVisible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const current = ref<ReportSetApi.ReportSetVO>()
const preview = ref<ReportSetApi.ReportSetPreviewVO>()

const dialogTitle = computed(() =>
  current.value ? '生成报文 - ' + current.value.setName : '生成报文'
)

const reportNames = computed(() => (preview.value?.reportNames || []).join('、') || '-')

/** 字节数可读化（与 mock 层 fileSizeText 同口径） */
const sizeText = (bytes?: number) => {
  const value = Number(bytes || 0)
  if (value >= 1024 * 1024) return (value / 1024 / 1024).toFixed(2) + ' MB'
  if (value >= 1024) return (value / 1024).toFixed(2) + ' KB'
  return value + ' B'
}

/** 打开弹窗 */
const open = async (row: ReportSetApi.ReportSetVO) => {
  current.value = row
  dialogVisible.value = true
  preview.value = undefined
  loading.value = true
  try {
    preview.value = await ReportSetApi.getReportSetPreview(row.id!)
  } finally {
    loading.value = false
  }
}
defineExpose({ open })

/** 执行生成 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  if (!current.value) return
  submitting.value = true
  try {
    const result = await ReportSetApi.generateReportSet(current.value.id!)
    message.success(
      '已生成 ' +
        result.fileCount +
        ' 个报文（新增 ' +
        result.created +
        ' / 覆盖 ' +
        result.updated +
        '），跳过 ' +
        result.skipped +
        ' 个已上报报文，可在「报文状态查询」中查看'
    )
    dialogVisible.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}
</script>
