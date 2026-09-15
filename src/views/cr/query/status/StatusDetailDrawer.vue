<template>
  <el-drawer v-model="visible" title="报表报送明细" size="760px" :destroy-on-close="true">
    <div v-loading="loading">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="机构">{{ detail.orgName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报送期次">{{ detail.period || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报表编码">{{ detail.reportCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报表名称">{{ detail.reportName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数据频度">
          <dict-tag v-if="detail.freq" :type="DICT_TYPE.CR_REPORT_FREQ" :value="detail.freq" />
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="业务口径">{{ detail.caliber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="填报状态">
          <dict-tag :type="DICT_TYPE.CR_FILL_STATUS" :value="detail.fillStatus ?? 0" />
        </el-descriptions-item>
        <el-descriptions-item label="校验状态">
          <dict-tag :type="DICT_TYPE.CR_CHECK_STATUS" :value="detail.checkStatus ?? 0" />
        </el-descriptions-item>
        <el-descriptions-item label="报送状态">
          <el-tag :type="submitStatusType(detail.submitStatus)" effect="plain">
            {{ submitStatusLabel(detail.submitStatus) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="数据行数">
          {{ formatNumber(detail.dataRows) }}
        </el-descriptions-item>
        <el-descriptions-item label="最后修改人">{{
          detail.lastModifier || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="最后修改时间">
          {{ detail.lastModifyTime || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">数据表拆分</el-divider>
      <el-table :data="detail.tables || []" size="small" border>
        <el-table-column label="表编码" align="center" prop="tableCode" width="110" />
        <el-table-column
          label="物理表名"
          align="left"
          prop="tableName"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          label="中文表名"
          align="left"
          prop="cnName"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="数据行数" align="right" prop="rows" width="110">
          <template #default="scope">{{ formatNumber(scope.row.rows) }}</template>
        </el-table-column>
        <el-table-column label="最近同步" align="center" prop="lastSyncTime" width="170" />
      </el-table>

      <el-divider content-position="left">校验问题</el-divider>
      <el-alert
        v-if="!detail.issues?.length"
        type="success"
        :closable="false"
        show-icon
        :title="
          detail.checkStatus === 2 ? '全部校验规则通过，无待处理问题' : '该报表尚未执行数据校验'
        "
      />
      <el-table v-else :data="detail.issues" size="small" border>
        <el-table-column label="规则编码" align="center" prop="ruleCode" width="110" />
        <el-table-column
          label="规则名称"
          align="left"
          prop="ruleName"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="级别" align="center" prop="levelName" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.level === 1 ? 'danger' : 'warning'" effect="plain">
              {{ scope.row.levelName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="影响行数" align="right" prop="affectRows" width="100" />
        <el-table-column label="处理状态" align="center" prop="status" width="100" />
        <el-table-column label="发现时间" align="center" prop="foundTime" width="160" />
      </el-table>

      <el-divider content-position="left">处理轨迹</el-divider>
      <el-timeline v-if="detail.logs?.length">
        <el-timeline-item
          v-for="(log, index) in detail.logs"
          :key="index"
          :timestamp="log.time"
          :type="resultType(log.result)"
          placement="top"
        >
          <div class="font-bold">{{ log.node }} · {{ log.operator }}</div>
          <div class="mt-4px text-3.5 text-gray-500">
            结果：{{ log.result }}｜影响行数：{{ formatNumber(log.affectRows) }}
          </div>
          <div class="text-3.5 text-gray-500">{{ log.remark }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无处理轨迹" :image-size="60" />

      <el-divider content-position="left">报表备注</el-divider>
      <div v-if="detail.remarks?.length">
        <div v-for="remark in detail.remarks" :key="remark.id" class="mb-10px">
          <div class="text-3.5 text-gray-500"> {{ remark.creator }} · {{ remark.createTime }} </div>
          <div>{{ remark.content }}</div>
        </div>
      </div>
      <el-empty v-else description="暂无备注" :image-size="60" />
    </div>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as ReportStatusApi from '@/api/cr/query/status'

defineOptions({ name: 'CrQueryStatusDetailDrawer' })

/** el-tag 主题色 */
type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const visible = ref(false)
const loading = ref(false)
const detail = ref<Partial<ReportStatusApi.ReportStatusDetailVO>>({})

const SUBMIT_STATUS: Record<number, { label: string; type: TagType }> = {
  0: { label: '未报送', type: 'info' },
  1: { label: '报送中', type: 'warning' },
  2: { label: '已报送', type: 'success' }
}
const submitStatusLabel = (value?: number) => SUBMIT_STATUS[Number(value)]?.label || '-'
const submitStatusType = (value?: number): TagType => SUBMIT_STATUS[Number(value)]?.type || 'info'

const formatNumber = (value?: number) =>
  value === undefined || value === null ? '-' : Number(value).toLocaleString('zh-CN')

/** 环节结果 → 时间轴颜色 */
const resultType = (result: string) => {
  if (result === '成功') return 'success'
  if (result === '失败') return 'danger'
  if (result === '进行中') return 'primary'
  return 'info'
}

/** 打开抽屉：按机构 + 报表 + 期次拉取明细 */
const open = async (row: ReportStatusApi.ReportStatusVO) => {
  visible.value = true
  loading.value = true
  detail.value = {}
  try {
    detail.value = await ReportStatusApi.getReportStatusDetail({
      orgId: row.orgId,
      reportId: row.reportId,
      period: row.period
    })
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>
