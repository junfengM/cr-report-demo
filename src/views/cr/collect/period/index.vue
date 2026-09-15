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
      <el-form-item label="期次" prop="period">
        <el-input
          v-model="queryParams.period"
          placeholder="如 202608"
          clearable
          class="!w-160px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_PERIOD_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="期次名称 / 备注"
          clearable
          class="!w-200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:collect-period:query']"
          ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
        >
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:collect-period:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增期次
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:collect-period:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:collect-period:delete']"
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
      title="报送期次决定「本期什么时候收数、什么时候截止、关不关得住」：采集窗口内允许导入与填报，期次关闭后停止收数（允许补录的期次可走补录申请），关闭前会校验本期任务是否已全部审核通过。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column
        label="期次名称"
        align="left"
        prop="periodName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="频度" align="center" prop="freq" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
        </template>
      </el-table-column>
      <el-table-column label="采集窗口" align="center" width="200">
        <template #default="scope">
          <span>{{ scope.row.collectStart }} ~ {{ scope.row.collectEnd }}</span>
        </template>
      </el-table-column>
      <el-table-column label="报送截止" align="center" prop="deadline" width="110" />
      <el-table-column label="允许补录" align="center" width="100">
        <template #default="scope">
          <el-tag v-if="scope.row.allowSupplement" type="success" size="small">允许</el-tag>
          <el-tag v-else type="info" size="small">不允许</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="本期任务" align="center" width="150">
        <template #default="scope">
          <span v-if="progressOf(scope.row.period)">
            {{ progressOf(scope.row.period).finishedCount }} /
            {{ progressOf(scope.row.period).taskCount }}
            <el-tag
              class="ml-5px"
              size="small"
              :type="rateType(progressOf(scope.row.period).submitRate)"
            >
              {{ progressOf(scope.row.period).submitRate }}%
            </el-tag>
          </span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="填报数据" align="center" width="110">
        <template #default="scope">
          <span v-if="progressOf(scope.row.period)"
            >{{ progressOf(scope.row.period).fillCount }} 行</span
          >
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_PERIOD_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="关闭情况" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <span v-if="scope.row.closeTime"
            >{{ scope.row.closeTime }}（{{ scope.row.closeUser }}）</span
          >
          <span v-else class="text-gray-400">未关闭</span>
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="260" fixed="right">
        <template #default="scope">
          <el-button
            v-if="scope.row.status !== 1"
            link
            type="success"
            @click="handleOpen(scope.row)"
            v-hasPermi="['cr:collect-period:open']"
          >
            开启采集
          </el-button>
          <el-button
            v-if="scope.row.status === 1"
            link
            type="warning"
            @click="handleClose(scope.row)"
            v-hasPermi="['cr:collect-period:close']"
          >
            关闭期次
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:collect-period:update']"
            >编辑</el-button
          >
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:collect-period:delete']"
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

  <PeriodForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as PeriodApi from '@/api/cr/collect/period'
import PeriodForm from './PeriodForm.vue'

defineOptions({ name: 'CrCollectPeriod' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<PeriodApi.CollectPeriodVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  period: '',
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
/** 期次进度：任务完成度与填报行数按任务表实时汇总，不落库 */
const progress = ref<Record<string, PeriodApi.CollectPeriodProgressVO>>({})

const progressOf = (period: string) => progress.value[period]
const rateType = (rate: number) => (rate >= 100 ? 'success' : rate >= 60 ? 'warning' : 'danger')

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await PeriodApi.getPeriodPage(queryParams)
    list.value = data.list
    total.value = data.total
    progress.value = (await PeriodApi.getPeriodProgress()) || {}
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

/** 开启 / 重新开放采集 */
const handleOpen = async (row: PeriodApi.CollectPeriodVO) => {
  try {
    await message.confirm(
      '开放期次 ' + row.period + ' 的数据采集？开放后各机构可以导入与填报本期数据。'
    )
    await PeriodApi.openPeriod({ period: row.period })
    message.success('期次 ' + row.period + ' 已开放采集')
    await getList()
  } catch {}
}

/** 关闭期次：先体检，未完成的任务会拦住；确认后可以强制关闭 */
const handleClose = async (row: PeriodApi.CollectPeriodVO) => {
  const check = await PeriodApi.getCloseCheck(row.period)
  if (check.canClose) {
    try {
      await message.confirm(check.message + '。关闭后将停止接收本期数据，确认关闭？')
      await PeriodApi.closePeriod({ period: row.period, remark: '任务已全部完成，正常关闭' })
      message.success('期次 ' + row.period + ' 已关闭')
      await getList()
    } catch {}
    return
  }
  try {
    await message.confirm(
      check.message + '。强制关闭会留下未完成任务，通常只在演示或特殊场景下使用。',
      '期次未完成，是否强制关闭？'
    )
    await PeriodApi.closePeriod({
      period: row.period,
      force: true,
      remark: '强制关闭（仍有未完成任务）'
    })
    message.success('期次 ' + row.period + ' 已强制关闭')
    await getList()
  } catch {}
}

const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await PeriodApi.deletePeriod(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: PeriodApi.CollectPeriodVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await PeriodApi.deletePeriodList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await PeriodApi.exportPeriod(queryParams)
    download.excel(data, '报送期次.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
