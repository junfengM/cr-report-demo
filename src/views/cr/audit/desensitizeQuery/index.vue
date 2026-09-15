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
          class="!w-260px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="`${report.code} ${report.name}`"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="数据项" prop="columnCode">
        <el-select
          v-model="queryParams.columnCode"
          placeholder="请选择数据项"
          clearable
          class="!w-180px"
        >
          <el-option
            v-for="item in columnOptions"
            :key="item.columnCode"
            :label="item.columnName"
            :value="item.columnCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="脱敏规则" prop="ruleType">
        <el-select
          v-model="queryParams.ruleType"
          placeholder="请选择脱敏规则"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_DESENSITIZE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="投保人编号 / 保单号 / 脱敏前后值"
          clearable
          class="!w-240px"
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
          v-hasPermi="['cr:audit-desensitize:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表：脱敏前后对照，用于核对脱敏规则是否正确 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="脱敏规则：MASK 掩码（保留部分字符）/ HASH 哈希（不可逆，用于比对）/ REPLACE 替换（统一为固定值）/ TRUNCATE 截断（保留前 N 位）。此处展示的原文仅用于核对脱敏是否正确，实际上报报文只包含脱敏后的结果。"
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
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column
        label="数据项名称"
        align="left"
        prop="columnName"
        width="130"
        show-overflow-tooltip
      >
        <template #default="scope">
          {{ scope.row.columnName }}
          <span class="text-12px text-[#909399]">{{ scope.row.columnCode }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="脱敏前原文"
        align="left"
        prop="originalValue"
        min-width="190"
        show-overflow-tooltip
      >
        <template #default="scope">
          <el-text class="original-value">{{ scope.row.originalValue }}</el-text>
        </template>
      </el-table-column>
      <el-table-column
        label="脱敏后结果"
        align="left"
        prop="maskedValue"
        min-width="200"
        show-overflow-tooltip
      >
        <template #default="scope">
          <span class="masked-value">{{ scope.row.maskedValue }}</span>
        </template>
      </el-table-column>
      <el-table-column label="脱敏规则" align="center" prop="ruleType" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_DESENSITIZE_TYPE" :value="scope.row.ruleType" />
        </template>
      </el-table-column>
      <el-table-column
        label="脱敏参数"
        align="left"
        prop="ruleParam"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column label="处理时间" align="center" prop="processTime" width="170" />
      <el-table-column label="操作" align="center" width="120" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:audit-desensitize:query']"
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

  <!-- 详情抽屉：同一条数据在多个字段上的脱敏情况 -->
  <el-drawer v-model="detailVisible" title="脱敏结果详情" size="780px">
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
      <el-descriptions-item label="投保人编号">{{ detail.dataKey }}</el-descriptions-item>
      <el-descriptions-item label="保单号">{{ detail.policyNo }}</el-descriptions-item>
      <el-descriptions-item label="数据行号">第 {{ detail.rowNo }} 行</el-descriptions-item>
      <el-descriptions-item label="处理时间">{{ detail.processTime }}</el-descriptions-item>
    </el-descriptions>

    <div v-if="detail" class="mb-14px">
      <div class="mb-8px font-bold">本条记录脱敏情况</div>
      <div class="desensitize-compare">
        <div class="compare-item">
          <div class="compare-label">数据项</div>
          <div class="compare-value">
            {{ detail.columnName }}
            <span class="text-12px text-[#909399]">{{ detail.columnCode }}</span>
          </div>
        </div>
        <div class="compare-item">
          <div class="compare-label">脱敏规则</div>
          <div class="compare-value">
            <dict-tag :type="DICT_TYPE.CR_DESENSITIZE_TYPE" :value="detail.ruleType" />
            <span class="ml-6px text-12px text-[#909399]">{{ detail.ruleParam }}</span>
          </div>
        </div>
        <div class="compare-item">
          <div class="compare-label">脱敏前原文</div>
          <div class="compare-value">
            <el-text class="original-value">{{ detail.originalValue }}</el-text>
          </div>
        </div>
        <div class="compare-item">
          <div class="compare-label">脱敏后结果</div>
          <div class="compare-value">
            <span class="masked-value">{{ detail.maskedValue }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="detail">
      <div class="mb-8px font-bold">
        同一条数据（{{ detail.dataKey }}）在多个字段上的脱敏情况（{{ detail.siblings?.length || 0 }}
        项）
      </div>
      <el-table v-loading="detailLoading" :data="detail.siblings || []" size="small" border>
        <el-table-column
          label="报表名称"
          align="left"
          prop="reportName"
          min-width="170"
          show-overflow-tooltip
        />
        <el-table-column label="数据项名称" align="center" prop="columnName" width="110" />
        <el-table-column
          label="脱敏前原文"
          align="left"
          prop="originalValue"
          min-width="170"
          show-overflow-tooltip
        >
          <template #default="scope">
            <el-text class="original-value">{{ scope.row.originalValue }}</el-text>
          </template>
        </el-table-column>
        <el-table-column
          label="脱敏后结果"
          align="left"
          prop="maskedValue"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="scope">
            <span class="masked-value">{{ scope.row.maskedValue }}</span>
          </template>
        </el-table-column>
        <el-table-column label="脱敏规则" align="center" prop="ruleType" width="90">
          <template #default="scope">
            <dict-tag :type="DICT_TYPE.CR_DESENSITIZE_TYPE" :value="scope.row.ruleType" />
          </template>
        </el-table-column>
        <el-table-column
          label="脱敏参数"
          align="left"
          prop="ruleParam"
          min-width="150"
          show-overflow-tooltip
        />
      </el-table>
    </div>

    <template #footer>
      <el-button @click="detailVisible = false">关 闭</el-button>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getStrDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as DesensitizeApi from '@/api/cr/audit/desensitizeQuery'

defineOptions({ name: 'CrAuditDesensitizeQuery' })

const message = useMessage()

const periodOptions = ['202603', '202604', '202605', '202606', '202607', '202608']

const loading = ref(true)
const total = ref(0)
const list = ref<DesensitizeApi.DesensitizeQueryVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '202608',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  columnCode: undefined as string | undefined,
  ruleType: undefined as string | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<DesensitizeApi.AuditOrgOptionVO[]>([])
const reportOptions = ref<DesensitizeApi.AuditReportOptionVO[]>([])
const columnOptions = ref<DesensitizeApi.DesensitizeColumnOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DesensitizeApi.getDesensitizeQueryPage(queryParams)
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

/** 详情抽屉：同一条数据在多个字段上的脱敏情况 */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<DesensitizeApi.DesensitizeQueryVO>()
const openDetail = async (id: number) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = undefined
  try {
    detail.value = await DesensitizeApi.getDesensitizeQuery(id)
  } finally {
    detailLoading.value = false
  }
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await DesensitizeApi.exportDesensitizeQuery(queryParams)
    download.excel(data, '脱敏结果.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, reports, columns] = await Promise.all([
    DesensitizeApi.getDesensitizeOrgOptions(),
    DesensitizeApi.getDesensitizeReportOptions(),
    DesensitizeApi.getDesensitizeColumnOptions()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  columnOptions.value = columns || []
}

onMounted(() => {
  getList()
  initOptions()
})
</script>

<style scoped>
.original-value {
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
  word-break: break-all;
}

.masked-value {
  font-weight: 700;
  color: var(--el-color-primary);
  word-break: break-all;
}

.desensitize-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.compare-item {
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background-color: var(--el-fill-color-lighter);
}

.compare-label {
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.compare-value {
  word-break: break-all;
}
</style>
