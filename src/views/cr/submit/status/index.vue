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
        <el-select v-model="queryParams.period" placeholder="请选择期次" clearable class="!w-160px">
          <el-option
            v-for="period in periodOptions"
            :key="period"
            :label="period"
            :value="period"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="机构" prop="orgId">
        <el-select v-model="queryParams.orgId" placeholder="请选择机构" clearable class="!w-180px">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          clearable
          filterable
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
      <el-form-item label="上报状态" prop="submitStatus">
        <el-select
          v-model="queryParams.submitStatus"
          placeholder="请选择上报状态"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="item in SUBMIT_STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="上报方式" prop="reportType">
        <el-select
          v-model="queryParams.reportType"
          placeholder="请选择上报方式"
          clearable
          class="!w-140px"
        >
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_REPORT_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="报文文件名 / 回执号"
          clearable
          class="!w-200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button :loading="loading" @click="getList">
          <Icon icon="ep:refresh-right" class="mr-5px" /> 刷新状态
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
      title="按「机构 × 报表 × 期次」跟踪报文上报状态：待生成 → 已生成 → 上报中 → 上报成功 → 已回执；上报失败的报文需排查原因后重新上报。"
    >
      <template #default>
        <span
          >「下载报文」按文件名后缀下发对应格式：.txt 为竖线分隔的纯文本报文、.csv
          为逗号分隔文件、.xml
          为结构化报文；列表上的数据行数与文件大小即该文件的实际行数与字节数。</span
        >
        <span v-if="failCount > 0" class="text-[#f56c6c]">
          当前查询结果中有 {{ failCount }} 条上报失败报文，请在「失败原因」列查看具体原因。
        </span>
        <span v-else>当前查询结果中没有上报失败的报文。</span>
      </template>
    </el-alert>
    <el-table v-loading="loading" :data="list" :row-class-name="rowClassName">
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column
        label="报文文件名"
        align="left"
        prop="fileName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="数据行数" align="right" prop="dataRows" width="110">
        <template #default="scope">{{ formatNumber(scope.row.dataRows) }}</template>
      </el-table-column>
      <el-table-column label="文件大小" align="right" prop="fileSize" width="110">
        <template #default="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
      </el-table-column>
      <el-table-column label="上报方式" align="center" prop="reportType" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_TYPE" :value="scope.row.reportType" />
        </template>
      </el-table-column>
      <el-table-column label="上报状态" align="center" prop="submitStatus" width="110">
        <template #default="scope">
          <el-tag
            :type="submitStatusTag(scope.row.submitStatus)"
            :effect="scope.row.submitStatus === SUBMIT_STATUS.RECEIPTED ? 'plain' : 'light'"
          >
            {{ submitStatusName(scope.row.submitStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="上报时间" align="center" prop="submitTime" width="170">
        <template #default="scope">{{ scope.row.submitTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="监管回执号" align="center" prop="receiptNo" width="170">
        <template #default="scope">{{ scope.row.receiptNo || '-' }}</template>
      </el-table-column>
      <el-table-column label="失败原因" align="left" prop="failReason" min-width="260">
        <template #default="scope">
          <el-tooltip
            v-if="scope.row.failReason"
            :content="scope.row.failReason"
            placement="top-start"
            effect="dark"
          >
            <span class="fail-reason">
              <Icon icon="ep:warning-filled" class="mr-3px" />{{ scope.row.failReason }}
            </span>
          </el-tooltip>
          <span v-else class="text-[#909399]">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="240" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            :disabled="!canReport(scope.row)"
            @click="handleReport(scope.row)"
          >
            重新上报
          </el-button>
          <el-button
            link
            type="primary"
            :disabled="scope.row.submitStatus === SUBMIT_STATUS.WAIT_GENERATE"
            @click="handleDownload(scope.row)"
          >
            下载报文
          </el-button>
          <el-button
            link
            type="primary"
            :disabled="!hasReceipt(scope.row)"
            @click="openReceipt(scope.row)"
          >
            查看回执
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 回执详情 -->
  <SubmitReceiptDrawer ref="receiptDrawerRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getStrDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as SubmitStatusApi from '@/api/cr/submit/status'
import SubmitReceiptDrawer from './SubmitReceiptDrawer.vue'
import {
  SUBMIT_STATUS,
  SUBMIT_STATUS_OPTIONS,
  formatFileSize,
  formatNumber,
  submitStatusName,
  submitStatusTag
} from '../constants'

defineOptions({ name: 'CrSubmitStatus' })

const message = useMessage()
const route = useRoute()

const loading = ref(true)
const total = ref(0)
const list = ref<SubmitStatusApi.SubmitStatusVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  submitStatus: undefined as number | undefined,
  reportType: '',
  keyword: ''
})
const queryFormRef = ref()
const orgOptions = ref<SubmitStatusApi.SubmitOrgOptionVO[]>([])
const reportOptions = ref<SubmitStatusApi.SubmitReportOptionVO[]>([])
const periodOptions = ref<string[]>([])

/** 当前页上报失败条数（醒目提示） */
const failCount = computed(
  () => list.value.filter((row) => Number(row.submitStatus) === SUBMIT_STATUS.FAILED).length
)

/** 失败行高亮 */
const rowClassName = ({ row }: { row: SubmitStatusApi.SubmitStatusVO }) =>
  Number(row.submitStatus) === SUBMIT_STATUS.FAILED ? 'submit-fail-row' : ''

/** 可重新上报：已生成 / 上报成功 / 上报失败 / 已回执（上报中与待生成不可） */
const canReport = (row: SubmitStatusApi.SubmitStatusVO) =>
  [
    SUBMIT_STATUS.GENERATED,
    SUBMIT_STATUS.SUCCESS,
    SUBMIT_STATUS.FAILED,
    SUBMIT_STATUS.RECEIPTED
  ].includes(Number(row.submitStatus) as (typeof SUBMIT_STATUS)[keyof typeof SUBMIT_STATUS])

/** 有回执可查：上报成功 / 已回执 */
const hasReceipt = (row: SubmitStatusApi.SubmitStatusVO) =>
  Number(row.submitStatus) >= SUBMIT_STATUS.SUCCESS

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await SubmitStatusApi.getSubmitStatusPage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 重新上报 */
const handleReport = async (row: SubmitStatusApi.SubmitStatusVO) => {
  try {
    await message.confirm(
      `确认对「${row.orgName} - ${row.reportName}」（期次 ${row.period}）重新上报报文 ${row.fileName} 吗？`,
      '重新上报'
    )
    await SubmitStatusApi.reportSubmitStatus(row.id!)
    message.success('已重新上报，监管前置机已接收报文')
    await getList()
  } catch {}
}

/** 下载报文：文件名后缀即实际格式（mock 下发的 Blob 已是 .txt/.csv/.xml 中对应的那一种） */
const handleDownload = async (row: SubmitStatusApi.SubmitStatusVO) => {
  const fileName = row.fileName || '报文文件.txt'
  try {
    const data = await SubmitStatusApi.downloadSubmitFile(row.id!)
    download.file(data, fileName)
    message.success(`已开始下载：${fileName}`)
  } catch {}
}

/** 查看回执 */
const receiptDrawerRef = ref()
const openReceipt = (row: SubmitStatusApi.SubmitStatusVO) => {
  receiptDrawerRef.value.open(row.id)
}

const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    SubmitStatusApi.getSubmitStatusPeriodOptions(),
    SubmitStatusApi.getSubmitStatusOrgOptions(),
    SubmitStatusApi.getSubmitStatusReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  // 支持从「报文生成」页带期次跳转过来
  const period = route.query.period
  if (typeof period === 'string' && period) {
    queryParams.period = period
  }
  initOptions()
  getList()
})
</script>

<style lang="scss" scoped>
:deep(.submit-fail-row) {
  background-color: var(--el-color-danger-light-9);
}

:deep(.submit-fail-row td:first-child) {
  border-left: 3px solid var(--el-color-danger);
}

.fail-reason {
  display: -webkit-box;
  overflow: hidden;
  font-weight: 700;
  color: var(--el-color-danger);
  cursor: help;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
