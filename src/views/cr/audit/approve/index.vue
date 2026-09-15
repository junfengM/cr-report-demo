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
      <el-form-item label="审核结论" prop="auditStatus">
        <el-select
          v-model="queryParams.auditStatus"
          placeholder="请选择审核结论"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_AUDIT_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报送状态" prop="submitStatus">
        <el-select
          v-model="queryParams.submitStatus"
          placeholder="请选择报送状态"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_FILL_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="批次号" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 机构 / 报表"
          clearable
          class="!w-200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :disabled="checkedAuditableRows.length === 0"
          @click="openBatchPass"
          v-hasPermi="['cr:audit-approve:pass']"
        >
          <Icon icon="ep:select" class="mr-5px" /> 批量审核通过（{{ checkedAuditableRows.length }}）
        </el-button>
        <el-button
          type="primary"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:audit-approve:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表：按「机构 × 报表 × 期次」整批审核 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="审核规则：审核按「机构 × 报表 × 期次」整批进行；错误级问题阻断上报，必须整改或由填报人说明后方可通过；审核不通过必须填写意见；个人敏感字段（姓名 / 证件号 / 手机号 / 地址）一律以脱敏后的值展示。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column
        type="selection"
        width="55"
        :selectable="(row: any) => row.auditStatus === 0"
      />
      <el-table-column label="批次号" align="center" prop="batchNo" width="140" />
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
        min-width="210"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="数据行数" align="center" prop="rowCount" width="100">
        <template #default="scope">{{ scope.row.rowCount }} 行</template>
      </el-table-column>
      <el-table-column label="校验情况" align="center" width="230">
        <template #default="scope">
          <el-tag type="success" size="small" disable-transitions
            >通过 {{ scope.row.passCount }}</el-tag
          >
          <el-tag type="warning" size="small" class="ml-4px" disable-transitions>
            警告 {{ scope.row.warnCount }}
          </el-tag>
          <el-tag type="danger" size="small" class="ml-4px" disable-transitions>
            错误 {{ scope.row.errorCount }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="报送状态" align="center" prop="submitStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="scope.row.submitStatus" />
        </template>
      </el-table-column>
      <el-table-column label="提交时间" align="center" prop="submitTime" width="170" />
      <el-table-column label="提交人" align="center" prop="submitUser" width="100" />
      <el-table-column label="审核结论" align="center" prop="auditStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_AUDIT_STATUS" :value="scope.row.auditStatus" />
        </template>
      </el-table-column>
      <el-table-column label="审核人" align="center" prop="auditor" width="100">
        <template #default="scope">{{ scope.row.auditor || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="120" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDialog(scope.row)"
            v-hasPermi="['cr:audit-approve:pass']"
          >
            {{ scope.row.auditStatus === 0 ? '审核' : '查看' }}
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

  <!-- 审核面板弹窗 -->
  <ApproveDialog ref="dialogRef" @success="getList" />

  <!-- 弹窗：批量审核通过 -->
  <Dialog v-model="batchVisible" title="批量审核通过" width="620">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="`本次将对 ${checkedAuditableRows.length} 个批次做「审核通过」：${checkedAuditableRows.map((row) => row.batchNo).join('、')}`"
      class="mb-12px"
    />
    <el-alert
      v-if="checkedSkippedCount"
      type="warning"
      :closable="false"
      show-icon
      :title="`勾选中另有 ${checkedSkippedCount} 个批次已完成审核或尚未提交，将被自动跳过。`"
      class="mb-12px"
    />
    <el-form ref="batchFormRef" :model="batchForm" label-width="90px">
      <el-form-item label="审核意见">
        <el-input
          v-model="batchForm.opinion"
          type="textarea"
          :rows="3"
          maxlength="300"
          show-word-limit
          placeholder="可选：批量通过意见将写入每个批次的审核结论"
        />
      </el-form-item>
      <el-form-item label="快捷意见">
        <el-select
          v-model="batchQuickOpinion"
          placeholder="选择常用意见快速填充"
          clearable
          class="w-full"
          @change="handleBatchQuickOpinion"
        >
          <el-option v-for="item in batchQuickOpinions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="batchLoading" type="primary" @click="submitBatchPass">确 定</el-button>
      <el-button @click="batchVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ApproveApi from '@/api/cr/audit/approve'
import ApproveDialog from './ApproveDialog.vue'

defineOptions({ name: 'CrAuditApprove' })

const message = useMessage()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']

const loading = ref(true)
const total = ref(0)
const list = ref<ApproveApi.AuditApproveVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  auditStatus: undefined as number | undefined,
  submitStatus: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<ApproveApi.AuditOrgOptionVO[]>([])
const reportOptions = ref<ApproveApi.AuditReportOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ApproveApi.getAuditApprovePage(queryParams)
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

/** 审核面板 */
const dialogRef = ref()
const openDialog = (row: ApproveApi.AuditApproveVO) => {
  dialogRef.value.open(row)
}

/** 勾选 */
const checkedRows = ref<ApproveApi.AuditApproveVO[]>([])
const handleRowCheckboxChange = (rows: ApproveApi.AuditApproveVO[]) => {
  checkedRows.value = rows
}
const checkedAuditableRows = computed(() =>
  checkedRows.value.filter((row) => row.auditStatus === 0 && row.submitStatus === 2)
)
const checkedSkippedCount = computed(
  () => checkedRows.value.filter((row) => row.auditStatus !== 0 || row.submitStatus !== 2).length
)

/** 批量审核通过 */
const batchVisible = ref(false)
const batchLoading = ref(false)
const batchFormRef = ref()
const batchForm = reactive({ opinion: '' })
const batchQuickOpinion = ref('')
const batchQuickOpinions = [
  '数据完整、勾稽关系核对无误，同意通过并进入上报环节。',
  '校验告警已由填报机构说明原因，同意通过。',
  '经与上期数据比对，波动在合理区间，同意通过。'
]
const handleBatchQuickOpinion = (value: string) => {
  if (value) batchForm.opinion = value
}
const openBatchPass = () => {
  if (!checkedAuditableRows.value.length) {
    message.warning('请先勾选待审核的批次')
    return
  }
  batchForm.opinion = ''
  batchQuickOpinion.value = ''
  batchVisible.value = true
}
const submitBatchPass = async () => {
  batchLoading.value = true
  try {
    const ids = checkedAuditableRows.value.map((row) => row.id!)
    const result = await ApproveApi.batchPassAuditApprove(ids, batchForm.opinion.trim())
    message.success(
      `批量审核通过 ${result.successCount} 个批次${
        result.failCount ? `，${result.failCount} 个批次未处理` : ''
      }`
    )
    batchVisible.value = false
    checkedRows.value = []
    await getList()
  } finally {
    batchLoading.value = false
  }
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ApproveApi.exportAuditApprove(queryParams)
    download.excel(data, '待审核批次.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, reports] = await Promise.all([
    ApproveApi.getAuditApproveOrgOptions(),
    ApproveApi.getAuditApproveReportOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  getList()
  initOptions()
})
</script>
