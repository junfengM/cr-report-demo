<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="900">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="报文结构" name="structure">
        <el-alert type="info" :closable="false" show-icon class="mb-10px" :title="structureHint" />
        <el-table v-loading="loading" :data="segments" max-height="420">
          <el-table-column label="段号" align="center" prop="segNo" width="70" />
          <el-table-column label="报表编码" align="center" prop="reportCode" width="100" />
          <el-table-column
            label="报表名称"
            align="left"
            prop="reportName"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column label="数据表" align="left" min-width="200" show-overflow-tooltip>
            <template #default="scope">
              <span>{{ scope.row.tableCode }} {{ scope.row.tableName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="字段数" align="center" prop="columnCount" width="90" />
          <el-table-column label="报文类型" align="center" width="100">
            <template #default>
              <dict-tag :type="DICT_TYPE.CR_MESSAGE_TYPE" :value="current?.messageType" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="报文样例" name="sample">
        <el-descriptions :column="2" border class="mb-10px">
          <el-descriptions-item label="样例文件名">{{
            sample?.fileName || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="样例机构">{{ sample?.orgName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="数据行数">{{
            sample?.dataRows ?? '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="文件总行数">{{
            sample?.lineCount ?? '-'
          }}</el-descriptions-item>
        </el-descriptions>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          class="mb-10px"
          title="样例由「一键报送」同一套报文生成器产出：列表展示的行数 / 字节数与实际下载内容严格一致，此处仅截取前 20 行。"
        />
        <pre class="sample-box">{{ sampleText }}</pre>
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as MessageInfoApi from '@/api/cr/message/messageInfo'

defineOptions({ name: 'CrMessageStructureDialog' })

const dialogVisible = ref(false)
const dialogTitle = ref('报文结构')
const activeTab = ref('structure')
const loading = ref(false)
const current = ref<MessageInfoApi.MessageInfoVO>()
const segments = ref<MessageInfoApi.MessageSegmentVO[]>([])
const sample = ref<MessageInfoApi.MessageSampleVO>()

const structureHint = computed(() => {
  if (!current.value) return ''
  return (
    '报文「' +
    current.value.messageCode +
    ' ' +
    current.value.messageName +
    '」共 ' +
    current.value.reportCount +
    ' 个报文段（表头行数 ' +
    current.value.headerRows +
    '，' +
    (current.value.tailFlag ? '含报尾' : '无报尾') +
    '）'
  )
})

const sampleText = computed(() => (sample.value?.preview || []).join('\n') || '（暂未生成样例）')

/** 打开弹窗：structure = 报文结构 / sample = 报文样例（都会加载结构，tab 默认落到指定页） */
const open = async (row: MessageInfoApi.MessageInfoVO, tab = 'structure') => {
  current.value = row
  dialogVisible.value = true
  activeTab.value = tab
  dialogTitle.value = '报文详情 - ' + row.messageName
  loading.value = true
  try {
    segments.value = (await MessageInfoApi.getMessageSegments(row.id!)) || []
  } finally {
    loading.value = false
  }
  if (tab === 'sample' && !sample.value) {
    await loadSample()
  }
}
defineExpose({ open })

const loadSample = async () => {
  if (!current.value) return
  sample.value = await MessageInfoApi.getMessageSample(current.value.id!)
}

watch(activeTab, async (tab) => {
  if (tab === 'sample' && !sample.value) {
    await loadSample()
  }
})
</script>

<style lang="scss" scoped>
.sample-box {
  max-height: 320px;
  overflow: auto;
  padding: 10px 12px;
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  color: #303133;
  white-space: pre;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
</style>
