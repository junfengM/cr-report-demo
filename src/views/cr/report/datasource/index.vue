<template>
  <ContentWrap title="数据源管理">
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="90px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="数据源代码 / 名称 / 连接信息 / 责任人"
          clearable
          class="!w-280px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="数据源类型" prop="dsType">
        <el-select v-model="queryParams.dsType" placeholder="全部类型" clearable class="!w-160px">
          <el-option
            v-for="item in DS_TYPE_OPTIONS"
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
        <el-button @click="handleQuery" v-hasPermi="['cr:report-datasource:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:report-datasource:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增数据源
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:report-datasource:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:report-datasource:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="数据源列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="数据源是报表取数的连接登记：数据库型用于直连取数，文件目录型用于读取回执与校验文件，接口型用于调用监管或外部系统。行上的「连接测试」只按登记信息做一次握手并把结论写回该行，不改动连接配置；结论原文展示，失败会标红。连接串请勿写入明文口令。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="数据源代码"
        align="left"
        prop="dsCode"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="数据源名称"
        align="left"
        prop="dsName"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column label="类型" align="center" prop="dsType" width="100">
        <template #default="scope">
          <el-tag size="small" effect="plain">{{ dsTypeLabel(scope.row.dsType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="数据库类型" align="center" prop="dbType" width="110">
        <template #default="scope">{{ dbTypeLabel(scope.row.dbType) }}</template>
      </el-table-column>
      <el-table-column
        label="连接信息"
        align="left"
        prop="connText"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="最近测试结论" align="left" min-width="300">
        <template #default="scope">
          <div v-if="scope.row.lastTestResult">
            <el-tag
              :type="isTestFailed(scope.row.lastTestResult) ? 'danger' : 'success'"
              size="small"
            >
              {{ isTestFailed(scope.row.lastTestResult) ? '失败' : '成功' }}
            </el-tag>
            <span
              class="ml-5px text-12px"
              :class="isTestFailed(scope.row.lastTestResult) ? 'text-[#f56c6c]' : 'text-[#606266]'"
            >
              {{ scope.row.lastTestResult }}
            </span>
          </div>
          <span v-else class="text-gray-400">未测试</span>
        </template>
      </el-table-column>
      <el-table-column label="最近测试时间" align="center" prop="lastTestTime" width="165" />
      <el-table-column label="预计可抽取" align="center" prop="lastTestRows" width="110">
        <template #default="scope">
          <span v-if="scope.row.lastTestResult">{{ scope.row.lastTestRows }} 行</span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="耗时" align="center" prop="lastTestCost" width="90">
        <template #default="scope">
          <span v-if="scope.row.lastTestResult">{{ scope.row.lastTestCost }} ms</span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="责任人"
        align="center"
        prop="owner"
        width="110"
        show-overflow-tooltip
      />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="220" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            :loading="testingId === scope.row.id"
            @click="handleTest(scope.row)"
            v-hasPermi="['cr:report-datasource:test']"
          >
            连接测试
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:report-datasource:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:report-datasource:delete']"
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
  <DatasourceForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as DatasourceApi from '@/api/cr/report/datasource'
import DatasourceForm from './DatasourceForm.vue'

defineOptions({ name: 'CrReportDatasource' })

const message = useMessage()
const { t } = useI18n()

/** 数据源类型 / 数据库类型的展示口径（服务端只回数字，页面负责中文展示） */
const DS_TYPE_OPTIONS = [
  { value: 1, label: '数据库' },
  { value: 2, label: '文件目录' },
  { value: 3, label: '接口' }
]
const DB_TYPE_OPTIONS = [
  { value: 1, label: 'MySQL' },
  { value: 2, label: 'Oracle' },
  { value: 3, label: '达梦' },
  { value: 0, label: '不适用' }
]

/** 测试结论里出现这些字样就是失败态（服务端返回的是结论文案，不是错误码） */
const TEST_FAILED_PATTERN = /超时|失败|不可达|错误|异常|无法/

const loading = ref(true)
const total = ref(0)
const list = ref<DatasourceApi.ReportDatasourceVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  dsType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在连接测试的行 id，避免整表转圈 */
const testingId = ref<number | undefined>()

const dsTypeLabel = (value?: number) =>
  DS_TYPE_OPTIONS.find((item) => item.value === Number(value))?.label || '—'
const dbTypeLabel = (value?: number) =>
  DB_TYPE_OPTIONS.find((item) => item.value === Number(value))?.label || '—'
const isTestFailed = (text?: string) => !!text && TEST_FAILED_PATTERN.test(text)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DatasourceApi.getPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
  } catch {
    // 失败原因由请求拦截器统一提示，这里只保证表格不空转
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

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 连接测试：服务端返回的是结论文案（成功/失败都在正常返回里），把结论写回该行并提示 */
const handleTest = async (row: DatasourceApi.ReportDatasourceVO) => {
  testingId.value = row.id
  try {
    const res = await DatasourceApi.testDatasource(row.id!)
    row.lastTestResult = res.lastTestResult
    row.lastTestTime = res.lastTestTime
    row.lastTestRows = res.lastTestRows
    row.lastTestCost = res.lastTestCost
    if (isTestFailed(res.lastTestResult)) {
      message.warning('连接测试未通过：' + res.lastTestResult)
    } else {
      message.success(res.lastTestResult)
    }
  } catch {
    // 异常（数据源不存在 / 无权限等）由请求拦截器提示
  } finally {
    testingId.value = undefined
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await DatasourceApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: DatasourceApi.ReportDatasourceVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await DatasourceApi.removeList(checkedIds.value)
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
    const data = await DatasourceApi.exportExcel(queryParams)
    download.excel(data, '数据源列表.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(() => {
  getList()
})
</script>
