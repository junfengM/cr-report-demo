<template>
  <ContentWrap>
    <!-- 我的权限横幅：读 /cr/permission-common/my-scope，口径与接口层的数据过滤同源（前端不自己算一遍） -->
    <el-alert v-if="myScope" class="mb-15px" type="success" :closable="false" show-icon>
      <template #title>
        <span>
          我的数据范围：{{ myScope.dataScope.scopeTypeLabel }}
          <span v-if="myScope.dataScope.orgNames.length">
            （{{ myScope.dataScope.orgNames.join('、') }}）
          </span>
          ｜ 我的动作范围：
          <span v-if="myScope.deptScope.actions.length">
            {{ myScope.deptScope.actions.map((item) => item.label).join('、') }}
          </span>
          <span v-else>仅可查看</span>
        </span>
      </template>
      <div class="text-12px">
        当前账号：{{ myScope.user.nickname }}（{{ myScope.user.deptName }} /
        {{ myScope.user.orgName }}）；数据范围依据：{{
          myScope.dataScope.superAdmin ? '超级管理员，不受规则限制' : myScope.dataScope.source
        }}；动作范围依据：{{
          myScope.deptScope.superAdmin ? '超级管理员，不受规则限制' : myScope.deptScope.source
        }}
      </div>
    </el-alert>
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
      <el-form-item label="机构范围" prop="scopeType">
        <el-select
          v-model="queryParams.scopeType"
          placeholder="请选择机构范围"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_SCOPE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
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
          placeholder="主体 / 报表 / 机构 / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:data-scope:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:data-scope:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增规则
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:data-scope:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:data-scope:delete']"
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
      title="判定顺序：用户级 > 角色级；指定报表 > 全部报表；再按优先级小的 → 后建的。未命中任何规则时回落到「角色管理」页配的角色默认数据范围；系统管理员不受限。"
    >
      本页规则真正落在接口上（数据导入批次列表按可见机构过滤），不是只藏按钮。
    </el-alert>
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
      <el-table-column label="报表范围" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope">{{ formatReport(scope.row) }}</template>
      </el-table-column>
      <el-table-column label="机构范围类型" align="center" prop="scopeType" width="120">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_SCOPE_TYPE" :value="scope.row.scopeType" />
        </template>
      </el-table-column>
      <el-table-column label="指定机构" align="left" min-width="160" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.orgNames || '-' }}</template>
      </el-table-column>
      <el-table-column label="优先级" align="center" prop="priority" width="90" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
      <el-table-column label="操作" align="center" width="190" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:data-scope:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:data-scope:delete']"
          >
            删除
          </el-button>
          <el-button
            link
            type="warning"
            @click="openDecision(scope.row)"
            v-hasPermi="['cr:data-scope:decide']"
          >
            生效判断
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

  <DataScopeForm ref="formRef" @success="getList" />
  <DataScopeDecisionDialog ref="decisionRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as DataScopeApi from '@/api/cr/system/dataScope'
import * as CommonApi from '@/api/cr/system/common'
import DataScopeForm from './DataScopeForm.vue'
import DataScopeDecisionDialog from './DataScopeDecisionDialog.vue'

defineOptions({ name: 'CrSystemDataScope' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<DataScopeApi.DataScopeVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  subjectType: undefined as number | undefined,
  scopeType: undefined as number | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 报表范围：reportId = 0 是「全部报表」，其余显示具体报表名 */
const formatReport = (row: DataScopeApi.DataScopeVO) =>
  !row.reportId ? '全部报表' : row.reportName || '-'

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DataScopeApi.getDataScopePage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** 我的权限横幅：由服务端判定（角色/用户规则 → 生效规则），页面只负责显示 */
const myScope = ref<CommonApi.MyScopeVO>()
const loadMyScope = async () => {
  try {
    myScope.value = await CommonApi.getMyScope()
  } catch {
    myScope.value = undefined
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

/** 生效判断：带出该行的报表；主体是用户时一并带出，角色则需在弹窗里手动选人 */
const decisionRef = ref()
const openDecision = (row: DataScopeApi.DataScopeVO) => {
  decisionRef.value.open(
    row.subjectType === 2 ? row.subjectId : undefined,
    row.reportId || undefined
  )
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await DataScopeApi.deleteDataScope(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: DataScopeApi.DataScopeVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await DataScopeApi.deleteDataScopeList(checkedIds.value)
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
    const data = await DataScopeApi.exportDataScope(queryParams)
    download.excel(data, '数据权限规则.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
  loadMyScope()
})
</script>
