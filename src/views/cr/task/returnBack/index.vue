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
      <el-form-item label="当前状态" prop="status">
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
          type="danger"
          plain
          :disabled="checkedRows.length !== 1"
          @click="openReturnDialog(checkedRows[0])"
          v-hasPermi="['cr:task-return:back']"
        >
          <Icon icon="ep:refresh-left" class="mr-5px" /> 打回任务
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:task-return:query']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 流转中的任务 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="打回操作：把流转中的任务打回指定环节（复核 / 本级审核 / 上级审核 / 填报），必须填写打回原因，并会生成待处理的打回记录。已完成、待下发的任务不在打回范围。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="任务编号" align="center" prop="taskCode" width="130" />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="填报机构" align="center" prop="orgName" width="120" />
      <el-table-column label="报送期次" align="center" prop="period" width="100" />
      <el-table-column label="截止日期" align="center" prop="deadline" width="120" />
      <el-table-column label="当前状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="当前环节" align="center" width="110">
        <template #default="scope">
          <el-tag :type="tagTypeOf(scope.row.status)" effect="plain">
            {{ stageOf(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="待处理打回" align="center" width="110">
        <template #default="scope">
          <el-tag v-if="pendingCount[scope.row.id!]" type="danger" effect="dark">
            {{ pendingCount[scope.row.id!] }} 条
          </el-tag>
          <span v-else class="color-#909399">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="150" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="danger"
            @click="openReturnDialog(scope.row)"
            v-hasPermi="['cr:task-return:back']"
          >
            打回
          </el-button>
          <el-button
            link
            type="primary"
            @click="openTraceDialog(scope.row.id)"
            v-hasPermi="['cr:task-return:query']"
          >
            轨迹
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

  <!-- 打回记录 -->
  <ContentWrap>
    <el-tabs v-model="recordTab" @tab-change="handleRecordTabChange">
      <el-tab-pane :label="`待处理打回（${recordStat.pending}）`" name="pending" />
      <el-tab-pane :label="`已处理打回（${recordStat.processed}）`" name="processed" />
    </el-tabs>
    <el-table v-loading="recordLoading" :data="recordList">
      <el-table-column label="任务编号" align="center" prop="taskCode" width="130" />
      <el-table-column
        label="报表名称"
        align="left"
        prop="taskName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="填报机构" align="center" prop="orgName" width="120" />
      <el-table-column label="打回环节" align="center" prop="stage" width="110">
        <template #default="scope">
          <el-tag type="danger" effect="plain">{{ scope.row.stage }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="打回原因"
        align="left"
        prop="reason"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="打回人" align="center" prop="returnUser" width="100" />
      <el-table-column
        label="打回时间"
        align="center"
        prop="returnTime"
        width="170"
        :formatter="dateFormatter"
      />
      <el-table-column label="处理状态" align="center" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.processed ? 'success' : 'danger'">
            {{ scope.row.processed ? '已处理' : '待处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="处理说明"
        align="left"
        prop="handleRemark"
        min-width="180"
        show-overflow-tooltip
      >
        <template #default="scope">{{ scope.row.handleRemark || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="110" fixed="right">
        <template #default="scope">
          <el-button
            v-if="!scope.row.processed"
            link
            type="primary"
            @click="openHandleDialog(scope.row)"
            v-hasPermi="['cr:task-return:back']"
          >
            处理
          </el-button>
          <span v-else class="color-#909399">—</span>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="recordTotal"
      v-model:page="recordQuery.pageNo"
      v-model:limit="recordQuery.pageSize"
      @pagination="getRecordList"
    />
  </ContentWrap>

  <!-- 弹窗：打回 -->
  <Dialog v-model="returnVisible" title="任务打回" width="620">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="打回后任务将回到所选环节重新处理，并生成一条待处理的打回记录，必须填写打回原因。"
      class="mb-12px"
    />
    <el-descriptions v-if="currentRow" :column="2" border size="small" class="mb-12px">
      <el-descriptions-item label="任务编号">{{ currentRow.taskCode }}</el-descriptions-item>
      <el-descriptions-item label="填报机构">{{ currentRow.orgName }}</el-descriptions-item>
      <el-descriptions-item label="报表名称" :span="2">{{
        currentRow.reportName
      }}</el-descriptions-item>
      <el-descriptions-item label="当前状态">
        <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="currentRow.status" />
      </el-descriptions-item>
      <el-descriptions-item label="当前环节">
        <el-tag :type="tagTypeOf(currentRow.status)" effect="plain">
          {{ stageOf(currentRow.status) }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>
    <el-form ref="returnFormRef" :model="returnForm" :rules="returnRules" label-width="90px">
      <el-form-item label="打回环节" prop="stage">
        <el-radio-group v-model="returnForm.stage">
          <el-radio-button
            v-for="stage in stageOptions"
            :key="stage"
            :value="stage"
            :disabled="stage === stageOf(currentRow?.status)"
          >
            {{ stage }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="打回原因" prop="reason">
        <el-input
          v-model="returnForm.reason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="请填写打回原因（必填），将作为打回记录与流转轨迹的意见"
        />
      </el-form-item>
      <el-form-item label="常用原因">
        <el-select
          v-model="quickReason"
          placeholder="选择常用原因快速填充"
          clearable
          class="w-full"
          @change="handleQuickReason"
        >
          <el-option v-for="item in quickReasons" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="returnLoading" type="danger" @click="submitReturn">确认打回</el-button>
      <el-button @click="returnVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- 弹窗：处理打回记录 -->
  <Dialog v-model="handleVisible" title="处理打回记录" width="560">
    <el-descriptions v-if="currentRecord" :column="1" border size="small" class="mb-12px">
      <el-descriptions-item label="任务编号">{{ currentRecord.taskCode }}</el-descriptions-item>
      <el-descriptions-item label="打回环节">{{ currentRecord.stage }}</el-descriptions-item>
      <el-descriptions-item label="打回原因">{{ currentRecord.reason }}</el-descriptions-item>
    </el-descriptions>
    <el-form :model="handleForm" label-width="90px">
      <el-form-item label="处理说明">
        <el-input
          v-model="handleForm.handleRemark"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="请填写处理说明，如：已重新填报并再次提交复核"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="handleLoading" type="primary" @click="submitHandle"
        >标记已处理</el-button
      >
      <el-button @click="handleVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- 弹窗：流转轨迹 -->
  <TaskTraceDialog ref="traceDialogRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as ReturnApi from '@/api/cr/task/returnBack'
import * as TaskApi from '@/api/cr/task/manage'
import TaskTraceDialog from '../components/TaskTraceDialog.vue'
import { RETURN_STAGE, stageOf, tagTypeOf } from '../constants'

defineOptions({ name: 'CrTaskReturnBack' })

const message = useMessage()

const loading = ref(true)
const total = ref(0)
const list = ref<ReturnApi.CrTaskVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  taskName: '',
  orgId: undefined as number | undefined,
  period: '',
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

const orgOptions = ref<Array<{ id: number; name: string }>>([])
const periodOptions = ref<Array<{ label: string; value: string }>>([])
const stageOptions = Object.values(RETURN_STAGE)

/** 查询流转中的任务 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ReturnApi.getReturnPage(queryParams)
    list.value = data.list
    total.value = data.total
    await loadPendingCount()
  } finally {
    loading.value = false
  }
}

/** 每个任务的待处理打回条数（列表上直接可见） */
const pendingCount = ref<Record<number, number>>({})
const loadPendingCount = async () => {
  const data = await ReturnApi.getReturnRecordPage({ pageNo: 1, pageSize: 200, processed: false })
  const counter: Record<number, number> = {}
  ;(data.list || []).forEach((row: ReturnApi.TaskReturnRecordVO) => {
    counter[row.taskId] = (counter[row.taskId] || 0) + 1
  })
  pendingCount.value = counter
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

const loadOptions = async () => {
  const [orgs, periods] = await Promise.all([
    TaskApi.getTaskOrgOptions(),
    TaskApi.getTaskPeriodOptions()
  ])
  orgOptions.value = orgs || []
  periodOptions.value = periods || []
}

/** 勾选（打回一次只针对一条任务，避免误伤） */
const checkedRows = ref<ReturnApi.CrTaskVO[]>([])
const handleRowCheckboxChange = (rows: ReturnApi.CrTaskVO[]) => {
  checkedRows.value = rows.length ? [rows[rows.length - 1]] : []
}

/** 打回弹窗 */
const returnVisible = ref(false)
const returnLoading = ref(false)
const returnFormRef = ref()
const currentRow = ref<ReturnApi.CrTaskVO>()
const returnForm = reactive({ stage: '' as string, reason: '' })
const returnRules = reactive({
  stage: [{ required: true, message: '请选择打回环节', trigger: 'change' }],
  reason: [{ required: true, message: '打回原因不能为空', trigger: 'blur' }]
})
const quickReasons = [
  '数据与业务系统明细不一致，请核对后重新报送',
  '报表存在漏项 / 空值，请补充完整后重报',
  '与上期数据波动异常且未附说明，请核实',
  '机构编码与机构维护信息不一致，请修正后重报',
  '证件号脱敏不符合监管要求，请按规则重新报送'
]
const quickReason = ref('')

const openReturnDialog = (row?: ReturnApi.CrTaskVO) => {
  if (!row) {
    message.warning('请先勾选需要打回的任务')
    return
  }
  currentRow.value = row
  returnForm.stage = ''
  returnForm.reason = ''
  quickReason.value = ''
  returnVisible.value = true
}

const handleQuickReason = (value: string) => {
  if (value) returnForm.reason = value
}

const submitReturn = async () => {
  await returnFormRef.value.validate()
  returnLoading.value = true
  try {
    await ReturnApi.returnBack(currentRow.value!.id!, returnForm.stage, returnForm.reason)
    message.success(`任务 ${currentRow.value!.taskCode} 已打回至${returnForm.stage}环节`)
    returnVisible.value = false
    checkedRows.value = []
    await getList()
    await getRecordList()
    await loadRecordStat()
  } finally {
    returnLoading.value = false
  }
}

/** 打回记录 */
const recordTab = ref<'pending' | 'processed'>('pending')
const recordLoading = ref(false)
const recordList = ref<ReturnApi.TaskReturnRecordVO[]>([])
const recordTotal = ref(0)
const recordQuery = reactive({ pageNo: 1, pageSize: 10 })
const recordStat = reactive({ pending: 0, processed: 0 })

const getRecordList = async () => {
  recordLoading.value = true
  try {
    const data = await ReturnApi.getReturnRecordPage({
      ...recordQuery,
      processed: recordTab.value === 'processed'
    })
    recordList.value = data.list
    recordTotal.value = data.total
  } finally {
    recordLoading.value = false
  }
}

const loadRecordStat = async () => {
  const data = await ReturnApi.getReturnRecordStat()
  recordStat.pending = data.pending
  recordStat.processed = data.processed
}

const handleRecordTabChange = () => {
  recordQuery.pageNo = 1
  getRecordList()
}

/** 处理打回记录 */
const handleVisible = ref(false)
const handleLoading = ref(false)
const currentRecord = ref<ReturnApi.TaskReturnRecordVO>()
const handleForm = reactive({ handleRemark: '' })

const openHandleDialog = (row: ReturnApi.TaskReturnRecordVO) => {
  currentRecord.value = row
  handleForm.handleRemark = ''
  handleVisible.value = true
}

const submitHandle = async () => {
  handleLoading.value = true
  try {
    await ReturnApi.handleReturnRecord([currentRecord.value!.id], handleForm.handleRemark)
    message.success('打回记录已处理')
    handleVisible.value = false
    await getRecordList()
    await loadRecordStat()
    await loadPendingCount()
  } finally {
    handleLoading.value = false
  }
}

/** 流转轨迹 */
const traceDialogRef = ref()
const openTraceDialog = (id: number) => {
  traceDialogRef.value.open(id)
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ReturnApi.exportReturn(queryParams)
    download.excel(data, '流转中任务.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await getList()
  await getRecordList()
  await loadRecordStat()
})
</script>
