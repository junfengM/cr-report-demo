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
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 机构 / 报表 / 操作人 / 说明"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="动作" prop="action">
        <el-select v-model="queryParams.action" placeholder="请选择动作" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_IMPORT_ACTION)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="结果" prop="result">
        <el-select v-model="queryParams.result" placeholder="请选择结果" clearable class="!w-140px">
          <el-option label="成功" :value="1" />
          <el-option label="失败" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="操作人" prop="operator">
        <el-input
          v-model="queryParams.operator"
          placeholder="请输入操作人"
          clearable
          class="!w-160px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="操作时间" prop="operateTime">
        <el-date-picker
          v-model="queryParams.operateTime"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:import-log:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:import-log:export']"
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
      title="导入日志按动作逐条留痕：一个批次会依次出现「文件解析 → 数据校验 → 数据入库 / 转审核」多条记录，失败原因的全文在详情里查看。"
    />
    <el-table v-loading="loading" :data="list">
      <el-table-column label="批次号" align="center" prop="batchNo" width="140" />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表"
        align="left"
        prop="reportName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="动作" align="center" prop="action" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_IMPORT_ACTION" :value="scope.row.action" />
        </template>
      </el-table-column>
      <el-table-column label="操作人" align="center" prop="operator" width="110" />
      <el-table-column label="操作时间" align="center" prop="operateTime" width="170" />
      <el-table-column label="结果" align="center" prop="result" width="90">
        <template #default="scope">
          <el-tag :type="resultTagType(scope.row.result)" size="small" disable-transitions>
            {{ resultLabel(scope.row.result) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="耗时" align="right" prop="duration" width="100">
        <template #default="scope">{{ scope.row.duration }} ms</template>
      </el-table-column>
      <el-table-column label="IP" align="center" prop="ip" width="130" />
      <el-table-column
        label="说明"
        align="left"
        prop="message"
        min-width="280"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="90" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:import-log:detail']"
          >
            详情
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

  <ImportLogDetail ref="detailRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ImportLogApi from '@/api/cr/collect/importLog'
import ImportLogDetail from './ImportLogDetail.vue'

defineOptions({ name: 'CrCollectImportLog' })

/** el-tag 主题色 */
type TagType = 'success' | 'danger'

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ImportLogApi.ImportLogVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  action: undefined as number | undefined,
  result: undefined as number | undefined,
  operator: '',
  operateTime: [] as string[]
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 结果：日志只有成功 / 失败两种取值，页面内约定，无对应字典 */
const resultLabel = (value: number) => (Number(value) === 1 ? '成功' : '失败')
const resultTagType = (value: number): TagType => (Number(value) === 1 ? 'success' : 'danger')

/** 查询参数：日志按天过滤，把日期区间拆成 beginTime / endTime 两个参数交给接口 */
const buildQueryParams = () => {
  const { operateTime, ...rest } = queryParams
  return { ...rest, beginTime: operateTime?.[0], endTime: operateTime?.[1] }
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ImportLogApi.getImportLogPage(buildQueryParams())
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

/** 详情 */
const detailRef = ref()
const openDetail = (id: number) => {
  detailRef.value.open(id)
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ImportLogApi.exportImportLog(buildQueryParams())
    download.excel(data, '导入日志.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
