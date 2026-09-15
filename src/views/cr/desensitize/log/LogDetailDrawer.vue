<template>
  <el-drawer v-model="visible" title="脱敏批次详情" size="60%" :destroy-on-close="true">
    <div v-loading="loading">
      <!-- 分区一：批次信息 -->
      <el-descriptions :column="2" border>
        <el-descriptions-item label="批次号">{{ detail.batchNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="执行范围">{{ detail.scopeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <dict-tag :type="DICT_TYPE.CR_DESENS_STATUS" :value="detail.status ?? ''" />
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ detail.startTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ detail.endTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{ detail.cost ?? 0 }} ms</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ detail.operator || '-' }}</el-descriptions-item>
        <el-descriptions-item label="字段数">{{ detail.fieldCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="规则数">{{ detail.ruleCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="涉及行数">{{ detail.totalRows ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="脱敏字段值">
          {{ detail.maskedRows ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="跳过">{{ detail.skipRows ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="按命中条件跳过"
          >{{ detail.conditionSkipped ?? 0 }} 行（至少一个字段不满足）</el-descriptions-item
        >
        <el-descriptions-item label="申请人">{{
          detail.applyUser || detail.operator || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ detail.applyTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核人">{{ detail.auditUser || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ detail.auditTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核意见" :span="2">{{
          detail.auditRemark || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="执行结果" :span="2">
          <span class="whitespace-pre-wrap break-all">{{ detail.message || '-' }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 审批与执行留痕：谁在什么时候提交、审核、执行、还原，一条都不省 -->
      <el-divider content-position="left">审批与执行留痕</el-divider>
      <el-timeline v-if="(detail.auditTrail || []).length" class="pl-5px">
        <el-timeline-item
          v-for="(item, index) in detail.auditTrail"
          :key="index"
          :timestamp="item.time"
          placement="top"
          :type="trailType(item.action)"
        >
          <div class="text-13px">
            <b>{{ item.actionLabel }}</b>
            <span class="ml-5px text-gray-500">{{ item.user }}</span>
          </div>
          <div v-if="item.remark" class="text-12px text-gray-500">{{ item.remark }}</div>
        </el-timeline-item>
      </el-timeline>
      <div v-else class="text-13px text-gray-400">该批次没有留痕记录（早期历史数据）</div>

      <!-- 分区二：字段处理明细（每个字段一行） -->
      <el-divider content-position="left">字段处理明细</el-divider>
      <el-table :data="details" size="small" border>
        <el-table-column label="数据项" align="left" min-width="170">
          <template #default="scope">
            {{ scope.row.columnName }}（{{ scope.row.columnCode }}）
          </template>
        </el-table-column>
        <el-table-column label="规则" align="left" min-width="220">
          <template #default="scope">
            <span>{{ scope.row.ruleName }}</span>
            <dict-tag
              class="ml-5px"
              :type="DICT_TYPE.CR_DESENSITIZE_TYPE"
              :value="scope.row.ruleType"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="规则参数"
          align="left"
          prop="ruleParam"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column label="处理行数" align="right" prop="rows" width="100" />
        <el-table-column label="命中条件" align="left" min-width="170">
          <template #default="scope">
            <span v-if="scope.row.condition">{{ scope.row.condition }}</span>
            <span v-else class="text-gray-400">全量</span>
            <span v-if="scope.row.conditionSkipped" class="ml-5px text-orange-500">
              （跳过 {{ scope.row.conditionSkipped }} 行）
            </span>
          </template>
        </el-table-column>
        <el-table-column
          label="样例（原值 → 脱敏值）"
          align="left"
          min-width="300"
          show-overflow-tooltip
        >
          <template #default="scope">
            <span class="text-gray-500">{{ scope.row.sampleFrom }}</span>
            <span class="mx-5px text-gray-400">→</span>
            <span>{{ scope.row.sampleTo }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分区三：写进「脱敏结果查询」的对照 -->
      <el-divider content-position="left">
        <span>写进「脱敏结果查询」的对照（前 10 条）</span>
        <span v-if="contrastCount !== undefined" class="ml-10px text-13px text-[#909399]">
          共 {{ contrastCount }} 条对照记录
        </span>
      </el-divider>
      <el-empty
        v-if="detailLoaded && contrastCount === 0"
        description="该批次没有对照记录（可能是种子历史批次）"
      />
      <el-table v-else :data="samples" size="small" border>
        <el-table-column label="行号" align="center" prop="rowNo" width="80" />
        <el-table-column
          label="保单号"
          align="left"
          prop="policyNo"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          label="数据项"
          align="left"
          prop="columnName"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          label="脱敏前"
          align="left"
          prop="originalValue"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          label="脱敏后"
          align="left"
          prop="maskedValue"
          min-width="180"
          show-overflow-tooltip
        />
      </el-table>
    </div>
    <template #footer>
      <el-button @click="visible = false">关 闭</el-button>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as DesensTaskApi from '@/api/cr/desensitize/task'

defineOptions({ name: 'DesensLogDetailDrawer' })

/** 时间线节点颜色：通过=绿、驳回=红、执行=蓝、还原=灰、提交=橙 */
const trailType = (action: string) => {
  if (action === 'approve') return 'success'
  if (action === 'reject') return 'danger'
  if (action === 'execute') return 'primary'
  if (action === 'submit') return 'warning'
  return 'info'
}

const visible = ref(false)
const loading = ref(false)
const detailLoaded = ref(false)
/** 先用列表行数据立即渲染，再用 /detail 补齐 details / samples / contrastCount */
const detail = ref<Partial<DesensTaskApi.DesensTaskDetailResultVO>>({})

const details = computed(() => detail.value.details ?? [])
const samples = computed(() => detail.value.samples ?? [])
const contrastCount = computed(() => detail.value.contrastCount)

/** 打开抽屉：详情接口失败只告警，页面继续展示列表行已有的信息 */
const open = async (row: DesensTaskApi.DesensTaskVO) => {
  visible.value = true
  detail.value = { ...row }
  detailLoaded.value = false
  loading.value = true
  try {
    detail.value = await DesensTaskApi.getTaskDetail(Number(row.id))
  } catch (error) {
    console.warn('[脱敏日志] 批次详情加载失败', error)
  } finally {
    loading.value = false
    detailLoaded.value = true
  }
}
defineExpose({ open })
</script>
