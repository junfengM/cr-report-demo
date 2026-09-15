<template>
  <Dialog v-model="dialogVisible" :title="title" width="760">
    <div v-loading="loading">
      <el-descriptions v-if="detail" :column="2" size="small" border>
        <el-descriptions-item label="提醒规则">{{ detail.ruleName }}</el-descriptions-item>
        <el-descriptions-item label="触发场景">
          {{ detail.sceneLabel || labelOf(meta.scenes, detail.scene) }}
        </el-descriptions-item>
        <el-descriptions-item label="接收人">{{ detail.receiverName }}</el-descriptions-item>
        <el-descriptions-item label="推送渠道">
          {{ labelOf(meta.channels, detail.channel) }}
        </el-descriptions-item>
        <el-descriptions-item label="发送时间">{{ detail.sendTime }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{
            statusLabel(detail.status)
          }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联单据">{{ detail.bizKey || '—' }}</el-descriptions-item>
        <el-descriptions-item label="生成方式">
          <el-tag :type="detail.seeded ? 'info' : 'success'" size="small" effect="plain">
            {{ detail.seeded ? '历史留痕（种子数据）' : '由立即执行生成' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提醒标题" :span="2">{{ detail.title }}</el-descriptions-item>
        <el-descriptions-item label="提醒内容" :span="2">
          <div class="whitespace-pre-wrap">{{ detail.content }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{
          detail.remark || '—'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else-if="!loading" description="提醒记录不存在或已被删除" />
    </div>
    <template #footer>
      <el-button
        v-if="detail"
        type="warning"
        :loading="resendLoading"
        @click="handleResend"
        v-hasPermi="['cr:remind-log:resend']"
      >
        重 发
      </el-button>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import * as RemindLogApi from '@/api/cr/remind/log'
import * as RemindRuleApi from '@/api/cr/remind/rule'

defineOptions({ name: 'CrRemindLogDetailDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const loading = ref(false)
const resendLoading = ref(false)
const detail = ref<RemindLogApi.RemindLogVO | null>(null)
const meta = reactive<RemindRuleApi.RemindMetaVO>({
  scenes: [],
  channels: [],
  statuses: [],
  roles: [],
  users: [],
  today: ''
})
const title = computed(() => (detail.value?.title ? '提醒详情：' + detail.value.title : '提醒详情'))

const labelOf = (
  options: Array<{ value: number | string; label: string }>,
  value?: number | string
) => {
  const hit = options.find((item) => String(item.value) === String(value))
  return hit ? hit.label : '—'
}

const statusLabel = (status?: number) => labelOf(meta.statuses, status)
const statusTagType = (status?: number) => {
  if (Number(status) === 3) return 'danger'
  if (Number(status) === 2) return 'success'
  return 'info'
}

/** 打开详情 */
const emit = defineEmits(['success'])
const open = async (id: number) => {
  dialogVisible.value = true
  detail.value = null
  loading.value = true
  try {
    if (!meta.statuses.length) {
      const remindMeta = await RemindRuleApi.getRemindMeta()
      meta.scenes = remindMeta.scenes || []
      meta.channels = remindMeta.channels || []
      meta.statuses = remindMeta.statuses || []
    }
    detail.value = await RemindLogApi.getDetail(id)
  } finally {
    loading.value = false
  }
}
defineExpose({ open })

/** 重发：追加一条新记录，历史记录不动，成功后让列表刷新 */
const handleResend = async () => {
  if (!detail.value?.id) return
  try {
    await message.confirm(
      '将向「' +
        detail.value.receiverName +
        '」重发这条提醒（渠道 ' +
        labelOf(meta.channels, detail.value.channel) +
        '），会追加一条新记录、历史记录不变。确认重发？'
    )
  } catch {
    return
  }
  resendLoading.value = true
  try {
    const res = await RemindLogApi.resendRemindLog(detail.value.id)
    message.success(res.message || '已重发')
    emit('success')
  } finally {
    resendLoading.value = false
  }
}
</script>
