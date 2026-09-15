<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="86px"
    >
      <el-form-item label="规则类型" prop="ruleType">
        <el-select
          v-model="queryParams.ruleType"
          placeholder="请选择类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_DESENSITIZE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="适用数据项" prop="scope">
        <el-select v-model="queryParams.scope" placeholder="请选择" clearable class="!w-140px">
          <el-option v-for="item in SCOPE_OPTIONS" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-140px">
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
          placeholder="编码 / 名称 / 说明"
          clearable
          class="!w-200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:desens-rule:query']"
          ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
        >
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:desens-rule:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增规则
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:desens-rule:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:desens-rule:delete']"
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
      title="脱敏规则决定「敏感值怎么变成不可识别的值」：掩码保留首尾、哈希不可逆、替换成固定文本、截断只留前几位。示例结果由规则算法现算，改了参数示例会跟着变；停用的规则不会被字段配置引用。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="规则编码" align="center" prop="ruleCode" width="100" />
      <el-table-column
        label="规则名称"
        align="left"
        prop="ruleName"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column label="规则类型" align="center" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_DESENSITIZE_TYPE" :value="scope.row.ruleType" />
        </template>
      </el-table-column>
      <el-table-column
        label="规则参数"
        align="left"
        prop="ruleParam"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column label="适用数据项" align="center" prop="scope" width="110" />
      <el-table-column label="示例（原文 → 结果）" align="left" min-width="260">
        <template #default="scope">
          <div class="truncate" :title="scope.row.sampleFrom + ' → ' + scope.row.sampleTo">
            <span class="text-gray-500">{{ scope.row.sampleFrom }}</span>
            <Icon icon="ep:right" class="mx-5px text-gray-400" />
            <span>{{ scope.row.sampleTo }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column
        label="说明"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="210" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:desens-rule:update']"
            >编辑</el-button
          >
          <el-button
            link
            :type="scope.row.status === 1 ? 'warning' : 'success'"
            @click="handleToggle(scope.row)"
            v-hasPermi="['cr:desens-rule:toggle']"
          >
            {{ scope.row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button
            link
            type="danger"
            :disabled="scope.row.builtin"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:desens-rule:delete']"
            >删除</el-button
          >
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

  <RuleForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions, getStrDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as RuleApi from '@/api/cr/desensitize/rule'
import RuleForm from './RuleForm.vue'

defineOptions({ name: 'CrDesensitizeRule' })

const message = useMessage()
const { t } = useI18n()

/** 适用数据项：与脱敏字段配置里的数据类型保持一致 */
const SCOPE_OPTIONS = ['姓名', '证件号', '手机号', '邮箱', '地址', '业务标识']

const loading = ref(true)
const total = ref(0)
const list = ref<RuleApi.DesensRuleVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  ruleType: '',
  scope: '',
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await RuleApi.getRulePage(queryParams)
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

const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 启用 / 停用：停用后引用它的字段配置不再生效 */
const handleToggle = async (row: RuleApi.DesensRuleVO) => {
  try {
    await message.confirm(
      row.status === 1
        ? '停用规则「' + row.ruleName + '」后，引用它的字段配置将不再生效，确认停用？'
        : '启用规则「' + row.ruleName + '」？'
    )
    const res: any = await RuleApi.toggleRule(row.id!)
    message.success(res?.tip || '操作成功')
    await getList()
  } catch {}
}

const handleDelete = async (row: RuleApi.DesensRuleVO) => {
  try {
    await message.delConfirm(
      '确认删除规则「' + row.ruleName + '」？删除后引用它的字段配置需要重新指定规则。'
    )
    await RuleApi.deleteRule(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: RuleApi.DesensRuleVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await RuleApi.deleteRuleList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await RuleApi.exportRule(queryParams)
    download.excel(data, '脱敏规则.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
