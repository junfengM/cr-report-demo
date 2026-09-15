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
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :disabled="checkedIds.length === 0"
          @click="openOpinion('batch-pass')"
          v-hasPermi="['cr:task-review:batch']"
        >
          <Icon icon="ep:select" class="mr-5px" /> 批量复核通过
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:task-review:query']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
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
      title="复核环节只处理「待复核」状态的任务：复核通过后进入本级审核；复核不通过将退回填报并生成打回记录。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="任务编号" align="center" prop="taskCode" width="130" />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="填报机构" align="center" prop="orgName" width="120" />
      <el-table-column label="报送期次" align="center" prop="period" width="100" />
      <el-table-column label="填报人" align="center" prop="fillUser" width="100" />
      <el-table-column
        label="下发时间"
        align="center"
        prop="dispatchTime"
        width="170"
        :formatter="dateFormatter"
      />
      <el-table-column label="截止日期" align="center" prop="deadline" width="120" />
      <el-table-column label="状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="240" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="success"
            @click="openOpinion('pass', scope.row)"
            v-hasPermi="['cr:task-review:pass']"
          >
            复核通过
          </el-button>
          <el-button
            link
            type="danger"
            @click="openOpinion('reject', scope.row)"
            v-hasPermi="['cr:task-review:reject']"
          >
            复核不通过
          </el-button>
          <el-button
            link
            type="primary"
            @click="openTraceDialog(scope.row.id)"
            v-hasPermi="['cr:task-review:query']"
          >
            轨迹
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

  <!-- 弹窗：复核意见 -->
  <Dialog v-model="opinionVisible" :title="opinionTitle" width="560">
    <el-alert
      v-if="opinionType === 'reject'"
      type="warning"
      :closable="false"
      show-icon
      title="复核不通过必须填写意见，任务将退回填报环节并生成打回记录。"
      class="mb-12px"
    />
    <el-descriptions
      v-if="currentRows.length === 1"
      :column="2"
      border
      size="small"
      class="mb-12px"
    >
      <el-descriptions-item label="任务编号">{{ currentRows[0].taskCode }}</el-descriptions-item>
      <el-descriptions-item label="填报机构">{{ currentRows[0].orgName }}</el-descriptions-item>
      <el-descriptions-item label="报表名称" :span="2">{{
        currentRows[0].reportName
      }}</el-descriptions-item>
      <el-descriptions-item label="填报人">{{ currentRows[0].fillUser }}</el-descriptions-item>
      <el-descriptions-item label="截止日期">{{ currentRows[0].deadline }}</el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-else
      type="info"
      :closable="false"
      show-icon
      :title="`本次批量复核 ${currentRows.length} 条任务：${currentRows.map((item) => item.taskCode).join('、')}`"
      class="mb-12px"
    />
    <el-form ref="opinionFormRef" :model="opinionForm" :rules="opinionRules" label-width="80px">
      <el-form-item label="复核意见" prop="opinion">
        <el-input
          v-model="opinionForm.opinion"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          :placeholder="
            opinionType === 'reject' ? '请填写不通过原因（必填）' : '请填写复核意见（可选）'
          "
        />
      </el-form-item>
      <el-form-item label="快捷意见">
        <el-select
          v-model="quickOpinion"
          placeholder="选择常用意见快速填充"
          clearable
          class="w-full"
          @change="handleQuickOpinion"
        >
          <el-option v-for="item in quickOpinions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="opinionLoading" type="primary" @click="submitOpinion">确 定</el-button>
      <el-button @click="opinionVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- 弹窗：流转轨迹 -->
  <TaskTraceDialog ref="traceDialogRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as ReviewApi from '@/api/cr/task/review'
import * as TaskApi from '@/api/cr/task/manage'
import TaskTraceDialog from '../components/TaskTraceDialog.vue'

defineOptions({ name: 'CrTaskReview' })

const message = useMessage()

const loading = ref(true)
const total = ref(0)
const list = ref<ReviewApi.CrTaskVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  taskName: '',
  orgId: undefined as number | undefined,
  period: '',
  freq: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

const orgOptions = ref<Array<{ id: number; name: string }>>([])
const periodOptions = ref<Array<{ label: string; value: string }>>([])

/** 查询待复核任务列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ReviewApi.getReviewPage(queryParams)
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

const loadOptions = async () => {
  const [orgs, periods] = await Promise.all([
    TaskApi.getTaskOrgOptions(),
    TaskApi.getTaskPeriodOptions()
  ])
  orgOptions.value = orgs || []
  periodOptions.value = periods || []
}

/** 复核意见弹窗 */
const opinionVisible = ref(false)
const opinionLoading = ref(false)
const opinionType = ref<'pass' | 'reject' | 'batch-pass'>('pass')
const opinionTitle = ref('复核操作')
const opinionFormRef = ref()
const opinionForm = reactive({ opinion: '' })
const opinionRules = reactive({
  opinion: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (opinionType.value !== 'pass' && !String(value || '').trim()) {
          callback(new Error('意见不能为空'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
})
const currentRows = ref<ReviewApi.CrTaskVO[]>([])

const quickOpinions = [
  '数据完整性与勾稽关系核对无误',
  '数据与上期波动超过 30%，已核对说明',
  '保费与赔案口径存在差异，请核对后重新提交',
  '报表数据与业务系统明细不一致，请复核后重报'
]
const quickOpinion = ref('')

const openOpinion = (type: 'pass' | 'reject' | 'batch-pass', row?: ReviewApi.CrTaskVO) => {
  opinionType.value = type
  currentRows.value = type === 'batch-pass' ? checkedRows.value : row ? [row] : []
  if (!currentRows.value.length) {
    message.warning('请先勾选需要批量复核的任务')
    return
  }
  opinionTitle.value =
    type === 'pass' ? '复核通过' : type === 'reject' ? '复核不通过' : '批量复核通过'
  opinionForm.opinion = ''
  quickOpinion.value = ''
  opinionVisible.value = true
}

const handleQuickOpinion = (value: string) => {
  if (value) opinionForm.opinion = value
}

const submitOpinion = async () => {
  await opinionFormRef.value.validate()
  opinionLoading.value = true
  const ids = currentRows.value.map((item) => item.id!)
  try {
    if (opinionType.value === 'pass') {
      await ReviewApi.reviewPass(ids, opinionForm.opinion)
      message.success(`复核通过 ${ids.length} 条，已提交本级审核`)
    } else if (opinionType.value === 'reject') {
      await ReviewApi.reviewReject(ids, opinionForm.opinion)
      message.success(`已退回填报 ${ids.length} 条，并生成打回记录`)
    } else {
      await ReviewApi.reviewBatchPass(ids, opinionForm.opinion || '批量复核通过')
      message.success(`批量复核通过 ${ids.length} 条，已提交本级审核`)
    }
    opinionVisible.value = false
    checkedIds.value = []
    await getList()
  } finally {
    opinionLoading.value = false
  }
}

/** 勾选 */
const checkedIds = ref<number[]>([])
const checkedRows = ref<ReviewApi.CrTaskVO[]>([])
const handleRowCheckboxChange = (rows: ReviewApi.CrTaskVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
  checkedRows.value = rows
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ReviewApi.exportReview(queryParams)
    download.excel(data, '待复核任务.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 流转轨迹 */
const traceDialogRef = ref()
const openTraceDialog = (id: number) => {
  traceDialogRef.value.open(id)
}

onMounted(async () => {
  await loadOptions()
  await getList()
})
</script>
