<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="90px"
    >
      <el-form-item label="所属主题域" prop="subjectId">
        <el-select
          v-model="queryParams.subjectId"
          placeholder="请选择主题域"
          clearable
          class="!w-180px"
        >
          <el-option
            v-for="item in subjectOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="表编码/名称" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="表编码 / 表名称 / 中文表名"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="是否上报" prop="reportFlag">
        <el-select v-model="queryParams.reportFlag" placeholder="请选择" clearable class="!w-160px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:meta-table:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增数据表
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:meta-table:delete']"
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
      title="数据表是监管报送的取数单元：是否上报决定该表是否进入报送范围，是否采集/校验/审核决定其处理环节。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="表编码" align="center" prop="tableCode" width="90" />
      <el-table-column
        label="表名称"
        align="left"
        prop="tableName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        label="中文表名"
        align="left"
        prop="cnName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        label="所属主题域"
        align="center"
        prop="subjectName"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column label="是否上报" align="center" prop="reportFlag" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.reportFlag ? 'success' : 'info'" disable-transitions>
            {{ scope.row.reportFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否采集" align="center" prop="collectFlag" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.collectFlag ? 'success' : 'info'" disable-transitions>
            {{ scope.row.collectFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否校验" align="center" prop="checkFlag" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.checkFlag ? 'success' : 'info'" disable-transitions>
            {{ scope.row.checkFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否审核" align="center" prop="auditFlag" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.auditFlag ? 'success' : 'info'" disable-transitions>
            {{ scope.row.auditFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="增量方式" align="center" prop="incrementType" width="100">
        <template #default="scope">{{ incrementTypeLabel(scope.row.incrementType) }}</template>
      </el-table-column>
      <el-table-column label="采集方式" align="center" prop="collectType" width="110">
        <template #default="scope">{{ collectTypeLabel(scope.row.collectType) }}</template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:meta-table:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:meta-table:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 表单弹窗：添加/修改 -->
  <TableForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import download from '@/utils/download'
import * as MetaTableApi from '@/api/cr/meta/table'
import TableForm from './TableForm.vue'

defineOptions({ name: 'CrMetaTable' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<MetaTableApi.MetaTableVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  subjectId: undefined as number | undefined,
  keyword: '',
  reportFlag: undefined as boolean | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const subjectOptions = ref<{ id: number; name: string }[]>([])

/** 增量方式 / 采集方式（无字典，页面内维护） */
const INCREMENT_TYPE_OPTIONS = [
  { value: 'FULL', label: '全量' },
  { value: 'INC', label: '增量' },
  { value: 'DELTA', label: '变化量' }
]
const COLLECT_TYPE_OPTIONS = [
  { value: 'AUTO', label: '数据加工' },
  { value: 'MANUAL', label: '手工采集' }
]
const incrementTypeLabel = (value: string) =>
  INCREMENT_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || '-'
const collectTypeLabel = (value: string) =>
  COLLECT_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || '-'

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await MetaTableApi.getMetaTablePage(queryParams)
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
    await MetaTableApi.deleteMetaTable(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: MetaTableApi.MetaTableVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await MetaTableApi.deleteMetaTableList(checkedIds.value)
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
    const data = await MetaTableApi.exportMetaTable(queryParams)
    download.excel(data, '监管数据表.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await getList()
  subjectOptions.value = await MetaTableApi.getSubjectOptions()
})
</script>
