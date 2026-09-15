<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <div v-loading="loading" class="min-h-120px">
      <template v-if="detail">
        <el-alert
          class="mb-12px"
          :type="detail.status === 3 ? 'error' : detail.status === 2 ? 'success' : 'info'"
          :closable="false"
          show-icon
          :title="'校验结论：' + statusLabel(detail.status)"
          :description="detail.checkMessage || '（接口未返回校验结论）'"
        />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="文件名">{{ detail.fileName }}</el-descriptions-item>
          <el-descriptions-item label="来源系统">
            {{ detail.sysName }}（{{ detail.sysCode }}）
          </el-descriptions-item>
          <el-descriptions-item label="业务类型">{{
            bizTypeLabel(detail.bizType)
          }}</el-descriptions-item>
          <el-descriptions-item label="扩展名">{{ detail.fileExt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{
            formatFileSize(detail.fileSize)
          }}</el-descriptions-item>
          <el-descriptions-item label="接收时间">{{
            detail.uploadTime || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="上传人">{{ detail.uploadUser || '-' }}</el-descriptions-item>
          <el-descriptions-item label="内容指纹">
            {{ detail.contentHash || '（未登记）' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{
            detail.remark || '-'
          }}</el-descriptions-item>
        </el-descriptions>
        <div class="mt-8px text-12px text-gray-500">
          内容指纹是演示用的轻量哈希（不是 MD5 /
          国密），只用来对照两次接收的内容是否一致；校验失败的附件不保存内容，因此没有指纹、也无法下载。
        </div>
      </template>
      <el-empty v-else-if="!loading" description="附件不存在或已被删除" />
    </div>
    <template #footer>
      <el-button
        v-if="detail"
        type="primary"
        :loading="downloading"
        @click="handleDownload"
        v-hasPermi="['cr:integration-attachment:query']"
      >
        <Icon icon="ep:download" class="mr-5px" /> 下 载
      </el-button>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import download from '@/utils/download'
import { formatFileSize } from '@/utils/file'
import * as IntegrationAttachmentApi from '@/api/cr/integration/attachment'

defineOptions({ name: 'CrIntegrationAttachmentDetailDialog' })

const props = defineProps<{ meta?: IntegrationAttachmentApi.AttachmentMetaVO | null }>()

const message = useMessage()

const dialogVisible = ref(false)
const loading = ref(false)
const downloading = ref(false)
const detail = ref<IntegrationAttachmentApi.IntegrationAttachmentVO | null>(null)
const dialogTitle = ref('附件详情')
const meta = ref<IntegrationAttachmentApi.AttachmentMetaVO | null>(null)

const statusLabel = (value?: number) => {
  if (Number(value) === 1) return '已接收'
  if (Number(value) === 2) return '校验通过'
  if (Number(value) === 3) return '校验失败'
  return String(value === undefined || value === null ? '-' : value)
}

const bizTypeLabel = (value?: number) => {
  const list = (meta.value && meta.value.bizTypes) || []
  const hit = list.find((item) => item.value === Number(value))
  return hit ? hit.label : String(value === undefined || value === null ? '-' : value)
}

/** 打开详情：按 id 回读，保证看到的是最新校验结论 */
const open = async (id: number) => {
  dialogVisible.value = true
  dialogTitle.value = '附件详情'
  detail.value = null
  loading.value = true
  try {
    const data = await IntegrationAttachmentApi.getDetail(id)
    detail.value = data
    if (data && data.fileName) dialogTitle.value = '附件详情：' + data.fileName
    if (!meta.value && props.meta) meta.value = props.meta
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  } finally {
    loading.value = false
  }
}
defineExpose({ open })

/** data URL → Blob：落盘交给项目统一的 download.file，不自己造 a 标签逻辑 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const comma = dataUrl.indexOf(',')
  const head = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const mimeHit = head.match(/:(.*?);/)
  const mime = mimeHit ? mimeHit[1] : 'application/octet-stream'
  const binary = atob(comma >= 0 ? dataUrl.slice(comma + 1) : '')
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new Blob([bytes.buffer as ArrayBuffer], { type: mime })
}

/** 下载：校验失败 / 无内容的附件由接口抛中文错，交给全局提示接住 */
const handleDownload = async () => {
  if (!detail.value) return
  downloading.value = true
  try {
    const data = await IntegrationAttachmentApi.getAttachmentContent(detail.value.id as number)
    const fileName = (data && data.fileName) || detail.value.fileName
    download.file(dataUrlToBlob(String((data && data.content) || '')), fileName)
    message.success('已开始下载：' + fileName)
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  } finally {
    downloading.value = false
  }
}
</script>
