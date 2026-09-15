<template>
  <Dialog v-model="dialogVisible" title="导入日志详情" width="760" :loading="detailLoading">
    <el-descriptions v-if="detail" :column="2" border>
      <el-descriptions-item label="批次号">{{ detail.batchNo }}</el-descriptions-item>
      <el-descriptions-item label="期次">{{ detail.period }}</el-descriptions-item>
      <el-descriptions-item label="机构">{{ detail.orgName }}</el-descriptions-item>
      <el-descriptions-item label="报表">{{ detail.reportName }}</el-descriptions-item>
      <el-descriptions-item label="动作">
        <dict-tag :type="DICT_TYPE.CR_IMPORT_ACTION" :value="detail.action" />
      </el-descriptions-item>
      <el-descriptions-item label="结果">
        <el-tag :type="resultTagType(detail.result)" size="small" disable-transitions>
          {{ resultLabel(detail.result) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="操作人">{{ detail.operator }}</el-descriptions-item>
      <el-descriptions-item label="操作时间">{{ detail.operateTime }}</el-descriptions-item>
      <el-descriptions-item label="耗时">{{ detail.duration }} ms</el-descriptions-item>
      <el-descriptions-item label="IP">{{ detail.ip }}</el-descriptions-item>
      <el-descriptions-item label="说明" :span="2">
        <!-- 失败原因可能是整段错误堆栈，原样换行完整展示，不做截断 -->
        <span class="whitespace-pre-wrap break-all">{{ detail.message || '-' }}</span>
      </el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as ImportLogApi from '@/api/cr/collect/importLog'

defineOptions({ name: 'CrCollectImportLogDetail' })

/** el-tag 主题色 */
type TagType = 'success' | 'danger'

const dialogVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<ImportLogApi.ImportLogVO>()

const resultLabel = (value?: number) => (Number(value) === 1 ? '成功' : '失败')
const resultTagType = (value?: number): TagType => (Number(value) === 1 ? 'success' : 'danger')

/** 打开详情：按 id 回查完整记录（列表里的说明列会被省略） */
const open = async (id: number) => {
  dialogVisible.value = true
  detail.value = undefined
  detailLoading.value = true
  try {
    detail.value = await ImportLogApi.getImportLog(id)
  } finally {
    detailLoading.value = false
  }
}
defineExpose({ open })
</script>
