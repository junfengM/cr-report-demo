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
      <el-form-item label="规则类型" prop="ruleType">
        <el-select
          v-model="queryParams.ruleType"
          placeholder="请选择规则类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_RULE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="是否已处理" prop="handled">
        <el-select
          v-model="queryParams.handled"
          placeholder="请选择处理状态"
          clearable
          class="!w-160px"
        >
          <el-option label="未处理" :value="false" />
          <el-option label="已处理" :value="true" />
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
          v-hasPermi="['cr:check-result:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表：仅展示校验不通过的明细 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="warning"
      :closable="false"
      show-icon
      title="本页仅列出校验不通过的明细：错误级问题阻断报送，警告级问题不阻断，处理后请重新执行校验确认。"
    />
    <el-table v-loading="loading" :data="list">
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="140"
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
      <el-table-column label="规则编码" align="center" prop="ruleCode" width="120" />
      <el-table-column
        label="规则名称"
        align="left"
        prop="ruleName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="错误级别" align="center" prop="errorLevel" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ERROR_LEVEL" :value="scope.row.errorLevel" />
        </template>
      </el-table-column>
      <el-table-column
        label="错误提示"
        align="left"
        prop="errorMessage"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column
        label="错误数据定位"
        align="left"
        prop="location"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="是否已处理" align="center" prop="handled" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.handled ? 'success' : 'info'">
            {{ scope.row.handled ? '已处理' : '未处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理人" align="center" prop="handler" width="100">
        <template #default="scope">{{ scope.row.handler || '-' }}</template>
      </el-table-column>
      <el-table-column label="处理时间" align="center" prop="handleTime" width="170">
        <template #default="scope">{{ scope.row.handleTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="170" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:check-result:detail']"
          >
            详情
          </el-button>
          <el-button
            v-if="!scope.row.handled"
            link
            type="success"
            @click="handleMarkHandled(scope.row)"
          >
            标记已处理
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

  <!-- 详情抽屉 -->
  <el-drawer v-model="detailVisible" title="校验结果详情" size="640px">
    <el-descriptions v-if="detail" v-loading="detailLoading" :column="1" border label-width="110px">
      <el-descriptions-item label="机构">{{ detail.orgName }}</el-descriptions-item>
      <el-descriptions-item label="报表">
        {{ detail.reportCode }} {{ detail.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="期次">{{ detail.period }}</el-descriptions-item>
      <el-descriptions-item label="校验任务号">{{ detail.taskNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="规则">
        {{ detail.ruleCode }} {{ detail.ruleName }}
      </el-descriptions-item>
      <el-descriptions-item label="规则类型">
        <dict-tag :type="DICT_TYPE.CR_RULE_TYPE" :value="detail.ruleType" />
      </el-descriptions-item>
      <el-descriptions-item label="错误级别">
        <dict-tag :type="DICT_TYPE.CR_ERROR_LEVEL" :value="detail.errorLevel" />
      </el-descriptions-item>
      <el-descriptions-item label="规则表达式">
        <span class="text-12px">{{ formatExpression(detail) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="错误提示">{{ detail.errorMessage }}</el-descriptions-item>
      <el-descriptions-item label="错误数据定位">{{ detail.location }}</el-descriptions-item>
      <el-descriptions-item label="实际值">
        <span class="font-bold text-[#f56c6c]">{{ detail.actualValue }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="期望值">
        <span class="font-bold text-[#67c23a]">{{ detail.expectValue }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="是否已处理">
        <el-tag :type="detail.handled ? 'success' : 'info'">
          {{ detail.handled ? '已处理' : '未处理' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="处理人">{{ detail.handler || '-' }}</el-descriptions-item>
      <el-descriptions-item label="处理时间">{{ detail.handleTime || '-' }}</el-descriptions-item>
      <el-descriptions-item label="处理说明">{{ detail.handleRemark || '-' }}</el-descriptions-item>
      <el-descriptions-item label="发现时间">{{ detail.createTime || '-' }}</el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button v-if="detail && !detail.handled" type="primary" @click="handleMarkHandled(detail)">
        标记已处理
      </el-button>
      <el-button @click="detailVisible = false">关 闭</el-button>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as CheckResultApi from '@/api/cr/check/result'

defineOptions({ name: 'CrCheckResult' })

const message = useMessage()
const route = useRoute()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']

const loading = ref(true)
const total = ref(0)
const list = ref<CheckResultApi.CheckResultVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: (route.query.period as string) || '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  errorLevel: undefined as number | undefined,
  ruleType: undefined as number | undefined,
  handled: undefined as boolean | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<CheckResultApi.CheckOrgOptionVO[]>([])
const reportOptions = ref<CheckResultApi.CheckReportOptionVO[]>([])

/** 规则表达式的可读写法：非空只看字段，枚举是「字段 ∈ 码值表」 */
const formatExpression = (row: CheckResultApi.CheckResultVO) => {
  if (row.ruleType === 1) return row.leftExpression
  if (row.ruleType === 6) return `${row.leftExpression} ∈ ${row.rightExpression}`
  return `${row.leftExpression} ${row.operator} ${row.rightExpression}`
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await CheckResultApi.getCheckResultPage(queryParams)
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

/** 详情抽屉 */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<CheckResultApi.CheckResultVO>()
const openDetail = async (id: number) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = undefined
  try {
    detail.value = await CheckResultApi.getCheckResult(id)
  } finally {
    detailLoading.value = false
  }
}

/** 标记已处理（二次确认） */
const handleMarkHandled = async (row: CheckResultApi.CheckResultVO) => {
  try {
    await message.confirm(
      `确认将「${row.ruleName}」这条${row.errorLevel === 2 ? '错误' : '警告'}标记为已处理吗？`,
      '标记已处理'
    )
    await CheckResultApi.handleCheckResult({ id: row.id! })
    message.success('已标记处理完成')
    detailVisible.value = false
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await CheckResultApi.exportCheckResult(queryParams)
    download.excel(data, '校验结果.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, reports] = await Promise.all([
    CheckResultApi.getCheckResultOrgOptions(),
    CheckResultApi.getCheckResultReportOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  getList()
  initOptions()
})
</script>
