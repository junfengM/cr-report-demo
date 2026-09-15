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
      <el-form-item label="所属字典" prop="regDict">
        <el-select
          v-model="queryParams.regDict"
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
          placeholder="监管码值 / 名称 / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:reg-code:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:reg-code:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:reg-code:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增码值
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:reg-code:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:reg-code:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap v-hasPermi="['cr:reg-code:query']" title="监管码值列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="监管码值是监管方发布的码值清单（如 A01 个人代理），报文字段最终取的就是这里的码值。「被映射情况」列显示这条监管码值被哪些本地码值引用（最多列前 3 条），为空表示还没有本地码值映射到它；被映射引用的码值不允许删除，接口会说明被几条映射引用。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="所属字典" align="left" min-width="160" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.regDictName }}</span>
          <span class="ml-5px text-12px text-[#909399]">{{ scope.row.regDict }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="监管码值"
        align="left"
        prop="regCode"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column
        label="监管名称"
        align="left"
        prop="regName"
        min-width="150"
        show-overflow-tooltip
      />
      <!-- 被映射情况：说清这条监管码值有没有被本地码值用上、被谁用、引用几条 -->
      <el-table-column label="被映射情况" align="left" min-width="240">
        <template #default="scope">
          <template v-if="scope.row.mappedLocal">
            <el-tag type="success" size="small" effect="plain" disable-transitions>已映射</el-tag>
            <span class="ml-5px">{{ scope.row.mappedLocal }}</span>
          </template>
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
            v-hasPermi="['cr:reg-code:update']"
          >
            修改
          </el-button>
          <!-- 删除不做前端禁用：被映射引用时由接口拦下并说明被哪几条映射引用，比灰按钮更能讲清楚 -->
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:reg-code:delete']"
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
  <RegCodeForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import {
  getRegCodePage,
  deleteRegCode,
  deleteRegCodeList,
  exportRegCode,
  type RegCodeVO
} from '@/api/cr/dict/regCode'
import { getRegDictOptions, type RegDictVO } from '@/api/cr/dict/regDict'
import RegCodeForm from './RegCodeForm.vue'

defineOptions({ name: 'CrDictRegCode' })

/** 监管字典下拉项（GET /cr/reg-dict/simple-list 返回） */
type RegDictOption = Pick<RegDictVO, 'id' | 'code' | 'name' | 'status'> & { label: string }

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<RegCodeVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  regDict: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const dictOptions = ref<RegDictOption[]>([])

/** 被多少条映射引用（含停用），0 表示还没有本地码值映射到它 */
const mappingCountOf = (row: RegCodeVO) => Number(row.mappingCount || 0)
/** 其中启用中的条数：一眼看出这条监管码值当前有没有真正在用 */
const enabledMappingCountOf = (row: RegCodeVO) => Number(row.enabledMappingCount || 0)

/** 所属字典下拉：只列启用中的字典（停用字典不能再维护它的码值） */
const loadDictOptions = async () => {
  const data = await getRegDictOptions()
  dictOptions.value = (data || []).filter((item: RegDictOption) => Number(item.status) === 1)
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await getRegCodePage(queryParams)
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
const handleDelete = async (row: RegCodeVO) => {
  try {
    await message.delConfirm('确认删除监管码值「' + row.regCode + ' ' + row.regName + '」？')
    await deleteRegCode(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: RegCodeVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await deleteRegCodeList(checkedIds.value)
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
    const data = await exportRegCode(queryParams)
    download.excel(data, '监管码值.xls')
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
