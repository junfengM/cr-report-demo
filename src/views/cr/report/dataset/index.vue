<template>
  <ContentWrap title="数据集管理">
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="数据集编码 / 名称 / 表名 / SQL"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="数据源" prop="datasourceId">
        <el-select
          v-model="queryParams.datasourceId"
          placeholder="全部数据源"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="item in datasourceOptions"
            :key="item.id"
            :label="item.dsCode + ' ' + item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部状态" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:report-dataset:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:report-dataset:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增数据集
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:report-dataset:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:report-dataset:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="数据集列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="数据集是「一次取数」的定义：数据表型按表名取数，SQL 型按登记的 SQL 取数。字段清单决定预览与报表能使用哪些列，「数据预览」会真的去读业务表并只展示前 N 行（最多 200 行）。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="数据集编码"
        align="left"
        prop="datasetCode"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="数据集名称"
        align="left"
        prop="datasetName"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="取数方式" align="center" prop="sourceType" width="100">
        <template #default="scope">
          <el-tag
            size="small"
            :type="scope.row.sourceType === 2 ? 'warning' : 'primary'"
            effect="plain"
          >
            {{ sourceTypeLabel(scope.row.sourceType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="数据源"
        align="left"
        prop="datasourceName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="取数来源（表）"
        align="left"
        prop="tableCode"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="取数来源标识" align="center" prop="previewSource" width="130">
        <template #default="scope">
          <el-tooltip
            content="预览取数时真正读取的数据来源，新建/修改时从下拉里选"
            placement="top"
            :show-after="200"
          >
            <el-tag size="small" type="info" effect="plain">{{ scope.row.previewSource }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="参考行数" align="center" prop="rowCount" width="100" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="200" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openPreview(scope.row)"
            v-hasPermi="['cr:report-dataset:preview']"
          >
            数据预览
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:report-dataset:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:report-dataset:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页组件 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 表单弹窗：新增 / 修改 -->
  <DatasetForm ref="formRef" @success="getList" />
  <!-- 数据预览 -->
  <DatasetPreviewDialog ref="previewRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as DatasetApi from '@/api/cr/report/dataset'
import * as DatasourceApi from '@/api/cr/report/datasource'
import DatasetForm from './DatasetForm.vue'
import DatasetPreviewDialog from './DatasetPreviewDialog.vue'

defineOptions({ name: 'CrReportDataset' })

const message = useMessage()
const { t } = useI18n()

/** 取数方式的展示口径 */
const SOURCE_TYPE_OPTIONS = [
  { value: 1, label: '数据表' },
  { value: 2, label: 'SQL' }
]

const loading = ref(true)
const total = ref(0)
const list = ref<DatasetApi.ReportDatasetVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  datasourceId: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
interface DatasourceOption {
  id: number
  name: string
  dsCode: string
}

const datasourceOptions = ref<DatasourceOption[]>([])

const sourceTypeLabel = (value?: number) =>
  SOURCE_TYPE_OPTIONS.find((item) => item.value === Number(value))?.label || '—'

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DatasetApi.getPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
  } catch {
    // 失败原因由请求拦截器统一提示
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 数据源下拉（搜索栏筛选用） */
const loadDatasourceOptions = async () => {
  try {
    datasourceOptions.value = (await DatasourceApi.getDatasourceOptions()) || []
  } catch {
    datasourceOptions.value = []
  }
}

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 数据预览 */
const previewRef = ref()
const openPreview = (row: DatasetApi.ReportDatasetVO) => {
  previewRef.value.open(row)
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await DatasetApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: DatasetApi.ReportDatasetVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await DatasetApi.removeList(checkedIds.value)
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
    const data = await DatasetApi.exportExcel(queryParams)
    download.excel(data, '数据集列表.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(() => {
  loadDatasourceOptions()
  getList()
})
</script>
