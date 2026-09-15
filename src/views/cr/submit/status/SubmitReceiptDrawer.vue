<template>
  <el-drawer v-model="visible" title="监管回执详情" size="620px" :destroy-on-close="true">
    <div v-loading="loading">
      <template v-if="receipt">
        <el-alert
          class="mb-15px"
          :type="receipt.receiptNo ? 'success' : 'warning'"
          :closable="false"
          show-icon
          :title="`${receipt.receiver}：${receipt.message}`"
        />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="监管回执号">
            <span class="font-bold">{{ receipt.receiptNo || '尚未回执' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="接收结果">
            <el-tag :type="receipt.receiptNo ? 'success' : 'warning'">{{ receipt.result }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="报送机构">{{ receipt.orgName }}</el-descriptions-item>
          <el-descriptions-item label="报表名称">{{ receipt.reportName }}</el-descriptions-item>
          <el-descriptions-item label="报送期次">{{ receipt.period }}</el-descriptions-item>
          <el-descriptions-item label="上报方式">{{ receipt.reportType }}</el-descriptions-item>
          <el-descriptions-item label="报文文件" :span="2">
            {{ receipt.fileName }}
          </el-descriptions-item>
          <el-descriptions-item label="文件大小">
            {{ formatFileSize(receipt.fileSize) }}
          </el-descriptions-item>
          <el-descriptions-item label="接收记录数">
            {{ receipt.receiptNo ? `${formatNumber(receipt.records)} 条` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="上报时间">{{
            receipt.submitTime || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="回执时间">{{
            receipt.receiptTime || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="接收方" :span="2">{{
            receipt.receiver
          }}</el-descriptions-item>
        </el-descriptions>

        <div class="mb-10px mt-15px font-bold">回执校验明细</div>
        <el-table :data="receipt.items" border>
          <el-table-column label="校验环节" align="left" prop="name" min-width="160" />
          <el-table-column label="结果" align="center" prop="result" width="90">
            <template #default="scope">
              <el-tag
                :type="
                  scope.row.result === '通过'
                    ? 'success'
                    : scope.row.result === '待回执'
                      ? 'warning'
                      : 'danger'
                "
              >
                {{ scope.row.result }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="说明"
            align="left"
            prop="remark"
            min-width="200"
            show-overflow-tooltip
          />
        </el-table>
        <el-alert
          class="mt-15px"
          type="info"
          :closable="false"
          show-icon
          title="回执由监管前置机在报文入库后回写；如长时间未收到回执，可在「报文状态查询」中重新上报。"
        />
      </template>
      <el-empty v-else-if="!loading" description="暂无回执数据" :image-size="80" />
    </div>
  </el-drawer>
</template>

<script lang="ts" setup>
import * as SubmitStatusApi from '@/api/cr/submit/status'
import { formatFileSize, formatNumber } from '../constants'

defineOptions({ name: 'SubmitReceiptDrawer' })

const visible = ref(false)
const loading = ref(false)
const receipt = ref<SubmitStatusApi.SubmitReceiptVO | null>(null)

/** 打开抽屉：按报文记录 id 拉取回执 */
const open = async (id: number) => {
  visible.value = true
  receipt.value = null
  loading.value = true
  try {
    receipt.value = await SubmitStatusApi.getSubmitReceipt(id)
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
