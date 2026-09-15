<template>
  <ContentWrap>
    <!-- 搜索工作栏：公式类型 + 状态 + 关键字 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="公式类型" prop="type">
        <el-select v-model="queryParams.type" placeholder="全部" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_FORMULA_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-140px">
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
          placeholder="公式编码 / 名称 / 应用对象 / 备注"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:sql-formula:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:sql-formula:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:sql-formula:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增公式
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:sql-formula:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:sql-formula:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap v-hasPermi="['cr:sql-formula:query']" title="公式列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="需求文档「系统配置操作」章只有一句「用于定义 SQL」，这里展示哪些是提案口径"
    >
      <div class="text-12px leading-20px">
        · 字段（公式编码 / 名称 / 类型 / 正文 / 应用对象 /
        状态）与「试运行」的校验规则都<strong>按通行做法提案</strong>，不是附件文档点名的字段清单；<br />
        · 公式只允许 <strong>SELECT</strong>：写操作会被试运行直接判不通过；<br />
        · 「试运行」是<strong>静态解析、不执行 SQL</strong
        >，检查结构、占位参数与引用表是否已在《报送配置 → 表管理》里登记；<br />
        · 改这里的公式<strong>不会</strong>影响已经生成的报文与统计结果 ——
        它只描述"下次取数怎么取"。
      </div>
    </el-alert>
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="公式编码" prop="code" width="230" show-overflow-tooltip />
      <el-table-column label="公式名称" prop="name" min-width="180" show-overflow-tooltip />
      <el-table-column label="公式类型" prop="type" width="120" align="center">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_FORMULA_TYPE" :value="scope.row.type" />
        </template>
      </el-table-column>
      <el-table-column label="应用对象" prop="target" min-width="180" show-overflow-tooltip />
      <el-table-column label="SQL 正文" prop="sqlText" min-width="260">
        <template #default="scope">
          <span class="font-mono text-12px">{{ snippet(scope.row.sqlText) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="90" align="center">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" prop="updateUser" width="110" />
      <el-table-column label="更新时间" prop="updateTime" width="170" />
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="handleTryRun(scope.row)"
            v-hasPermi="['cr:sql-formula:try-run']"
          >
            试运行
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:sql-formula:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:sql-formula:delete']"
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

  <!-- 表单弹窗：新增 / 修改 -->
  <SqlFormulaForm ref="formRef" @success="getList" />
  <TryRunDialog ref="tryRunRef" />
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import {
  deleteSqlFormula,
  deleteSqlFormulaList,
  exportSqlFormula,
  getSqlFormulaPage,
  type SqlFormulaVO
} from '@/api/cr/message/sqlCustom'
import SqlFormulaForm from './SqlFormulaForm.vue'
import TryRunDialog from './TryRunDialog.vue'

defineOptions({ name: 'CrMessageSqlCustom' })

const { t } = useI18n()
const message = useMessage()

/** SQL 正文在列表里只展示前 60 个字符：完整正文进表单或导出看 */
const snippet = (sql: string) => {
  const text = String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 60 ? text.slice(0, 60) + ' …' : text
}

const loading = ref(true)
const exportLoading = ref(false)
const list = ref<SqlFormulaVO[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  type: undefined,
  status: undefined,
  keyword: ''
})

const queryFormRef = ref()
const formRef = ref()
const tryRunRef = ref()

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await getSqlFormulaPage(queryParams)
    list.value = data.list
    total.value = data.total
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

/** 新增 / 修改 */
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 试运行：只解析不执行（接口已进 e2e:auth 的 COMPUTE 清单，用整库行数快照证明不落库） */
const handleTryRun = (row: SqlFormulaVO) => {
  tryRunRef.value.open({ id: row.id, code: row.code, name: row.name })
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await deleteSqlFormula(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除：逐条校验，只被拦下的那几条会报错，其余照删 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: SqlFormulaVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await deleteSqlFormulaList(checkedIds.value)
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
    const data = await exportSqlFormula(queryParams)
    download.excel(data, '公式SQL定制.xls')
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
