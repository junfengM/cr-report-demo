<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="880">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="只能添加与本任务数据频度一致的报表，频度不一致的报表将被过滤或拒绝。"
    />
    <el-row :gutter="12">
      <!-- 左侧：可选报表 -->
      <el-col :span="14">
        <el-input
          v-model="keyword"
          placeholder="搜索报表名称 / 编码"
          clearable
          class="mb-10px"
          @input="filterReports"
        >
          <template #prefix><Icon icon="ep:search" /></template>
        </el-input>
        <el-table
          ref="reportTableRef"
          v-loading="loading"
          :data="filteredReports"
          height="360"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="48" />
          <el-table-column label="报表编码" prop="reportCode" width="100" />
          <el-table-column label="报表名称" prop="reportName" show-overflow-tooltip />
          <el-table-column
            label="所属主题域"
            prop="subjectName"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column label="频度" align="center" prop="freq" width="80">
            <template #default="scope">
              <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
            </template>
          </el-table-column>
        </el-table>
      </el-col>
      <!-- 右侧：已选报表 -->
      <el-col :span="10">
        <div class="mb-10px flex items-center justify-between">
          <span class="font-bold">
            已选报表
            <el-tag type="primary" size="small" class="ml-5px">{{ selected.length }}</el-tag>
          </span>
          <el-button link type="danger" :disabled="!selected.length" @click="handleClear">
            清空
          </el-button>
        </div>
        <el-table :data="selected" height="360">
          <el-table-column label="报表名称" prop="reportName" show-overflow-tooltip />
          <el-table-column label="操作" width="70" align="center">
            <template #default="scope">
              <el-button link type="danger" @click="handleRemove(scope.row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>
    <template #footer>
      <el-button :disabled="loading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as TaskTemplateApi from '@/api/cr/task/template'

defineOptions({ name: 'CrTaskTemplateReportDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const loading = ref(false)
const templateId = ref<number>()
const templateFreq = ref<number>()
const keyword = ref('')

const reports = ref<TaskTemplateApi.ReportOptionVO[]>([])
const filteredReports = ref<TaskTemplateApi.ReportOptionVO[]>([])
const selected = ref<TaskTemplateApi.ReportOptionVO[]>([])
const reportTableRef = ref()
/** 防止 selection-change 在回显时覆盖已选集合 */
const syncing = ref(false)

/** 打开弹窗 */
const open = async (row: TaskTemplateApi.TaskTemplateVO) => {
  dialogVisible.value = true
  dialogTitle.value = `管理报表 — ${row.templateName}`
  templateId.value = row.id
  templateFreq.value = row.freq
  keyword.value = ''
  loading.value = true
  try {
    const [options, current] = await Promise.all([
      TaskTemplateApi.getReportOptions(),
      TaskTemplateApi.getTemplateReportList(row.id!)
    ])
    // 只展示频度一致的报表
    reports.value = (options || []).filter(
      (item: TaskTemplateApi.ReportOptionVO) => item.freq === row.freq
    )
    filteredReports.value = reports.value
    selected.value = current || []
    // 回显勾选状态
    syncing.value = true
    await nextTick()
    const selectedIds = new Set(selected.value.map((item) => item.id))
    reports.value.forEach((item) => {
      if (selectedIds.has(item.id)) {
        reportTableRef.value?.toggleRowSelection(item, true)
      }
    })
    await nextTick()
    syncing.value = false
  } finally {
    loading.value = false
  }
}
defineExpose({ open })

const filterReports = () => {
  const kw = keyword.value.trim().toLowerCase()
  filteredReports.value = kw
    ? reports.value.filter(
        (item) =>
          item.reportName.toLowerCase().includes(kw) || item.code?.toLowerCase().includes(kw)
      )
    : reports.value
}

/** 表格勾选变化：把勾选结果同步到右侧已选列表 */
const handleSelectionChange = (rows: TaskTemplateApi.ReportOptionVO[]) => {
  if (syncing.value) return
  selected.value = rows.map((row) => ({
    ...row,
    name: row.reportName,
    subjectName: row.subjectName,
    subjectId: row.subjectId
  })) as unknown as TaskTemplateApi.ReportOptionVO[]
}

/** 右侧移除：同时取消左侧勾选 */
const handleRemove = (row: TaskTemplateApi.ReportOptionVO) => {
  selected.value = selected.value.filter((item) => item.id !== row.id)
  const target = reports.value.find((item) => item.id === row.id)
  if (target) reportTableRef.value?.toggleRowSelection(target, false)
}

/** 清空 */
const handleClear = () => {
  selected.value = []
  reportTableRef.value?.clearSelection()
}

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  loading.value = true
  try {
    await TaskTemplateApi.updateTemplateReports(
      templateId.value!,
      selected.value.map((item) => item.id)
    )
    message.success('报表已保存')
    dialogVisible.value = false
    emit('success')
  } finally {
    loading.value = false
  }
}

void templateFreq
</script>
