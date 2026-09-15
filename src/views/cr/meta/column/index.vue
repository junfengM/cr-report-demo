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
      <el-form-item label="所属数据表" prop="tableId">
        <el-select
          v-model="queryParams.tableId"
          placeholder="请选择数据表"
          clearable
          filterable
          class="!w-240px"
        >
          <el-option
            v-for="item in tableOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="字段" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="字段编码 / 字段名称 / 中文名"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="脱敏规则" prop="desensitizeRule">
        <el-select
          v-model="queryParams.desensitizeRule"
          placeholder="请选择脱敏规则"
          clearable
          class="!w-170px"
        >
          <el-option label="不脱敏" :value="DESENSITIZE_NONE" />
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_DESENSITIZE_TYPE)"
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
          v-hasPermi="['cr:meta-column:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增字段
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:meta-column:delete']"
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
      title="字段（数据项）是监管报送的最小单元，涉及客户敏感信息的字段必须配置脱敏规则后上报。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="字段编码" align="center" prop="columnCode" width="100" />
      <el-table-column
        label="字段名称"
        align="left"
        prop="columnName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="字段中文名"
        align="left"
        prop="cnName"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        label="所属数据表"
        align="left"
        prop="cnTableName"
        min-width="190"
        show-overflow-tooltip
      />
      <el-table-column label="数据类型" align="center" prop="dataType" width="100" />
      <el-table-column label="长度" align="center" prop="dataLength" width="80" />
      <el-table-column label="是否必填" align="center" prop="required" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.required ? 'success' : 'info'" disable-transitions>
            {{ scope.row.required ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否主键" align="center" prop="primaryKey" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.primaryKey ? 'success' : 'info'" disable-transitions>
            {{ scope.row.primaryKey ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="脱敏规则" align="center" prop="desensitizeRule" width="100">
        <template #default="scope">
          <dict-tag
            v-if="scope.row.desensitizeRule"
            :type="DICT_TYPE.CR_DESENSITIZE_TYPE"
            :value="scope.row.desensitizeRule"
          />
          <el-tag v-else type="info" disable-transitions>不脱敏</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="脱敏参数"
        align="center"
        prop="desensitizeParam"
        width="120"
        show-overflow-tooltip
      />
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
            v-hasPermi="['cr:meta-column:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:meta-column:delete']"
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
  <ColumnForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getStrDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as MetaColumnApi from '@/api/cr/meta/column'
import type { MetaTableOptionVO } from '@/api/cr/meta/table'
import { DESENSITIZE_NONE } from '@/api/cr/meta/column'
import ColumnForm from './ColumnForm.vue'

defineOptions({ name: 'CrMetaColumn' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<MetaColumnApi.MetaColumnVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  tableId: undefined as number | undefined,
  keyword: '',
  desensitizeRule: undefined as string | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const tableOptions = ref<MetaTableOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await MetaColumnApi.getMetaColumnPage(queryParams)
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
    await MetaColumnApi.deleteMetaColumn(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: MetaColumnApi.MetaColumnVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await MetaColumnApi.deleteMetaColumnList(checkedIds.value)
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
    const data = await MetaColumnApi.exportMetaColumn(queryParams)
    download.excel(data, '监管数据项.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await getList()
  tableOptions.value = await MetaColumnApi.getTableOptions()
})
</script>
