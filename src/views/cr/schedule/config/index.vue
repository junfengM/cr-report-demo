<template>
  <ContentWrap>
    <!-- 调度状态的作用范围与 Cron 口径先讲清楚：关掉 != 不能手工执行 -->
    <el-alert
      class="mb-15px"
      type="info"
      :closable="false"
      show-icon
      title="调度状态只决定「自动调度会不会跑它」：关掉之后任务仍然可以在「手工调度」页手动执行"
      description="「有状态」的任务串行执行（上一次没跑完不会起第二次），无状态的任务可以并发。Cron 是 Quartz 六段（秒 分 时 日 月 周），段数不对接口会拦下并说明缺哪一段；一个任务只保留一条调度配置。"
    />

    <!-- 搜索工作栏：关键字 + 调度状态 + 任务 -->
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
          placeholder="任务名称 / Cron / 备注"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="调度状态" prop="enabled">
        <!-- 只有开启 / 关闭两种值，没有对应字典（CR_ENABLE_STATUS 是给"启停"用的另一套语境），清空即全部 -->
        <el-select v-model="queryParams.enabled" placeholder="全部" clearable class="!w-160px">
          <el-option label="已开启" :value="1" />
          <el-option label="已关闭" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="任务" prop="taskId">
        <el-select
          v-model="queryParams.taskId"
          placeholder="全部任务"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="item in taskOptions"
            :key="item.id"
            :label="item.code + ' ' + item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:schedule:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery" v-hasPermi="['cr:schedule:query']">
          <Icon icon="ep:refresh" class="mr-5px" /> 重置
        </el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:schedule:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:schedule:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:schedule:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 调度配置列表 -->
  <ContentWrap v-hasPermi="['cr:schedule:query']" title="调度配置列表">
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="任务名称"
        align="left"
        prop="taskName"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column
        label="任务编码"
        align="left"
        prop="taskCode"
        width="200"
        show-overflow-tooltip
      />
      <el-table-column label="Cron 表达式" align="center" width="150">
        <template #default="scope">
          <span class="font-mono">{{ scope.row.cron }}</span>
        </template>
      </el-table-column>
      <el-table-column label="调度状态" align="center" width="130">
        <template #default="scope">
          <!-- 启停是写操作：没有权限时整条开关都不渲染，不留"点得动但会被接口拒绝"的假入口 -->
          <span v-hasPermi="['cr:schedule:toggle']">
            <el-switch
              v-model="scope.row.enabled"
              :active-value="1"
              :inactive-value="0"
              :disabled="toggleId === scope.row.id"
              @change="handleToggle(scope.row)"
            />
          </span>
        </template>
      </el-table-column>
      <el-table-column label="是否有状态" align="center" width="110">
        <template #default="scope">
          <el-tag
            :type="scope.row.stateful ? 'warning' : 'info'"
            size="small"
            effect="plain"
            disable-transitions
          >
            {{ scope.row.stateful ? '有状态' : '无状态' }}
          </el-tag>
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
            v-hasPermi="['cr:schedule:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:schedule:delete']"
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
  <ConfigForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import download from '@/utils/download'
import {
  getSchedulePage,
  deleteSchedule,
  deleteScheduleList,
  exportSchedule,
  toggleSchedule,
  type ScheduleVO
} from '@/api/cr/schedule/config'
import { getCollectTaskOptions, type CollectTaskOptionVO } from '@/api/cr/schedule/task'
import ConfigForm from './ConfigForm.vue'

defineOptions({ name: 'CrScheduleConfig' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ScheduleVO[]>([])
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在启停的记录 id：避免同一行被连点两次 */
const toggleId = ref<number>()

const taskOptions = ref<CollectTaskOptionVO[]>([])

const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  enabled: undefined as number | undefined,
  taskId: undefined as number | undefined
})

/** 查询参数：空值一律不下发，避免被 mock 当成精确匹配 */
const buildQueryParams = () => ({
  pageNo: queryParams.pageNo,
  pageSize: queryParams.pageSize,
  keyword: queryParams.keyword || undefined,
  enabled: queryParams.enabled ?? undefined,
  taskId: queryParams.taskId ?? undefined
})

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await getSchedulePage(buildQueryParams())
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

/** 任务下拉：加载失败不阻塞列表，原因由拦截器统一提示 */
const getTaskOptions = async () => {
  try {
    taskOptions.value = (await getCollectTaskOptions()) || []
  } catch {}
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

/**
 * 启停调度：el-switch 已经先把本地值改掉了，所以失败时不能只提示 ——
 * finally 里的 getList() 会把开关拉回服务端的真实状态（否则页面会显示一个假的"已开启"）。
 */
const handleToggle = async (row: ScheduleVO) => {
  toggleId.value = row.id
  try {
    const result = await toggleSchedule(row.id!, row.enabled)
    message.success('任务「' + row.taskName + '」的调度' + (result?.enabledLabel || '已更新'))
  } catch {
    // 失败原因由拦截器统一提示，这里什么都不用编
  } finally {
    toggleId.value = undefined
    await getList()
  }
}

/** 删除：一个任务只保留一条调度，删掉后该任务就没有自动调度了 */
const handleDelete = async (row: ScheduleVO) => {
  try {
    await message.delConfirm('确认删除任务「' + row.taskName + '」的调度配置？')
    await deleteSchedule(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ScheduleVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await deleteScheduleList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出：导出的是当前筛选条件下的全量调度配置（与列表同一套过滤） */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await exportSchedule(buildQueryParams())
    download.excel(data, '调度配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 */
onMounted(() => {
  getTaskOptions()
  getList()
})
</script>
