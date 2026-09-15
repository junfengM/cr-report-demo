<template>
  <el-dialog v-model="dialogVisible" :title="title" width="820px" append-to-body>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="演示环境没有独立的文件服务：文件内容以 data URL 存进浏览器本地库，所以下载拿到的是真实内容。单文件不超过 1MB，一个申请最多 3 个附件；只有「待审核 / 已驳回」的申请能增删附件。"
    />

    <div class="mb-10px">
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
        accept=".csv,.txt,.xlsx,.xls,.doc,.docx,.pdf,.png,.jpg,.jpeg"
      >
        <el-button
          type="primary"
          plain
          :loading="uploading"
          :disabled="!editable"
          v-hasPermi="['cr:collect-supplement:upload-file']"
        >
          <Icon icon="ep:upload" class="mr-5px" /> 选择文件上传
        </el-button>
      </el-upload>
      <span class="ml-10px text-12px text-gray-500">
        支持 csv / txt / xlsx / xls / doc / docx / pdf / png / jpg / jpeg，单文件 ≤ 1MB
      </span>
    </div>
    <el-alert
      v-if="!editable"
      class="mb-10px"
      type="warning"
      :closable="false"
      show-icon
      title="该申请当前状态不允许增删附件：只有「待审核 / 已驳回」的申请可以维护附件，已通过 / 已补录的申请只能查看和下载。"
    />

    <el-table v-loading="loading" :data="files" size="small" border max-height="320">
      <el-table-column label="文件名" prop="fileName" min-width="240" show-overflow-tooltip />
      <el-table-column label="大小" align="center" width="100">
        <template #default="scope">{{ formatSize(scope.row.fileSize) }}</template>
      </el-table-column>
      <el-table-column label="上传人" align="center" prop="uploadUser" width="110" />
      <el-table-column label="上传时间" align="center" prop="uploadTime" width="170" />
      <el-table-column label="操作" align="center" width="190" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="handlePreview(scope.row)"
            v-hasPermi="['cr:collect-supplement:query']"
            >预览</el-button
          >
          <el-button
            link
            type="primary"
            @click="handleDownload(scope.row)"
            v-hasPermi="['cr:collect-supplement:download-file']"
            >下载</el-button
          >
          <el-button
            link
            type="danger"
            :disabled="!editable"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:collect-supplement:delete-file']"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <div class="mt-6px text-12px text-gray-500">
      共 {{ files.length }} / {{ MAX_FILE_COUNT }} 个附件{{
        files.length ? '' : '（还没有上传附件）'
      }}
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </el-dialog>

  <!-- 预览：图片直接给 img，文本类（csv / txt）解码后用 pre 展示，其它类型引导下载 -->
  <el-dialog
    v-model="previewVisible"
    :title="'附件预览：' + (previewFile?.fileName || '')"
    width="760px"
    append-to-body
  >
    <div v-loading="previewLoading" class="min-h-120px">
      <el-image v-if="previewImage" :src="previewImage" fit="contain" class="max-h-520px w-full" />
      <pre
        v-else-if="previewText !== ''"
        class="max-h-520px overflow-auto whitespace-pre-wrap break-all bg-[var(--el-fill-color-light)] p-10px text-12px m-0"
        >{{ previewText }}</pre
      >
      <el-empty v-else :description="previewTip" />
    </div>
    <template #footer>
      <el-button
        v-if="previewFile"
        @click="handleDownload(previewFile)"
        v-hasPermi="['cr:collect-supplement:download-file']"
        >下 载</el-button
      >
      <el-button @click="previewVisible = false">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import * as SupplementApi from '@/api/cr/collect/supplement'

defineOptions({ name: 'SupplementFileDialog' })

const emit = defineEmits(['file-count'])
const message = useMessage()

/** 与服务端校验口径保持一致，先在客户端拦一道，省得白跑一趟 */
const MAX_FILE_SIZE = 1024 * 1024
const MAX_FILE_COUNT = 3
const ALLOW_FILE_EXTS = ['csv', 'txt', 'xlsx', 'xls', 'doc', 'docx', 'pdf', 'png', 'jpg', 'jpeg']
/** 能在线预览的扩展名 */
const TEXT_EXTS = ['csv', 'txt']
const IMAGE_EXTS = ['png', 'jpg', 'jpeg']

const dialogVisible = ref(false)
const loading = ref(false)
const uploading = ref(false)
const supplementId = ref(0)
const applyNo = ref('')
const files = ref<SupplementApi.SupplementFileVO[]>([])
const uploadRef = ref()

const previewVisible = ref(false)
const previewLoading = ref(false)
const previewFile = ref<SupplementApi.SupplementFileVO | null>(null)
const previewImage = ref('')
const previewText = ref('')
const previewTip = ref('')

const title = computed(() => '补录附件' + (applyNo.value ? '：' + applyNo.value : ''))
/** 待审核（1）/ 已驳回（3）才允许增删附件，与服务端一致 */
const editable = ref(true)

/** 打开弹窗：applyNo 只用于标题，editable 由列表行状态决定 */
const open = async (id: number, no?: string, canEdit?: boolean) => {
  dialogVisible.value = true
  supplementId.value = id
  applyNo.value = no || ''
  editable.value = canEdit !== false
  files.value = []
  await loadFiles()
}
defineExpose({ open })

const loadFiles = async () => {
  if (!supplementId.value) return
  loading.value = true
  try {
    files.value = (await SupplementApi.getSupplementFileList(supplementId.value)) || []
  } finally {
    loading.value = false
  }
  emit('file-count', { supplementId: supplementId.value, count: files.value.length })
}

const formatSize = (bytes: number) => {
  const size = Number(bytes) || 0
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(2) + ' MB'
}

/**
 * 选中文件：el-upload 是 auto-upload=false，这里拿原始 File
 * → FileReader 读成 data URL → 调上传接口。读之前先做客户端预检。
 */
const handleFileChange = async (uploadFile: any) => {
  const raw: File | undefined = uploadFile?.raw
  try {
    if (!raw) return
    if (!editable.value) {
      message.warning('该申请当前状态不允许增删附件（只有待审核 / 已驳回的申请可以）')
      return
    }
    const ext = (raw.name.split('.').pop() || '').toLowerCase()
    if (ALLOW_FILE_EXTS.indexOf(ext) < 0) {
      message.warning('不支持的附件类型 .' + ext + '，仅支持 ' + ALLOW_FILE_EXTS.join(' / '))
      return
    }
    if (raw.size > MAX_FILE_SIZE) {
      message.warning(
        '附件 ' +
          raw.name +
          ' 有 ' +
          (raw.size / 1024 / 1024).toFixed(2) +
          'MB，超过演示环境单文件上限 ' +
          MAX_FILE_SIZE / 1024 / 1024 +
          'MB（真实系统上限由文件服务决定）'
      )
      return
    }
    if (files.value.length >= MAX_FILE_COUNT) {
      message.warning('一个补录申请最多上传 ' + MAX_FILE_COUNT + ' 个附件，请先删除不再需要的附件')
      return
    }
    if (files.value.some((row) => row.fileName === raw.name)) {
      message.warning('附件 ' + raw.name + ' 已上传，请勿重复提交')
      return
    }
    const content = await readFileAsDataUrl(raw)
    if (!content) {
      message.warning('附件内容读取失败，请重新选择文件')
      return
    }
    uploading.value = true
    await SupplementApi.uploadSupplementFile({
      supplementId: supplementId.value,
      fileName: raw.name,
      fileSize: raw.size,
      content
    })
    message.success('附件 ' + raw.name + ' 上传成功')
    await loadFiles()
  } catch {
    // 业务失败（超过 1MB / 状态不允许 / 同名重复等）已由 axios 拦截器统一 toast，
    // 这里只负责吞掉 rejected promise，别让它冒到 el-upload 的 change 回调外面。
  } finally {
    uploading.value = false
    // 同一个文件再选一次也要能触发 change
    const input = uploadRef.value?.$el?.querySelector('input[type=file]')
    if (input) input.value = ''
  }
}

/** FileReader 读 data URL（后端要的是 data:xxx;base64,... 这种格式） */
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/** 下载：拿 file-content 的 data URL，用 <a download> 存成真实文件名 */
const handleDownload = async (row: SupplementApi.SupplementFileVO) => {
  const dataUrl = await fetchContent(row.id)
  if (!dataUrl) return
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = row.fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  message.success('已开始下载：' + row.fileName)
}

/** 预览：图片给 img，csv / txt 按 base64 → Uint8Array → TextDecoder 解文本，其它类型引导下载 */
const handlePreview = async (row: SupplementApi.SupplementFileVO) => {
  previewFile.value = row
  previewImage.value = ''
  previewText.value = ''
  previewTip.value = ''
  previewVisible.value = true
  const ext = (row.fileExt || row.fileName.split('.').pop() || '').toLowerCase()
  if (IMAGE_EXTS.indexOf(ext) < 0 && TEXT_EXTS.indexOf(ext) < 0) {
    previewTip.value = '该类型不支持在线预览，请下载后查看'
    return
  }
  previewLoading.value = true
  try {
    const dataUrl = await fetchContent(row.id)
    if (!dataUrl) return
    if (IMAGE_EXTS.indexOf(ext) >= 0) {
      previewImage.value = dataUrl
    } else {
      previewText.value = decodeDataUrlText(dataUrl)
    }
  } finally {
    previewLoading.value = false
  }
}

/** 取附件内容：顺便把「已被删除」之类的失败情况挡掉，避免后面拿空串解析 */
const fetchContent = async (id: number): Promise<string> => {
  try {
    const row = await SupplementApi.getSupplementFileContent(id)
    const content = String(row?.content || '')
    if (content.indexOf('data:') !== 0) {
      message.warning('附件内容读取失败，请重新上传')
      return ''
    }
    return content
  } catch {
    // 业务错误已由拦截器统一提示
    return ''
  }
}

/**
 * data URL → 文本。
 * 注意：中文必须走 TextDecoder 解 Uint8Array，直接 atob 当字符串用会乱码。
 */
const decodeDataUrlText = (dataUrl: string): string => {
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return '（内容解码失败，请下载后查看）'
  }
}

const handleDelete = async (row: SupplementApi.SupplementFileVO) => {
  try {
    await message.delConfirm('确认删除附件 ' + row.fileName + ' ？删除后附件内容不可恢复。')
  } catch {
    return
  }
  try {
    const result = await SupplementApi.deleteSupplementFile(row.id)
    message.success('附件 ' + row.fileName + ' 已删除，剩余 ' + (result?.remain ?? 0) + ' 个')
    await loadFiles()
  } catch {}
}
</script>
