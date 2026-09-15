<template>
  <!-- 搜索工作栏 -->
  <ContentWrap>
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="部门" prop="deptId">
        <el-tree-select
          v-model="queryParams.deptId"
          :data="deptTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          check-strictly
          clearable
          filterable
          :render-after-expand="false"
          placeholder="请选择部门"
          class="!w-200px"
        />
      </el-form-item>
      <el-form-item label="动作" prop="action">
        <el-select v-model="queryParams.action" placeholder="请选择动作" clearable class="!w-170px">
          <el-option
            v-for="action in actionOptions"
            :key="action.value"
            :label="action.label"
            :value="action.value"
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
          placeholder="部门 / 报表 / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:dept-scope:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:dept-scope:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增规则
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:dept-scope:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:dept-scope:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert class="mb-10px" type="info" :closable="false" show-icon>
      <template #title>部门权限 = 部门（含上级部门链）× 报表范围 → 允许的动作</template>
      <div class="leading-6">
        <div>1. 规则的部门对该部门及其全部下级部门生效。</div>
        <div>例：给「总公司」授权，总公司各部门都命中。</div>
        <div>2. 同一「部门 × 报表」有多条时，按下面的顺序决定谁生效：</div>
        <div>指定报表 &gt; 全部报表 → 优先级小的 → 后建的。</div>
        <div>3. 未命中任何规则 = 默认拒绝（与导入权限同一约定）。</div>
        <div>4. 动作真正落在接口上：数据填报保存 / 批量提交 / 复核 / 审核 / 打回。</div>
      </div>
    </el-alert>
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="部门"
        align="left"
        prop="deptName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表范围"
        align="left"
        prop="reportName"
        min-width="165"
        show-overflow-tooltip
      />
      <el-table-column label="允许动作" align="left" min-width="195">
        <template #default="scope">
          <template v-if="actionLabelsOf(scope.row).length">
            <el-tag
              v-for="label in actionLabelsOf(scope.row)"
              :key="label"
              class="mr-5px"
              size="small"
              disable-transitions
            >
              {{ label }}
            </el-tag>
          </template>
          <span v-else class="text-[#c0c4cc]">-</span>
        </template>
      </el-table-column>
      <el-table-column label="优先级" align="center" prop="priority" width="80" />
      <el-table-column label="状态" align="center" prop="status" width="85">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="95" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column label="操作" align="center" width="190" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:dept-scope:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:dept-scope:delete']"
          >
            删除
          </el-button>
          <el-button
            link
            type="warning"
            @click="openDecision(scope.row)"
            v-hasPermi="['cr:dept-scope:decide']"
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

  <DeptScopeForm ref="formRef" @success="getList" />
  <DeptScopeDecisionDialog ref="decisionRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { handleTree } from '@/utils/tree'
import download from '@/utils/download'
import * as DeptScopeApi from '@/api/cr/system/deptScope'
import {
  getDeptOptions,
  getPermissionMeta,
  type DeptOptionVO,
  type PermissionMetaVO
} from '@/api/cr/system/common'
import DeptScopeForm from './DeptScopeForm.vue'
import DeptScopeDecisionDialog from './DeptScopeDecisionDialog.vue'

defineOptions({ name: 'CrSystemDeptScope' })

const message = useMessage()
const { t } = useI18n()

/** 列表行：接口 VO + 服务端逐行给的动作中文名（取不到时用服务端动作清单兜底，见 actionLabelsOf） */
type DeptScopeRow = DeptScopeApi.DeptScopeVO & { actionLabels?: string[] }

/** 部门树节点：接口给的是扁平数组（id / name / parentId），页面按 parentId 组树 */
type DeptTreeNode = DeptOptionVO & { children?: DeptTreeNode[] }

const loading = ref(true)
const total = ref(0)
const list = ref<DeptScopeRow[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  deptId: undefined as number | undefined,
  action: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const deptTree = ref<DeptTreeNode[]>([])
/** 动作清单与中文名都取自服务端（getPermissionMeta().actions），页面不维护第二套映射 */
const actionOptions = ref<PermissionMetaVO['actions']>([])

/** 动作标识 → 中文名（只由服务端的动作清单构建） */
const actionLabelMap = computed(() => {
  const map: Record<string, string> = {}
  actionOptions.value.forEach((action) => {
    map[action.value] = action.label
  })
  return map
})

/** 允许动作的中文名：优先用服务端逐行给的 actionLabels，缺失时才按服务端动作清单翻译 */
const actionLabelsOf = (row: DeptScopeRow): string[] => {
  if (row.actionLabels && row.actionLabels.length) return row.actionLabels
  return (row.actions || []).map((action) => actionLabelMap.value[action] || action)
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await DeptScopeApi.getDeptScopePage(queryParams)
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

/** 生效判断：把当前行的报表范围带进弹窗，省得再选一次 */
const decisionRef = ref()
const openDecision = (row: DeptScopeRow) => {
  decisionRef.value.open(row)
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await DeptScopeApi.deleteDeptScope(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: DeptScopeRow[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await DeptScopeApi.deleteDeptScopeList(checkedIds.value)
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
    const data = await DeptScopeApi.exportDeptScope(queryParams)
    download.excel(data, '部门权限规则.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  // 部门树与动作清单一次拉全量：筛选在接口侧，翻页时无需重复请求
  const [depts, meta] = await Promise.all([getDeptOptions(), getPermissionMeta()])
  deptTree.value = handleTree((depts as DeptOptionVO[]) || [])
  actionOptions.value = meta?.actions || []
  getList()
})
</script>
