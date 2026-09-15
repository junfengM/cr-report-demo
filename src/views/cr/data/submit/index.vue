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
        <el-select v-model="queryParams.period" clearable placeholder="请选择期次" class="!w-160px">
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
      <el-form-item label="校验状态" prop="checkStatus">
        <el-select
          v-model="queryParams.checkStatus"
          clearable
          placeholder="请选择状态"
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
      title="提交规则：仅「已填报」状态的记录可提交；提交前系统自动校验，校验状态为「校验不通过」或「未校验」的记录不允许提交，请先在数据填报页完成校验；提交成功后状态变更为「已提交」，如需修改请联系复核人打回。"
    />

    <div class="mb-10px">
      <el-button
        type="primary"
        :disabled="!checkedIds.length"
        :loading="submitting"
        @click="handleBatchSubmit"
        v-hasPermi="['cr:data-submit:batch']"
      >
        <Icon icon="ep:upload" class="mr-5px" /> 批量提交（已选 {{ checkedIds.length }} 条）
      </el-button>
      <el-button :disabled="!list.length" @click="handleCheckAll">全选本页</el-button>
      <span class="ml-10px text-13px text-[#909399]">
        待提交 {{ total }} 条，本次勾选 {{ checkedIds.length }} 条
      </span>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="list"
      @selection-change="handleRowCheckboxChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column label="机构" align="left" prop="orgName" width="140" show-overflow-tooltip />
      <el-table-column label="报表名称" align="left" min-width="240" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.reportCode }} {{ scope.row.reportName }}
        </template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="100" />
      <el-table-column label="数据行数" align="center" prop="rowCount" width="100">
        <template #default="scope">
          <span :class="scope.row.rowCount ? '' : 'text-[#f56c6c]'"
            >{{ scope.row.rowCount }} 行</span
          >
        </template>
      </el-table-column>
      <el-table-column label="校验状态" align="center" prop="checkStatus" width="120">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_CHECK_STATUS" :value="scope.row.checkStatus" />
        </template>
      </el-table-column>
      <el-table-column label="填报状态" align="center" prop="fillStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="scope.row.fillStatus" />
        </template>
      </el-table-column>
      <el-table-column label="截止日期" align="center" prop="deadline" width="120" />
      <el-table-column label="操作" align="center" width="100" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            :disabled="scope.row.checkStatus !== 2 || !scope.row.rowCount"
            @click="handleSubmit(scope.row)"
            v-hasPermi="['cr:data-submit:batch']"
          >
            提交
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
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as SubmitApi from '@/api/cr/data/submit'

defineOptions({ name: 'CrDataSubmit' })

const message = useMessage()

const loading = ref(false)
const submitting = ref(false)
const total = ref(0)
const list = ref<SubmitApi.FillRecordVO[]>([])
const periodOptions = ref<string[]>([])
const orgOptions = ref<{ id: number; name: string }[]>([])
const reportOptions = ref<{ id: number; name: string; code: string }[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  checkStatus: undefined as number | undefined
})
const queryFormRef = ref()
const tableRef = ref()
const checkedIds = ref<number[]>([])

/** 查询待提交列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await SubmitApi.getSubmitRecordPage(queryParams)
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
  queryParams.period = ''
  queryParams.orgId = undefined
  queryParams.reportId = undefined
  queryParams.checkStatus = undefined
  handleQuery()
}

const handleRowCheckboxChange = (rows: SubmitApi.FillRecordVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleCheckAll = () => {
  list.value.forEach((row) => tableRef.value?.toggleRowSelection(row, true))
}

/** 单条提交 */
const handleSubmit = async (row: SubmitApi.FillRecordVO) => {
  try {
    await message.confirm(
      `确认提交【${row.orgName}｜${row.reportName}｜${row.period}】共 ${row.rowCount} 行数据？`,
      '提交确认'
    )
  } catch {
    return
  }
  await doSubmit([row.id!])
}

/** 批量提交 */
const handleBatchSubmit = async () => {
  if (!checkedIds.value.length) {
    message.warning('请先勾选要提交的填报记录')
    return
  }
  try {
    await message.confirm(
      `确认批量提交选中的 ${checkedIds.value.length} 条填报记录？提交后状态变更为「已提交」。`,
      '批量提交确认'
    )
  } catch {
    return
  }
  await doSubmit(checkedIds.value)
}

const doSubmit = async (ids: number[]) => {
  submitting.value = true
  try {
    const data = await SubmitApi.submitFillRecords(ids)
    message.success(`提交成功：${data.successCount} 条记录已于 ${data.submitTime} 提交`)
    checkedIds.value = []
    await getList()
  } catch {
    // 校验不通过等业务异常由 axios 拦截器统一弹出中文提示
  } finally {
    submitting.value = false
  }
}

/** 初始化下拉选项 */
const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    SubmitApi.getSubmitPeriodOptions(),
    SubmitApi.getSubmitOrgOptions(),
    SubmitApi.getSubmitReportOptions()
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
