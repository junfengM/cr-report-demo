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
      <el-form-item label="填报人" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="填报人 / 复核人 / 报表 / 机构"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="报送机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
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
          v-hasPermi="['cr:message-filler:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增指派
        </el-button>
        <el-button type="warning" plain @click="openBatch" v-hasPermi="['cr:message-filler:batch']">
          <Icon icon="ep:operation" class="mr-5px" /> 批量分配
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:message-filler:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:message-filler:delete']"
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
      title="填报人管理按「机构 + 报表范围」指派填报人与复核人：报表级指派优先于机构级默认指派，指派结果决定各页面的待办归属。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="报送机构"
        align="left"
        prop="orgName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="报表范围" align="left" min-width="240" show-overflow-tooltip>
        <template #default="scope">
          <el-tag v-if="!scope.row.reportId" type="info" size="small">全部报表</el-tag>
          <span v-else>{{ scope.row.reportCode }} {{ scope.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="数据频度" align="center" width="100">
        <template #default="scope">
          <dict-tag
            v-if="scope.row.freq"
            :type="DICT_TYPE.CR_REPORT_FREQ"
            :value="scope.row.freq"
          />
          <span v-else>不限</span>
        </template>
      </el-table-column>
      <el-table-column label="填报人" align="center" prop="fillerName" width="110" />
      <el-table-column label="复核人" align="center" prop="reviewerName" width="110" />
      <el-table-column label="生效日期" align="center" prop="effectiveDate" width="120" />
      <el-table-column label="失效日期" align="center" prop="expireDate" width="120" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="180" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:message-filler:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:message-filler:delete']"
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

  <FillerAssignForm ref="formRef" @success="getList" />
  <FillerBatchDialog ref="batchDialogRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as FillerApi from '@/api/cr/message/filler'
import { getOrgOptions, type MessageOrgOptionVO } from '@/api/cr/message/common'
import FillerAssignForm from './FillerAssignForm.vue'
import FillerBatchDialog from './FillerBatchDialog.vue'

defineOptions({ name: 'CrMessageFiller' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<FillerApi.FillerAssignVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  orgId: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<MessageOrgOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await FillerApi.getFillerAssignPage(queryParams)
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

/** 批量分配 */
const batchDialogRef = ref()
const openBatch = () => {
  batchDialogRef.value.open()
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await FillerApi.deleteFillerAssign(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: FillerApi.FillerAssignVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await FillerApi.deleteFillerAssignList(checkedIds.value)
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
    const data = await FillerApi.exportFillerAssign(queryParams)
    download.excel(data, '填报人管理.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  orgOptions.value = (await getOrgOptions()) || []
  getList()
})
</script>
