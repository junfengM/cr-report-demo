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
      <el-form-item label="报文集" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="报文集编码 / 名称 / 期次"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="数据频度" prop="freq">
        <el-select v-model="queryParams.freq" placeholder="请选择频度" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.COMMON_STATUS)"
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
          v-hasPermi="['cr:message-report-set:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增报文集
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:message-report-set:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:message-report-set:delete']"
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
      title="报文集把一批报表按机构范围打包，点「生成报文」即按机构 × 报表逐条生成报文，结果可在「一键报送 → 报文状态查询」中查看与下载。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="报文集编码" align="center" prop="setCode" width="130" />
      <el-table-column
        label="报文集名称"
        align="left"
        prop="setName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="数据频度" align="center" prop="freq" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
        </template>
      </el-table-column>
      <el-table-column label="适用期次" align="center" prop="period" width="100" />
      <el-table-column
        label="报送机构"
        align="left"
        prop="orgNames"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="关联报文" align="center" prop="messageCode" width="130" />
      <el-table-column label="报表数量" align="center" prop="reportCount" width="100">
        <template #default="scope">
          <el-link type="primary" @click="openItems(scope.row)">
            {{ scope.row.reportCount }} 张
          </el-link>
        </template>
      </el-table-column>
      <el-table-column label="压缩上报" align="center" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.compress ? 'warning' : 'info'" size="small">
            {{ scope.row.compress ? '压缩' : '不压缩' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="260" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openGenerate(scope.row)"
            v-hasPermi="['cr:message-report-set:generate']"
          >
            生成报文
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:message-report-set:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:message-report-set:delete']"
          >
            删除
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

  <ReportSetForm ref="formRef" @success="getList" />
  <ReportSetGenerateDialog ref="generateDialogRef" @success="getList" />

  <!-- 报表清单 -->
  <el-drawer v-model="itemsVisible" :title="'报表清单 - ' + (currentSet?.setName || '')" size="55%">
    <el-table v-loading="itemsLoading" :data="items" max-height="560">
      <el-table-column label="序号" align="center" prop="seq" width="70" />
      <el-table-column label="报表编码" align="center" prop="reportCode" width="100" />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="数据表" align="left" min-width="180" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.tableCode }} {{ scope.row.tableName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="字段数" align="center" prop="columnCount" width="90" />
    </el-table>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ReportSetApi from '@/api/cr/message/reportSet'
import ReportSetForm from './ReportSetForm.vue'
import ReportSetGenerateDialog from './ReportSetGenerateDialog.vue'

defineOptions({ name: 'CrMessageReportSet' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ReportSetApi.ReportSetVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  freq: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ReportSetApi.getReportSetPage(queryParams)
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

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 报表清单 */
const itemsVisible = ref(false)
const itemsLoading = ref(false)
const items = ref<ReportSetApi.ReportSetItemVO[]>([])
const currentSet = ref<ReportSetApi.ReportSetVO>()
const openItems = async (row: ReportSetApi.ReportSetVO) => {
  currentSet.value = row
  itemsVisible.value = true
  itemsLoading.value = true
  try {
    items.value = (await ReportSetApi.getReportSetItems(row.id!)) || []
  } finally {
    itemsLoading.value = false
  }
}

/** 生成报文 */
const generateDialogRef = ref()
const openGenerate = (row: ReportSetApi.ReportSetVO) => {
  generateDialogRef.value.open(row)
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ReportSetApi.deleteReportSet(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ReportSetApi.ReportSetVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ReportSetApi.deleteReportSetList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ReportSetApi.exportReportSet(queryParams)
    download.excel(data, '报文集配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
