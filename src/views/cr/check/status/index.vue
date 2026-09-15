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
      <el-form-item label="校验状态" prop="checkStatus">
        <el-select
          v-model="queryParams.checkStatus"
          placeholder="请选择校验状态"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_CHECK_STATUS)"
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
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:check-status:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
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
      title="校验状态按「机构 × 报表 × 期次」记录。"
    >
      <template #default>
        「重新校验」会按当前启用规则重新执行该机构该报表的校验并刷新状态与明细；「重置数据」会清空该校验任务的状态与明细，可重新发起校验。
      </template>
    </el-alert>
    <el-table v-loading="loading" :data="list">
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="校验状态" align="center" prop="checkStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_CHECK_STATUS" :value="scope.row.checkStatus" />
        </template>
      </el-table-column>
      <el-table-column label="校验时间" align="center" prop="checkTime" width="170">
        <template #default="scope">{{ scope.row.checkTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="耗时" align="center" prop="costTime" width="90">
        <template #default="scope">
          {{ scope.row.costTime ? `${scope.row.costTime} 秒` : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="通过数" align="center" prop="passCount" width="90" />
      <el-table-column label="警告数" align="center" prop="warnCount" width="90">
        <template #default="scope">
          <span :class="{ 'text-[#e6a23c] font-bold': scope.row.warnCount > 0 }">
            {{ scope.row.warnCount }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="错误数" align="center" prop="errorCount" width="90">
        <template #default="scope">
          <span :class="{ 'text-[#f56c6c] font-bold': scope.row.errorCount > 0 }">
            {{ scope.row.errorCount }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="校验任务号" align="center" prop="taskNo" width="150">
        <template #default="scope">{{ scope.row.taskNo || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="180" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            :disabled="scope.row.checkStatus === 1"
            @click="handleRecheck(scope.row)"
          >
            重新校验
          </el-button>
          <el-button
            link
            type="danger"
            :disabled="scope.row.checkStatus === 1"
            @click="handleReset(scope.row)"
            v-hasPermi="['cr:check-status:reset']"
          >
            重置数据
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
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as CheckStatusApi from '@/api/cr/check/status'

defineOptions({ name: 'CrCheckStatus' })

const message = useMessage()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']

const loading = ref(true)
const total = ref(0)
const list = ref<CheckStatusApi.CheckStatusVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  checkStatus: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<CheckStatusApi.CheckOrgOptionVO[]>([])
const reportOptions = ref<CheckStatusApi.CheckReportOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await CheckStatusApi.getCheckStatusPage(queryParams)
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

/** 重新校验（二次确认） */
const handleRecheck = async (row: CheckStatusApi.CheckStatusVO) => {
  try {
    await message.confirm(
      `确认对「${row.orgName} - ${row.reportName}」（期次 ${row.period}）重新执行数据校验吗？`,
      '重新校验'
    )
    const data = await CheckStatusApi.recheckCheckStatus(row.id!)
    message.success(
      `重新校验完成：通过 ${data.passCount} 条 / 警告 ${data.warnCount} 条 / 错误 ${data.errorCount} 条`
    )
    await getList()
  } catch {}
}

/** 重置数据（二次确认） */
const handleReset = async (row: CheckStatusApi.CheckStatusVO) => {
  try {
    await message.confirm(
      `确认重置「${row.orgName} - ${row.reportName}」（期次 ${row.period}）的校验数据吗？重置后校验状态与校验明细将被清空，需要重新执行校验。`,
      '重置数据'
    )
    await CheckStatusApi.resetCheckStatus(row.id!)
    message.success('校验数据已重置')
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await CheckStatusApi.exportCheckStatus(queryParams)
    download.excel(data, '数据校验状态.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, reports] = await Promise.all([
    CheckStatusApi.getCheckStatusOrgOptions(),
    CheckStatusApi.getCheckStatusReportOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  getList()
  initOptions()
})
</script>
