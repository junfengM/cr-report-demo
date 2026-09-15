<template>
  <Dialog v-model="dialogVisible" title="报表清单" width="820">
    <div v-loading="loading">
      <el-descriptions v-if="task" :column="3" border size="small" class="mb-12px">
        <el-descriptions-item label="任务编号">{{ task.taskCode }}</el-descriptions-item>
        <el-descriptions-item label="填报机构">{{ task.orgName }}</el-descriptions-item>
        <el-descriptions-item label="报送期次">{{ task.period }}</el-descriptions-item>
        <el-descriptions-item label="填报人">{{ task.fillUser || '—' }}</el-descriptions-item>
        <el-descriptions-item label="复核人">{{ task.reviewUser || '—' }}</el-descriptions-item>
        <el-descriptions-item label="截止日期">{{ task.deadline }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        class="mb-10px"
        type="info"
        :closable="false"
        show-icon
        :title="`该任务下共 ${list.length} 张报表，审核通过后进入${nextStage}环节。`"
      />
      <el-table :data="list" size="small" max-height="360">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column label="报表编码" prop="reportCode" width="100" />
        <el-table-column label="报表名称" prop="reportName" min-width="200" show-overflow-tooltip />
        <el-table-column label="数据频度" prop="freq" width="100" align="center">
          <template #default="scope">
            <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
          </template>
        </el-table-column>
        <el-table-column label="填报人" prop="fillUser" width="90" align="center" />
        <el-table-column label="复核人" prop="reviewUser" width="90" align="center" />
        <el-table-column label="截止日期" prop="deadline" width="110" align="center" />
      </el-table>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as TaskApi from '@/api/cr/task/manage'

defineOptions({ name: 'CrTaskReportDialog' })

const props = defineProps<{ nextStage?: string }>()

const dialogVisible = ref(false)
const loading = ref(false)
const task = ref<TaskApi.CrTaskVO>()
const list = ref<any[]>([])
const nextStage = computed(() => props.nextStage || '下一环节')

/** 打开弹窗：入参为列表行 */
const open = async (row: TaskApi.CrTaskVO) => {
  dialogVisible.value = true
  loading.value = true
  task.value = row
  list.value = []
  try {
    list.value = await TaskApi.getTaskReportList(row.id!)
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
