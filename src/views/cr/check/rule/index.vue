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
      <el-form-item label="规则名称" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="规则名称 / 编码"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="规则类型" prop="ruleType">
        <el-select
          v-model="queryParams.ruleType"
          placeholder="请选择规则类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_RULE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="错误级别" prop="errorLevel">
        <el-select
          v-model="queryParams.errorLevel"
          placeholder="请选择错误级别"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ERROR_LEVEL)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="是否启用" prop="status">
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
          v-hasPermi="['cr:check-rule:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增规则
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:check-rule:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert class="mb-10px" type="info" :closable="false" show-icon title="规则类型说明">
      <template #default>
        非空校验：字段值不可为空；长度校验：字段长度满足比较条件；值域校验：数值 /
        日期落在允许区间； 逻辑校验：同一张表内字段间比较（如「满期日期 &gt;
        生效日期」）；表间校验：跨表勾稽关系（如「保费收入合计 =
        保费信息表金额汇总」）；枚举校验：取值必须在监管码值表范围内。
        错误级别为「错误」的规则不通过将<strong>阻断报送</strong>，「警告」仅提示不阻断。
      </template>
    </el-alert>
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="规则编码" align="center" prop="ruleCode" width="120" />
      <el-table-column
        label="规则名称"
        align="left"
        prop="ruleName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="规则类型" align="center" prop="ruleType" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_RULE_TYPE" :value="scope.row.ruleType" />
        </template>
      </el-table-column>
      <el-table-column label="错误级别" align="center" prop="errorLevel" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ERROR_LEVEL" :value="scope.row.errorLevel" />
        </template>
      </el-table-column>
      <el-table-column label="规则表达式" align="left" min-width="280" show-overflow-tooltip>
        <template #default="scope">
          <span class="text-12px">{{ formatExpression(scope.row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="适用报表" align="left" min-width="240" show-overflow-tooltip>
        <template #default="scope">{{ (scope.row.reportNames || []).join('、') || '-' }}</template>
      </el-table-column>
      <el-table-column
        label="错误提示语"
        align="left"
        prop="errorMessage"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        align="center"
        prop="createTime"
        width="180"
        :formatter="dateFormatter"
      />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:check-rule:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:check-rule:delete']"
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
  <CheckRuleForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as CheckRuleApi from '@/api/cr/check/rule'
import CheckRuleForm from './CheckRuleForm.vue'

defineOptions({ name: 'CrCheckRule' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<CheckRuleApi.CheckRuleVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  ruleType: undefined as number | undefined,
  errorLevel: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 规则表达式的可读写法：非空只看字段，枚举是「字段 ∈ 码值表」 */
const formatExpression = (row: CheckRuleApi.CheckRuleVO) => {
  if (row.ruleType === CheckRuleApi.CheckRuleType.NOT_NULL) return row.leftExpression
  if (row.ruleType === CheckRuleApi.CheckRuleType.ENUM) {
    return `${row.leftExpression} ∈ ${row.rightExpression}`
  }
  return `${row.leftExpression} ${row.operator} ${row.rightExpression}`
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await CheckRuleApi.getCheckRulePage(queryParams)
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
    await message.delConfirm('确认删除该条校验规则吗？删除后引用该规则的校验任务将不再执行该规则。')
    await CheckRuleApi.deleteCheckRule(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: CheckRuleApi.CheckRuleVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await CheckRuleApi.deleteCheckRuleList(checkedIds.value)
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
    const data = await CheckRuleApi.exportCheckRule(queryParams)
    download.excel(data, '校验规则.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
