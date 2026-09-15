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
          @click="openOpinion('pass')"
          v-hasPermi="['cr:task-audit-upper:pass']"
        >
          <Icon icon="ep:select" class="mr-5px" /> 批量审核通过（{{ checkedIds.length }}）
        </el-button>
        <el-button
          type="warning"
          plain
          :disabled="checkedIds.length === 0"
          @click="openOpinion('back')"
          v-hasPermi="['cr:task-audit-upper:reject']"
        >
          <Icon icon="ep:back" class="mr-5px" /> 退回至本级审核
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:task-audit-upper:query']"
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
      title="上级审核为链路最后一环：审核通过后任务完成、可进入报文生成；不通过则退回本级审核，也可直接退回至本级审核重新把关。"
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
      <el-table-column label="复核人" align="center" prop="reviewUser" width="100">
        <template #default="scope">{{ scope.row.reviewUser || '—' }}</template>
      </el-table-column>
      <el-table-column label="本级审核人" align="center" prop="auditUser" width="110">
        <template #default="scope">{{ scope.row.auditUser || '—' }}</template>
      </el-table-column>
      <el-table-column label="截止日期" align="center" prop="deadline" width="120" />
      <el-table-column label="当前状态" align="center" prop="status" width="120">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="当前环节" align="center" width="110">
        <template #default>
          <el-tag type="warning" effect="plain">上级审核</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="320" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openReportDialog(scope.row)"
            v-hasPermi="['cr:task-audit-upper:query']"
          >
            报表清单
          </el-button>
          <el-button
            link
            type="success"
            @click="openOpinion('pass', scope.row)"
            v-hasPermi="['cr:task-audit-upper:pass']"
          >
            审核通过
          </el-button>
          <el-button
            link
            type="danger"
            @click="openOpinion('reject', scope.row)"
            v-hasPermi="['cr:task-audit-upper:reject']"
          >
            审核不通过
          </el-button>
          <el-button
            link
            type="warning"
            @click="openOpinion('back', scope.row)"
            v-hasPermi="['cr:task-audit-upper:reject']"
          >
            退回本级
          </el-button>
          <el-button
            link
            type="info"
            @click="openTraceDialog(scope.row.id)"
            v-hasPermi="['cr:task-audit-upper:query']"
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

  <!-- 弹窗：审核意见 -->
  <Dialog v-model="opinionVisible" :title="opinionTitle" width="600">
    <el-alert
      v-if="opinionType === 'reject'"
      type="warning"
      :closable="false"
      show-icon
      title="上级审核不通过必须填写意见，任务将退回本级审核并生成打回记录。"
      class="mb-12px"
    />
    <el-alert
      v-else-if="opinionType === 'back'"
      type="warning"
      :closable="false"
      show-icon
      title="退回至本级审核不修改填报数据，仅将任务退回本级重新把关（保留审核流水）。"
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
      <el-descriptions-item label="本级审核人">{{
        currentRows[0].auditUser || '—'
      }}</el-descriptions-item>
      <el-descriptions-item label="截止日期">{{ currentRows[0].deadline }}</el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-else
      type="info"
      :closable="false"
      show-icon
      :title="`本次处理 ${currentRows.length} 条任务：${currentRows.map((item) => item.taskCode).join('、')}`"
      class="mb-12px"
    />
    <el-form ref="opinionFormRef" :model="opinionForm" :rules="opinionRules" label-width="80px">
      <el-form-item label="审核意见" prop="opinion">
        <el-input
          v-model="opinionForm.opinion"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          :placeholder="opinionType === 'pass' ? '请填写审核意见（可选）' : '请填写原因（必填）'"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="opinionLoading" type="primary" @click="submitOpinion">确 定</el-button>
      <el-button @click="opinionVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- 弹窗：报表清单 -->
  <TaskReportDialog ref="reportDialogRef" next-stage="报文生成" />
  <!-- 弹窗：流转轨迹 -->
  <TaskTraceDialog ref="traceDialogRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as AuditApi from '@/api/cr/task/auditUpper'
import * as TaskApi from '@/api/cr/task/manage'
import TaskReportDialog from '../components/TaskReportDialog.vue'
import TaskTraceDialog from '../components/TaskTraceDialog.vue'

defineOptions({ name: 'CrTaskAuditUpper' })

const message = useMessage()

const loading = ref(true)
const total = ref(0)
const list = ref<AuditApi.CrTaskVO[]>([])
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

/** 查询待上级审核任务 */
const getList = async () => {
  loading.value = true
  try {
    const data = await AuditApi.getAuditUpperPage(queryParams)
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

/** 勾选 */
const checkedIds = ref<number[]>([])
const checkedRows = ref<AuditApi.CrTaskVO[]>([])
const handleRowCheckboxChange = (rows: AuditApi.CrTaskVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
  checkedRows.value = rows
}

/** 审核意见弹窗 */
const opinionVisible = ref(false)
const opinionLoading = ref(false)
const opinionType = ref<'pass' | 'reject' | 'back'>('pass')
const opinionTitle = ref('上级审核')
const opinionFormRef = ref()
const opinionForm = reactive({ opinion: '' })
const opinionRules = reactive({
  opinion: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (opinionType.value !== 'pass' && !String(value || '').trim()) {
          callback(new Error('原因不能为空'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
})
const currentRows = ref<AuditApi.CrTaskVO[]>([])

const openOpinion = (type: 'pass' | 'reject' | 'back', row?: AuditApi.CrTaskVO) => {
  opinionType.value = type
  currentRows.value = row ? [row] : checkedRows.value
  if (!currentRows.value.length) {
    message.warning('请先勾选需要处理的任务')
    return
  }
  opinionTitle.value =
    type === 'pass' ? '上级审核通过' : type === 'reject' ? '上级审核不通过' : '退回至本级审核'
  opinionForm.opinion = ''
  opinionVisible.value = true
}

const submitOpinion = async () => {
  await opinionFormRef.value.validate()
  opinionLoading.value = true
  const ids = currentRows.value.map((item) => item.id!)
  try {
    if (opinionType.value === 'pass') {
      const result = await AuditApi.auditUpperPass(ids, opinionForm.opinion)
      message.success(`上级审核通过 ${result.successCount} 条，任务已完成`)
    } else if (opinionType.value === 'reject') {
      await AuditApi.auditUpperReject(ids, opinionForm.opinion)
      message.success(`已退回本级审核 ${ids.length} 条，并生成打回记录`)
    } else {
      await AuditApi.auditUpperBack(ids, opinionForm.opinion)
      message.success(`已退回至本级审核 ${ids.length} 条`)
    }
    opinionVisible.value = false
    checkedIds.value = []
    await getList()
  } finally {
    opinionLoading.value = false
  }
}

/** 报表清单 */
const reportDialogRef = ref()
const openReportDialog = (row: AuditApi.CrTaskVO) => {
  reportDialogRef.value.open(row)
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
    const data = await AuditApi.exportAuditUpper(queryParams)
    download.excel(data, '待上级审核任务.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await getList()
})
</script>
