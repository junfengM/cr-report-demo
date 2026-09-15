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
      <el-form-item label="审核时间" prop="auditTime">
        <el-date-picker
          v-model="queryParams.auditTime"
          type="daterange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :default-time="[new Date('1 00:00:00'), new Date('1 23:59:59')]"
          class="!w-260px"
        />
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 审核人 / 审核意见"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:audit-result:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表：历史审核结论 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="审核结论按「机构 × 报表 × 期次」留痕，多轮审核（退回整改后重报）会形成多条记录，点击「查看详情」可查看审核意见全文与关联问题清单。"
    />
    <el-table v-loading="loading" :data="list">
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
      <el-table-column label="批次号" align="center" prop="batchNo" width="140" />
      <el-table-column label="轮次" align="center" prop="auditRound" width="80">
        <template #default="scope">第 {{ scope.row.auditRound }} 轮</template>
      </el-table-column>
      <el-table-column label="审核结论" align="center" prop="auditStatus" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_AUDIT_STATUS" :value="scope.row.auditStatus" />
        </template>
      </el-table-column>
      <el-table-column label="审核人" align="center" prop="auditor" width="100" />
      <el-table-column label="审核时间" align="center" prop="auditTime" width="170" />
      <el-table-column
        label="审核意见"
        align="left"
        prop="auditOpinion"
        min-width="280"
        show-overflow-tooltip
      />
      <el-table-column label="问题数量" align="center" prop="issueCount" width="100">
        <template #default="scope">
          <el-tag
            :type="scope.row.issueCount ? 'warning' : 'success'"
            size="small"
            disable-transitions
          >
            {{ scope.row.issueCount }} 个
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="120" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:audit-result:query']"
          >
            查看详情
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

  <!-- 详情抽屉：审核意见全文 + 关联问题清单 -->
  <el-drawer v-model="detailVisible" title="审核结果详情" size="760px">
    <el-descriptions
      v-if="detail"
      v-loading="detailLoading"
      :column="2"
      border
      size="small"
      label-width="90px"
      class="mb-14px"
    >
      <el-descriptions-item label="机构">{{ detail.orgName }}</el-descriptions-item>
      <el-descriptions-item label="报送期次">{{ detail.period }}</el-descriptions-item>
      <el-descriptions-item label="报表名称" :span="2">
        {{ detail.reportCode }} {{ detail.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="批次号">{{ detail.batchNo }}</el-descriptions-item>
      <el-descriptions-item label="审核轮次">第 {{ detail.auditRound }} 轮</el-descriptions-item>
      <el-descriptions-item label="审核结论">
        <dict-tag :type="DICT_TYPE.CR_AUDIT_STATUS" :value="detail.auditStatus" />
      </el-descriptions-item>
      <el-descriptions-item label="审核人">{{ detail.auditor || '-' }}</el-descriptions-item>
      <el-descriptions-item label="审核时间">{{ detail.auditTime || '-' }}</el-descriptions-item>
      <el-descriptions-item label="数据行数">{{ detail.rowCount }} 行</el-descriptions-item>
      <el-descriptions-item label="提交时间">{{ detail.submitTime || '-' }}</el-descriptions-item>
      <el-descriptions-item label="问题数量" :span="2">
        共 {{ detail.issueCount }} 个（错误 {{ detail.errorCount }} / 警告 {{ detail.warnCount }}）
      </el-descriptions-item>
    </el-descriptions>

    <div v-if="detail" class="mb-14px">
      <div class="mb-8px font-bold">审核意见全文</div>
      <div class="audit-opinion">{{ detail.auditOpinion || '（无审核意见）' }}</div>
    </div>

    <div v-if="detail">
      <div class="mb-8px font-bold"> 关联问题清单（{{ detail.problems?.length || 0 }} 条） </div>
      <el-table v-loading="detailLoading" :data="detail.problems || []" size="small" border>
        <el-table-column
          label="数据定位"
          align="left"
          prop="location"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column label="字段名称" align="center" prop="columnName" width="110" />
        <el-table-column
          label="原值"
          align="left"
          prop="originalValue"
          width="150"
          show-overflow-tooltip
        >
          <template #default="scope">
            <span class="text-[#f56c6c]">{{ scope.row.originalValue || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="错误级别" align="center" prop="errorLevel" width="100">
          <template #default="scope">
            <el-tag
              :type="scope.row.errorLevel === 2 ? 'danger' : 'warning'"
              size="small"
              disable-transitions
            >
              {{ scope.row.errorLevelName || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="审核意见"
          align="left"
          prop="auditOpinion"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column label="填报状态" align="center" prop="statusName" width="100">
          <template #default="scope">{{ scope.row.statusName || '-' }}</template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <el-button @click="detailVisible = false">关 闭</el-button>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ResultApi from '@/api/cr/audit/result'

defineOptions({ name: 'CrAuditResult' })

const message = useMessage()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']

const loading = ref(true)
const total = ref(0)
const list = ref<ResultApi.AuditResultVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  auditStatus: undefined as number | undefined,
  auditTime: [] as string[],
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<ResultApi.AuditOrgOptionVO[]>([])
const reportOptions = ref<ResultApi.AuditReportOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ResultApi.getAuditResultPage(queryParams)
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

/** 详情抽屉：审核意见全文 + 关联问题清单 */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<ResultApi.AuditResultVO>()
const openDetail = async (id: number) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = undefined
  try {
    detail.value = await ResultApi.getAuditResult(id)
  } finally {
    detailLoading.value = false
  }
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ResultApi.exportAuditResult(queryParams)
    download.excel(data, '审核结果.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, reports] = await Promise.all([
    ResultApi.getAuditResultOrgOptions(),
    ResultApi.getAuditResultReportOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
}

onMounted(() => {
  getList()
  initOptions()
})
</script>

<style scoped>
.audit-opinion {
  padding: 10px 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-primary);
  border-radius: 4px;
  background-color: var(--el-fill-color-lighter);
}
</style>
