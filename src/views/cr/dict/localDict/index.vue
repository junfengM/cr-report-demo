<template>
  <ContentWrap>
    <!-- 搜索工作栏：状态 + 关键字两条件 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-160px">
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
          placeholder="字典编码 / 名称 / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:local-dict:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:local-dict:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:local-dict:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增字典
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:local-dict:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:local-dict:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap v-hasPermi="['cr:local-dict:query']" title="本地字典列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="本地字典是本地库的码值分类（如 LOCAL_CHANNEL 本地渠道），本地枚举与本地标准映射都按字典编码关联。字典下还有码值时不允许删除，接口会说明还剩几条；字典停用后不能再维护它的码值。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="字典编码"
        align="left"
        prop="code"
        width="190"
        show-overflow-tooltip
      />
      <el-table-column
        label="字典名称"
        align="left"
        prop="name"
        min-width="170"
        show-overflow-tooltip
      />
      <!-- 码值条数：>0 时删除会被接口拦下，这里先把规模亮出来 -->
      <el-table-column label="码值条数" align="center" width="110">
        <template #default="scope">
          <el-tag
            v-if="codeCountOf(scope.row) > 0"
            type="primary"
            size="small"
            effect="plain"
            disable-transitions
          >
            {{ codeCountOf(scope.row) }} 条
          </el-tag>
          <span v-else class="text-[#909399]">0 条</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:local-dict:update']"
          >
            修改
          </el-button>
          <!-- 删除不做前端禁用：字典下还有码值时由接口拦下并说明原因，比灰按钮更能讲清楚为什么不能删 -->
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:local-dict:delete']"
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
  <LocalDictForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as LocalDictApi from '@/api/cr/dict/localDict'
import LocalDictForm from './LocalDictForm.vue'

defineOptions({ name: 'CrDictLocalDict' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<LocalDictApi.LocalDictVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 码值条数：服务端按字典编码现算（cr.localCode 里同字典的行数） */
const codeCountOf = (row: LocalDictApi.LocalDictVO) => Number(row.codeCount || 0)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await LocalDictApi.getLocalDictPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
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

/** 删除：字典下还有码值时接口会拦下并给出中文原因（还剩几条、请先删除或停用码值） */
const handleDelete = async (row: LocalDictApi.LocalDictVO) => {
  try {
    await message.delConfirm('确认删除本地字典「' + row.code + ' ' + row.name + '」？')
    await LocalDictApi.deleteLocalDict(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除：逐条校验，只被拦下的那几条会报错，其余照删 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: LocalDictApi.LocalDictVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await LocalDictApi.deleteLocalDictList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出：导出的是当前筛选条件下的全量数据（与列表同一套过滤） */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await LocalDictApi.exportLocalDict(queryParams)
    download.excel(data, '本地字典.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 */
onMounted(() => {
  getList()
})
</script>
