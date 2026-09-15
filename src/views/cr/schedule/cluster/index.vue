<template>
  <ContentWrap>
    <!-- 搜索工作栏：关键字 + 角色 + 状态三条件 -->
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
          placeholder="节点名 / 地址 / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="角色" prop="role">
        <el-select v-model="queryParams.role" placeholder="全部" clearable class="!w-160px">
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_CLUSTER_ROLE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_CLUSTER_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:cluster:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:cluster:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:cluster:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:cluster:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:cluster:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap v-hasPermi="['cr:cluster:query']" title="集群节点列表">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="集群里只应有一个主节点（master），它负责任务分发与调度决策；工作节点（worker）承担实际跑批。离线节点不会再接收到调度。"
      description="节点地址格式为 IP:端口（如 10.20.31.11:8080），格式不对接口会拦下并给出中文原因；节点名在集群内唯一，重复也会被接口拦下。接口只校验这两条，不会阻止你再配一个 master —— 主节点数量要靠部署时人工保证（演示数据里 master 只有一条）。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="节点名" prop="nodeName" width="140" show-overflow-tooltip />
      <el-table-column label="节点地址" prop="address" width="180" show-overflow-tooltip />
      <el-table-column label="角色" align="center" prop="role" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_CLUSTER_ROLE" :value="scope.row.role" />
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_CLUSTER_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:cluster:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:cluster:delete']"
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
  <ClusterForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions, getStrDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import {
  getClusterPage,
  deleteCluster,
  deleteClusterList,
  exportCluster,
  type ClusterVO
} from '@/api/cr/schedule/cluster'
import ClusterForm from './ClusterForm.vue'

defineOptions({ name: 'CrScheduleCluster' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ClusterVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  role: undefined as string | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await getClusterPage(queryParams)
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

/** 删除：删掉主节点会让集群没有分发者，接口不拦这一条，所以在确认框里再提醒一次 */
const handleDelete = async (row: ClusterVO) => {
  try {
    const tip =
      row.role === 'master'
        ? '「' + row.nodeName + '」是主节点（master），删除后集群将没有任务分发者，确认删除？'
        : '确认删除集群节点「' + row.nodeName + '」？'
    await message.delConfirm(tip)
    await deleteCluster(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ClusterVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm('确认删除选中的 ' + checkedIds.value.length + ' 个集群节点？')
    await deleteClusterList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出：导出的是当前筛选条件下的全量节点（与列表同一套过滤） */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await exportCluster(queryParams)
    download.excel(data, '集群节点.xls')
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
