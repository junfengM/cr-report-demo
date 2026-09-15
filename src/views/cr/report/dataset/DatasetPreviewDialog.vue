<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="960">
    <div v-loading="loading">
      <template v-if="preview">
        <el-descriptions :column="2" border size="small" class="mb-10px">
          <el-descriptions-item label="数据集">{{ preview.datasetName }}</el-descriptions-item>
          <el-descriptions-item label="取数来源">{{ preview.source }}</el-descriptions-item>
          <el-descriptions-item label="数据总行数">{{ preview.total }} 行</el-descriptions-item>
          <el-descriptions-item label="本次展示">
            {{ preview.rows.length }} 行（请求 {{ preview.limit }} 行）
          </el-descriptions-item>
        </el-descriptions>
        <el-alert class="mb-10px" type="info" :closable="false" show-icon :title="preview.note" />
        <el-table :data="preview.rows" border size="small" max-height="380">
          <el-table-column
            v-for="col in preview.columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            min-width="150"
            show-overflow-tooltip
          >
            <template #header>
              <span>{{ col.label }}</span>
              <span class="ml-4px text-12px text-[#909399]">
                {{ col.prop }}{{ col.type ? ' · ' + col.type : '' }}
              </span>
            </template>
          </el-table-column>
          <template #empty>当前数据集没有可预览的数据</template>
        </el-table>
      </template>
      <el-empty v-else-if="!loading" description="暂无预览结果" />
    </div>
    <template #footer>
      <el-select v-model="limit" class="mr-8px !w-140px" @change="handleLoad">
        <el-option
          v-for="item in LIMIT_OPTIONS"
          :key="item"
          :label="'预览 ' + item + ' 行'"
          :value="item"
        />
      </el-select>
      <el-button :disabled="loading" @click="handleLoad">重新预览</el-button>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as DatasetApi from '@/api/cr/report/dataset'

defineOptions({ name: 'CrReportDatasetPreviewDialog' })

const dialogVisible = ref(false)
const dialogTitle = ref('数据预览')
const loading = ref(false)
const datasetId = ref<number>()
const limit = ref(20)
const preview = ref<DatasetApi.DatasetPreviewVO>()
const LIMIT_OPTIONS = [10, 20, 50, 100, 200]

/** 真的去读业务表（服务端只读计算），失败原因由请求拦截器提示 */
const handleLoad = async () => {
  if (!datasetId.value) return
  loading.value = true
  try {
    preview.value = await DatasetApi.previewDataset(datasetId.value, limit.value)
  } catch {
    preview.value = undefined
  } finally {
    loading.value = false
  }
}

/** 打开弹窗：传行数据或数据集 id 都可以 */
const open = async (rowOrId: DatasetApi.ReportDatasetVO | number) => {
  const id = typeof rowOrId === 'number' ? rowOrId : rowOrId.id!
  dialogTitle.value =
    '数据预览 — ' + (typeof rowOrId === 'number' ? '数据集 #' + id : rowOrId.datasetName || '')
  datasetId.value = id
  limit.value = 20
  preview.value = undefined
  dialogVisible.value = true
  await handleLoad()
}
defineExpose({ open })
</script>
