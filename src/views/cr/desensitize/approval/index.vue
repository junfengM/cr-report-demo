<template>
  <ContentWrap title="脱敏审批">
    <el-alert
      class="mb-15px"
      type="warning"
      :closable="false"
      show-icon
      title="脱敏执行前要过审批：管理员在「脱敏执行」页提交申请，审核岗在这里放行，放行那一刻才真正改写填报数据"
      description="提交申请只落一条「待审核」的申请单，不动任何数据；审核通过后由系统按同一套脱敏规则执行，并把执行结果写回这张申请单。打开审核弹窗时会按当前数据复算一次——申请单上的「预计脱敏 N」是提交那一刻的快照，之后有人补录/导入/还原就会过期，不一致时弹窗顶部会给出红条（只提示，不阻断放行）。驳回必须写原因，申请单保留在列表里可查。"
    />
    <el-row :gutter="15">
      <el-col :span="6">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">待审核申请</div>
          <div class="mt-5px text-24px font-700">{{ stats.pending }} 条</div>
          <div class="mt-5px text-12px text-gray-500">涉及填报数据 {{ stats.pendingRows }} 行</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">最久等待</div>
          <div class="mt-5px text-24px font-700">{{ stats.longestWaitHours }} 小时</div>
          <div class="mt-5px text-12px text-gray-500">申请人提交到现在的时长</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">累计放行</div>
          <div class="mt-5px text-24px font-700">{{ stats.approved }} 条</div>
          <div class="mt-5px text-12px text-gray-500">
            执行成功 {{ stats.executionSucceeded ?? 0 }} · 失败 {{ stats.executionFailed ?? 0 }} ·
            已还原
            {{ stats.restored ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">累计驳回</div>
          <div class="mt-5px text-24px font-700">{{ stats.rejected }} 条</div>
          <div class="mt-5px text-12px text-gray-500">驳回原因在列表与详情里都能看到</div>
        </el-card>
      </el-col>
    </el-row>
  </ContentWrap>

  <ContentWrap title="执行申请">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <span class="text-13px text-gray-500"
          >默认只看待审核；把状态清空可以看到全部申请与执行结果</span
        >
      </div>
    </template>
    <el-form class="mb-10px" :model="queryParams" :inline="true" label-width="68px">
      <el-form-item label="状态">
        <el-select
          v-model="queryParams.status"
          placeholder="全部"
          clearable
          class="!w-140px"
          @change="handleQuery"
        >
          <el-option label="待审核" :value="6" />
          <el-option label="已驳回" :value="7" />
          <el-option label="执行成功" :value="2" />
          <el-option label="部分失败" :value="3" />
          <el-option label="执行失败" :value="4" />
          <el-option label="已还原" :value="5" />
        </el-select>
      </el-form-item>
      <el-form-item label="机构">
        <el-select
          v-model="queryParams.orgId"
          placeholder="全部机构"
          clearable
          class="!w-180px"
          @change="handleQuery"
        >
          <el-option
            v-for="item in orgOptions"
            :key="item.id"
            :label="item.orgName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表">
        <el-select
          v-model="queryParams.reportId"
          placeholder="全部报表"
          clearable
          class="!w-240px"
          @change="handleQuery"
        >
          <el-option
            v-for="item in reportOptions"
            :key="item.id"
            :label="item.reportCode + ' ' + item.reportName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="期次">
        <el-select
          v-model="queryParams.period"
          placeholder="全部期次"
          clearable
          class="!w-130px"
          @change="handleQuery"
        >
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="queryParams.keyword"
          placeholder="批次号 / 机构 / 报表 / 申请人 / 审核意见"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 查询</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          :disabled="!total"
          @click="exportList"
          v-hasPermi="['cr:desens-approval:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" row-key="id" :highlight-current-row="true">
      <el-table-column label="批次号" align="center" prop="batchNo" width="145" />
      <el-table-column label="状态" align="center" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_DESENS_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="执行范围" align="left" min-width="230" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.orgName }} / {{ scope.row.reportName }}</template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="字段数" align="right" prop="fieldCount" width="80" />
      <el-table-column label="涉及行数" align="right" prop="totalRows" width="95" />
      <el-table-column label="脱敏字段值" align="right" width="130">
        <template #default="scope">
          <span v-if="scope.row.status === 6" class="text-orange-500"
            >预计 {{ plannedRows(scope.row) }}</span
          >
          <span v-else>{{ scope.row.maskedRows }}</span>
        </template>
      </el-table-column>
      <el-table-column label="条件跳过" align="right" width="95">
        <template #default="scope">
          <span :class="scope.row.conditionSkipped ? 'text-orange-500' : ''">
            {{ scope.row.conditionSkipped || 0 }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="申请人 / 申请时间" align="left" min-width="180">
        <template #default="scope">
          <div>{{ scope.row.applyUser || scope.row.operator }}</div>
          <div class="text-12px text-gray-500">{{
            scope.row.applyTime || scope.row.startTime
          }}</div>
        </template>
      </el-table-column>
      <el-table-column label="审核人 / 审核时间" align="left" min-width="180">
        <template #default="scope">
          <div>{{ scope.row.auditUser || '-' }}</div>
          <div class="text-12px text-gray-500">{{ scope.row.auditTime || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column
        label="申请说明 / 审核意见"
        align="left"
        min-width="220"
        show-overflow-tooltip
      >
        <template #default="scope">
          <div>{{ scope.row.remark || '-' }}</div>
          <div v-if="scope.row.auditRemark" class="text-12px text-gray-500">{{
            scope.row.auditRemark
          }}</div>
        </template>
      </el-table-column>
      <el-table-column
        label="执行结果"
        align="left"
        prop="message"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="210" fixed="right">
        <template #default="scope">
          <el-button
            v-if="scope.row.status === 6"
            link
            type="success"
            @click="openAudit(scope.row, 'approve')"
            v-hasPermi="['cr:desens-approval:approve']"
          >
            审核通过
          </el-button>
          <el-button
            v-if="scope.row.status === 6"
            link
            type="danger"
            @click="openAudit(scope.row, 'reject')"
            v-hasPermi="['cr:desens-approval:reject']"
          >
            驳回
          </el-button>
          <el-button
            v-if="scope.row.status === 6 && canWithdraw(scope.row)"
            link
            type="info"
            @click="handleWithdraw(scope.row)"
            v-hasPermi="['cr:desens-approval:withdraw']"
          >
            撤回
          </el-button>
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row)"
            v-hasPermi="['cr:desens-approval:query']"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 审核弹窗：通过 / 驳回 都在这里，先看清楚"将要动什么"再决定 -->
  <el-dialog
    v-model="auditVisible"
    :title="auditAction === 'approve' ? '审核通过并执行' : '驳回执行申请'"
    width="900px"
    append-to-body
  >
    <template v-if="auditRow">
      <el-alert
        class="mb-10px"
        :type="auditAction === 'approve' ? 'warning' : 'info'"
        :closable="false"
        show-icon
        :title="
          auditAction === 'approve'
            ? '通过后系统会立即执行脱敏，真实改写「数据填报」里的明细值（可在「脱敏日志」里还原）'
            : '驳回不会执行任何脱敏，申请单会保留为「已驳回」并记录原因'
        "
      />
      <el-alert
        v-if="recheck && recheck.changed"
        class="mb-10px"
        type="error"
        :closable="false"
        show-icon
        :title="recheckTitle"
      >
        <div v-if="recheckBullets.length" class="text-12px">
          <div v-for="(item, index) in recheckBullets" :key="index">· {{ item }}</div>
        </div>
      </el-alert>
      <el-descriptions :column="3" border class="mb-10px">
        <el-descriptions-item label="批次号">{{ auditRow.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="执行范围">{{ auditRow.scopeName }}</el-descriptions-item>
        <el-descriptions-item label="期次">{{ auditRow.period }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{
          auditRow.applyUser || auditRow.operator
        }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{
          auditRow.applyTime || auditRow.startTime
        }}</el-descriptions-item>
        <el-descriptions-item label="涉及行数">{{ auditRow.totalRows }} 行</el-descriptions-item>
        <el-descriptions-item label="申请说明" :span="3">{{
          auditRow.remark || '（未填写）'
        }}</el-descriptions-item>
      </el-descriptions>
      <!-- 留痕：审核岗要能看到谁提交、什么时候提交、之前有没有被驳回过 -->
      <el-divider content-position="left">审批与执行留痕</el-divider>
      <el-timeline v-if="(auditRow.auditTrail || []).length" class="pl-5px">
        <el-timeline-item
          v-for="(item, index) in auditRow.auditTrail"
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
      <div v-else class="text-13px text-gray-400">没有留痕记录</div>

      <el-divider content-position="left">这次会动哪些字段</el-divider>
      <el-table :data="auditRow.details || []" size="small" border>
        <el-table-column label="数据项" align="left" min-width="170">
          <template #default="scope"
            >{{ scope.row.columnName }}（{{ scope.row.columnCode }}）</template
          >
        </el-table-column>
        <el-table-column label="规则" align="left" min-width="200">
          <template #default="scope">{{ scope.row.ruleName }} · {{ scope.row.ruleParam }}</template>
        </el-table-column>
        <el-table-column label="命中条件" align="left" min-width="170">
          <template #default="scope">
            <span v-if="scope.row.condition">{{ scope.row.condition }}</span>
            <span v-else class="text-gray-400">全量</span>
            <span v-if="scope.row.conditionSkipped" class="ml-5px text-orange-500">
              （跳过 {{ scope.row.conditionSkipped }} 行）
            </span>
          </template>
        </el-table-column>
        <el-table-column label="将处理行数" align="right" prop="rows" width="110" />
        <el-table-column
          label="样例（原值 → 脱敏值）"
          align="left"
          min-width="260"
          show-overflow-tooltip
        >
          <template #default="scope"
            >{{ scope.row.sampleFrom }} → {{ scope.row.sampleTo }}</template
          >
        </el-table-column>
      </el-table>
      <el-form class="mt-15px" label-width="90px">
        <el-form-item :label="auditAction === 'approve' ? '审核意见' : '驳回原因'" required>
          <el-input
            v-model="auditRemark"
            type="textarea"
            :rows="2"
            maxlength="120"
            show-word-limit
            :placeholder="
              auditAction === 'approve'
                ? '选填，如：核对无误，同意按新口径脱敏'
                : '必填，如：上期数据已报送，不再重跑脱敏'
            "
          />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button
        :loading="auditLoading"
        :type="auditAction === 'approve' ? 'success' : 'danger'"
        @click="submitAudit"
      >
        {{ auditAction === 'approve' ? '确认通过并执行' : '确认驳回' }}
      </el-button>
      <el-button @click="auditVisible = false">取 消</el-button>
    </template>
  </el-dialog>

  <!-- 批次详情：与「脱敏日志」共用同一个抽屉组件，避免两处口径不一致 -->
  <DesensLogDetailDrawer ref="detailRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as ExecuteApi from '@/api/cr/desensitize/execute'
import * as TaskApi from '@/api/cr/desensitize/task'
import {
  getDesensOrgOptions,
  getDesensReportOptions,
  getDesensPeriodOptions
} from '@/api/cr/desensitize/common'
import { useUserStore } from '@/store/modules/user'
import DesensLogDetailDrawer from '../log/LogDetailDrawer.vue'

defineOptions({ name: 'CrDesensitizeApproval' })

const message = useMessage()
const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const list = ref<TaskApi.DesensTaskVO[]>([])
const total = ref(0)
const orgOptions = ref<any[]>([])
const reportOptions = ref<any[]>([])
const periodOptions = ref<string[]>([])
const stats = ref<ExecuteApi.DesensApprovalStatsVO>({
  pending: 0,
  pendingRows: 0,
  approved: 0,
  executionSucceeded: 0,
  executionFailed: 0,
  restored: 0,
  rejected: 0,
  longestWaitHours: 0
})
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  // 默认只看待审核；执行页跳过来时会带上批次号当关键词
  status: 6 as number | undefined,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: '',
  keyword: ''
})

const auditVisible = ref(false)
const auditLoading = ref(false)
const auditAction = ref<'approve' | 'reject'>('approve')
const auditRow = ref<TaskApi.DesensTaskVO | null>(null)
/** 放行前复算结果：申请时的预计 vs 现在的预计（changed=true 时弹窗顶部显示红条） */
const recheck = ref<ExecuteApi.DesensRecheckVO | null>(null)
const auditRemark = ref('')
const detailRef = ref<InstanceType<typeof DesensLogDetailDrawer>>()

/** 待审核的申请还没执行，列表上的"脱敏字段值"要显示预计值，不能显示 0 让人以为没东西可脱 */
/** 时间线节点颜色：通过=绿、驳回=红、执行=蓝、还原=灰、提交=橙 */
const trailType = (action: string) => {
  if (action === 'approve') return 'success'
  if (action === 'reject') return 'danger'
  if (action === 'execute') return 'primary'
  if (action === 'submit') return 'warning'
  return 'info'
}

const plannedRows = (row: TaskApi.DesensTaskVO) =>
  (row.details || []).reduce((sum, item) => sum + Number(item.rows || 0), 0)

/** 只有申请人本人或系统管理员能撤回（服务端同样会校验，这里只是不显示无效按钮） */
const canWithdraw = (row: TaskApi.DesensTaskVO) => {
  const nickname = String(userStore.getUser?.nickname || '')
  const isAdmin = userStore.getRoles.includes('super_admin')
  return isAdmin || (!!nickname && nickname === (row.applyUser || row.operator))
}

const getList = async () => {
  loading.value = true
  try {
    const data = await TaskApi.getTaskPage({ ...queryParams })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const getStats = async () => {
  stats.value = await ExecuteApi.getApprovalStats()
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

const resetQuery = () => {
  queryParams.status = 6
  queryParams.orgId = undefined
  queryParams.reportId = undefined
  queryParams.period = ''
  queryParams.keyword = ''
  handleQuery()
}

/** 复算红条的标题：数量变了 / 只是口径变了（数量恰好一样）两种说法分开，别让审核岗猜 */
const recheckTitle = computed(() => {
  const info = recheck.value
  if (!info) return ''
  if (info.error) {
    return (
      '放行前复算失败：' +
      info.error +
      '（申请时预计 ' +
      info.storedExpected +
      ' 个），请先处理再放行'
    )
  }
  const base =
    '申请时预计 ' +
    info.storedExpected +
    ' 个字段值（' +
    info.storedTotalRows +
    ' 行），现在预计 ' +
    info.currentExpected +
    ' 个（' +
    info.currentTotalRows +
    ' 行）'
  const countChanged =
    info.countChanged ??
    (info.storedExpected !== info.currentExpected || info.storedTotalRows !== info.currentTotalRows)
  if (countChanged) {
    return '申请后填报数据有变化：' + base + '——通过后将按现在的数据执行'
  }
  if (info.scopeChanged) {
    return (
      '申请后生效规则 / 命中条件有变化（改写数量恰好不变）：' + base + '——通过后将按现在的口径执行'
    )
  }
  // 只有原文内容变了（规则、条件、行数都没变）：标题就别再提"规则/条件有变化"了
  return (
    '申请后参与改写的原文内容有变化（脱敏字段、规则、行数都没变）：' +
    base +
    '——通过后将按现在的数据执行'
  )
})

/** 只有"原文内容变了"时标题已经把话说完了，子弹里那条就不再重复一遍；口径/数量的问题必须逐条列出来 */
const recheckBullets = computed(() => {
  const info = recheck.value
  if (!info || !info.diff) return []
  const contentOnly = info.contentChanged && !info.scopeChanged && !info.countChanged
  return contentOnly ? info.diff.filter((item) => item.indexOf('原文内容有变动') < 0) : info.diff
})

const openAudit = async (row: TaskApi.DesensTaskVO, action: 'approve' | 'reject') => {
  auditAction.value = action
  auditRemark.value = action === 'approve' ? '' : ''
  // 列表行已经带了 details，但仍然拉一次详情：审批要以最新的服务端数据为准
  const detail = await TaskApi.getTaskDetail(Number(row.id))
  auditRow.value = detail
  recheck.value = null
  auditVisible.value = true
  // 放行前复算：申请之后数据可能被补录/导入/还原改过，数量对不上要让审核岗先看到（失败不阻塞弹窗）
  if (action === 'approve') {
    try {
      recheck.value = await ExecuteApi.recheckDesensApply(Number(row.id))
    } catch (error) {
      console.warn('[脱敏审批] 放行前复算失败', error)
    }
  }
}

const submitAudit = async () => {
  const row = auditRow.value
  if (!row) return
  if (auditAction.value === 'reject' && !auditRemark.value.trim()) {
    message.warning('驳回必须填写原因')
    return
  }
  auditLoading.value = true
  try {
    if (auditAction.value === 'approve') {
      const result: any = await ExecuteApi.approveDesens({
        id: Number(row.id),
        remark: auditRemark.value
      })
      message.success(
        '已通过并执行：批次 ' + result.batchNo + '，脱敏 ' + result.maskedRows + ' 个字段值'
      )
    } else {
      await ExecuteApi.rejectDesens({ id: Number(row.id), remark: auditRemark.value })
      message.success('已驳回批次 ' + row.batchNo)
    }
    auditVisible.value = false
    await Promise.all([getList(), getStats()])
  } finally {
    auditLoading.value = false
  }
}

const handleWithdraw = async (row: TaskApi.DesensTaskVO) => {
  try {
    await message.confirm(
      '撤回批次 ' + row.batchNo + ' 的执行申请？申请单会作废（它还没有改过任何数据）。'
    )
  } catch {
    return
  }
  await ExecuteApi.withdrawDesens({ id: Number(row.id) })
  message.success('已撤回申请 ' + row.batchNo)
  await Promise.all([getList(), getStats()])
}

const openDetail = (row: TaskApi.DesensTaskVO) => {
  detailRef.value?.open(row)
}

const exportList = async () => {
  await TaskApi.exportTask({ ...queryParams })
}

onMounted(async () => {
  orgOptions.value = ((await getDesensOrgOptions()) || []).filter(
    (item: any) => Number(item.id) !== 0
  )
  reportOptions.value = (await getDesensReportOptions()) || []
  periodOptions.value = (await getDesensPeriodOptions()) || []
  // 从「脱敏执行」页跳过来时带着批次号，落地就能看到那一条申请
  const keyword = String(route.query.keyword || '')
  if (keyword) {
    queryParams.keyword = keyword
    queryParams.status = undefined
  }
  await Promise.all([getList(), getStats()])
})
</script>
