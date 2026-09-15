<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="queryParams.period" clearable placeholder="请选择期次" class="!w-150px">
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="报送机构" prop="orgId">
        <el-select v-model="queryParams.orgId" clearable placeholder="请选择机构" class="!w-180px">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          clearable
          filterable
          placeholder="请选择报表"
          class="!w-280px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="`${report.code} ${report.name}`"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="文件类型" prop="fileType">
        <el-select
          v-model="queryParams.fileType"
          clearable
          placeholder="请选择类型"
          class="!w-130px"
        >
          <el-option v-for="type in FILE_TYPES" :key="type" :label="type" :value="type" />
        </el-select>
      </el-form-item>
      <el-form-item label="生成状态" prop="status">
        <el-select v-model="queryParams.status" clearable placeholder="请选择状态" class="!w-150px">
          <el-option
            v-for="(label, value) in MESSAGE_STATUS_LABEL"
            :key="value"
            :label="label"
            :value="Number(value)"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openGenerateForm"
          v-hasPermi="['cr:data-message:generate']"
        >
          <Icon icon="ep:document-add" class="mr-5px" /> 生成报文
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="报文格式由机构的报送文件配置决定（生成报文时可指定文件类型，扩展名即内容格式）：.txt 为竖线分隔的纯文本报文、.csv 为逗号分隔文件（带 BOM，Excel 可直接打开）、.xml 为结构化报文；列表上的数据行数与文件大小就是下载到的那份文件的实际行数与字节数。"
    >
      <template #default>
        <span
          >同一机构、同一报表、同期次的报文与「报文状态查询」是同一份文件，两处文件名与大小一致。</span
        >
      </template>
    </el-alert>
    <el-table v-loading="loading" :data="list">
      <el-table-column
        label="报文名称"
        align="left"
        prop="messageName"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column label="机构" align="left" prop="orgName" width="130" show-overflow-tooltip />
      <el-table-column label="报表" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.reportCode }} {{ scope.row.reportName }}
        </template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="95" />
      <el-table-column label="文件类型" align="center" prop="fileType" width="100">
        <template #default="scope">
          <el-tag size="small" effect="plain">{{ scope.row.fileType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="文件大小" align="right" prop="fileSize" width="130">
        <template #default="scope">
          <div>{{ formatFileSize(scope.row.fileSize) }}</div>
          <div v-if="scope.row.fileSize" class="text-12px text-[#909399]">
            {{ formatBytes(scope.row.fileSize) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="数据行数" align="right" prop="rowCount" width="110">
        <template #default="scope">
          <span v-if="scope.row.rowCount">{{ formatNumber(scope.row.rowCount) }} 行</span>
          <span v-else class="text-[#909399]">-</span>
        </template>
      </el-table-column>
      <el-table-column label="生成状态" align="center" prop="status" width="110">
        <template #default="scope">
          <el-tooltip
            :content="scope.row.remark || MESSAGE_STATUS_LABEL[scope.row.status]"
            placement="top"
          >
            <el-tag :type="STATUS_TAG[scope.row.status]" size="small" effect="dark">
              {{ MESSAGE_STATUS_LABEL[scope.row.status] }}
            </el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="生成时间" align="center" prop="genTime" width="170" />
      <el-table-column label="操作" align="center" width="190" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            :loading="downloadId === scope.row.id"
            :disabled="scope.row.status !== 2"
            :title="downloadTip(scope.row)"
            @click="handleDownload(scope.row)"
            v-hasPermi="['cr:data-message:download']"
          >
            下载
          </el-button>
          <el-button
            link
            type="primary"
            :disabled="scope.row.status === 1"
            @click="handleRegenerate(scope.row)"
            v-hasPermi="['cr:data-message:generate']"
          >
            重新生成
          </el-button>
          <el-button
            link
            type="danger"
            :disabled="scope.row.status === 1"
            @click="handleDelete(scope.row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 生成报文弹窗 -->
  <MessageGenerateForm ref="generateFormRef" @success="handleGenerated" />
</template>

<script lang="ts" setup>
import download from '@/utils/download'
import * as MessageApi from '@/api/cr/data/message'
import MessageGenerateForm from './MessageGenerateForm.vue'

defineOptions({ name: 'CrDataMessage' })

const FILE_TYPES = ['TXT', 'XML', 'CSV']
const MESSAGE_STATUS_LABEL: Record<number, string> = { 1: '生成中', 2: '生成成功', 3: '生成失败' }
const STATUS_TAG: Record<number, 'primary' | 'success' | 'danger'> = {
  1: 'primary',
  2: 'success',
  3: 'danger'
}

/** 千分位格式化 */
const formatNumber = (value?: number): string =>
  value === undefined || value === null ? '-' : Number(value).toLocaleString('zh-CN')

/** 文件大小格式化：字节 → B / KB / MB（与下载到的 Blob 字节数同源） */
const formatFileSize = (size?: number): string => {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

/** 精确字节数（列表显示与实际下载逐字节可比） */
const formatBytes = (size?: number): string =>
  size ? `${Number(size).toLocaleString('zh-CN')} 字节` : ''

/** 下载按钮提示：真实文件名 + 格式 + 大小 + 行数 */
const downloadTip = (row: MessageApi.MessageVO): string =>
  `下载 ${row.messageName}（${row.fileType} 格式 / ${formatFileSize(row.fileSize)} / ${formatNumber(
    row.rowCount
  )} 行）`

const message = useMessage()

const loading = ref(false)
const total = ref(0)
const downloadId = ref<number | undefined>(undefined)
const list = ref<MessageApi.MessageVO[]>([])
const periodOptions = ref<string[]>([])
const orgOptions = ref<{ id: number; name: string }[]>([])
const reportOptions = ref<{ id: number; name: string; code: string }[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  fileType: undefined as string | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const generateFormRef = ref()

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await MessageApi.getMessagePage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

const resetQuery = () => {
  queryFormRef.value.resetFields()
  queryParams.period = '202608'
  queryParams.orgId = undefined
  queryParams.reportId = undefined
  queryParams.fileType = undefined
  queryParams.status = undefined
  handleQuery()
}

/** 生成报文 */
const openGenerateForm = () => {
  generateFormRef.value.open()
}

/** 生成成功：稍等片刻再刷新，可看到「生成中 → 生成成功」的状态流转 */
const handleGenerated = () => {
  setTimeout(() => getList(), 1200)
}

/** 下载报文：文件名与格式完全按列表上的报文记录（扩展名即内容格式） */
const handleDownload = async (row: MessageApi.MessageVO) => {
  downloadId.value = row.id
  try {
    const data = await MessageApi.downloadMessage(row.id!)
    const fileName = row.messageName
    download.file(data, fileName)
    message.success(
      `已开始下载：${fileName}（${row.fileType} 格式 / ${formatFileSize(
        row.fileSize
      )} / ${formatNumber(row.rowCount)} 行）`
    )
  } catch {
    // 接口已给出中文提示（生成中 / 生成失败 / 无可下载数据），这里不再重复提示
  } finally {
    downloadId.value = undefined
  }
}

/** 重新生成 */
const handleRegenerate = async (row: MessageApi.MessageVO) => {
  try {
    await message.confirm(
      `确认重新生成报文【${row.messageName}】？重新生成将覆盖原文件。`,
      '重新生成确认'
    )
  } catch {
    return
  }
  await MessageApi.regenerateMessage(row.id!)
  message.success('已提交重新生成任务，请稍候刷新查看结果')
  await getList()
}

/** 删除 */
const handleDelete = async (row: MessageApi.MessageVO) => {
  try {
    await message.delConfirm(`确认删除报文【${row.messageName}】？`)
  } catch {
    return
  }
  await MessageApi.deleteMessage(row.id!)
  message.success('删除成功')
  await getList()
}

/** 初始化下拉选项 */
const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    MessageApi.getMessagePeriodOptions(),
    MessageApi.getMessageOrgOptions(),
    MessageApi.getMessageReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  await getList()
}

onMounted(() => {
  initOptions()
})
</script>
