<template>
  <el-row :gutter="16">
    <!-- 左栏：任务分组。点某个分组只看该组，再点一次（或点「全部分组」）回到全部 -->
    <el-col :span="6">
      <ContentWrap title="任务分组">
        <el-alert class="mb-10px" type="info" :closable="false" show-icon :title="groupTip" />
        <el-button
          class="mb-10px w-full"
          :type="queryParams.groupId ? 'default' : 'primary'"
          plain
          @click="handleAllGroups"
        >
          <Icon icon="ep:menu" class="mr-5px" /> 全部分组
        </el-button>
        <el-tree
          ref="groupTreeRef"
          v-loading="groupLoading"
          :data="groupTree"
          :props="{ label: 'groupName', children: 'children' }"
          node-key="id"
          default-expand-all
          highlight-current
          :expand-on-click-node="false"
          @node-click="handleGroupClick"
        >
          <template #default="{ data }">
            <span class="flex items-center">
              <span>{{ data.groupName }}</span>
              <el-tag class="ml-5px" size="small" type="primary" effect="plain" disable-transitions>
                {{ data.taskCount }} 个
              </el-tag>
              <el-tag
                v-if="data.highPriorityCount > 0"
                class="ml-5px"
                size="small"
                type="danger"
                effect="plain"
                disable-transitions
              >
                高 {{ data.highPriorityCount }}
              </el-tag>
            </span>
          </template>
        </el-tree>
      </ContentWrap>
    </el-col>

    <!-- 右栏：搜索 + 列表 -->
    <el-col :span="18">
      <ContentWrap>
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
              placeholder="任务编码 / 名称 / 实现方法 / 描述"
              clearable
              class="!w-220px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="实现类型" prop="implType">
            <el-select v-model="queryParams.implType" placeholder="全部" clearable class="!w-160px">
              <el-option
                v-for="item in meta.implTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级" prop="priority">
            <el-select v-model="queryParams.priority" placeholder="全部" clearable class="!w-160px">
              <el-option
                v-for="item in meta.priorities"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="handleQuery" v-hasPermi="['cr:collect-task:query']">
              <Icon icon="ep:search" class="mr-5px" /> 搜索
            </el-button>
            <el-button @click="resetQuery" v-hasPermi="['cr:collect-task:query']">
              <Icon icon="ep:refresh" class="mr-5px" /> 重置
            </el-button>
            <el-button
              type="primary"
              plain
              @click="openForm('create')"
              v-hasPermi="['cr:collect-task:create']"
            >
              <Icon icon="ep:plus" class="mr-5px" /> 新增任务
            </el-button>
            <el-button
              type="success"
              plain
              :loading="exportLoading"
              @click="handleExport"
              v-hasPermi="['cr:collect-task:export']"
            >
              <Icon icon="ep:download" class="mr-5px" /> 导出
            </el-button>
            <el-button
              type="danger"
              plain
              :disabled="checkedIds.length === 0"
              @click="handleDeleteBatch"
              v-hasPermi="['cr:collect-task:delete']"
            >
              <Icon icon="ep:delete" class="mr-5px" /> 批量删除
            </el-button>
          </el-form-item>
        </el-form>
      </ContentWrap>

      <ContentWrap v-hasPermi="['cr:collect-task:query']" title="采集任务列表">
        <el-alert
          class="mb-10px"
          type="info"
          :closable="false"
          show-icon
          title="这组任务按「优先级 → 任务编号」顺序执行；任务编码是跑批日志的关联键，创建后不可修改；前置任务决定「批量监控」里等待判定的结果。"
        />
        <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
          <el-table-column type="selection" width="55" />
          <el-table-column
            label="任务编码"
            align="left"
            prop="code"
            width="200"
            show-overflow-tooltip
          />
          <el-table-column
            label="任务名称"
            align="left"
            prop="name"
            min-width="170"
            show-overflow-tooltip
          />
          <el-table-column label="所属分组" align="center" prop="groupName" width="130" />
          <!-- 优先级用 el-tag 而不是 dict-tag：中文名由服务端按同一套映射算好（priorityLabel） -->
          <el-table-column label="优先级" align="center" width="90">
            <template #default="scope">
              <el-tag
                :type="priorityTagType(scope.row.priority)"
                size="small"
                effect="plain"
                disable-transitions
              >
                {{ scope.row.priorityLabel || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="实现类型" align="center" prop="implType" width="110">
            <template #default="scope">
              <dict-tag :type="DICT_TYPE.CR_TASK_IMPL_TYPE" :value="scope.row.implType" />
            </template>
          </el-table-column>
          <el-table-column
            label="实现方法"
            align="left"
            prop="implMethod"
            min-width="200"
            show-overflow-tooltip
          />
          <!-- 前置任务为空时显式写「无」，避免空单元格被当成"没配过"或"加载失败" -->
          <el-table-column label="前置任务" align="left" min-width="180" show-overflow-tooltip>
            <template #default="scope">
              <span v-if="scope.row.preTaskNames && scope.row.preTaskNames.length">
                {{ scope.row.preTaskNames.join('、') }}
              </span>
              <span v-else class="text-[#909399]">无</span>
            </template>
          </el-table-column>
          <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
          <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
          <el-table-column label="操作" align="center" width="200" fixed="right">
            <template #default="scope">
              <el-button
                link
                type="primary"
                @click="openForm('update', scope.row.id)"
                v-hasPermi="['cr:collect-task:update']"
              >
                修改
              </el-button>
              <el-button
                link
                type="warning"
                @click="openPreTask(scope.row.id)"
                v-hasPermi="['cr:collect-task:pre-task']"
              >
                前置任务
              </el-button>
              <!-- 删除不做前端禁用：能不能删由接口判定，被拦下时会给出中文原因（灰按钮说不出为什么不能删） -->
              <el-button
                link
                type="danger"
                @click="handleDelete(scope.row)"
                v-hasPermi="['cr:collect-task:delete']"
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
    </el-col>
  </el-row>

  <!-- 表单弹窗：新增 / 修改 -->
  <TaskForm ref="formRef" @success="refreshAfterChange" />
  <!-- 前置任务弹窗（主 agent 提供，接口会做自我依赖与环检测） -->
  <PreTaskDialog ref="preTaskRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import download from '@/utils/download'
import {
  getCollectTaskPage,
  deleteCollectTask,
  deleteCollectTaskList,
  exportCollectTask,
  getCollectTaskGroupTree,
  getCollectTaskMeta,
  type CollectTaskVO,
  type CollectTaskGroupVO
} from '@/api/cr/schedule/task'
import TaskForm from './TaskForm.vue'
import PreTaskDialog from './PreTaskDialog.vue'

defineOptions({ name: 'CrScheduleTask' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<CollectTaskVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  implType: undefined as number | undefined,
  priority: undefined as number | undefined,
  /** 左栏树选中的分组；undefined = 全部分组（接口对空值跳过该过滤条件） */
  groupId: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

const groupLoading = ref(false)
const groupTree = ref<CollectTaskGroupVO[]>([])
const groupTreeRef = ref()

/** 实现类型 / 优先级的选项由服务端 meta 给（与列表、导出同一套中文名，页面不再写第二份） */
const meta = ref<{
  implTypes: { value: number; label: string }[]
  priorities: { value: number; label: string }[]
}>({ implTypes: [], priorities: [] })

/** 左栏顶部说明：选中分组时讲清这组取哪块数据，未选中时讲清分组树怎么用 */
const groupTip = computed(() => {
  const current = groupTree.value.find((item) => item.id === queryParams.groupId)
  if (!current) {
    return '任务按分组维护取数范围：点某个分组只看该组，再点一次或点「全部分组」回到全部。'
  }
  return (
    '当前只看「' +
    current.groupName +
    '」：' +
    (current.description || '暂无分组说明') +
    '（共 ' +
    current.taskCount +
    ' 个任务，其中高优先级 ' +
    current.highPriorityCount +
    ' 个）'
  )
})

/** 优先级配色：高=danger / 中=warning / 低=info，跟"先跑谁"的风险感一致 */
const priorityTagType = (priority: number) => {
  if (Number(priority) === 1) return 'danger'
  if (Number(priority) === 2) return 'warning'
  return 'info'
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await getCollectTaskPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

/** 查询分组树（组内任务数由服务端现算，任务增删后要跟着刷） */
const getGroupTree = async () => {
  groupLoading.value = true
  try {
    groupTree.value = (await getCollectTaskGroupTree()) || []
  } finally {
    groupLoading.value = false
  }
}

/** 查询元数据：实现类型 / 优先级选项 */
const getMeta = async () => {
  const data = await getCollectTaskMeta()
  meta.value = { implTypes: data?.implTypes || [], priorities: data?.priorities || [] }
}

/** 新增 / 删除会改变组内任务数，所以列表与分组树一起刷新 */
const refreshAfterChange = async () => {
  await Promise.all([getList(), getGroupTree()])
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 点分组：只看这一组；再点一次同一组等于取消筛选（回到全部） */
const handleGroupClick = (data: CollectTaskGroupVO) => {
  const nextId = queryParams.groupId === data.id ? undefined : data.id
  queryParams.groupId = nextId
  groupTreeRef.value?.setCurrentKey(nextId ?? null)
  handleQuery()
}

/** 全部分组 */
const handleAllGroups = () => {
  queryParams.groupId = undefined
  groupTreeRef.value?.setCurrentKey(null)
  handleQuery()
}

/** 重置 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  // groupId 由左栏树控制、不是搜索表单字段，resetFields 清不掉，必须显式回到全部
  queryParams.groupId = undefined
  groupTreeRef.value?.setCurrentKey(null)
  handleQuery()
}

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 前置任务弹窗 */
const preTaskRef = ref()
const openPreTask = (id: number) => {
  preTaskRef.value.open(id)
}

/** 删除：能不能删由接口判定，被拦下时给出中文原因（不在前端猜规则） */
const handleDelete = async (row: CollectTaskVO) => {
  try {
    await message.delConfirm('确认删除采集任务「' + row.code + ' ' + row.name + '」？')
    await deleteCollectTask(row.id!)
    message.success(t('common.delSuccess'))
    await refreshAfterChange()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: CollectTaskVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await deleteCollectTaskList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await refreshAfterChange()
  } catch {}
}

/** 导出：导出的是当前筛选条件下的全量数据（与列表同一套过滤） */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await exportCollectTask(queryParams)
    download.excel(data, '采集任务.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化：分组树 + 元数据 + 列表并行拉 */
onMounted(() => {
  Promise.all([getGroupTree(), getMeta(), getList()])
})
</script>
