<template>
  <el-dialog v-model="dialogVisible" :title="title" width="1040px" append-to-body>
    <div v-loading="loading">
      <el-descriptions v-if="detail" :column="3" size="small" border>
        <el-descriptions-item label="批次号">{{ detail.task.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="报送机构">{{ detail.task.orgName }}</el-descriptions-item>
        <el-descriptions-item label="报表"
          >{{ detail.task.reportCode }} {{ detail.task.reportName }}</el-descriptions-item
        >
        <el-descriptions-item label="期次">{{ detail.task.period }}</el-descriptions-item>
        <el-descriptions-item label="来源">
          <dict-tag :type="DICT_TYPE.CR_COLLECT_CHANNEL" :value="detail.task.sourceType" />
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <dict-tag :type="DICT_TYPE.CR_IMPORT_STATUS" :value="detail.task.status" />
        </el-descriptions-item>
        <el-descriptions-item label="文件名">{{ detail.task.fileName }}</el-descriptions-item>
        <el-descriptions-item label="文件大小"
          >{{ (detail.task.fileSize / 1024).toFixed(1) }} KB</el-descriptions-item
        >
        <el-descriptions-item label="文件类型">
          <dict-tag :type="DICT_TYPE.CR_FILE_TYPE" :value="detail.task.fileType" />
        </el-descriptions-item>
        <el-descriptions-item label="总行数">{{ detail.task.totalRows }}</el-descriptions-item>
        <el-descriptions-item label="成功 / 失败"
          >{{ detail.task.successRows }} / {{ detail.task.failRows }}</el-descriptions-item
        >
        <el-descriptions-item label="已写入填报数据"
          >{{ detail.task.writtenRows }} 行</el-descriptions-item
        >
        <el-descriptions-item label="导入人">{{ detail.task.importer }}</el-descriptions-item>
        <el-descriptions-item label="导入时间">{{ detail.task.importTime }}</el-descriptions-item>
        <el-descriptions-item label="解析耗时"
          >{{ detail.task.importCost }} ms</el-descriptions-item
        >
        <el-descriptions-item label="审核人">{{ detail.task.auditor || '—' }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{
          detail.task.auditTime || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="审核意见">{{
          detail.task.auditRemark || '—'
        }}</el-descriptions-item>
      </el-descriptions>

      <el-tabs v-if="detail" v-model="activeTab" class="mt-10px">
        <el-tab-pane :label="'暂存数据（' + detail.dataTotal + ' 行）'" name="data">
          <el-table :data="detail.dataRows" size="small" border max-height="320">
            <el-table-column label="行号" prop="rowNo" width="70" align="center" />
            <el-table-column
              v-for="column in detail.stagingFieldOptions"
              :key="column.field"
              :label="column.label"
              :prop="column.field"
              min-width="120"
              show-overflow-tooltip
            />
          </el-table>
          <div class="mt-6px text-12px text-gray-500">
            共 {{ detail.dataTotal }} 行暂存数据，这里最多展示前 20 行；{{
              detail.dataTotal > 20 ? '入库后可在数据填报页查看全部。' : ''
            }}
          </div>
        </el-tab-pane>
        <el-tab-pane :label="'错误 / 警告（' + detail.errorRows.length + '）'" name="error">
          <el-table :data="detail.errorRows" size="small" border max-height="320">
            <el-table-column label="文件行号" prop="rowNo" width="90" align="center" />
            <el-table-column label="级别" width="80" align="center">
              <template #default="scope">
                <el-tag :type="scope.row.level === 1 ? 'danger' : 'warning'" size="small">{{
                  scope.row.level === 1 ? '错误' : '警告'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="字段" prop="errorField" width="130" align="center" />
            <el-table-column label="原因" prop="errorMsg" min-width="240" show-overflow-tooltip />
            <el-table-column
              label="原始内容"
              prop="content"
              min-width="280"
              show-overflow-tooltip
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="'操作日志（' + detail.logs.length + '）'" name="log">
          <el-table :data="detail.logs" size="small" border max-height="320">
            <el-table-column label="动作" prop="action" width="120" align="center">
              <template #default="scope">
                <dict-tag :type="DICT_TYPE.CR_IMPORT_ACTION" :value="scope.row.action" />
              </template>
            </el-table-column>
            <el-table-column label="操作人" prop="operator" width="120" align="center" />
            <el-table-column label="操作时间" prop="operateTime" width="170" align="center" />
            <el-table-column label="结果" width="90" align="center">
              <template #default="scope">
                <el-tag :type="scope.row.result === 1 ? 'success' : 'danger'" size="small">{{
                  scope.row.result === 1 ? '成功' : '失败'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="耗时" width="100" align="center">
              <template #default="scope">{{ scope.row.duration }} ms</template>
            </el-table-column>
            <el-table-column label="说明" prop="message" min-width="260" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as ImportTaskApi from '@/api/cr/collect/importTask'

defineOptions({ name: 'CollectImportDetailDialog' })

const dialogVisible = ref(false)
const loading = ref(false)
const detail = ref<ImportTaskApi.ImportDetailVO | null>(null)
const activeTab = ref('data')
const title = computed(
  () => '导入批次详情' + (detail.value?.task?.batchNo ? '：' + detail.value.task.batchNo : '')
)

/** 打开详情：数据导入页与导入审核页共用 */
const open = async (id: number) => {
  dialogVisible.value = true
  activeTab.value = 'data'
  detail.value = null
  loading.value = true
  try {
    detail.value = await ImportTaskApi.getImportDetail(id)
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
