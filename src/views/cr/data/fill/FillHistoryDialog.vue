<template>
  <Dialog v-model="dialogVisible" title="修改历史" width="920">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      :title="`${orgName}｜${reportName}｜期次 ${period}　共 ${list.length} 条修改记录（最近修改在最上方）`"
    />
    <el-table v-loading="loading" :data="list" max-height="440" size="small">
      <el-table-column label="操作时间" prop="operateTime" width="170" align="center" />
      <el-table-column label="操作类型" prop="action" width="110" align="center">
        <template #default="scope">
          <el-tag size="small" :type="tagType(scope.row.action)">{{ scope.row.action }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作详情" prop="detail" min-width="330" show-overflow-tooltip />
      <el-table-column label="变更前" prop="beforeValue" width="130" align="center" />
      <el-table-column label="变更后" prop="afterValue" width="130" align="center" />
      <el-table-column label="操作人" prop="operator" width="100" align="center" />
    </el-table>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as FillApi from '@/api/cr/data/fill'

defineOptions({ name: 'CrDataFillHistoryDialog' })

const loading = ref(false)
const list = ref<FillApi.FillHistoryVO[]>([])
const orgName = ref('')
const reportName = ref('')
const period = ref('')
const dialogVisible = ref(false)

const tagType = (action: string) => {
  if (action === '数据校验') return 'warning'
  if (action === '提交') return 'success'
  if (action === '保存' || action === '数据恢复') return 'primary'
  return 'info'
}

/** 打开弹窗：按「机构 × 报表 × 期次」拉取修改历史 */
const open = async (params: {
  orgId: number
  reportId: number
  period: string
  orgName?: string
  reportName?: string
}) => {
  dialogVisible.value = true
  orgName.value = params.orgName || ''
  reportName.value = params.reportName || ''
  period.value = params.period
  loading.value = true
  try {
    const data = await FillApi.getFillHistory({
      orgId: params.orgId,
      reportId: params.reportId,
      period: params.period
    })
    list.value = data || []
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>
