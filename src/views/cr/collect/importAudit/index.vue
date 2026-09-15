<template>
  <ContentWrap>
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="72px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 机构 / 报表 / 提交人"
          clearable
          class="!w-230px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-170px"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="请选择期次" clearable class="!w-150px">
          <el-option
            v-for="item in periodOptions"
            :key="item.period"
            :label="item.period"
            :value="item.period"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="审核状态" prop="status">
        <el-select
          v-model="queryParams.status"
          placeholder="请选择审核状态"
          clearable
          class="!w-150px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_AUDIT_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:import-audit:query']"
          ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
        >
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:import-audit:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="只有「导入设置」里勾了「入库前审核」或有错误行的批次才会进这里：审核通过才把暂存数据写进填报数据，驳回则整批不写入（机构可以整改后重新导入）。审核前建议先看批次详情里的错误行与暂存数据。"
    />
    <el-row :gutter="12" class="mb-10px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <div class="rounded border border-solid border-[var(--el-border-color)] px-12px py-8px">
          <div class="text-12px text-gray-500">{{ card.label }}</div>
          <div class="text-20px font-bold" :class="card.class">{{ card.value }}</div>
        </div>
      </el-col>
    </el-row>
    <el-table v-loading="loading" :data="list">
      <el-table-column label="批次号" align="center" prop="batchNo" width="140" fixed="left">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.taskId)"
            v-hasPermi="['cr:import-audit:detail']"
          >
            {{ scope.row.batchNo }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column
        label="报送机构"
        align="left"
        prop="orgName"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column label="报表" align="left" min-width="190" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.reportName }}</template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="总行数" align="center" prop="totalRows" width="90" />
      <el-table-column label="成功 / 失败" align="center" width="110">
        <template #default="scope">
          <span class="text-[var(--el-color-success)]">{{ scope.row.successRows }}</span>
          <span class="mx-2px">/</span>
          <span :class="scope.row.failRows ? 'text-[var(--el-color-danger)]' : ''">{{
            scope.row.failRows
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="提交人" align="center" prop="submitUser" width="110" />
      <el-table-column label="提交时间" align="center" prop="submitTime" width="170" />
      <el-table-column label="审核状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_AUDIT_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="审核人" align="center" prop="auditor" width="110" />
      <el-table-column label="审核时间" align="center" prop="auditTime" width="170" />
      <el-table-column
        label="审核意见"
        align="left"
        prop="auditRemark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="170" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.taskId)"
            v-hasPermi="['cr:import-audit:detail']"
            >批次详情</el-button
          >
          <el-button
            v-if="scope.row.status === 0"
            link
            type="warning"
            @click="openAudit(scope.row)"
            v-hasPermi="['cr:import-audit:audit']"
            >审核</el-button
          >
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

  <ImportDetailDialog ref="detailRef" />

  <el-dialog v-model="auditVisible" title="导入批次审核" width="560px" append-to-body>
    <el-descriptions v-if="auditRow" :column="2" size="small" border class="mb-15px">
      <el-descriptions-item label="批次号">{{ auditRow.batchNo }}</el-descriptions-item>
      <el-descriptions-item label="机构 / 期次"
        >{{ auditRow.orgName }} / {{ auditRow.period }}</el-descriptions-item
      >
      <el-descriptions-item label="报表">{{ auditRow.reportName }}</el-descriptions-item>
      <el-descriptions-item label="总行数"
        >{{ auditRow.totalRows }}（错误 {{ auditRow.failRows }}）</el-descriptions-item
      >
    </el-descriptions>
    <el-form label-width="90px">
      <el-form-item label="审核结论">
        <el-radio-group v-model="auditForm.pass">
          <el-radio :value="true">通过（写入填报数据）</el-radio>
          <el-radio :value="false">驳回（整批不写入）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="审核意见" required>
        <el-input
          v-model="auditForm.remark"
          type="textarea"
          :rows="3"
          :placeholder="
            auditForm.pass
              ? '如：错误行为可忽略的存量数据，同意入库'
              : '请写明驳回原因，机构需要据此整改后重新导入'
          "
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="auditVisible = false">取 消</el-button>
      <el-button type="primary" :loading="auditLoading" @click="submitAudit">确 定</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ImportAuditApi from '@/api/cr/collect/importAudit'
import {
  getCollectOrgOptions,
  getCollectPeriodOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectPeriodOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import ImportDetailDialog from '../import/ImportDetailDialog.vue'

defineOptions({ name: 'CrCollectImportAudit' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ImportAuditApi.ImportAuditVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: undefined as string | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const periodOptions = ref<CollectPeriodOptionVO[]>([])

const statCards = computed(() => [
  {
    label: '本页待审核',
    value: list.value.filter((row) => row.status === 0).length,
    class: 'text-[var(--el-color-warning)]'
  },
  {
    label: '本页已通过',
    value: list.value.filter((row) => row.status === 1).length,
    class: 'text-[var(--el-color-success)]'
  },
  {
    label: '本页已驳回',
    value: list.value.filter((row) => row.status === 2).length,
    class: 'text-[var(--el-color-danger)]'
  },
  {
    label: '本页待入库行数',
    value: list.value
      .filter((row) => row.status === 0)
      .reduce((sum, row) => sum + row.successRows, 0),
    class: ''
  }
])

const getList = async () => {
  loading.value = true
  try {
    const data = await ImportAuditApi.getImportAuditPage(queryParams)
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
  handleQuery()
}

const detailRef = ref()
const openDetail = (taskId: number) => {
  detailRef.value.open(taskId)
}

const auditVisible = ref(false)
const auditLoading = ref(false)
const auditRow = ref<ImportAuditApi.ImportAuditVO | null>(null)
const auditForm = reactive({ id: 0, pass: true, remark: '' })

const openAudit = (row: ImportAuditApi.ImportAuditVO) => {
  auditRow.value = row
  auditForm.id = row.id!
  auditForm.pass = true
  auditForm.remark = ''
  auditVisible.value = true
}

/** 审核：通过会把暂存数据写进填报数据，驳回则整批作废 */
const submitAudit = async () => {
  if (!auditForm.remark) {
    message.warning('请填写审核意见')
    return
  }
  auditLoading.value = true
  try {
    const result = await ImportAuditApi.auditImport({ ...auditForm })
    message.success(
      auditForm.pass
        ? '审核通过，批次 ' + result.batchNo + ' 已写入 ' + result.writtenRows + ' 行填报数据'
        : '已驳回批次 ' + result.batchNo + '，数据未写入'
    )
    auditVisible.value = false
    await getList()
  } finally {
    auditLoading.value = false
  }
}

const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ImportAuditApi.exportImportAudit(queryParams)
    download.excel(data, '导入审核.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  orgOptions.value = (await getCollectOrgOptions()) || []
  reportOptions.value = (await getCollectReportOptions()) || []
  periodOptions.value = (await getCollectPeriodOptions()) || []
  getList()
})
</script>
