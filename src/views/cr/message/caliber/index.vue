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
      <el-form-item label="口径信息" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="口径编码 / 名称 / 指标 / 责任部门"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="口径类型" prop="caliberType">
        <el-select
          v-model="queryParams.caliberType"
          placeholder="请选择口径类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_CALIBER_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="监管报表" prop="reportId">
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
          v-hasPermi="['cr:message-caliber:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增口径
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:message-caliber:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:message-caliber:delete']"
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
      title="口径信息说明每个监管指标「怎么算、从哪取数、由谁负责」，是监管问询与数据追溯时的解释依据。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="口径编码" align="center" prop="caliberCode" width="100" />
      <el-table-column
        label="口径名称"
        align="left"
        prop="caliberName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="口径类型" align="center" prop="caliberType" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_CALIBER_TYPE" :value="scope.row.caliberType" />
        </template>
      </el-table-column>
      <el-table-column label="所属报表" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.reportCode }} {{ scope.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="指标" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.targetCode }} {{ scope.row.targetName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="来源" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.sourceTable }}.{{ scope.row.sourceField }}</span>
        </template>
      </el-table-column>
      <el-table-column label="责任部门" align="center" prop="owner" width="120" />
      <el-table-column label="版本" align="center" prop="version" width="90" />
      <el-table-column label="生效日期" align="center" prop="effectDate" width="120" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="180" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row)"
            v-hasPermi="['cr:message-caliber:query']"
          >
            详情
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:message-caliber:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:message-caliber:delete']"
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

  <CaliberForm ref="formRef" @success="getList" />

  <!-- 口径详情：取数规则较长，单独用抽屉展示 -->
  <el-drawer v-model="detailVisible" title="口径详情" size="45%">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="口径编码">{{ detail?.caliberCode }}</el-descriptions-item>
      <el-descriptions-item label="口径名称">{{ detail?.caliberName }}</el-descriptions-item>
      <el-descriptions-item label="口径类型">
        <dict-tag :type="DICT_TYPE.CR_CALIBER_TYPE" :value="detail?.caliberType" />
      </el-descriptions-item>
      <el-descriptions-item label="所属报表">
        {{ detail?.reportCode }} {{ detail?.reportName }}
      </el-descriptions-item>
      <el-descriptions-item label="指标"
        >{{ detail?.targetCode }} {{ detail?.targetName }}</el-descriptions-item
      >
      <el-descriptions-item label="来源表 / 字段">
        {{ detail?.sourceTable }}.{{ detail?.sourceField }}
      </el-descriptions-item>
      <el-descriptions-item label="取数规则">{{ detail?.formula }}</el-descriptions-item>
      <el-descriptions-item label="责任部门">{{ detail?.owner }}</el-descriptions-item>
      <el-descriptions-item label="版本 / 生效日期">
        {{ detail?.version }} / {{ detail?.effectDate }}
      </el-descriptions-item>
      <el-descriptions-item label="备注">{{ detail?.remark }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as CaliberApi from '@/api/cr/message/caliber'
import { getReportOptions, type MessageReportOptionVO } from '@/api/cr/message/common'
import CaliberForm from './CaliberForm.vue'

defineOptions({ name: 'CrMessageCaliber' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<CaliberApi.CaliberVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  caliberType: undefined as number | undefined,
  reportId: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const reportOptions = ref<MessageReportOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await CaliberApi.getCaliberPage(queryParams)
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

/** 详情 */
const detailVisible = ref(false)
const detail = ref<CaliberApi.CaliberVO>()
const openDetail = (row: CaliberApi.CaliberVO) => {
  detail.value = row
  detailVisible.value = true
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await CaliberApi.deleteCaliber(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: CaliberApi.CaliberVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await CaliberApi.deleteCaliberList(checkedIds.value)
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
    const data = await CaliberApi.exportCaliber(queryParams)
    download.excel(data, '口径信息.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  reportOptions.value = (await getReportOptions()) || []
  getList()
})
</script>
