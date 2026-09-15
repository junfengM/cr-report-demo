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
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
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
      <el-form-item label="数据定位" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="保单号 / 字段名称 / 数据定位"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="错误级别" prop="errorLevel">
        <el-select
          v-model="queryParams.errorLevel"
          placeholder="请选择错误级别"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ERROR_LEVEL)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleBatchConfirm"
          v-hasPermi="['cr:audit-reason:confirm']"
        >
          <Icon icon="ep:select" class="mr-5px" /> 批量确认（{{ checkedIds.length }}）
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:audit-reason:query']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表：被审核标记为存疑 / 不通过的数据项，由填报人补充错误原因 -->
  <ContentWrap>
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane
        v-for="tab in statusTabs"
        :key="String(tab.value)"
        :name="String(tab.value)"
        :label="`${tab.label}${tab.count ? ` (${tab.count})` : ''}`"
      />
    </el-tabs>
    <el-alert
      class="mb-10px"
      type="warning"
      :closable="false"
      show-icon
      title="审核人员标记为存疑 / 不通过的数据项必须填写错误原因（不少于 10 个字）并提交，审核人确认后本条闭环。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" :selectable="(row: any) => row.status !== 2" />
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
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column
        label="数据定位"
        align="left"
        prop="location"
        min-width="210"
        show-overflow-tooltip
      />
      <el-table-column
        label="字段名称"
        align="left"
        prop="columnName"
        width="120"
        show-overflow-tooltip
      />
      <el-table-column
        label="原值"
        align="left"
        prop="originalValue"
        width="150"
        show-overflow-tooltip
      >
        <template #default="scope">
          <span class="text-[#f56c6c]">{{ scope.row.originalValue || '(空)' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="错误级别" align="center" prop="errorLevel" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ERROR_LEVEL" :value="scope.row.errorLevel" />
        </template>
      </el-table-column>
      <el-table-column
        label="审核意见"
        align="left"
        prop="auditOpinion"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column label="回复期限" align="center" prop="deadline" width="110" />
      <el-table-column label="处理状态" align="center" prop="status" width="100">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.status)" disable-transitions>
            {{ statusLabel(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="填报人" align="center" prop="fillUser" width="100">
        <template #default="scope">{{ scope.row.fillUser || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="200" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm(scope.row)"
            v-hasPermi="['cr:audit-reason:create']"
          >
            {{
              scope.row.status === 0 ? '填写原因' : scope.row.status === 1 ? '修改原因' : '查看详情'
            }}
          </el-button>
          <el-button
            v-if="scope.row.status === 1"
            link
            type="success"
            @click="handleConfirm(scope.row)"
            v-hasPermi="['cr:audit-reason:confirm']"
          >
            确认
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

  <!-- 表单弹窗：填写 / 查看错误原因 -->
  <ReasonForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ReasonApi from '@/api/cr/audit/reason'
import ReasonForm from './ReasonForm.vue'

defineOptions({ name: 'CrAuditReason' })

const message = useMessage()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']

const loading = ref(true)
const total = ref(0)
const list = ref<ReasonApi.AuditReasonVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  keyword: '',
  errorLevel: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<ReasonApi.AuditOrgOptionVO[]>([])
const reportOptions = ref<ReasonApi.AuditReportOptionVO[]>([])

/** 处理状态分页签（默认「全部」，与表格状态列同一口径） */
const activeTab = ref('')
const statusCounts = ref<ReasonApi.AuditReasonStatusCountVO[]>([])
const statusTabs = computed(() =>
  [
    { label: '全部', value: '' as number | '' },
    { label: '待填报', value: 0 },
    { label: '已填报', value: 1 },
    { label: '已确认', value: 2 }
  ].map((tab) => ({
    ...tab,
    count: statusCounts.value.find((item) => String(item.status) === String(tab.value))?.count ?? 0
  }))
)

const statusLabel = (status: number) =>
  status === 0 ? '待填报' : status === 1 ? '已填报' : '已确认'
const statusTagType = (status: number) =>
  status === 0 ? 'warning' : status === 1 ? 'primary' : 'success'

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ReasonApi.getAuditReasonPage(queryParams)
    list.value = data.list
    total.value = data.total
    statusCounts.value = await ReasonApi.getAuditReasonStatusCount(queryParams)
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
  activeTab.value = ''
  queryParams.status = undefined
  handleQuery()
}

/** 切换处理状态分页签 */
const handleTabChange = () => {
  queryParams.status = activeTab.value === '' ? undefined : Number(activeTab.value)
  handleQuery()
}

/** 填写 / 查看错误原因 */
const formRef = ref()
const openForm = (row: ReasonApi.AuditReasonVO) => {
  formRef.value.open(row)
}

/** 勾选 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ReasonApi.AuditReasonVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

/** 审核人确认（单条） */
const handleConfirm = async (row: ReasonApi.AuditReasonVO) => {
  try {
    await message.confirm(
      `确认「${row.columnName}」这条错误原因说明吗？确认后填报人不能再修改。`,
      '确认错误原因'
    )
    const result = await ReasonApi.confirmAuditReason([row.id!])
    message.success(result.successCount ? '已确认' : '未确认')
    await getList()
  } catch {}
}

/** 审核人批量确认 */
const handleBatchConfirm = async () => {
  try {
    await message.confirm(
      `确认将勾选的 ${checkedIds.value.length} 条错误原因说明标记为「已确认」吗？确认后填报人不能再修改。`,
      '批量确认'
    )
    const result = await ReasonApi.confirmAuditReason(checkedIds.value)
    message.success(
      `已确认 ${result.successCount} 条${result.failCount ? `，${result.failCount} 条未处理` : ''}`
    )
    checkedIds.value = []
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ReasonApi.exportAuditReason(queryParams)
    download.excel(data, '错误原因填报.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, reports] = await Promise.all([
    ReasonApi.getAuditReasonOrgOptions(),
    ReasonApi.getAuditReasonReportOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  getList()
  initOptions()
})
</script>
