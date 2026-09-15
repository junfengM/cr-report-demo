<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-alert class="mb-10px" type="info" :closable="false" show-icon :title="tip" />
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="来源系统" prop="sysCode">
            <el-select
              v-model="formData.sysCode"
              placeholder="请选择接入系统"
              filterable
              class="w-full"
            >
              <el-option
                v-for="item in systemOptions"
                :key="item.sysCode"
                :label="item.sysName + '（' + item.sysCode + '）'"
                :value="item.sysCode"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="业务类型" prop="bizType">
            <el-select v-model="formData.bizType" placeholder="请选择业务类型" class="w-full">
              <el-option
                v-for="item in bizTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="选择文件">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="false"
          :accept="accept"
          :on-change="handleFileChange"
        >
          <el-button type="primary" plain :loading="uploading">
            <Icon icon="ep:upload" class="mr-5px" /> 选择本地文件并接收
          </el-button>
        </el-upload>
        <span class="ml-10px text-12px text-gray-500"
          >支持 {{ exts.join(' / ') }}，单文件 ≤ {{ maxSizeText }}</span
        >
      </el-form-item>

      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 监管方回执，含 1 条 FAIL"
        />
      </el-form-item>

      <!-- 上传结论：校验失败也是「正常返回」，这里如实展示 statusLabel + checkMessage -->
      <el-alert
        v-if="result"
        :type="result.status === 3 ? 'error' : 'success'"
        :closable="false"
        show-icon
        :title="'接收结果：' + result.statusLabel"
      >
        <div class="text-13px leading-22px">
          <div>{{ result.checkMessage }}</div>
          <div>内容指纹：{{ result.contentHash || '（校验未通过，未登记）' }}</div>
        </div>
      </el-alert>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { formatFileSize } from '@/utils/file'
import * as IntegrationAttachmentApi from '@/api/cr/integration/attachment'
import * as IntegrationSystemApi from '@/api/cr/integration/system'

defineOptions({ name: 'CrIntegrationAttachmentUploadDialog' })

/** 口径由列表页传入（同一份 meta），避免每开一次弹窗重复请求 */
const props = defineProps<{ meta?: IntegrationAttachmentApi.AttachmentMetaVO | null }>()

const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('接收附件')
const formLoading = ref(false)
const uploading = ref(false)
const formRef = ref()
const uploadRef = ref()
const result = ref<IntegrationAttachmentApi.AttachmentUploadVO | null>(null)
const meta = ref<IntegrationAttachmentApi.AttachmentMetaVO | null>(null)
const systemOptions = ref<any[]>([])

const bizTypes = computed(() => (meta.value && meta.value.bizTypes) || [])
/** 白名单与大小上限都来自 meta 接口，页面不写死 */
const exts = computed(() => (meta.value && meta.value.exts) || [])
const accept = computed(() => exts.value.map((ext) => '.' + ext).join(','))
const maxSize = computed(() => (meta.value && meta.value.maxSize) || 1024 * 1024)
const maxSizeText = computed(() => {
  const bytes = maxSize.value
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? Math.round(mb * 100) / 100 + 'MB' : Math.round(bytes / 1024) + 'KB'
})
const tip = computed(
  () =>
    '内容读成 data URL 后交给服务端（演示环境没有独立文件服务，内容存在浏览器本地库）。' +
    '扩展名不在白名单（' +
    exts.value.join(' / ') +
    '）或超过 ' +
    maxSizeText.value +
    ' 会在本地先拦下；服务端校验失败时只登记信息、不保存内容。'
)

const defaultForm = () => ({
  sysCode: undefined as string | undefined,
  bizType: undefined as number | undefined,
  remark: ''
})

const formData = ref(defaultForm())

const formRules = reactive({
  sysCode: [{ required: true, message: '请选择来源系统', trigger: 'change' }],
  bizType: [{ required: true, message: '请选择业务类型', trigger: 'change' }]
})

/** 打开弹窗：口径与下拉按需拉取（列表页已经拉过就直接用） */
const open = async () => {
  dialogVisible.value = true
  result.value = null
  formData.value = defaultForm()
  formRef.value?.resetFields()
  if (!meta.value || !exts.value.length) {
    meta.value = props.meta || (await IntegrationAttachmentApi.getAttachmentMeta())
  }
  if (!systemOptions.value.length) {
    systemOptions.value = (await IntegrationSystemApi.getSystemOptions()) || []
  }
  // 业务类型默认第一项，省一次点击；来源系统不预设，避免把文件记到错的系统上
  if (!formData.value.bizType && bizTypes.value.length)
    formData.value.bizType = bizTypes.value[0].value
}
defineExpose({ open })

/** FileReader 读 data URL（服务端要的就是 data:xxx;base64,... 这种格式） */
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/**
 * 选中文件：先按 meta 口径本地预检（扩展名白名单 / 单文件大小），
 * 再读成 data URL 调接收接口。接口正常返回哪怕结论是校验失败，也如实展示。
 */
const handleFileChange = async (uploadFile: any) => {
  const raw: File | undefined = uploadFile?.raw
  try {
    if (!raw) return
    if (!formData.value.sysCode) {
      message.warning('请先选择来源系统')
      return
    }
    if (!formData.value.bizType) {
      message.warning('请先选择业务类型')
      return
    }
    const ext = (raw.name.split('.').pop() || '').toLowerCase()
    if (exts.value.indexOf(ext) < 0) {
      message.warning('不支持的附件类型 .' + ext + '，仅支持 ' + exts.value.join(' / '))
      return
    }
    if (raw.size > maxSize.value) {
      message.warning(
        '单文件不能超过 ' + maxSizeText.value + '（当前文件 ' + formatFileSize(raw.size) + '）'
      )
      return
    }
    const content = await readFileAsDataUrl(raw)
    if (!content) {
      message.warning('文件内容读取失败，请重新选择文件')
      return
    }
    uploading.value = true
    const data = await IntegrationAttachmentApi.uploadAttachment({
      sysCode: formData.value.sysCode,
      fileName: raw.name,
      bizType: formData.value.bizType,
      content,
      fileSize: raw.size,
      remark: formData.value.remark
    })
    result.value = data
    // 结论文案：避免「校验通过：校验通过：…」这种重复前缀
    const text = data.checkMessage || ''
    const resultText = text.indexOf(data.statusLabel) === 0 ? text : data.statusLabel + '：' + text
    if (Number(data.status) === 3) {
      message.warning(resultText)
    } else {
      message.success(resultText)
    }
    emit('success')
  } catch {
    // 服务端中文原因（系统不存在 / 超过 1MB / 缺少文件名）已由 axios 拦截器统一提示
  } finally {
    uploading.value = false
    // 同一个文件再选一次也要能触发 change
    const input = uploadRef.value?.$el?.querySelector('input[type=file]')
    if (input) input.value = ''
  }
}

const emit = defineEmits(['success'])
</script>
