<template>
  <ContentWrap>
    <!-- 搜索工作栏：所属字典 + 状态 + 关键字三条件 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="所属字典" prop="localDict">
        <el-select
          v-model="queryParams.localDict"
          placeholder="全部"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="dict in dictOptions"
            :key="dict.code"
            :label="dict.label"
            :value="dict.code"
          />
        </el-select>
      </el-form-item>
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
          placeholder="本地码值 / 名称 / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:local-code:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:local-code:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:local-code:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增码值
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:local-code:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:local-code:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap v-hasPermi="['cr:local-code:query']" title="本地枚举列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="本地枚举是本地库的码值（如 L01 个险），报文字段取的是监管码值，所以每条码值要到「本地标准映射」页配好映射才会真正生效。「映射情况」列显示这条码值当前最终生效的监管码值；被映射引用的码值不允许删除。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="所属字典" align="left" min-width="160" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.localDictName }}</span>
          <span class="ml-5px text-12px text-[#909399]">{{ scope.row.localDict }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="本地码值"
        align="left"
        prop="localCode"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column
        label="本地名称"
        align="left"
        prop="localName"
        min-width="150"
        show-overflow-tooltip
      />
      <!-- 映射情况：显示最终生效的监管码值（未映射要说清是"没配"还是"配了但都停用"） -->
      <el-table-column label="映射情况" align="left" min-width="230">
        <template #default="scope">
          <template v-if="scope.row.effectiveRegCode">
            <el-tag type="success" size="small" effect="plain" disable-transitions>已映射</el-tag>
            <span class="ml-5px">{{ scope.row.effectiveRegCode }}</span>
          </template>
          <el-tooltip
            v-else-if="mappingCountOf(scope.row) > 0"
            :content="unmappedReason(scope.row)"
            placement="top"
          >
            <el-tag type="warning" size="small" effect="plain" disable-transitions>未映射</el-tag>
          </el-tooltip>
          <el-tag v-else type="info" size="small" effect="plain" disable-transitions>未映射</el-tag>
          <div v-if="mappingCountOf(scope.row) > 0" class="text-12px text-[#909399] leading-18px">
            引用 {{ mappingCountOf(scope.row) }} 条映射 · 启用
            {{ enabledMappingCountOf(scope.row) }} 条
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="170" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:local-code:update']"
          >
            修改
          </el-button>
          <!-- 删除不做前端禁用：被映射引用时由接口拦下并说明被哪几条映射引用，比灰按钮更能讲清楚 -->
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:local-code:delete']"
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
  <LocalCodeForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as LocalCodeApi from '@/api/cr/dict/localCode'
import * as LocalDictApi from '@/api/cr/dict/localDict'
import LocalCodeForm from './LocalCodeForm.vue'

defineOptions({ name: 'CrDictLocalCode' })

/** 本地字典下拉项（GET /cr/local-dict/simple-list 返回） */
interface LocalDictOption {
  id: number
  code: string
  name: string
  status: number
  /** 服务端拼好的展示名，如「LOCAL_CHANNEL 本地渠道」 */
  label: string
}

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<LocalCodeApi.LocalCodeVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  localDict: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const dictOptions = ref<LocalDictOption[]>([])

/** 被多少条映射引用（含停用），0 表示还没配过映射 */
const mappingCountOf = (row: LocalCodeApi.LocalCodeVO) => Number(row.mappingCount || 0)
/** 其中启用中的条数：启用 0 条就等于当前没有生效的监管码值 */
const enabledMappingCountOf = (row: LocalCodeApi.LocalCodeVO) =>
  Number(row.enabledMappingCount || 0)

/** 未映射的两种原因要分开说：一条没配，vs 配了但都停用（后者不解释清楚就会被当成系统坏了） */
const unmappedReason = (row: LocalCodeApi.LocalCodeVO) =>
  enabledMappingCountOf(row) > 0
    ? '有 ' +
      enabledMappingCountOf(row) +
      ' 条启用中的映射，但对应监管码值已停用，当前没有生效的监管码值；请到「本地标准映射」页核对'
    : '已配 ' +
      mappingCountOf(row) +
      ' 条映射，但都处于停用状态，当前没有生效的监管码值；请到「本地标准映射」页启用一条'

/** 所属字典下拉：只列启用中的字典（停用字典不能再维护它的码值） */
const loadDictOptions = async () => {
  const data = await LocalDictApi.getLocalDictOptions()
  dictOptions.value = (data || []).filter((item: LocalDictOption) => Number(item.status) === 1)
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await LocalCodeApi.getLocalCodePage(queryParams)
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

/** 删除：被映射引用时接口会拦下并给出中文原因（被几条映射引用、请先删映射） */
const handleDelete = async (row: LocalCodeApi.LocalCodeVO) => {
  try {
    await message.delConfirm('确认删除本地码值「' + row.localCode + ' ' + row.localName + '」？')
    await LocalCodeApi.deleteLocalCode(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: LocalCodeApi.LocalCodeVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await LocalCodeApi.deleteLocalCodeList(checkedIds.value)
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
    const data = await LocalCodeApi.exportLocalCode(queryParams)
    download.excel(data, '本地枚举.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化：字典下拉与列表互不依赖，一起拉（下拉失败也不挡列表） */
onMounted(() => {
  loadDictOptions()
  getList()
})
</script>
