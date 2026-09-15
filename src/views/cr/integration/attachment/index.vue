<template>
  <ContentWrap title="接入附件">
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="文件名 / 来源系统 / 上传人 / 校验结论"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="来源系统" prop="sysCode">
        <el-select
          v-model="queryParams.sysCode"
          placeholder="请选择来源系统"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="item in systemOptions"
            :key="item.sysCode"
            :label="item.sysName + '（' + item.sysCode + '）'"
            :value="item.sysCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="业务类型" prop="bizType">
        <el-select
          v-model="queryParams.bizType"
          placeholder="请选择业务类型"
          clearable
          class="!w-170px"
        >
          <el-option
            v-for="item in bizTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-150px">
          <el-option
            v-for="item in STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:integration-attachment:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openUpload"
          v-hasPermi="['cr:integration-attachment:upload']"
        >
          <Icon icon="ep:upload" class="mr-5px" /> 接收附件
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:integration-attachment:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:integration-attachment:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert class="mb-10px" type="info" :closable="false" show-icon :title="alertTitle" />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="文件名"
        align="left"
        prop="fileName"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column
        label="来源系统"
        align="left"
        prop="sysName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="业务类型" align="center" prop="bizType" width="100">
        <template #default="scope">{{ bizTypeLabel(scope.row.bizType) }}</template>
      </el-table-column>
      <el-table-column label="扩展名" align="center" prop="fileExt" width="80" />
      <el-table-column label="大小" align="right" prop="fileSize" width="100">
        <template #default="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
      </el-table-column>
      <el-table-column label="接收时间" align="center" prop="uploadTime" width="170" />
      <el-table-column label="内容指纹" align="center" prop="contentHash" width="110">
        <template #default="scope">
          <span>{{ scope.row.contentHash || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="95">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.status)" size="small" disable-transitions>
            {{ statusLabel(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="校验结论"
        align="left"
        prop="checkMessage"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="240" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:integration-attachment:query']"
          >
            详情
          </el-button>
          <el-button
            link
            type="primary"
            @click="handleDownload(scope.row)"
            v-hasPermi="['cr:integration-attachment:query']"
          >
            下载
          </el-button>
          <el-button
            link
            type="warning"
            :loading="recheckId === scope.row.id"
            @click="handleRecheck(scope.row)"
            v-hasPermi="['cr:integration-attachment:recheck']"
          >
            重新校验
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:integration-attachment:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页组件 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 接收附件弹窗 -->
  <AttachmentUploadDialog ref="uploadRef" :meta="meta" @success="getList" />
  <!-- 详情弹窗（含校验结论与下载） -->
  <AttachmentDetailDialog ref="detailRef" :meta="meta" />
</template>

<script setup lang="ts">
import download from '@/utils/download'
import { formatFileSize } from '@/utils/file'
import * as IntegrationAttachmentApi from '@/api/cr/integration/attachment'
import * as IntegrationSystemApi from '@/api/cr/integration/system'
import AttachmentUploadDialog from './AttachmentUploadDialog.vue'
import AttachmentDetailDialog from './AttachmentDetailDialog.vue'

defineOptions({ name: 'CrIntegrationAttachment' })

const message = useMessage()
const { t } = useI18n()

/** 校验状态口径（与 mock ATTACH_STATUS_LABEL 一致；该状态没有对应字典，故在页面内固定一份） */
const STATUS_OPTIONS = [
  { value: 1, label: '已接收' },
  { value: 2, label: '校验通过' },
  { value: 3, label: '校验失败' }
]

const loading = ref(true)
const total = ref(0)
const list = ref<IntegrationAttachmentApi.IntegrationAttachmentVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  sysCode: undefined as string | undefined,
  bizType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const checkedIds = ref<number[]>([])
/** 正在重新校验的行 id */
const recheckId = ref<number | undefined>(undefined)
const systemOptions = ref<any[]>([])
/** 附件口径（业务类型 / 扩展名白名单 / 大小上限）由服务端 meta 接口给出，页面不写死 */
const meta = ref<IntegrationAttachmentApi.AttachmentMetaVO | null>(null)

const bizTypeOptions = computed(() => (meta.value && meta.value.bizTypes) || [])

const alertTitle = computed(() => {
  const exts = (meta.value && meta.value.exts) || []
  const size = meta.value ? maxSizeText(meta.value.maxSize) : '1MB'
  return (
    '接收附件会真存内容（浏览器本地库，data URL），能下载；扩展名白名单与大小上限取自服务端 meta 接口' +
    (exts.length ? '（' + exts.join(' / ') + '，单文件 ≤ ' + size + '）' : '') +
    '。校验失败的附件只登记信息、不保存内容，下载会给出中文提示。'
  )
})

const maxSizeText = (bytes: number) => {
  if (!bytes) return '-'
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? Math.round(mb * 100) / 100 + 'MB' : Math.round(bytes / 1024) + 'KB'
}

const bizTypeLabel = (value?: number) => {
  const hit = bizTypeOptions.value.find((item) => item.value === Number(value))
  return hit ? hit.label : String(value === undefined || value === null ? '-' : value)
}

const statusLabel = (value?: number) => {
  const hit = STATUS_OPTIONS.find((item) => item.value === Number(value))
  return hit ? hit.label : String(value === undefined || value === null ? '-' : value)
}

const statusTagType = (value?: number) => {
  if (Number(value) === 2) return 'success'
  if (Number(value) === 3) return 'danger'
  return 'info'
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await IntegrationAttachmentApi.getPage(queryParams)
    // 空数据容忍：0 行时给空数组，表格显示空态
    list.value = (data && data.list) || []
    total.value = (data && data.total) || 0
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 接收附件 / 详情 */
const uploadRef = ref()
const openUpload = () => {
  uploadRef.value.open()
}
const detailRef = ref()
const openDetail = (id: number) => {
  detailRef.value.open(id)
}

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

/** 下载：内容由接口给出（只读），校验失败 / 无内容的附件会抛中文错，交给全局提示 */
const handleDownload = async (row: IntegrationAttachmentApi.IntegrationAttachmentVO) => {
  try {
    const data = await IntegrationAttachmentApi.getAttachmentContent(row.id as number)
    const fileName = (data && data.fileName) || row.fileName
    download.file(dataUrlToBlob(String((data && data.content) || '')), fileName)
    message.success('已开始下载：' + fileName)
  } catch {
    // 服务端中文原因（校验失败未保存内容 / 附件不存在）已由 axios 拦截器统一提示
  }
}

/** 结论文案：避免出现「校验通过：校验通过：…」这种重复前缀 */
const checkMessageWith = (label?: string, checkMessage?: string) => {
  const text = checkMessage || ''
  if (!label) return text
  if (!text) return label
  return text.indexOf(label) === 0 ? text : label + '：' + text
}

/** 重新校验：把返回的状态 / 结论 / 指纹写回该行 */
const handleRecheck = async (row: IntegrationAttachmentApi.IntegrationAttachmentVO) => {
  recheckId.value = row.id
  try {
    const data = await IntegrationAttachmentApi.recheckAttachment(row.id as number)
    row.status = data.status
    row.checkMessage = data.checkMessage
    if (data.contentHash) row.contentHash = data.contentHash
    const resultText = checkMessageWith(data.statusLabel, data.checkMessage)
    if (Number(data.status) === 3) {
      message.warning('重新校验完成：' + resultText)
    } else {
      message.success('重新校验完成：' + resultText)
    }
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  } finally {
    recheckId.value = undefined
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
  } catch {
    return
  }
  try {
    await IntegrationAttachmentApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  }
}

/** 批量删除 */
const handleRowCheckboxChange = (rows: IntegrationAttachmentApi.IntegrationAttachmentVO[]) => {
  checkedIds.value = rows.map((row) => row.id as number)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
  } catch {
    return
  }
  try {
    await IntegrationAttachmentApi.removeList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  }
}

/** 导出按钮操作 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await IntegrationAttachmentApi.exportExcel(queryParams)
    download.excel(data, '接入附件.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化：口径与下拉各取一次 */
onMounted(async () => {
  meta.value = await IntegrationAttachmentApi.getAttachmentMeta()
  systemOptions.value = (await IntegrationSystemApi.getSystemOptions()) || []
  getList()
})
</script>
