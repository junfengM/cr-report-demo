<template>
  <ContentWrap>
    <el-alert
      class="mb-15px"
      type="warning"
      :closable="false"
      show-icon
      title="执行脱敏需要审批：提交申请 → 审核岗在「脱敏审批」页放行，才会真正改写填报数据（本页与审批接口都只对系统管理员开放）"
      description="选好机构 / 报表 / 期次 → 预检（只算不动，告诉你动哪些字段、影响多少行）→ 提交执行申请（此时还不改数据）→ 审核岗通过后由系统执行（改写填报数据 + 写入脱敏结果查询）。执行结果可以在「数据填报」页看到、在「脱敏结果查询」页看前後对照，演示时还能一键还原。字段配置里的「生效期」与「命中条件」会真正参与判定：不在生效期内的配置本次不生效，不满足条件的明细行保持原文不动。"
    />
    <!-- 执行范围 -->
    <el-form :model="scope" :inline="true" label-width="72px">
      <el-form-item label="机构">
        <el-select
          v-model="scope.orgId"
          placeholder="请选择机构"
          clearable
          class="!w-200px"
          @change="handleScopeChange"
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
          v-model="scope.reportId"
          placeholder="请选择报表"
          clearable
          class="!w-260px"
          @change="handleScopeChange"
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
          v-model="scope.period"
          placeholder="请选择期次"
          clearable
          class="!w-140px"
          @change="handleScopeChange"
        >
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          :loading="precheckLoading"
          :disabled="!scopeReady"
          @click="handlePrecheck"
          v-hasPermi="['cr:desens-execute:precheck']"
        >
          <Icon icon="ep:search" class="mr-5px" /> 预检
        </el-button>
        <el-button
          type="primary"
          :loading="runLoading"
          :disabled="!scopeReady"
          @click="handleRun"
          v-hasPermi="['cr:desens-execute:apply']"
        >
          <Icon icon="ep:promotion" class="mr-5px" /> 提交执行申请
        </el-button>
        <el-button v-if="pendingApply" link type="primary" @click="goApproval">
          <Icon icon="ep:stamp" class="mr-5px" /> 去「脱敏审批」放行
        </el-button>
        <el-button @click="handleResetScope"
          ><Icon icon="ep:refresh" class="mr-5px" /> 重置范围</el-button
        >
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 预检结果 -->
  <ContentWrap v-if="precheck" title="预检结果（只算不动，还没有改任何数据）">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <el-tag v-if="precheck.conditionSkipped" class="mr-5px" type="warning" size="small">
          按命中条件跳过 {{ precheck.conditionSkipped }} 行（至少一个字段的条件不满足）
        </el-tag>
        <el-tag :type="precheck.willMask ? 'success' : 'info'" size="small"
          >将脱敏 {{ precheck.willMask }} 个字段值</el-tag
        >
      </div>
    </template>
    <el-descriptions :column="4" border class="mb-10px">
      <el-descriptions-item label="执行范围"
        >{{ precheck.orgName }} / {{ precheck.reportName }}</el-descriptions-item
      >
      <el-descriptions-item label="期次">{{ precheck.period }}</el-descriptions-item>
      <el-descriptions-item label="填报明细">{{ precheck.totalRows }} 行</el-descriptions-item>
      <el-descriptions-item label="命中字段 / 规则"
        >{{ precheck.fieldCount }} / {{ precheck.ruleCount }}</el-descriptions-item
      >
      <el-descriptions-item label="生效期基准日" :span="4">
        {{ precheck.today }}（字段配置的生效期按这一天判断，已过期 / 未生效的配置不会参与本次执行）
      </el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-for="(item, index) in precheck.warnings"
      :key="index"
      class="mb-5px"
      type="warning"
      :closable="false"
      show-icon
      :title="item"
    />
    <el-table
      v-if="precheck.excluded && precheck.excluded.length"
      class="mb-10px"
      :data="precheck.excluded"
      size="small"
      border
    >
      <el-table-column label="未参与本次执行的配置" align="left" min-width="220">
        <template #default="scope2"
          >{{ scope2.row.columnName }}（{{ scope2.row.columnCode }}）</template
        >
      </el-table-column>
      <el-table-column label="规则" align="left" min-width="170">
        <template #default="scope2">{{ scope2.row.ruleCode }} {{ scope2.row.ruleName }}</template>
      </el-table-column>
      <el-table-column label="生效期" align="center" prop="window" width="200" />
      <el-table-column label="原因" align="center" width="100">
        <template #default="scope2">
          <el-tag :type="scope2.row.reason === '已过期' ? 'danger' : 'warning'" size="small">{{
            scope2.row.reason
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="该字段是否仍会脱敏" align="center" width="160">
        <template #default="scope2">
          <el-tag :type="scope2.row.covered ? 'success' : 'danger'" size="small">
            {{ scope2.row.covered ? '有其他生效配置' : '本次完全不处理' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <el-table :data="precheck.plan" size="small">
      <el-table-column label="数据项" align="left" min-width="180">
        <template #default="scope2"
          >{{ scope2.row.columnName }}（{{ scope2.row.columnCode }}）</template
        >
      </el-table-column>
      <el-table-column label="命中规则" align="left" min-width="220">
        <template #default="scope2">
          <span>{{ scope2.row.ruleName }}</span>
          <dict-tag
            class="ml-5px"
            :type="DICT_TYPE.CR_DESENSITIZE_TYPE"
            :value="scope2.row.ruleType"
          />
          <span class="ml-5px text-gray-500">{{ scope2.row.ruleParam }}</span>
        </template>
      </el-table-column>
      <el-table-column label="命中条件" align="left" min-width="200">
        <template #default="scope2">
          <span v-if="scope2.row.conditionError" class="text-red-500">{{
            scope2.row.conditionError
          }}</span>
          <span v-else-if="scope2.row.condition">{{ scope2.row.condition }}</span>
          <span v-else class="text-gray-400">全量（无附加条件）</span>
        </template>
      </el-table-column>
      <el-table-column label="命中行数" align="center" prop="matched" width="100" />
      <el-table-column label="条件跳过" align="center" width="100" show-overflow-tooltip>
        <template #default="scope2">
          <span :class="scope2.row.conditionSkipped ? 'text-orange-500' : 'text-gray-400'">{{
            scope2.row.conditionSkipped
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="待处理行数" align="center" prop="rows" width="110" />
      <el-table-column label="已脱敏（跳过）" align="center" prop="alreadyMasked" width="130" />
      <el-table-column label="空值（跳过）" align="center" prop="empty" width="110" />
    </el-table>
  </ContentWrap>

  <!-- 执行结果 -->
  <ContentWrap v-if="lastRun" title="本次提交的申请单">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <span class="text-13px text-gray-500">
          批次号 {{ lastRun.batchNo }}
          <el-button class="ml-10px" link type="primary" @click="handleDetail(lastRun)"
            >查看批次详情</el-button
          >
        </span>
      </div>
    </template>
    <el-alert
      class="mb-10px"
      :type="
        lastRun.status === 6
          ? 'warning'
          : lastRun.status === 2
            ? 'success'
            : lastRun.status === 3
              ? 'warning'
              : 'error'
      "
      :closable="false"
      show-icon
      :title="lastRun.message"
      :description="
        lastRun.status === 6
          ? '申请单已生成，预计脱敏 ' +
            (lastRun.details || []).reduce((sum, item) => sum + Number(item.rows || 0), 0) +
            ' 个字段值' +
            (lastRun.conditionSkipped
              ? '，另有 ' + lastRun.conditionSkipped + ' 行不满足命中条件会保持原文'
              : '') +
            '；此刻还没有改任何数据，等审核岗在「脱敏审批」页通过后才会执行'
          : '改写了 ' +
            lastRun.maskedRows +
            ' 个字段值，跳过 ' +
            lastRun.skipRows +
            ' 个（空值或已脱敏）' +
            (lastRun.conditionSkipped
              ? '，另有 ' + lastRun.conditionSkipped + ' 行不满足命中条件保持原文'
              : '') +
            '，耗时 ' +
            lastRun.cost +
            ' ms'
      "
    />
    <el-table :data="lastRun.details" size="small">
      <el-table-column label="数据项" align="left" min-width="170">
        <template #default="scope2"
          >{{ scope2.row.columnName }}（{{ scope2.row.columnCode }}）</template
        >
      </el-table-column>
      <el-table-column label="规则" align="left" min-width="200">
        <template #default="scope2"
          >{{ scope2.row.ruleName }} · {{ scope2.row.ruleParam }}</template
        >
      </el-table-column>
      <el-table-column label="处理行数" align="center" prop="rows" width="100" />
      <el-table-column label="命中条件" align="left" min-width="180">
        <template #default="scope2">
          <span v-if="scope2.row.condition">{{ scope2.row.condition }}</span>
          <span v-else class="text-gray-400">全量</span>
          <span v-if="scope2.row.conditionSkipped" class="ml-5px text-orange-500"
            >（跳过 {{ scope2.row.conditionSkipped }} 行）</span
          >
        </template>
      </el-table-column>
      <el-table-column
        label="样例（原值 → 脱敏值）"
        align="left"
        min-width="320"
        show-overflow-tooltip
      >
        <template #default="scope2">
          <span class="text-gray-500">{{ scope2.row.sampleFrom }}</span>
          <Icon icon="ep:right" class="mx-5px text-gray-400" />
          <span>{{ scope2.row.sampleTo }}</span>
        </template>
      </el-table-column>
    </el-table>
    <div class="mt-10px">
      <el-button type="primary" @click="goResult" v-hasPermi="['cr:desens-execute:result']">
        <Icon icon="ep:view" class="mr-5px" /> 查看脱敏结果（前後对照）
      </el-button>
      <el-button
        type="warning"
        plain
        @click="handleRestore(lastRun)"
        v-hasPermi="['cr:desens-execute:restore']"
      >
        <Icon icon="ep:refresh-left" class="mr-5px" /> 还原本批次
      </el-button>
    </div>
  </ContentWrap>

  <!-- 最近执行批次 -->
  <ContentWrap title="最近批次与申请单（含待审核 / 已驳回）">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <span class="text-13px text-gray-500">按当前选择的范围过滤；清空范围可以看到全部</span>
      </div>
    </template>
    <el-table v-loading="loading" :data="list" size="small">
      <el-table-column label="批次号" align="center" prop="batchNo" width="150" />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column
        label="报表"
        align="left"
        prop="reportName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="字段数" align="center" prop="fieldCount" width="80" />
      <el-table-column label="脱敏字段值" align="center" prop="maskedRows" width="110" />
      <el-table-column label="条件跳过" align="center" width="100">
        <template #default="scope2">
          <span :class="scope2.row.conditionSkipped ? 'text-orange-500' : 'text-gray-400'">{{
            scope2.row.conditionSkipped || 0
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="100">
        <template #default="scope2">
          <dict-tag :type="DICT_TYPE.CR_DESENS_STATUS" :value="scope2.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" prop="startTime" width="165" />
      <el-table-column label="耗时" align="center" width="90">
        <template #default="scope2">{{ scope2.row.cost }} ms</template>
      </el-table-column>
      <el-table-column label="操作人" align="center" prop="operator" width="110" />
      <el-table-column label="操作" align="center" width="150" fixed="right">
        <template #default="scope2">
          <el-button
            link
            type="primary"
            @click="handleDetail(scope2.row)"
            v-hasPermi="['cr:desens-execute:query']"
            >详情</el-button
          >
          <el-button
            v-if="scope2.row.status === 2 || scope2.row.status === 3"
            link
            type="warning"
            @click="handleRestore(scope2.row)"
            v-hasPermi="['cr:desens-execute:restore']"
            >还原</el-button
          >
          <el-button
            v-if="scope2.row.status === 6"
            link
            type="primary"
            @click="goApprovalRow(scope2.row)"
            v-hasPermi="['cr:desens-execute:query']"
            >去审批</el-button
          >
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

  <!-- 批次详情 -->
  <el-dialog v-model="detailVisible" title="脱敏批次详情" width="900px" append-to-body>
    <template v-if="detail">
      <el-descriptions :column="3" border class="mb-10px">
        <el-descriptions-item label="批次号">{{ detail.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="执行范围">{{ detail.scopeName }}</el-descriptions-item>
        <el-descriptions-item label="状态"
          ><dict-tag :type="DICT_TYPE.CR_DESENS_STATUS" :value="detail.status"
        /></el-descriptions-item>
        <el-descriptions-item label="开始 / 结束"
          >{{ detail.startTime }} → {{ detail.endTime }}</el-descriptions-item
        >
        <el-descriptions-item label="耗时">{{ detail.cost }} ms</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ detail.operator }}</el-descriptions-item>
        <el-descriptions-item label="涉及行数">{{ detail.totalRows }} 行</el-descriptions-item>
        <el-descriptions-item label="脱敏字段值">{{ detail.maskedRows }} 个</el-descriptions-item>
        <el-descriptions-item label="跳过">{{ detail.skipRows }} 个</el-descriptions-item>
        <el-descriptions-item label="按命中条件跳过"
          >{{ detail.conditionSkipped || 0 }} 行（至少一个字段不满足）</el-descriptions-item
        >
        <el-descriptions-item label="执行结果" :span="3">{{ detail.message }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">字段处理明细</el-divider>
      <el-table :data="detail.details" size="small">
        <el-table-column label="数据项" align="left" min-width="160">
          <template #default="scope2"
            >{{ scope2.row.columnName }}（{{ scope2.row.columnCode }}）</template
          >
        </el-table-column>
        <el-table-column label="规则" align="left" min-width="180">
          <template #default="scope2"
            >{{ scope2.row.ruleName }} · {{ scope2.row.ruleParam }}</template
          >
        </el-table-column>
        <el-table-column label="处理行数" align="center" prop="rows" width="100" />
        <el-table-column label="命中条件" align="left" min-width="170">
          <template #default="scope2">
            <span v-if="scope2.row.condition">{{ scope2.row.condition }}</span>
            <span v-else class="text-gray-400">全量</span>
            <span v-if="scope2.row.conditionSkipped" class="ml-5px text-orange-500"
              >（跳过 {{ scope2.row.conditionSkipped }} 行）</span
            >
          </template>
        </el-table-column>
        <el-table-column label="样例" align="left" min-width="280" show-overflow-tooltip>
          <template #default="scope2"
            >{{ scope2.row.sampleFrom }} → {{ scope2.row.sampleTo }}</template
          >
        </el-table-column>
      </el-table>
      <el-divider content-position="left"
        >写进「脱敏结果查询」的对照（前 10 条，共 {{ detail.contrastCount }} 条）</el-divider
      >
      <el-table v-if="detail.samples && detail.samples.length" :data="detail.samples" size="small">
        <el-table-column label="行号" align="center" prop="rowNo" width="70" />
        <el-table-column label="保单号" align="center" prop="policyNo" width="140" />
        <el-table-column label="数据项" align="left" prop="columnName" min-width="120" />
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
      <el-empty v-else description="该批次没有对照记录（种子历史批次不会回放进填报数据）" />
    </template>
  </el-dialog>
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

defineOptions({ name: 'CrDesensitizeExecute' })

const message = useMessage()
const router = useRouter()

const loading = ref(false)
const precheckLoading = ref(false)
const runLoading = ref(false)
const orgOptions = ref<any[]>([])
const reportOptions = ref<any[]>([])
const periodOptions = ref<string[]>([])
const scope = reactive({
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: ''
})
const scopeReady = computed(() => !!scope.orgId && !!scope.reportId && !!scope.period)
const precheck = ref<ExecuteApi.DesensPrecheckVO | null>(null)
const lastRun = ref<ExecuteApi.DesensRunResultVO | null>(null)
const list = ref<TaskApi.DesensTaskVO[]>([])
const total = ref(0)
const queryParams = reactive({ pageNo: 1, pageSize: 10 })
const detail = ref<TaskApi.DesensTaskDetailResultVO | null>(null)
const detailVisible = ref(false)

/** 当前范围是否与预检时一致（范围一变，旧预检就作废） */
const precheckMatchesScope = computed(() => {
  if (!precheck.value || !scopeReady.value) return false
  return (
    Number(precheck.value.orgId) === Number(scope.orgId) &&
    Number(precheck.value.reportId) === Number(scope.reportId) &&
    precheck.value.period === scope.period
  )
})

const getList = async () => {
  loading.value = true
  try {
    const data = await TaskApi.getTaskPage({
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize,
      orgId: scope.orgId,
      reportId: scope.reportId,
      period: scope.period
    })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const handleScopeChange = () => {
  precheck.value = null
  queryParams.pageNo = 1
  getList()
}

const handleResetScope = () => {
  scope.orgId = undefined
  scope.reportId = undefined
  scope.period = periodOptions.value[0] || ''
  precheck.value = null
  queryParams.pageNo = 1
  getList()
}

/** 预检：只算不动 */
const handlePrecheck = async () => {
  if (!scopeReady.value) {
    message.warning('请先选择机构、报表与期次')
    return
  }
  precheckLoading.value = true
  try {
    const data = await ExecuteApi.precheckDesens({ ...scope } as any)
    precheck.value = data
    if (!data.totalRows) {
      message.warning('该范围下还没有填报数据，请先到「数据导入 / 数据填报」里准备数据')
    } else if (!data.willMask) {
      message.warning(
        data.conditionSkipped
          ? '没有任何行满足命中条件，提交申请也不会产生变更'
          : '所有字段值都已脱敏或为空，重复执行不会产生变更'
      )
    } else {
      message.success('预检完成：将脱敏 ' + data.willMask + ' 个字段值')
    }
  } finally {
    precheckLoading.value = false
  }
}

/**
 * 提交执行申请：范围变了就先自动预检，再带着预检结论让用户确认。
 * **这一步不改任何数据** —— 只落一条「待审核」的申请单，等审核岗在「脱敏审批」页放行。
 */
const handleRun = async () => {
  if (!scopeReady.value) {
    message.warning('请先选择机构、报表与期次')
    return
  }
  if (!precheckMatchesScope.value) {
    await handlePrecheck()
  }
  const plan = precheck.value
  if (!plan) return
  if (!plan.totalRows) {
    message.warning('该范围下还没有填报数据，无法提交申请')
    return
  }
  if (!plan.willMask) {
    message.warning(
      plan.conditionSkipped
        ? '没有任何行满足命中条件，不需要提交申请'
        : '所有字段值都已脱敏或为空，不需要重复提交'
    )
    return
  }
  const fieldLines = plan.plan
    .filter((item) => item.rows > 0)
    .map((item) => item.columnName + '（' + item.ruleName + '，' + item.rows + ' 行）')
    .join('、')
  let remark = ''
  try {
    const input = await message.prompt(
      '将对「' +
        plan.orgName +
        ' / ' +
        plan.reportName +
        ' / ' +
        plan.period +
        '」的 ' +
        plan.totalRows +
        ' 行数据提交脱敏申请：' +
        fieldLines +
        '。' +
        (plan.conditionSkipped
          ? '其中 ' + plan.conditionSkipped + ' 行不满足命中条件，会保持原文不动。'
          : '') +
        '提交后不会立刻改数据，需要审核岗在「脱敏审批」页通过后才会执行。申请说明可留空：',
      '提交脱敏执行申请'
    )
    remark = String((input && input.value) || '')
  } catch {
    return
  }
  runLoading.value = true
  try {
    const result: any = await ExecuteApi.applyDesens({ ...scope, remark } as any)
    lastRun.value = result
    message.success('申请已提交：批次 ' + result.batchNo + '，等待审核岗放行')
    await handlePrecheck()
    await getList()
  } finally {
    runLoading.value = false
  }
}

/** 当前范围是否已经有一条待审核申请（页面上给出"去审批页放行"的入口） */
const pendingApply = computed(() =>
  list.value.find(
    (row) =>
      Number(row.status) === 6 &&
      Number(row.orgId) === Number(scope.orgId) &&
      Number(row.reportId) === Number(scope.reportId) &&
      row.period === scope.period
  )
)

/** 去「脱敏审批」页放行：把批次号带过去，审批页会用它预填搜索词，落地就能看到那一条 */
const goApproval = () => {
  const row: any = pendingApply.value
  router.push({
    path: '/new-unified/cr-desensitize/approval',
    query: row ? { keyword: String(row.batchNo) } : {}
  })
}

const goApprovalRow = (row: any) => {
  router.push({
    path: '/new-unified/cr-desensitize/approval',
    query: { keyword: String(row.batchNo || '') }
  })
}

/** 还原：把这一批次改写的值倒回原文（先查对照行数——历史种子批次没有对照，不能假装能还原） */
const handleRestore = async (row: any) => {
  const info = await TaskApi.getTaskDetail(row.id)
  if (!info.contrastCount) {
    message.warning(
      '批次 ' +
        row.batchNo +
        ' 是历史记录（没有可还原的对照数据），只有页面上执行出来的批次才能还原'
    )
    return
  }
  try {
    await message.confirm(
      '还原批次 ' +
        row.batchNo +
        '？' +
        info.contrastCount +
        ' 个已脱敏的字段值会恢复为原文（演示用能力，真实系统通常不保留原文）。'
    )
    const res: any = await ExecuteApi.restoreDesens({ id: row.id })
    message.success('已还原 ' + res.restored + ' 个字段值')
    if (lastRun.value && lastRun.value.id === row.id) lastRun.value = null
    precheck.value = null
    await getList()
  } catch {}
}

/** 详情只需要 id：执行结果与批次列表两种行都能传进来 */
const handleDetail = async (row: { id?: number }) => {
  detail.value = await TaskApi.getTaskDetail(row.id!)
  detailVisible.value = true
}

const goResult = () => {
  router.push('/new-unified/cr-audit/desensitize-query')
}

onMounted(async () => {
  orgOptions.value = ((await getDesensOrgOptions()) || []).filter(
    (item: any) => Number(item.id) !== 0
  )
  reportOptions.value = (await getDesensReportOptions()) || []
  periodOptions.value = (await getDesensPeriodOptions()) || []
  scope.period = periodOptions.value[0] || ''
  await getList()
})
</script>
