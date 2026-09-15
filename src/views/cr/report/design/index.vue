<template>
  <ContentWrap title="报表维护">
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
          placeholder="报表编码 / 名称 / 数据集"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="展示方式" prop="chartType">
        <el-select
          v-model="queryParams.chartType"
          placeholder="全部方式"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="item in chartTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
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
        <el-button @click="handleQuery" v-hasPermi="['cr:report-design:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:report-design:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增报表
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:report-design:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:report-design:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="报表列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="报表建在数据集之上：选一个数据集，指定分组用的维度字段与求和用的度量字段（不选度量则按记录数统计），再选展示方式。行上的「报表预览」按当前系统里的真实数据现算，表格型只出表格，柱状图 / 折线图 / 饼图会同时给出表格与图表。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="报表编码"
        align="left"
        prop="reportCode"
        width="160"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        label="数据集"
        align="left"
        prop="datasetName"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column label="展示方式" align="center" prop="chartType" width="110">
        <template #default="scope">
          <el-tag :type="chartTagType(scope.row.chartType)" size="small" effect="plain">
            {{ chartTypeLabel(scope.row.chartType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="维度字段"
        align="left"
        prop="dimensionField"
        width="140"
        show-overflow-tooltip
      />
      <el-table-column label="度量字段" align="left" min-width="180" show-overflow-tooltip>
        <template #default="scope">
          <span v-if="scope.row.measureFields && scope.row.measureFields.length">
            {{ scope.row.measureFields.join('、') }}
          </span>
          <span v-else class="text-gray-400">按记录数统计</span>
        </template>
      </el-table-column>
      <el-table-column
        label="过滤条件"
        align="left"
        prop="filterText"
        min-width="170"
        show-overflow-tooltip
      >
        <template #default="scope">
          <span v-if="scope.row.filterText">{{ scope.row.filterText }}</span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
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
            v-hasPermi="['cr:report-design:preview']"
          >
            报表预览
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:report-design:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:report-design:delete']"
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
  <DesignForm ref="formRef" @success="getList" />
  <!-- 报表预览 -->
  <DesignPreviewDialog ref="previewRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as DesignApi from '@/api/cr/report/design'
// 展示方式的中文口径由服务端给（/cr/report-dataset/source-options），页面不另写一份
import * as DatasetApi from '@/api/cr/report/dataset'
import DesignForm from './DesignForm.vue'
import DesignPreviewDialog from './DesignPreviewDialog.vue'

defineOptions({ name: 'CrReportDesign' })

const message = useMessage()
const { t } = useI18n()

const CHART_TAG_TYPE: Record<number, 'primary' | 'success' | 'info' | 'warning'> = {
  1: 'info',
  2: 'primary',
  3: 'success',
  4: 'warning'
}

const loading = ref(true)
const total = ref(0)
const list = ref<DesignApi.ReportDesignVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  chartType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
interface ChartTypeOption {
  value: number
  label: string
}

const chartTypeOptions = ref<ChartTypeOption[]>([])

const chartTypeLabel = (value?: number) =>
  chartTypeOptions.value.find((item) => Number(item.value) === Number(value))?.label || '—'
const chartTagType = (value?: number) => CHART_TAG_TYPE[Number(value)] || 'info'

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DesignApi.getPage(queryParams)
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

/** 展示方式下拉 */
const loadMeta = async () => {
  try {
    const meta = await DatasetApi.getDatasetMeta()
    chartTypeOptions.value = meta?.chartTypes || []
  } catch {
    chartTypeOptions.value = []
  }
}

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 报表预览 */
const previewRef = ref()
const openPreview = (row: DesignApi.ReportDesignVO) => {
  previewRef.value.open(row)
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await DesignApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: DesignApi.ReportDesignVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await DesignApi.removeList(checkedIds.value)
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
    const data = await DesignApi.exportExcel(queryParams)
    download.excel(data, '报表列表.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(() => {
  loadMeta()
  getList()
})
</script>
