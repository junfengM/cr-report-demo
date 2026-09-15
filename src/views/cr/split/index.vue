<template>
  <!-- 一、顶部说明：拆分是什么、三种方式、不复制不改写 -->
  <ContentWrap title="数据拆分（分包报送 / 分片交付）">
    <el-alert
      class="mb-10px"
      type="warning"
      :closable="false"
      show-icon
      title="数据拆分把「机构 × 报表 × 期次」的填报明细按规则拆成多个报送包：1 按行数均分（每包最多 N 行，超出顺延到下一包，包内不重排序）/ 2 按字段值分组（销售渠道 / 数据状态 / 险种名称 / 报送机构）/ 3 不拆分（整表一个包）。"
      description="拆分只做分组与清单 —— 不复制行，也不改写填报数据（cr.fillData）里的任何字段值：批次里落的是包清单（包名、行数、包文件、首末保单号与样例行），原始填报数据保持原样。与「数据脱敏」一样，它属于报送前的数据准备动作。包文件可以真的下载下来（与「一键报送」共用同一套报文文件生成器）；包内明细行与报文文件同口径，是按定宽规则生成的模拟数据，行数与字节数与包清单严格一致。"
    />
    <el-alert
      class="mb-15px"
      type="info"
      :closable="false"
      show-icon
      title="口径说明：本模块的需求附件不在工程里，这一块是按通行做法提案实现的口径（三种拆分方式 + 包清单字段），细节待业务确认。"
    />

    <!-- 二、统计卡片 -->
    <el-row v-loading="statsLoading" :gutter="15">
      <el-col :span="8">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">启用规则数</div>
          <div class="mt-5px text-24px font-700">{{ stats.ruleCount }} 条</div>
          <div class="mt-5px text-12px text-gray-500"
            >停用的规则不参与拆分，会回落到下一条可用规则</div
          >
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">拆分批次总数</div>
          <div class="mt-5px text-24px font-700">{{ stats.taskCount }} 个</div>
          <div class="mt-5px text-12px text-gray-500"
            >拆分成功 {{ stats.successCount }} / 失败 {{ stats.failedCount }}</div
          >
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">累计包数</div>
          <div class="mt-5px text-24px font-700">{{ stats.pkgCount }} 个</div>
          <div class="mt-5px text-12px text-gray-500">
            只统计拆分成功的批次，单次上限 {{ meta.maxPackages }} 个包
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">累计拆分行数</div>
          <div class="mt-5px text-24px font-700">{{ stats.splitRows }} 行</div>
          <div class="mt-5px text-12px text-gray-500">按包清单行数累加，数据本身没有被复制</div>
          <div class="mt-5px text-12px text-gray-500">包文件在「拆分记录 → 详情」里逐个下载</div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <div class="text-13px text-gray-500">最近一次拆分时间</div>
          <div class="mt-5px text-20px font-700">{{ stats.lastTime || '-' }}</div>
          <div class="mt-5px text-12px text-gray-500">全部批次里最新的一条执行时间</div>
        </el-card>
      </el-col>
    </el-row>
  </ContentWrap>

  <!-- 三、拆分规则 -->
  <ContentWrap title="拆分规则（机构 × 报表 → 分包方式）">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <span class="text-13px text-gray-500"
          >同一范围配了多条时按「优先级小的先生效」判定，优先级相同才看后建的；停用后自动回落到下一条可用规则</span
        >
      </div>
    </template>
    <el-form
      class="mb-10px"
      ref="ruleQueryFormRef"
      :model="ruleQuery"
      :inline="true"
      label-width="86px"
    >
      <el-form-item label="机构" prop="orgId">
        <el-select
          v-model="ruleQuery.orgId"
          placeholder="全部机构"
          clearable
          filterable
          class="!w-200px"
        >
          <el-option
            v-for="item in orgOptions"
            :key="item.id"
            :label="item.orgName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="ruleQuery.reportId"
          placeholder="全部报表"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="item in reportOptions"
            :key="item.id"
            :label="item.reportCode ? item.reportCode + ' ' + item.reportName : item.reportName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="拆分方式" prop="mode">
        <el-select v-model="ruleQuery.mode" placeholder="全部方式" clearable class="!w-160px">
          <el-option
            v-for="item in meta.modes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="ruleQuery.status" placeholder="全部状态" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词" prop="keyword">
        <el-input
          v-model="ruleQuery.keyword"
          placeholder="编码 / 名称 / 机构 / 报表 / 包名前缀"
          clearable
          class="!w-240px"
          @keyup.enter="handleRuleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleRuleQuery" v-hasPermi="['cr:split-rule:query']">
          <Icon icon="ep:search" class="mr-5px" /> 查询
        </el-button>
        <el-button @click="resetRuleQuery"
          ><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button
        >
        <el-button
          type="primary"
          plain
          @click="openRuleForm('create')"
          v-hasPermi="['cr:split-rule:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增规则
        </el-button>
        <el-button
          type="success"
          plain
          :loading="ruleExportLoading"
          @click="handleExportRule"
          v-hasPermi="['cr:split-rule:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="ruleLoading" :data="ruleList" size="small">
      <el-table-column label="规则编码" align="center" prop="ruleCode" width="100" />
      <el-table-column
        label="规则名称"
        align="left"
        prop="ruleName"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="报表" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope2">
          <span v-if="scope2.row.reportCode"
            >{{ scope2.row.reportCode }} {{ scope2.row.reportName }}</span
          >
          <span v-else>{{ scope2.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="拆分方式" align="center" width="110">
        <template #default="scope2">
          <dict-tag :type="DICT_TYPE.CR_SPLIT_MODE" :value="scope2.row.mode" />
        </template>
      </el-table-column>
      <el-table-column label="每包行数" align="right" width="95">
        <template #default="scope2">
          <span v-if="scope2.row.rowsPerPackage">{{ scope2.row.rowsPerPackage }}</span>
          <span v-else class="text-gray-400">-</span>
        </template>
      </el-table-column>
      <el-table-column label="拆分字段" align="center" width="100">
        <template #default="scope2">
          <span v-if="scope2.row.splitFieldLabel">{{ scope2.row.splitFieldLabel }}</span>
          <span v-else class="text-gray-400">-</span>
        </template>
      </el-table-column>
      <el-table-column label="包名前缀" align="center" prop="pkgPrefix" width="110" />
      <el-table-column label="优先级" align="center" prop="priority" width="80" />
      <el-table-column label="状态" align="center" width="90">
        <template #default="scope2">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope2.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" width="190" fixed="right">
        <template #default="scope2">
          <el-button
            link
            type="primary"
            @click="openRuleForm('update', scope2.row.id)"
            v-hasPermi="['cr:split-rule:update']"
          >
            修改
          </el-button>
          <el-button
            link
            :type="scope2.row.status === 1 ? 'warning' : 'success'"
            @click="handleToggleRule(scope2.row)"
            v-hasPermi="['cr:split-rule:toggle']"
          >
            {{ scope2.row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDeleteRule(scope2.row)"
            v-hasPermi="['cr:split-rule:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="ruleTotal"
      v-model:page="ruleQuery.pageNo"
      v-model:limit="ruleQuery.pageSize"
      @pagination="getRuleList"
    />
  </ContentWrap>

  <!-- 四、拆分执行 -->
  <ContentWrap title="拆分执行（先预检，再落批次）">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <span class="text-13px text-gray-500">预检只算不动；范围一变，旧预检自动作废</span>
      </div>
    </template>
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
            v-for="item in realOrgOptions"
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
            v-for="item in realReportOptions"
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
          v-hasPermi="['cr:split-execute:precheck']"
        >
          <Icon icon="ep:search" class="mr-5px" /> 预检
        </el-button>
        <el-button
          type="primary"
          :loading="runLoading"
          :disabled="!scopeReady"
          @click="handleRun"
          v-hasPermi="['cr:split-execute:run']"
        >
          <Icon icon="ep:scissor" class="mr-5px" /> 执行拆分
        </el-button>
        <el-button @click="handleResetScope"
          ><Icon icon="ep:refresh" class="mr-5px" /> 重置范围</el-button
        >
      </el-form-item>
    </el-form>
    <el-alert
      v-if="lastRun"
      class="mt-10px"
      type="success"
      :closable="false"
      show-icon
      :title="
        '本次执行：批次 ' +
        lastRun.batchNo +
        '，拆成 ' +
        lastRun.pkgCount +
        ' 个包 / ' +
        lastRun.totalRows +
        ' 行'
      "
      :description="
        lastRun.message + '（耗时 ' + lastRun.cost + ' ms）批次详情可以在下方「拆分记录」里查看'
      "
    />
  </ContentWrap>

  <!-- 预检结果（只算不动） -->
  <ContentWrap v-if="precheckMatchesScope" title="预检结果（只算不动，还没有落任何批次）">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <el-tag v-if="precheck" class="mr-5px" size="small" type="info">
          单次包数上限 {{ meta.maxPackages }}
        </el-tag>
        <el-tag
          v-if="precheck"
          size="small"
          :type="precheck.pkgCount > meta.maxPackages ? 'danger' : 'success'"
        >
          共 {{ precheck.pkgCount }} 个包
        </el-tag>
      </div>
    </template>
    <template v-if="precheck">
      <el-alert
        v-if="precheck.rule"
        class="mb-10px"
        type="info"
        :closable="false"
        show-icon
        :title="
          '命中规则 ' +
          precheck.rule.ruleCode +
          '「' +
          precheck.rule.ruleName +
          '」：' +
          precheck.totalRows +
          ' 行按「' +
          precheck.modeLabel +
          '」拆成 ' +
          precheck.pkgCount +
          ' 个包（' +
          ruleParamText +
          '，包名前缀 ' +
          precheck.rule.pkgPrefix +
          '）'
        "
      />
      <el-alert
        v-else
        class="mb-10px"
        type="error"
        :closable="false"
        show-icon
        title="该「机构 × 报表」没有启用的拆分规则，请先到上方「拆分规则」里配置（或启用一条默认规则）"
      />
      <el-alert
        v-for="(item, index) in precheck.warnings"
        :key="index"
        class="mb-5px"
        type="warning"
        :closable="false"
        show-icon
        :title="item"
      />
      <el-descriptions class="mt-10px mb-10px" :column="4" border>
        <el-descriptions-item label="拆分范围">
          {{ precheck.orgName }} / {{ precheck.reportCode }} {{ precheck.reportName }}
        </el-descriptions-item>
        <el-descriptions-item label="期次">{{ precheck.period }}</el-descriptions-item>
        <el-descriptions-item label="填报明细">{{ precheck.totalRows }} 行</el-descriptions-item>
        <el-descriptions-item label="拆成包数">{{ precheck.pkgCount }} 个包</el-descriptions-item>
        <el-descriptions-item label="命中规则" :span="2">
          <span v-if="precheck.rule"
            >{{ precheck.rule.ruleCode }} {{ precheck.rule.ruleName }}</span
          >
          <span v-else class="text-red-500">无可用规则</span>
        </el-descriptions-item>
        <el-descriptions-item label="拆分方式">{{
          precheck.modeLabel || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="包名前缀">{{
          precheck.rule ? precheck.rule.pkgPrefix : '-'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="precheck.packages" size="small" border>
        <el-table-column label="包名" align="left" prop="pkgName" min-width="130" />
        <el-table-column label="行数" align="right" prop="rows" width="70" />
        <el-table-column
          v-if="precheck.mode === MODE_BY_FIELD"
          label="分组值"
          align="left"
          prop="fieldValue"
          min-width="100"
        />
        <el-table-column
          label="包文件（与一键报送同一生成口径）"
          align="left"
          prop="fileName"
          min-width="280"
          show-overflow-tooltip
        />
        <el-table-column label="大小" align="right" width="95">
          <template #default="scope2">{{ sizeText(scope2.row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="首个保单号" align="left" prop="firstPolicyNo" width="130" />
        <el-table-column label="末个保单号" align="left" prop="lastPolicyNo" width="130" />
        <el-table-column
          label="样例行（保单号 投保人 渠道 保费）"
          align="left"
          min-width="320"
          show-overflow-tooltip
        >
          <template #default="scope2">{{ sampleText(scope2.row.samples) }}</template>
        </el-table-column>
      </el-table>
    </template>
  </ContentWrap>

  <!-- 五、拆分记录 -->
  <ContentWrap title="拆分记录（批次与包清单）">
    <template #header>
      <div class="flex flex-grow items-center justify-end">
        <span class="text-13px text-gray-500">按执行时间倒序；点「详情」看包清单与一致性校验</span>
      </div>
    </template>
    <el-form
      class="mb-10px"
      ref="taskQueryFormRef"
      :model="taskQuery"
      :inline="true"
      label-width="72px"
    >
      <el-form-item label="机构" prop="orgId">
        <el-select v-model="taskQuery.orgId" placeholder="全部机构" clearable class="!w-200px">
          <el-option
            v-for="item in realOrgOptions"
            :key="item.id"
            :label="item.orgName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select v-model="taskQuery.reportId" placeholder="全部报表" clearable class="!w-260px">
          <el-option
            v-for="item in realReportOptions"
            :key="item.id"
            :label="item.reportCode + ' ' + item.reportName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="期次" prop="period">
        <el-select v-model="taskQuery.period" placeholder="全部期次" clearable class="!w-140px">
          <el-option v-for="item in periodOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="taskQuery.status" placeholder="全部状态" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_SPLIT_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词" prop="keyword">
        <el-input
          v-model="taskQuery.keyword"
          placeholder="批次号 / 机构 / 报表 / 规则 / 操作人"
          clearable
          class="!w-240px"
          @keyup.enter="handleTaskQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleTaskQuery"
          ><Icon icon="ep:search" class="mr-5px" /> 查询</el-button
        >
        <el-button @click="resetTaskQuery"
          ><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button
        >
        <el-button
          type="success"
          plain
          :loading="taskExportLoading"
          :disabled="!taskTotal"
          @click="handleExportTask"
          v-hasPermi="['cr:split-task:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="taskLoading" :data="taskList" size="small">
      <el-table-column label="批次号" align="center" prop="batchNo" width="150" />
      <el-table-column label="状态" align="center" width="100">
        <template #default="scope2">
          <dict-tag :type="DICT_TYPE.CR_SPLIT_STATUS" :value="scope2.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="报表" align="left" min-width="190" show-overflow-tooltip>
        <template #default="scope2">
          <span v-if="scope2.row.reportCode"
            >{{ scope2.row.reportCode }} {{ scope2.row.reportName }}</span
          >
          <span v-else>{{ scope2.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="期次" align="center" prop="period" width="90" />
      <el-table-column label="命中规则" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope2">{{ scope2.row.ruleCode }} {{ scope2.row.ruleName }}</template>
      </el-table-column>
      <el-table-column label="拆分行数" align="right" prop="totalRows" width="100" />
      <el-table-column label="包数" align="right" prop="pkgCount" width="80" />
      <el-table-column label="耗时" align="center" width="90">
        <template #default="scope2">{{ scope2.row.cost }} ms</template>
      </el-table-column>
      <el-table-column label="执行时间" align="center" prop="startTime" width="165" />
      <el-table-column label="操作人" align="center" prop="operator" width="110" />
      <el-table-column label="操作" align="center" width="90" fixed="right">
        <template #default="scope2">
          <el-button
            link
            type="primary"
            @click="handleDetail(scope2.row)"
            v-hasPermi="['cr:split-task:detail']"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="taskTotal"
      v-model:page="taskQuery.pageNo"
      v-model:limit="taskQuery.pageSize"
      @pagination="getTaskList"
    />
  </ContentWrap>

  <RuleForm ref="ruleFormRef" @success="handleRuleSaved" />
  <PackageDrawer ref="packageDrawerRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import {
  getSplitMeta,
  getSplitOrgOptions,
  getSplitPeriodOptions,
  getSplitReportOptions,
  type SplitMetaVO
} from '@/api/cr/split/common'
import * as RuleApi from '@/api/cr/split/rule'
import * as ExecuteApi from '@/api/cr/split/execute'
import * as TaskApi from '@/api/cr/split/task'
import RuleForm from './RuleForm.vue'
import PackageDrawer from './PackageDrawer.vue'

defineOptions({ name: 'CrSplit' })

const message = useMessage()
const { t } = useI18n()

/**
 * 拆分方式取值（与字典 cr_split_mode、服务端 SPLIT_MODE 对齐）：
 * 只用于「按字段值分组时才显示分组值列」这一个显隐判断，下拉选项文案与可用拆分字段全部来自 getSplitMeta()。
 */
const MODE_BY_FIELD = 2

const ruleFormRef = ref()
const packageDrawerRef = ref()

/* ==================== 下拉与 meta（不自己写枚举） ==================== */
const meta = ref<SplitMetaVO>({ modes: [], fields: [], maxPackages: 0 })
/** 含「全部机构」/「全部报表」，用于规则查询与规则弹窗 */
const orgOptions = ref<any[]>([])
const reportOptions = ref<any[]>([])
/** 执行范围与批次查询只针对具体机构 / 报表，剔除 id=0 的「全部」选项 */
const realOrgOptions = computed(() => orgOptions.value.filter((item) => Number(item.id) !== 0))
const realReportOptions = computed(() =>
  reportOptions.value.filter((item) => Number(item.id) !== 0)
)
const periodOptions = ref<string[]>([])

/* ==================== 统计 ==================== */
const statsLoading = ref(false)
const stats = ref<TaskApi.SplitStatsVO>({
  ruleCount: 0,
  taskCount: 0,
  successCount: 0,
  failedCount: 0,
  pkgCount: 0,
  splitRows: 0,
  lastTime: ''
})

const getStats = async () => {
  statsLoading.value = true
  try {
    stats.value = await TaskApi.getSplitStats()
  } finally {
    statsLoading.value = false
  }
}

/* ==================== 拆分规则 ==================== */
const ruleLoading = ref(false)
const ruleExportLoading = ref(false)
const ruleList = ref<RuleApi.SplitRuleVO[]>([])
const ruleTotal = ref(0)
const ruleQueryFormRef = ref()
const ruleQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  mode: undefined as number | undefined,
  status: undefined as number | undefined,
  keyword: ''
})

const getRuleList = async () => {
  ruleLoading.value = true
  try {
    const data = await RuleApi.getSplitRulePage(ruleQuery)
    ruleList.value = data.list
    ruleTotal.value = data.total
  } finally {
    ruleLoading.value = false
  }
}

const handleRuleQuery = () => {
  ruleQuery.pageNo = 1
  getRuleList()
}

const resetRuleQuery = () => {
  ruleQueryFormRef.value?.resetFields()
  handleRuleQuery()
}

const openRuleForm = (type: string, id?: number) => {
  ruleFormRef.value.open(type, id)
}

/** 规则保存成功后：刷新列表与统计（启用规则数会变） */
const handleRuleSaved = async () => {
  await Promise.all([getRuleList(), getStats()])
}

/** 启用 / 停用：停用后该「机构 × 报表」回落到下一条可用规则 */
const handleToggleRule = async (row: RuleApi.SplitRuleVO) => {
  try {
    await message.confirm(
      row.status === 1
        ? '停用规则「' +
            row.ruleName +
            '」后，「' +
            row.orgName +
            ' / ' +
            row.reportName +
            '」会回落到下一条可用规则（没有就提示无可用规则）。确认停用？'
        : '启用规则「' + row.ruleName + '」？启用后它会参与该「机构 × 报表」的拆分判定。'
    )
    const res: any = await RuleApi.toggleSplitRule(row.id!)
    message.success(res?.tip || '操作成功')
    await Promise.all([getRuleList(), getStats()])
  } catch {}
}

const handleDeleteRule = async (row: RuleApi.SplitRuleVO) => {
  try {
    await message.delConfirm(
      '确认删除规则「' + row.ruleName + '」？删除后该范围的拆分请求会回落到下一条可用规则。'
    )
    await RuleApi.deleteSplitRule(row.id!)
    message.success(t('common.delSuccess'))
    await Promise.all([getRuleList(), getStats()])
  } catch {}
}

const handleExportRule = async () => {
  try {
    await message.exportConfirm()
    ruleExportLoading.value = true
    const data = await RuleApi.exportSplitRule(ruleQuery)
    download.excel(data, '数据拆分规则.xls')
  } catch {
  } finally {
    ruleExportLoading.value = false
  }
}

/* ==================== 拆分执行 ==================== */
const precheckLoading = ref(false)
const runLoading = ref(false)
const scope = reactive({
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: ''
})
const scopeReady = computed(() => !!scope.orgId && !!scope.reportId && !!scope.period)
const precheck = ref<ExecuteApi.SplitPrecheckVO | null>(null)
const lastRun = ref<ExecuteApi.SplitRunResultVO | null>(null)

/** 当前范围是否与预检时一致（范围一变，旧预检就作废） */
const precheckMatchesScope = computed(() => {
  if (!precheck.value || !scopeReady.value) return false
  return (
    Number(precheck.value.orgId) === Number(scope.orgId) &&
    Number(precheck.value.reportId) === Number(scope.reportId) &&
    precheck.value.period === scope.period
  )
})

/** 命中规则的参数描述（按行数均分看每包行数，按字段值分组看拆分字段） */
const ruleParamText = computed(() => {
  const rule = precheck.value?.rule
  if (!rule) return ''
  if (Number(rule.rowsPerPackage) > 0) return '每包最多 ' + rule.rowsPerPackage + ' 行'
  if (rule.splitFieldLabel) return '按「' + rule.splitFieldLabel + '」分组'
  return '整表一个包'
})

/** 字节数可读文案（与报文模块口径一致） */
const sizeText = (size: number) => {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(2) + ' MB'
}

/** 样例行紧凑文本：保单号 投保人 渠道 保费，最多 3 条 */
const sampleText = (samples: any[] | undefined) =>
  (samples || [])
    .slice(0, 3)
    .map((item) => [item.policyNo, item.holderName, item.channel, item.premiumAmount].join(' '))
    .join('；')

const handleScopeChange = () => {
  precheck.value = null
  lastRun.value = null
  taskQuery.pageNo = 1
  getTaskList()
}

const handleResetScope = () => {
  scope.orgId = undefined
  scope.reportId = undefined
  scope.period = periodOptions.value[0] || ''
  precheck.value = null
  lastRun.value = null
  taskQuery.pageNo = 1
  getTaskList()
}

/** 预检：只算不动 */
const handlePrecheck = async () => {
  if (!scopeReady.value) {
    message.warning('请先选择机构、报表与期次')
    return
  }
  precheckLoading.value = true
  try {
    const result = await ExecuteApi.precheckSplit({ ...scope } as any)
    precheck.value = result
    if (!result.rule) {
      message.warning('该「机构 × 报表」没有启用的拆分规则，请先到「拆分规则」里配置')
    } else if (!result.totalRows) {
      message.warning('该「机构 × 报表 × 期次」下还没有填报数据，请先导入或补录')
    } else {
      message.success(
        '预检完成：' +
          result.totalRows +
          ' 行将按「' +
          result.modeLabel +
          '」拆成 ' +
          result.pkgCount +
          ' 个包'
      )
    }
  } finally {
    precheckLoading.value = false
  }
}

/**
 * 执行拆分：范围变了先自动预检，再带着预检结论让用户确认。
 * 落一条拆分批次 + 包清单；**不复制行、不改写填报数据**。
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
  if (!plan.rule) {
    message.warning('该「机构 × 报表」没有启用的拆分规则，请先到「拆分规则」里配置')
    return
  }
  if (!plan.totalRows) {
    message.warning('该范围下还没有可拆分的填报数据')
    return
  }
  if (plan.pkgCount > meta.value.maxPackages) {
    message.warning(
      '本次会拆出 ' +
        plan.pkgCount +
        ' 个包，超过单次上限 ' +
        meta.value.maxPackages +
        '，请调整拆分规则'
    )
    return
  }
  try {
    await message.confirm(
      '将对「' +
        plan.orgName +
        ' / ' +
        plan.reportName +
        ' / ' +
        plan.period +
        '」的 ' +
        plan.totalRows +
        ' 行数据执行拆分：' +
        '按「' +
        plan.modeLabel +
        '」拆成 ' +
        plan.pkgCount +
        ' 个包（规则 ' +
        plan.rule.ruleCode +
        ' ' +
        plan.rule.ruleName +
        '，' +
        ruleParamText.value +
        '）。' +
        '执行会落一条拆分批次（批次号 + 每包清单），不会复制行，也不会改写填报数据里的任何字段值。确认执行？',
      '执行拆分'
    )
  } catch {
    return
  }
  runLoading.value = true
  try {
    const result: any = await ExecuteApi.runSplit({ ...scope } as any)
    lastRun.value = result
    message.success(
      '拆分成功：批次 ' +
        result.batchNo +
        '，共 ' +
        result.pkgCount +
        ' 个包 / ' +
        result.totalRows +
        ' 行'
    )
    await Promise.all([getStats(), getTaskList()])
  } finally {
    runLoading.value = false
  }
}

/* ==================== 拆分记录 ==================== */
const taskLoading = ref(false)
const taskExportLoading = ref(false)
const taskList = ref<TaskApi.SplitTaskVO[]>([])
const taskTotal = ref(0)
const taskQueryFormRef = ref()
const taskQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: '',
  status: undefined as number | undefined,
  keyword: ''
})

const getTaskList = async () => {
  taskLoading.value = true
  try {
    const data = await TaskApi.getSplitTaskPage(taskQuery)
    taskList.value = data.list
    taskTotal.value = data.total
  } finally {
    taskLoading.value = false
  }
}

const handleTaskQuery = () => {
  taskQuery.pageNo = 1
  getTaskList()
}

const resetTaskQuery = () => {
  taskQueryFormRef.value?.resetFields()
  handleTaskQuery()
}

const handleExportTask = async () => {
  try {
    await message.exportConfirm()
    taskExportLoading.value = true
    const data = await TaskApi.exportSplitTask(taskQuery)
    download.excel(data, '数据拆分记录.xls')
  } catch {
  } finally {
    taskExportLoading.value = false
  }
}

/** 详情抽屉：批次信息 + 一致性校验 + 包清单 */
const handleDetail = (row: TaskApi.SplitTaskVO) => {
  packageDrawerRef.value.open(row)
}

onMounted(async () => {
  const [orgs, reports, periods, metaData] = await Promise.all([
    getSplitOrgOptions(),
    getSplitReportOptions(),
    getSplitPeriodOptions(),
    getSplitMeta()
  ])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  periodOptions.value = periods || []
  meta.value = metaData || meta.value
  scope.period = periodOptions.value[0] || ''
  await Promise.all([getStats(), getRuleList(), getTaskList()])
})
</script>
