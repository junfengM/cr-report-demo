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
      <el-form-item label="任务编号" prop="taskName">
        <el-input
          v-model="queryParams.taskName"
          placeholder="任务编号 / 任务名称"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="填报机构" prop="orgId">
        <el-select v-model="queryParams.orgId" placeholder="请选择机构" clearable class="!w-160px">
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="请选择期次" clearable class="!w-160px">
          <el-option
            v-for="item in periodOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="数据频度" prop="freq">
        <el-select v-model="queryParams.freq" placeholder="请选择频度" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="任务状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_TASK_STATUS)"
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
          @click="openDispatchDialog()"
          v-hasPermi="['cr:task:dispatch']"
        >
          <Icon icon="ep:promotion" class="mr-5px" /> 任务下发
        </el-button>
        <el-button
          type="warning"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDispatchBatch"
          v-hasPermi="['cr:task:dispatch-batch']"
        >
          <Icon icon="ep:position" class="mr-5px" /> 批量下发
        </el-button>
        <el-button type="success" plain @click="handleInit" v-hasPermi="['cr:task:init']">
          <Icon icon="ep:refresh" class="mr-5px" /> 任务初始化
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:task:delete']"
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
      title="任务下发后按机构 × 报表生成填报任务，流转链路：填报 → 复核 → 本级审核 → 上级审核 → 报文生成，任一环节均可打回。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="任务编号" align="center" prop="taskCode" width="130" />
      <el-table-column
        label="任务名称"
        align="left"
        prop="taskName"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="填报机构" align="center" prop="orgName" width="120" />
      <el-table-column label="数据频度" align="center" prop="freq" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
        </template>
      </el-table-column>
      <el-table-column label="报送期次" align="center" prop="period" width="100" />
      <el-table-column
        label="下发时间"
        align="center"
        prop="dispatchTime"
        width="170"
        :formatter="dateFormatter"
      />
      <el-table-column label="截止日期" align="center" prop="deadline" width="120" />
      <el-table-column label="当前状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="当前环节" align="center" width="200">
        <template #default="scope">
          <el-tag :type="tagTypeOf(scope.row.status)" effect="plain">
            {{ stageOf(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="填报人" align="center" prop="fillUser" width="100" />
      <el-table-column label="复核人" align="center" prop="reviewUser" width="100">
        <template #default="scope">{{ scope.row.reviewUser || '—' }}</template>
      </el-table-column>
      <el-table-column label="审核人" align="center" prop="auditUser" width="100">
        <template #default="scope">{{ scope.row.auditUser || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="200" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openTraceDialog(scope.row.id)"
            v-hasPermi="['cr:task:query']"
          >
            轨迹
          </el-button>
          <el-button
            link
            type="primary"
            @click="openDispatchDialog(scope.row)"
            v-hasPermi="['cr:task:dispatch']"
          >
            下发
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:task:delete']"
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

  <!-- 弹窗：任务下发 -->
  <TaskDispatchDialog ref="dispatchDialogRef" @success="getList" />

  <!-- 弹窗：流转轨迹 -->
  <TaskTraceDialog ref="traceDialogRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import * as TaskApi from '@/api/cr/task/manage'
import TaskDispatchDialog from './TaskDispatchDialog.vue'
import TaskTraceDialog from '../components/TaskTraceDialog.vue'
import { stageOf, tagTypeOf } from '../constants'

defineOptions({ name: 'CrTaskManage' })

const message = useMessage()

const loading = ref(true)
const total = ref(0)
const list = ref<TaskApi.CrTaskVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  taskName: '',
  orgId: undefined as number | undefined,
  period: '',
  freq: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()

/** 下拉数据 */
const orgOptions = ref<Array<{ id: number; name: string }>>([])
const periodOptions = ref<Array<{ label: string; value: string }>>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await TaskApi.getTaskPage(queryParams)
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

/** 加载下拉数据 */
const loadOptions = async () => {
  const [orgs, periods] = await Promise.all([
    TaskApi.getTaskOrgOptions(),
    TaskApi.getTaskPeriodOptions()
  ])
  orgOptions.value = orgs || []
  periodOptions.value = periods || []
}

/** 任务下发弹窗（表单与提交逻辑见 TaskDispatchDialog.vue） */
const dispatchDialogRef = ref()
const openDispatchDialog = (row?: TaskApi.CrTaskVO) => {
  dispatchDialogRef.value.open(row)
}

/** 批量下发：勾选任务按模板补发缺失机构任务 */
const checkedIds = ref<number[]>([])
const checkedRows = ref<TaskApi.CrTaskVO[]>([])
const handleRowCheckboxChange = (rows: TaskApi.CrTaskVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
  checkedRows.value = rows
}

const handleDispatchBatch = async () => {
  const finished = checkedRows.value.filter((row) => row.status === 90)
  const targets = checkedRows.value.filter((row) => row.status !== 90)
  if (!targets.length) {
    message.warning('勾选的任务均已完成，无需批量下发')
    return
  }
  try {
    await message.confirm(
      `将按勾选任务所属模板补发缺失的机构任务（共 ${targets.length} 条，已完成的 ${finished.length} 条自动忽略），是否继续？`,
      '批量下发确认'
    )
    const data = await TaskApi.dispatchTaskBatch(targets.map((row) => row.id!))
    message.success(`批量下发完成：新增 ${data.count} 条，跳过已下发 ${data.skipped} 条`)
    await getList()
  } catch {}
}

/** 任务初始化：按启用中的模板重建本期任务 */
const handleInit = async () => {
  try {
    await message.confirm(
      '任务初始化将按「启用中的任务模板 × 分公司」重建本期任务，已存在的任务不会重复生成，是否继续？',
      '任务初始化确认'
    )
    const data = await TaskApi.initTask()
    if (data.count) {
      message.success(
        `任务初始化完成：模板 ${data.templateCount} 个、机构 ${data.orgCount} 家，新增 ${data.count} 条，跳过 ${data.skipped} 条`
      )
    } else {
      message.warning(`本期（${data.period}）任务已全部生成，无需初始化（跳过 ${data.skipped} 条）`)
    }
    await getList()
  } catch {}
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await TaskApi.deleteTask(id)
    message.success('删除成功')
    await getList()
  } catch {}
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm(`确认删除选中的 ${checkedIds.value.length} 条任务吗？`)
    await TaskApi.deleteTaskList(checkedIds.value)
    checkedIds.value = []
    message.success('删除成功')
    await getList()
  } catch {}
}

/** 流转轨迹弹窗 */
const traceDialogRef = ref()
const openTraceDialog = (id: number) => {
  traceDialogRef.value.open(id)
}

onMounted(async () => {
  await loadOptions()
  await getList()
})
</script>
