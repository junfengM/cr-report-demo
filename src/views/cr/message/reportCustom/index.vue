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
      <el-form-item label="定制名称" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="定制编码 / 名称 / 报表"
          clearable
          class="!w-220px"
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
          v-hasPermi="['cr:message-report-custom:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增定制
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:message-report-custom:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:message-report-custom:delete']"
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
      title="报表定制定义监管报表的取数范围与上报字段：定制字段数决定报文里该报表的实际列数，必填字段不允许裁剪。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="定制编码" align="center" prop="customCode" width="120" />
      <el-table-column
        label="定制名称"
        align="left"
        prop="customName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="监管报表" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.reportCode }} {{ scope.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="数据频度" align="center" prop="freq" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
        </template>
      </el-table-column>
      <el-table-column label="取数数据表" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.dataTableCode }} {{ scope.row.dataTableName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="定制字段" align="center" prop="columnCount" width="110">
        <template #default="scope">
          <el-link type="primary" @click="openColumnDialog(scope.row)">
            {{ scope.row.columnCount }} 个
          </el-link>
        </template>
      </el-table-column>
      <el-table-column label="版本" align="center" prop="version" width="90" />
      <el-table-column label="生效日期" align="center" prop="effectDate" width="120" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="220" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:message-report-custom:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="primary"
            @click="openColumnDialog(scope.row)"
            v-hasPermi="['cr:message-report-custom:columns']"
          >
            配置字段
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:message-report-custom:delete']"
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

  <ReportCustomForm ref="formRef" @success="getList" />
  <ReportCustomColumnDialog ref="columnDialogRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ReportCustomApi from '@/api/cr/message/reportCustom'
import ReportCustomForm from './ReportCustomForm.vue'
import ReportCustomColumnDialog from './ReportCustomColumnDialog.vue'

defineOptions({ name: 'CrMessageReportCustom' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ReportCustomApi.ReportCustomVO[]>([])
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
    const data = await ReportCustomApi.getReportCustomPage(queryParams)
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

/** 定制字段弹窗 */
const columnDialogRef = ref()
const openColumnDialog = (row: ReportCustomApi.ReportCustomVO) => {
  columnDialogRef.value.open(row)
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ReportCustomApi.deleteReportCustom(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ReportCustomApi.ReportCustomVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ReportCustomApi.deleteReportCustomList(checkedIds.value)
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
    const data = await ReportCustomApi.exportReportCustom(queryParams)
    download.excel(data, '报表定制.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
