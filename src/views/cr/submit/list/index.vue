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
      <el-form-item label="批次号" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 报送人"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="机构" prop="orgId">
        <el-select v-model="queryParams.orgId" placeholder="请选择机构" clearable class="!w-180px">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
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
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option
            v-for="item in BATCH_STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
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
          v-hasPermi="['cr:submit-list:download']"
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
      title="报送清单按「报送批次」记录每次一键报送的结果，展开任意批次可查看该批次下每张报表的报文文件与上报状态。"
    />
    <el-table v-loading="loading" :data="list" row-key="id" @expand-change="handleExpandChange">
      <el-table-column type="expand">
        <template #default="scope">
          <div class="batch-detail">
            <div class="mb-8px flex items-center justify-between">
              <span class="font-bold">批次明细（{{ scope.row.batchNo }}）</span>
              <span class="text-12px text-[#909399]">
                共 {{ scope.row.reportCount }} 张报表 / {{ formatNumber(scope.row.totalRows) }} 行 /
                {{ formatFileSize(scope.row.totalSize) }}
              </span>
            </div>
            <el-table
              v-loading="itemLoading[scope.row.id]"
              :data="itemMap[scope.row.id] || []"
              size="small"
              border
            >
              <el-table-column label="报表编码" align="center" prop="reportCode" width="100" />
              <el-table-column
                label="报表名称"
                align="left"
                prop="reportName"
                min-width="220"
                show-overflow-tooltip
              />
              <el-table-column
                label="报文文件名"
                align="left"
                prop="fileName"
                min-width="220"
                show-overflow-tooltip
              />
              <el-table-column label="数据行数" align="right" prop="rowCount" width="110">
                <template #default="scope">{{ formatNumber(scope.row.rowCount) }}</template>
              </el-table-column>
              <el-table-column label="文件大小" align="right" prop="fileSize" width="110">
                <template #default="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
              </el-table-column>
              <el-table-column label="上报状态" align="center" prop="submitStatus" width="110">
                <template #default="scope">
                  <el-tag :type="submitStatusTag(scope.row.submitStatus)">
                    {{ submitStatusName(scope.row.submitStatus) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="上报时间" align="center" prop="submitTime" width="170">
                <template #default="scope">{{ scope.row.submitTime || '-' }}</template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="报送批次号" align="center" prop="batchNo" width="150" fixed="left" />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="报表数量" align="center" prop="reportCount" width="100">
        <template #default="scope">{{ scope.row.reportCount }} 张</template>
      </el-table-column>
      <el-table-column label="数据总行数" align="right" prop="totalRows" width="120">
        <template #default="scope">{{ formatNumber(scope.row.totalRows) }}</template>
      </el-table-column>
      <el-table-column label="文件总大小" align="right" prop="totalSize" width="120">
        <template #default="scope">{{ formatFileSize(scope.row.totalSize) }}</template>
      </el-table-column>
      <el-table-column label="报送人" align="center" prop="submitter" width="100" />
      <el-table-column label="报送时间" align="center" prop="submitTime" width="170">
        <template #default="scope">{{ scope.row.submitTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="130">
        <template #default="scope">
          <el-tag :type="batchStatusTag(scope.row.status)">
            {{ batchStatusName(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="110" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="openDetail(scope.row)">查看明细</el-button>
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

  <!-- 明细抽屉 -->
  <el-drawer v-model="detailVisible" title="报文明细" size="760px">
    <div v-if="detailBatch" v-loading="detailLoading">
      <el-descriptions :column="2" border class="mb-15px">
        <el-descriptions-item label="报送批次号">{{ detailBatch.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="机构">{{ detailBatch.orgName }}</el-descriptions-item>
        <el-descriptions-item label="报送期次">{{ detailBatch.period }}</el-descriptions-item>
        <el-descriptions-item label="报送人">{{
          detailBatch.submitter || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="报送时间">{{
          detailBatch.submitTime || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="batchStatusTag(detailBatch.status)">
            {{ batchStatusName(detailBatch.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="报表数量">
          {{ detailBatch.reportCount }} 张
        </el-descriptions-item>
        <el-descriptions-item label="数据总行数">
          {{ formatNumber(detailBatch.totalRows) }} 行
        </el-descriptions-item>
        <el-descriptions-item label="文件总大小">
          {{ formatFileSize(detailBatch.totalSize) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ detailBatch.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="detailItems" border>
        <el-table-column label="报表编码" align="center" prop="reportCode" width="100" />
        <el-table-column
          label="报表名称"
          align="left"
          prop="reportName"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          label="报文文件名"
          align="left"
          prop="fileName"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column label="数据行数" align="right" prop="rowCount" width="110">
          <template #default="scope">{{ formatNumber(scope.row.rowCount) }}</template>
        </el-table-column>
        <el-table-column label="文件大小" align="right" prop="fileSize" width="110">
          <template #default="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="上报状态" align="center" prop="submitStatus" width="110">
          <template #default="scope">
            <el-tag :type="submitStatusTag(scope.row.submitStatus)">
              {{ submitStatusName(scope.row.submitStatus) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-drawer>
</template>

<script lang="ts" setup>
import download from '@/utils/download'
import * as SubmitListApi from '@/api/cr/submit/list'
import {
  BATCH_STATUS_OPTIONS,
  batchStatusName,
  batchStatusTag,
  formatFileSize,
  formatNumber,
  submitStatusName,
  submitStatusTag
} from '../constants'

defineOptions({ name: 'CrSubmitList' })

const message = useMessage()

const loading = ref(true)
const total = ref(0)
const list = ref<SubmitListApi.SubmitListVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  orgId: undefined as number | undefined,
  period: '',
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<SubmitListApi.SubmitOrgOptionVO[]>([])
const periodOptions = ref<string[]>([])

/** 展开行明细缓存：batchId → 明细列表 */
const itemMap = ref<Record<number, SubmitListApi.SubmitBatchItemVO[]>>({})
const itemLoading = ref<Record<number, boolean>>({})

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await SubmitListApi.getSubmitListPage(queryParams)
    list.value = data.list
    total.value = data.total
    // 已展开的行需要重新拉取明细（分页 / 搜索后行内容已变化）
    itemMap.value = {}
    itemLoading.value = {}
  } finally {
    loading.value = false
  }
}

/** 加载批次明细 */
const loadItems = async (batchId: number) => {
  itemLoading.value = { ...itemLoading.value, [batchId]: true }
  try {
    const data = await SubmitListApi.getSubmitListItems(batchId)
    itemMap.value = { ...itemMap.value, [batchId]: data || [] }
  } finally {
    itemLoading.value = { ...itemLoading.value, [batchId]: false }
  }
}

/** 展开行时按需加载明细 */
const handleExpandChange = (row: SubmitListApi.SubmitListVO, expanded: any[]) => {
  const isExpanded = Array.isArray(expanded)
    ? expanded.some((item) => item.id === row.id)
    : Boolean(expanded)
  if (isExpanded && !itemMap.value[row.id!]) {
    loadItems(row.id!)
  }
}

/** 查看明细（抽屉） */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailBatch = ref<SubmitListApi.SubmitListVO | null>(null)
const detailItems = ref<SubmitListApi.SubmitBatchItemVO[]>([])
const openDetail = async (row: SubmitListApi.SubmitListVO) => {
  detailBatch.value = row
  detailItems.value = []
  detailVisible.value = true
  detailLoading.value = true
  try {
    detailItems.value = (await SubmitListApi.getSubmitListItems(row.id!)) || []
  } finally {
    detailLoading.value = false
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

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await SubmitListApi.exportSubmitList(queryParams)
    download.excel(data, '数据报送清单.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

const initOptions = async () => {
  const [orgs, periods] = await Promise.all([
    SubmitListApi.getSubmitListOrgOptions(),
    SubmitListApi.getSubmitListPeriodOptions()
  ])
  orgOptions.value = orgs || []
  periodOptions.value = periods || []
}

onMounted(() => {
  initOptions()
  getList()
})
</script>

<style lang="scss" scoped>
.batch-detail {
  padding: 10px 20px 14px;
  background-color: var(--el-fill-color-lighter);
}
</style>
