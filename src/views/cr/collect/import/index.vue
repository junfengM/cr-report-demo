<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
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
          placeholder="批次号 / 机构 / 文件名 / 导入人"
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
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_IMPORT_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="来源" prop="sourceType">
        <el-select
          v-model="queryParams.sourceType"
          placeholder="请选择来源"
          clearable
          class="!w-150px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_COLLECT_CHANNEL)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:collect-import:query']"
          ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
        >
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          v-if="canImportNow"
          type="primary"
          plain
          @click="openImport"
          v-hasPermi="['cr:collect-import:import']"
        >
          <Icon icon="ep:upload" class="mr-5px" /> 数据导入
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:collect-import:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:collect-import:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
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
      title="数据导入把外部文件变成系统里的填报数据：先按「导入设置」里的生效模板解析文件，再按模板的三个开关决定——严格校验失败整批不入库、不允许覆盖时本期已有数据会拦住、需要审核时先进「导入审核」。点批次号可以看暂存数据、错误行和操作日志。"
    />

    <!-- 我的导入权限：与后端拦截同源（同一个接口算出来的），避免"横幅说能导、提交却被拒" -->
    <el-alert v-if="myAuth" class="mb-10px" :type="authAlertType" :closable="false" show-icon>
      <template #title>
        <span class="font-bold">我的导入权限</span>
        <span class="ml-6px">{{ myAuth.message }}</span>
      </template>
      <div class="text-12px leading-20px">
        <span class="mr-12px"
          >授权主体：{{ myAuth.auth.userName }}（{{
            myAuth.auth.roleNames.join(' / ') || '无角色'
          }}）</span
        >
        <span class="mr-12px">生效来源：{{ myAuth.auth.source }}</span>
        <span class="mr-12px">允许覆盖：{{ myAuth.allowOverwrite ? '是' : '否' }}</span>
        <span class="mr-12px">入库前审核：{{ myAuth.needAudit ? '是' : '否' }}</span>
        <span class="mr-12px"
          >单批上限：{{ myAuth.auth.maxRows ? myAuth.auth.maxRows + ' 行' : '不限' }}</span
        >
        <span v-if="myAuth.orgId">本期已有数据：{{ myAuth.existRows }} 行</span>
      </div>
    </el-alert>
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
      <el-table-column label="批次号" align="center" prop="batchNo" width="140" fixed="left">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:collect-import:detail']"
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
        <template #default="scope">{{ scope.row.reportCode }} {{ scope.row.reportName }}</template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column
        label="文件名"
        align="left"
        prop="fileName"
        min-width="180"
        show-overflow-tooltip
      />
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
      <el-table-column label="已写入" align="center" prop="writtenRows" width="90" />
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_IMPORT_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="来源" align="center" prop="sourceType" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_COLLECT_CHANNEL" :value="scope.row.sourceType" />
        </template>
      </el-table-column>
      <el-table-column label="导入人" align="center" prop="importer" width="110" />
      <el-table-column label="导入时间" align="center" prop="importTime" width="170" />
      <el-table-column
        label="审核意见"
        align="left"
        prop="auditRemark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="220" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:collect-import:detail']"
            >详情</el-button
          >
          <el-button
            v-if="scope.row.status === 3"
            link
            type="warning"
            @click="openAudit(scope.row)"
            v-hasPermi="['cr:collect-import:audit']"
            >审核</el-button
          >
          <el-button
            v-if="scope.row.status === 4"
            link
            type="warning"
            @click="handleRollback(scope.row)"
            v-hasPermi="['cr:collect-import:rollback']"
            >回滚</el-button
          >
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:collect-import:delete']"
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

  <ImportDialog ref="importRef" @success="getList" />
  <ImportDetailDialog ref="detailRef" />

  <!-- 审核弹窗：通过才把暂存数据写进填报数据 -->
  <el-dialog v-model="auditVisible" title="导入批次审核" width="560px" append-to-body>
    <el-descriptions v-if="auditRow" :column="2" size="small" border class="mb-15px">
      <el-descriptions-item label="批次号">{{ auditRow.batchNo }}</el-descriptions-item>
      <el-descriptions-item label="机构 / 期次"
        >{{ auditRow.orgName }} / {{ auditRow.period }}</el-descriptions-item
      >
      <el-descriptions-item label="报表"
        >{{ auditRow.reportCode }} {{ auditRow.reportName }}</el-descriptions-item
      >
      <el-descriptions-item label="总行数"
        >{{ auditRow.totalRows }}（错误 {{ auditRow.failRows }}）</el-descriptions-item
      >
    </el-descriptions>
    <el-form label-width="90px">
      <el-form-item label="审核结论">
        <el-radio-group v-model="auditForm.pass">
          <el-radio :value="true">通过（写入填报数据）</el-radio>
          <el-radio :value="false">驳回（不写入）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="审核意见" required>
        <el-input
          v-model="auditForm.remark"
          type="textarea"
          :rows="3"
          :placeholder="
            auditForm.pass ? '如：错误行已确认可忽略，同意入库' : '请写明驳回原因，机构需要据此整改'
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
import * as ImportTaskApi from '@/api/cr/collect/importTask'
import {
  getCollectOrgOptions,
  getCollectPeriodOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectPeriodOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import ImportDialog from './ImportDialog.vue'
import ImportDetailDialog from './ImportDetailDialog.vue'

defineOptions({ name: 'CrCollectImport' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ImportTaskApi.ImportTaskVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: undefined as string | undefined,
  status: undefined as number | undefined,
  sourceType: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const periodOptions = ref<CollectPeriodOptionVO[]>([])

/** 顶部指标：只看当前这页数据，给一个大概的分布印象 */
const statCards = computed(() => [
  { label: '本页批次', value: list.value.length, class: '' },
  {
    label: '待审核',
    value: list.value.filter((row) => row.status === 3).length,
    class: 'text-[var(--el-color-warning)]'
  },
  {
    label: '已入库',
    value: list.value.filter((row) => row.status === 4).length,
    class: 'text-[var(--el-color-success)]'
  },
  {
    label: '解析失败 / 已驳回',
    value: list.value.filter((row) => row.status === 2 || row.status === 5).length,
    class: 'text-[var(--el-color-danger)]'
  }
])

/* ---------------- 我的导入权限 ---------------- */
const myAuth = ref<ImportTaskApi.MyImportAuthVO | null>(null)

/** 拉到权限就按它显示；没拉到（接口异常）时不拦人，交给后端拒绝 */
const authAlertType = computed(() => {
  if (!myAuth.value) return 'info'
  if (!myAuth.value.auth.canImport) return 'error'
  return myAuth.value.auth.superAdmin ? 'info' : 'success'
})

/**
 * 能不能显示「数据导入」按钮：
 * 选了机构 + 报表就按该范围的权限判定；没选范围时不做客户端拦截（避免误判成"没权限"）。
 */
const canImportNow = computed(() => {
  if (!myAuth.value) return true
  if (!myAuth.value.orgId || !myAuth.value.reportId) return true
  return myAuth.value.auth.canImport
})

const loadMyAuth = async () => {
  try {
    myAuth.value = await ImportTaskApi.getMyImportAuth({
      orgId: queryParams.orgId,
      reportId: queryParams.reportId
    })
  } catch {
    myAuth.value = null
  }
}

// 查询范围一变，生效权限跟着变（同一组条件在后端算出同一条规则）
watch(() => [queryParams.orgId, queryParams.reportId], loadMyAuth)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ImportTaskApi.getImportTaskPage(queryParams)
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

const importRef = ref()
const openImport = () => {
  importRef.value.open()
}

const detailRef = ref()
const openDetail = (id: number) => {
  detailRef.value.open(id)
}

/** 审核 */
const auditVisible = ref(false)
const auditLoading = ref(false)
const auditRow = ref<ImportTaskApi.ImportTaskVO | null>(null)
const auditForm = reactive({ id: 0, pass: true, remark: '' })

const openAudit = (row: ImportTaskApi.ImportTaskVO) => {
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
    const result = await ImportTaskApi.auditImportTask({ ...auditForm })
    message.success(
      auditForm.pass
        ? '审核通过，已写入填报数据 ' + result.writtenRows + ' 行'
        : '已驳回批次 ' + result.batchNo + '，数据未写入'
    )
    auditVisible.value = false
    await getList()
  } finally {
    auditLoading.value = false
  }
}

/** 回滚：删掉本批次写进填报数据的行，批次退回待审核 */
const handleRollback = async (row: ImportTaskApi.ImportTaskVO) => {
  try {
    await message.confirm(
      '回滚批次 ' +
        row.batchNo +
        '？会删除该批次写入的 ' +
        row.writtenRows +
        ' 行填报数据，批次退回待审核。'
    )
    const result = await ImportTaskApi.rollbackImportTask({ id: row.id! })
    message.success('已回滚 ' + result.removed + ' 行填报数据，批次退回待审核')
    await getList()
  } catch {}
}

const handleDelete = async (id: number) => {
  try {
    await message.delConfirm(
      '删除批次会连同暂存数据、错误行一起删除；已入库的批次会先回滚填报数据。'
    )
    const result = await ImportTaskApi.removeImportTask(id)
    message.success(
      result.removed ? '批次已删除，并回滚了 ' + result.removed + ' 行填报数据' : '批次已删除'
    )
    await getList()
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ImportTaskApi.ImportTaskVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm(
      '批量删除选中的 ' + checkedIds.value.length + ' 个批次？已入库的会先回滚。'
    )
    for (const id of checkedIds.value) {
      await ImportTaskApi.removeImportTask(id)
    }
    message.success(t('common.delSuccess'))
    checkedIds.value = []
    await getList()
  } catch {}
}

const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ImportTaskApi.exportImportTask(queryParams)
    download.excel(data, '数据导入批次.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  orgOptions.value = (await getCollectOrgOptions()) || []
  reportOptions.value = (await getCollectReportOptions()) || []
  periodOptions.value = (await getCollectPeriodOptions()) || []
  await loadMyAuth()
  getList()
})
</script>
