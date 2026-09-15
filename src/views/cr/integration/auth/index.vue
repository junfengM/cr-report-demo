<template>
  <ContentWrap title="接入权限">
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="接口范围 / 机构 / 报表 / 备注"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="接入系统" prop="sysCode">
        <el-select
          v-model="queryParams.sysCode"
          placeholder="请选择接入系统"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="item in systemOptions"
            :key="item.sysCode"
            :label="item.sysName + '（' + item.sysCode + '）'"
            :value="item.sysCode"
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
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:integration-auth:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:integration-auth:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增授权
        </el-button>
        <el-button
          type="warning"
          plain
          @click="handleDecideQuery"
          v-hasPermi="['cr:integration-auth:decide']"
        >
          <Icon icon="ep:magic-stick" class="mr-5px" /> 生效判断
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:integration-auth:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:integration-auth:delete']"
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
      title="接入权限 = 接入系统 × 接口范围 × 数据范围（机构 / 报表）。同一系统的多条授权里只有一条真正生效：接口范围更精确（无通配 *）优先，其次优先级小的优先。点「生效判断」看逐条结论。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="接入系统" align="left" min-width="190" show-overflow-tooltip>
        <template #default="scope">
          <div>{{ scope.row.sysName }}</div>
          <div class="text-12px text-gray-400">{{ scope.row.sysCode }}</div>
        </template>
      </el-table-column>
      <el-table-column
        label="接口范围"
        align="left"
        prop="apiScope"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        label="机构范围"
        align="left"
        prop="orgNames"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表范围"
        align="left"
        prop="reportNames"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="优先级" align="center" prop="priority" width="90" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
      <el-table-column label="操作" align="center" width="210" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="warning"
            @click="openDecision(scope.row.sysCode, scope.row.sysName)"
            v-hasPermi="['cr:integration-auth:decide']"
          >
            生效判断
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:integration-auth:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:integration-auth:delete']"
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
  <AuthForm ref="formRef" :system-options="systemOptions" @success="getList" />
  <!-- 生效判断弹窗 -->
  <AuthDecisionDialog ref="decisionRef" />
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as IntegrationAuthApi from '@/api/cr/integration/auth'
import * as IntegrationSystemApi from '@/api/cr/integration/system'
import AuthForm from './AuthForm.vue'
import AuthDecisionDialog from './AuthDecisionDialog.vue'

defineOptions({ name: 'CrIntegrationAuth' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<IntegrationAuthApi.IntegrationAuthVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  sysCode: undefined as string | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const checkedIds = ref<number[]>([])
/** 接入系统下拉：权限页与附件页共用同一个 simple-list-all 接口 */
const systemOptions = ref<any[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await IntegrationAuthApi.getPage(queryParams)
    // 空数据容忍：没有授权记录时列表为空数组，表格显示空态
    list.value = (data && data.list) || []
    total.value = (data && data.total) || 0
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 生效判断：行内按该行系统判定 */
const decisionRef = ref()
const openDecision = (sysCode: string, sysName?: string) => {
  decisionRef.value.open(sysCode, sysName)
}

/** 生效判断：工具栏按搜索栏选中的系统判定（没选就提示先选，不猜） */
const handleDecideQuery = () => {
  if (!queryParams.sysCode) {
    message.warning('请先在上方「接入系统」里选择要判定的系统，或直接点某一行的「生效判断」')
    return
  }
  openDecision(queryParams.sysCode)
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
  } catch {
    return
  }
  try {
    await IntegrationAuthApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  }
}

/** 批量删除 */
const handleRowCheckboxChange = (rows: IntegrationAuthApi.IntegrationAuthVO[]) => {
  checkedIds.value = rows.map((row) => row.id as number)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
  } catch {
    return
  }
  try {
    await IntegrationAuthApi.removeList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  }
}

/** 导出按钮操作 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await IntegrationAuthApi.exportExcel(queryParams)
    download.excel(data, '接入权限.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 */
onMounted(async () => {
  systemOptions.value = (await IntegrationSystemApi.getSystemOptions()) || []
  getList()
})
</script>
