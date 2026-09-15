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
      <el-form-item label="填报状态" prop="fillStatus">
        <el-select
          v-model="queryParams.fillStatus"
          clearable
          placeholder="请选择状态"
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
      title="手工批量操作：勾选「机构 × 报表 × 期次」的填报记录后执行批量动作。清空与删除不可恢复，请谨慎操作。"
    />

    <div class="mb-10px">
      <el-button
        type="warning"
        plain
        :disabled="!checkedIds.length"
        :loading="executing"
        @click="handleAction('clear')"
        v-hasPermi="['cr:data-batch:execute']"
      >
        <Icon icon="ep:delete-filled" class="mr-5px" /> 批量清空
      </el-button>
      <el-button
        type="primary"
        plain
        :disabled="!checkedIds.length"
        :loading="executing"
        @click="handleAction('copyPrev')"
        v-hasPermi="['cr:data-batch:execute']"
      >
        <Icon icon="ep:copy-document" class="mr-5px" /> 批量复制上期数据
      </el-button>
      <el-button
        type="success"
        plain
        :disabled="!checkedIds.length"
        :loading="executing"
        @click="handleAction('calculate')"
        v-hasPermi="['cr:data-batch:execute']"
      >
        <Icon icon="ep:magic-stick" class="mr-5px" /> 批量计算
      </el-button>
      <el-button
        type="danger"
        plain
        :disabled="!checkedIds.length"
        :loading="executing"
        @click="handleAction('delete')"
        v-hasPermi="['cr:data-batch:execute']"
      >
        <Icon icon="ep:delete" class="mr-5px" /> 批量删除
      </el-button>
      <span class="ml-10px text-13px text-[#909399]">已勾选 {{ checkedIds.length }} 条</span>
    </div>

    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
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
          <span :class="scope.row.rowCount ? '' : 'text-[#909399]'"
            >{{ scope.row.rowCount }} 行</span
          >
        </template>
      </el-table-column>
      <el-table-column label="填报状态" align="center" prop="fillStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="scope.row.fillStatus" />
        </template>
      </el-table-column>
      <el-table-column label="最后修改人" align="center" prop="lastModifier" width="110">
        <template #default="scope">{{ scope.row.lastModifier || '-' }}</template>
      </el-table-column>
      <el-table-column label="最后修改时间" align="center" prop="lastModifyTime" width="170">
        <template #default="scope">{{ scope.row.lastModifyTime || '-' }}</template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 执行结果 -->
  <Dialog v-model="resultVisible" :title="`${result?.label || '批量操作'}执行结果`" width="760">
    <el-alert
      class="mb-10px"
      :type="result && result.failCount === 0 ? 'success' : 'warning'"
      :closable="false"
      show-icon
      :title="`成功 ${result?.successCount || 0} 条 / 失败 ${result?.failCount || 0} 条，执行时间 ${result?.executeTime || ''}`"
    />
    <el-table :data="result?.results || []" max-height="360" size="small">
      <el-table-column label="机构" prop="orgName" width="130" />
      <el-table-column label="报表名称" prop="reportName" min-width="200" show-overflow-tooltip />
      <el-table-column label="期次" prop="period" width="90" align="center" />
      <el-table-column label="结果" width="90" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.success ? 'success' : 'danger'" size="small">
            {{ scope.row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="说明" prop="message" min-width="220" show-overflow-tooltip />
    </el-table>
    <template #footer>
      <el-button type="primary" @click="resultVisible = false">知道了</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as BatchApi from '@/api/cr/data/batch'

defineOptions({ name: 'CrDataBatch' })

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const executing = ref(false)
const total = ref(0)
const list = ref<BatchApi.FillRecordVO[]>([])
const periodOptions = ref<string[]>([])
const orgOptions = ref<{ id: number; name: string }[]>([])
const reportOptions = ref<{ id: number; name: string; code: string }[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: (route.query.period as string) || '',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  fillStatus: undefined as number | undefined
})
const queryFormRef = ref()

const resultVisible = ref(false)
const result = ref<BatchApi.BatchExecuteResultVO | null>(null)

const ACTION_TIP: Record<BatchApi.BatchAction, string> = {
  clear: '清空后该机构该报表的数据行将全部删除且不可恢复！',
  copyPrev: '将用上期同机构同报表的数据覆盖本期数据，请确认上期数据已定稿。',
  calculate: '将按「保险金额 = 保费金额 × 费率」重算保险金额。',
  delete: '删除后填报记录与明细数据一并移除且不可恢复！'
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await BatchApi.getBatchRecordPage(queryParams)
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
  queryParams.fillStatus = undefined
  handleQuery()
}

/** 勾选 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: BatchApi.FillRecordVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

/** 执行批量动作：二次确认 → 执行 → 结果反馈 */
const handleAction = async (action: BatchApi.BatchAction) => {
  if (!checkedIds.value.length) {
    message.warning('请先勾选要操作的填报记录')
    return
  }
  const tip = ACTION_TIP[action]
  try {
    await message.confirm(
      `确认对选中的 ${checkedIds.value.length} 条填报记录执行批量操作？${tip}`,
      '批量操作二次确认'
    )
  } catch {
    return
  }
  executing.value = true
  try {
    const data = await BatchApi.executeBatch({ ids: checkedIds.value, action })
    result.value = data
    resultVisible.value = true
    if (data.failCount === 0) {
      message.success(`${data.label}完成：成功 ${data.successCount} 条，失败 ${data.failCount} 条`)
    } else {
      message.warning(`${data.label}完成：成功 ${data.successCount} 条，失败 ${data.failCount} 条`)
    }
    checkedIds.value = []
    await getList()
  } finally {
    executing.value = false
  }
}

/** 初始化下拉选项 */
const initOptions = async () => {
  const [periods, orgs, reports] = await Promise.all([
    BatchApi.getBatchPeriodOptions(),
    BatchApi.getBatchOrgOptions(),
    BatchApi.getBatchReportOptions()
  ])
  periodOptions.value = periods || []
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  if (!queryParams.period) queryParams.period = '202608'
  await getList()
}

onMounted(() => {
  initOptions()
})
</script>
