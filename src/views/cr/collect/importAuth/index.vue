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
      <el-form-item label="主体类型" prop="subjectType">
        <el-select
          v-model="queryParams.subjectType"
          placeholder="请选择主体类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_SUBJECT_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-200px"
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
          class="!w-260px"
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
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="主体名称 / 机构 / 报表"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:import-auth:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:import-auth:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增授权
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:import-auth:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:import-auth:delete']"
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
      title="导入权限决定「谁能导、能不能覆盖、要不要审核、单批最多多少行」：同一主体在「机构 + 报表」上的精确授权优先于「全部机构 / 全部报表」的兜底授权。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="主体类型" align="center" prop="subjectType" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_SUBJECT_TYPE" :value="scope.row.subjectType" />
        </template>
      </el-table-column>
      <el-table-column
        label="授权主体"
        align="left"
        prop="subjectName"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        label="机构范围"
        align="left"
        prop="orgName"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表范围"
        align="left"
        prop="reportName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="允许导入" align="center" prop="canImport" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.canImport ? 'success' : 'info'" size="small" disable-transitions>
            {{ scope.row.canImport ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="允许覆盖" align="center" prop="canOverwrite" width="100">
        <template #default="scope">
          <el-tag
            :type="scope.row.canOverwrite ? 'success' : 'info'"
            size="small"
            disable-transitions
          >
            {{ scope.row.canOverwrite ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="需要审核" align="center" prop="needAudit" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.needAudit ? 'warning' : 'info'" size="small" disable-transitions>
            {{ scope.row.needAudit ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="单批上限" align="right" prop="maxRows" width="110">
        <template #default="scope">{{ formatRows(scope.row.maxRows) }}</template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="授权人" align="center" prop="grantUser" width="110" />
      <el-table-column label="授权时间" align="center" prop="grantTime" width="170" />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:import-auth:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:import-auth:delete']"
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

  <ImportAuthForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ImportAuthApi from '@/api/cr/collect/importAuth'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import ImportAuthForm from './ImportAuthForm.vue'

defineOptions({ name: 'CrCollectImportAuth' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ImportAuthApi.ImportAuthVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  subjectType: undefined as number | undefined,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])

/** 单批上限：只做千分位，保留 0 的原样含义（0 表示该主体不允许导入） */
const formatRows = (value?: number) =>
  value === undefined || value === null ? '-' : Number(value).toLocaleString('zh-CN')

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ImportAuthApi.getImportAuthPage(queryParams)
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

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ImportAuthApi.deleteImportAuth(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ImportAuthApi.ImportAuthVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ImportAuthApi.deleteImportAuthList(checkedIds.value)
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
    const data = await ImportAuthApi.exportImportAuth(queryParams)
    download.excel(data, '导入权限.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  // 机构与报表下拉一次拉全量：筛选是本地条件，翻页时无需重复请求
  orgOptions.value = (await getCollectOrgOptions()) || []
  reportOptions.value = (await getCollectReportOptions()) || []
  getList()
})
</script>
