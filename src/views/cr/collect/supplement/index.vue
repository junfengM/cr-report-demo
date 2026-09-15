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
          placeholder="申请单号 / 机构 / 原因 / 申请人"
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
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-150px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_SUPPLEMENT_STATUS)"
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
          @click="openForm('create')"
          v-hasPermi="['cr:collect-supplement:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增补录申请
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:collect-supplement:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:collect-supplement:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
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
      title="数据补录是漏报、错报的补救通道：机构提交补录申请 → 管理员审核 → 执行补录打开通道 → 机构在数据填报页重新录入或再次导入文件。只有「报送期次设置」里允许补录的期次才能执行。"
    />
    <el-row :gutter="12" class="mb-10px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <div class="rounded border border-solid border-[var(--el-border-color)] px-12px py-8px">
          <div class="text-12px text-gray-500">{{ card.label }}</div>
          <div class="text-20px font-bold" :class="card.class">{{ card.value }}</div>
        </div>
      </el-col>
    </el-row>
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="申请单号" align="center" prop="applyNo" width="150" fixed="left">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row)"
            v-hasPermi="['cr:collect-supplement:query']"
          >
            {{ scope.row.applyNo }}
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
        <template #default="scope">{{ scope.row.reportCode }} {{ scope.row.reportName }}</template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="补录范围" align="center" width="110">
        <template #default="scope">
          <el-tag size="small" :type="scope.row.scopeType === 1 ? 'warning' : 'info'">
            {{ scope.row.scopeType === 1 ? '整表补录' : '指定行补录' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="补录行数" align="center" prop="rowCount" width="90" />
      <el-table-column
        label="补录原因"
        align="left"
        prop="reason"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="申请人" align="center" prop="applyUser" width="110" />
      <el-table-column label="申请时间" align="center" prop="applyTime" width="170" />
      <el-table-column label="状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_SUPPLEMENT_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="审核人" align="center" prop="auditor" width="110" />
      <el-table-column
        label="审核意见"
        align="left"
        prop="auditRemark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="完成时间" align="center" prop="finishTime" width="170" />
      <!-- 附件：有真实文件（已查过 file-list 且数量 > 0）才做成能点开的入口，只有登记名时按普通文本展示 -->
      <el-table-column label="附件" align="left" min-width="190">
        <template #default="scope">
          <el-button
            v-if="hasRealFiles(scope.row)"
            link
            type="primary"
            @click="openFileDialog(scope.row)"
            v-hasPermi="['cr:collect-supplement:query']"
          >
            <Icon icon="ep:paperclip" class="mr-3px" /> 附件（{{ fileCountOf(scope.row) }}）
          </el-button>
          <el-tooltip
            v-else-if="scope.row.attachment"
            placement="top"
            :content="
              '附件登记名：' +
              scope.row.attachment +
              '（历史记录只登记了材料名称，没有文件内容，点「附件」可确认）'
            "
          >
            <span class="text-gray-400">
              {{ scope.row.attachment }}
              <span class="text-12px">（仅登记名称）</span>
            </span>
          </el-tooltip>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="280" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row)"
            v-hasPermi="['cr:collect-supplement:query']"
            >详情</el-button
          >
          <el-button
            link
            type="primary"
            @click="openFileDialog(scope.row)"
            v-hasPermi="['cr:collect-supplement:query']"
            >附件</el-button
          >
          <el-button
            v-if="scope.row.status === 1"
            link
            type="warning"
            @click="openAudit(scope.row)"
            v-hasPermi="['cr:collect-supplement:audit']"
            >审核</el-button
          >
          <el-button
            v-if="scope.row.status === 2"
            link
            type="success"
            @click="handleExecute(scope.row)"
            v-hasPermi="['cr:collect-supplement:execute']"
            >执行补录</el-button
          >
          <el-button
            v-if="scope.row.status === 1"
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:collect-supplement:update']"
            >编辑</el-button
          >
          <el-button
            v-if="scope.row.status === 1 || scope.row.status === 3"
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:collect-supplement:delete']"
            >删除</el-button
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

  <SupplementForm ref="formRef" @success="getList" />

  <SupplementFileDialog ref="fileDialogRef" @file-count="handleFileCount" />

  <!-- 详情抽屉：附带该机构该报表本期的填报与导入现状，方便审核人决策 -->
  <el-drawer v-model="detailVisible" title="补录申请详情" size="46%">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="申请单号">{{ detail?.applyNo }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <dict-tag :type="DICT_TYPE.CR_SUPPLEMENT_STATUS" :value="detail?.status" />
      </el-descriptions-item>
      <el-descriptions-item label="报送机构 / 报表">
        {{ detail?.orgName }} / {{ detail?.reportCode }} {{ detail?.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="期次 / 范围">
        {{ detail?.period }} / {{ detail?.scopeType === 1 ? '整表补录' : '指定行补录' }}（{{
          detail?.rowCount
        }}
        行）
      </el-descriptions-item>
      <el-descriptions-item label="补录原因">{{ detail?.reason }}</el-descriptions-item>
      <el-descriptions-item label="申请人 / 申请时间"
        >{{ detail?.applyUser }} / {{ detail?.applyTime }}</el-descriptions-item
      >
      <el-descriptions-item label="审核人 / 审核时间"
        >{{ detail?.auditor || '—' }} / {{ detail?.auditTime || '—' }}</el-descriptions-item
      >
      <el-descriptions-item label="审核意见">{{ detail?.auditRemark || '—' }}</el-descriptions-item>
      <el-descriptions-item label="附件">{{ detail?.attachment || '—' }}</el-descriptions-item>
      <el-descriptions-item label="备注">{{ detail?.remark || '—' }}</el-descriptions-item>
    </el-descriptions>

    <div class="mt-15px mb-6px font-bold">本期数据现状</div>
    <el-descriptions v-if="context" :column="1" border size="small">
      <el-descriptions-item label="已填报数据">{{ context.fillRows }} 行</el-descriptions-item>
      <el-descriptions-item label="该期是否允许补录">
        <el-tag :type="context.allowSupplement ? 'success' : 'danger'" size="small">
          {{ context.allowSupplement ? '允许补录' : '未开放补录' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="相关导入批次">
        <div v-if="context.importTasks.length">
          <div v-for="task in context.importTasks" :key="task.batchNo">
            {{ task.batchNo }} ·
            <dict-tag :type="DICT_TYPE.CR_IMPORT_STATUS" :value="task.status" />
            · {{ task.totalRows }} 行 · {{ task.importTime }}
          </div>
        </div>
        <span v-else class="text-gray-400">本期还没有导入批次</span>
      </el-descriptions-item>
    </el-descriptions>
    <el-skeleton v-else :rows="3" animated />
  </el-drawer>

  <el-dialog v-model="auditVisible" title="补录申请审核" width="560px" append-to-body>
    <el-descriptions v-if="auditRow" :column="2" size="small" border class="mb-15px">
      <el-descriptions-item label="申请单号">{{ auditRow.applyNo }}</el-descriptions-item>
      <el-descriptions-item label="机构 / 期次"
        >{{ auditRow.orgName }} / {{ auditRow.period }}</el-descriptions-item
      >
      <el-descriptions-item label="报表">{{ auditRow.reportName }}</el-descriptions-item>
      <el-descriptions-item label="补录行数">{{ auditRow.rowCount }}</el-descriptions-item>
    </el-descriptions>
    <el-form label-width="90px">
      <el-form-item label="审核结论">
        <el-radio-group v-model="auditForm.pass">
          <el-radio :value="true">通过（允许执行补录）</el-radio>
          <el-radio :value="false">驳回</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="审核意见" required>
        <el-input
          v-model="auditForm.remark"
          type="textarea"
          :rows="3"
          :placeholder="
            auditForm.pass ? '如：情况属实，同意补录，请于 3 个工作日内完成' : '请写明驳回原因'
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
import * as SupplementApi from '@/api/cr/collect/supplement'
import {
  getCollectOrgOptions,
  getCollectPeriodOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectPeriodOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import SupplementForm from './SupplementForm.vue'
import SupplementFileDialog from './SupplementFileDialog.vue'

defineOptions({ name: 'CrCollectSupplement' })

const message = useMessage()
const { t } = useI18n()
const router = useRouter()

const loading = ref(true)
const total = ref(0)
const list = ref<SupplementApi.SupplementVO[]>([])
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
    value: list.value.filter((row) => row.status === 1).length,
    class: 'text-[var(--el-color-warning)]'
  },
  {
    label: '待执行补录',
    value: list.value.filter((row) => row.status === 2).length,
    class: 'text-[var(--el-color-primary)]'
  },
  {
    label: '已补录',
    value: list.value.filter((row) => row.status === 4).length,
    class: 'text-[var(--el-color-success)]'
  },
  {
    label: '本页申请行数',
    value: list.value.reduce((sum, row) => sum + row.rowCount, 0),
    class: ''
  }
])

const getList = async () => {
  loading.value = true
  try {
    const data = await SupplementApi.getSupplementPage(queryParams)
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

const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/**
 * 附件入口。
 * 行里的 attachment 是服务端同步的「附件名顿号连接」字符串，历史数据只有登记名、
 * 没有文件内容，所以这里先按需拉一次 file-list（不返回 base64，可以放心拉）确认
 * 到底有没有真实文件，只有真的有文件才渲染成能点开的入口。
 */
const fileDialogRef = ref()
const fileCountMap = ref<Record<number, number>>({})

const hasRealFiles = (row: SupplementApi.SupplementVO) => {
  if (!row.id) return false
  const count = fileCountMap.value[row.id]
  return typeof count === 'number' && count > 0
}

const fileCountOf = (row: SupplementApi.SupplementVO) =>
  row.id ? fileCountMap.value[row.id] || 0 : 0

const refreshFileCount = async (row: SupplementApi.SupplementVO) => {
  if (!row.id) return
  const files = (await SupplementApi.getSupplementFileList(row.id)) || []
  fileCountMap.value = { ...fileCountMap.value, [row.id]: files.length }
}

const openFileDialog = async (row: SupplementApi.SupplementVO) => {
  // 先确认一次文件数：入口按钮/附件列的展示依赖它，避免「登记名」被当成可下载的文件
  await refreshFileCount(row)
  fileDialogRef.value?.open(row.id!, row.applyNo, row.status === 1 || row.status === 3)
}

/** 附件弹窗内增删后同步附件列的文件数 */
const handleFileCount = (payload: { supplementId: number; count: number }) => {
  fileCountMap.value = { ...fileCountMap.value, [payload.supplementId]: payload.count }
}

/** 详情：同时查该机构该报表本期的数据现状 */
const detailVisible = ref(false)
const detail = ref<SupplementApi.SupplementVO | null>(null)
const context = ref<any>(null)

const openDetail = async (row: SupplementApi.SupplementVO) => {
  detail.value = row
  context.value = null
  detailVisible.value = true
  context.value = await SupplementApi.getSupplementContext({
    orgId: row.orgId,
    reportId: row.reportId,
    period: row.period
  })
}

const auditVisible = ref(false)
const auditLoading = ref(false)
const auditRow = ref<SupplementApi.SupplementVO | null>(null)
const auditForm = reactive({ id: 0, pass: true, remark: '' })

const openAudit = (row: SupplementApi.SupplementVO) => {
  auditRow.value = row
  auditForm.id = row.id!
  auditForm.pass = true
  auditForm.remark = ''
  auditVisible.value = true
}

const submitAudit = async () => {
  if (!auditForm.remark) {
    message.warning('请填写审核意见')
    return
  }
  auditLoading.value = true
  try {
    await SupplementApi.auditSupplement({ ...auditForm })
    message.success(auditForm.pass ? '审核通过，可以执行补录了' : '已驳回该补录申请')
    auditVisible.value = false
    await getList()
  } finally {
    auditLoading.value = false
  }
}

/**
 * 执行补录：打开补录通道（把该机构该报表本期的填报记录置为待补录），
 * 然后问一下要不要直接跳到数据填报页。
 */
const handleExecute = async (row: SupplementApi.SupplementVO) => {
  try {
    await message.confirm(
      '对申请单 ' + row.applyNo + ' 执行补录？执行后该机构可以重新录入或导入本期数据。'
    )
    const result = await SupplementApi.executeSupplement({ id: row.id! })
    await getList()
    try {
      await message.confirm(result.message + '，是否现在跳到数据填报页？', '补录通道已打开')
      await router.push(result.fillLink)
    } catch {}
  } catch {}
}

const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await SupplementApi.deleteSupplement(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: SupplementApi.SupplementVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await SupplementApi.deleteSupplementList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await SupplementApi.exportSupplement(queryParams)
    download.excel(data, '数据补录申请.xls')
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
