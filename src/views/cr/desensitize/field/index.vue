<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-200px"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          clearable
          filterable
          class="!w-260px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="机构 / 报表 / 数据项 / 规则"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:desens-field:query']"
          ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
        >
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:desens-field:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增配置
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:desens-field:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="机构级配置优先于「全部机构」兜底；同一数据项配了多条时，优先级数字小的先生效，且只有一个生效。"
    />
    <el-table v-loading="loading" :data="list">
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="100"
        show-overflow-tooltip
      />
      <el-table-column label="报表" align="left" min-width="140" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.reportCode }} {{ scope.row.reportName }}
        </template>
      </el-table-column>
      <el-table-column label="数据项" align="left" min-width="105">
        <template #default="scope">
          <div>{{ scope.row.columnName }}</div>
          <div class="text-12px text-[#909399]">{{ scope.row.columnCode }}</div>
        </template>
      </el-table-column>
      <el-table-column label="命中规则" align="left" min-width="145">
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
        min-width="95"
        show-overflow-tooltip
      />
      <!-- 命中条件：只有满足条件的明细行才脱敏，留空 = 该字段全量脱敏 -->
      <el-table-column label="命中条件" align="left" min-width="135" show-overflow-tooltip>
        <template #default="scope">
          <span v-if="scope.row.condition">{{ scope.row.condition }}</span>
          <span v-else class="text-[#909399]">全量</span>
        </template>
      </el-table-column>
      <el-table-column label="优先级" align="center" prop="priority" width="70" />
      <!-- 生效期：不在生效期内的配置不参与执行；状态以服务端 today 判定 -->
      <el-table-column label="生效期" align="left" min-width="125" show-overflow-tooltip>
        <template #default="scope">
          <div>{{ effectiveText(scope.row) }}</div>
          <el-tag
            v-if="effectiveState(scope.row) === 'expired'"
            class="mt-2px"
            type="danger"
            size="small"
            effect="plain"
          >
            已过期
          </el-tag>
          <el-tag
            v-else-if="effectiveState(scope.row) === 'notStarted'"
            class="mt-2px"
            type="warning"
            size="small"
            effect="plain"
          >
            未生效
          </el-tag>
          <span v-else-if="effectiveState(scope.row) === 'active'" class="text-12px text-[#67c23a]">
            生效中
          </span>
        </template>
      </el-table-column>
      <!-- 适用期次：与生效期是两个维度 —— 生效期按"今天"判，期次按"这次跑哪一期"判 -->
      <el-table-column label="适用期次" align="left" min-width="120" show-overflow-tooltip>
        <template #default="scope">
          <span v-if="(scope.row.periods || []).length" class="text-12px">{{
            periodsText(scope.row)
          }}</span>
          <span v-else class="text-[#909399]">全部期次</span>
        </template>
      </el-table-column>
      <!-- 生效判断：服务端判定"本条到底生不生效"，被同范围其它配置盖住时直接点名，避免"配了却没生效"的误会 -->
      <el-table-column label="生效判断" align="center" width="110">
        <template #default="scope">
          <el-tooltip
            v-if="decisionOf(scope.row)"
            :content="decisionOf(scope.row)!.reason"
            placement="top"
          >
            <el-tag
              v-if="decisionOf(scope.row)!.state === 'active'"
              type="success"
              size="small"
              effect="plain"
            >
              生效中
            </el-tag>
            <el-tag
              v-else-if="decisionOf(scope.row)!.state === 'shadowed'"
              type="warning"
              size="small"
              effect="plain"
            >
              被覆盖
            </el-tag>
            <el-tag
              v-else-if="decisionOf(scope.row)!.state === 'window'"
              type="info"
              size="small"
              effect="plain"
            >
              不在生效期
            </el-tag>
            <el-tag v-else type="info" size="small" effect="plain">已停用</el-tag>
          </el-tooltip>
          <span v-else class="text-[#c0c4cc]">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="80">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="85" />
      <el-table-column
        label="更新时间"
        align="center"
        prop="updateTime"
        :formatter="dateFormatter"
        width="150"
      />
      <el-table-column label="操作" align="center" width="165" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row)"
            v-hasPermi="['cr:desens-field:update']"
          >
            修改
          </el-button>
          <el-button
            link
            :type="scope.row.status === 1 ? 'warning' : 'success'"
            @click="handleToggle(scope.row)"
            v-hasPermi="['cr:desens-field:toggle']"
          >
            {{ scope.row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:desens-field:delete']"
          >
            删除
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

  <FieldForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as FieldApi from '@/api/cr/desensitize/field'
import {
  getDesensOrgOptions,
  getDesensReportOptions,
  getDesensConditionMeta,
  type DesensOrgOptionVO,
  type DesensReportOptionVO
} from '@/api/cr/desensitize/common'
import FieldForm from './FieldForm.vue'

defineOptions({ name: 'CrDesensitizeField' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<FieldApi.DesensFieldVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<DesensOrgOptionVO[]>([])
const reportOptions = ref<DesensReportOptionVO[]>([])
/** 判断生效期用的「今天」由服务端给（条件帮助接口一并返回），取不到就只显示生效期文本、不显示状态标签 */
const today = ref('')
/** 生效判断：配置 id → 服务端判定结果（生效中 / 被同范围其它配置覆盖 / 不在生效期 / 已停用） */
const decisions = ref<Record<number, FieldApi.DesensFieldDecisionVO>>({})

/** 取一条配置的生效判定（取不到就显示 "-"，不猜） */
const decisionOf = (row: FieldApi.DesensFieldVO) => decisions.value[row.id!] || null

/** 生效判定每次列表变化后重新拉（启停/新增/删除/改优先级都会改判定结果） */
const getDecisions = async () => {
  try {
    const data = await FieldApi.getFieldDecisions()
    const map: Record<number, FieldApi.DesensFieldDecisionVO> = {}
    ;(data?.decisions || []).forEach((item) => {
      map[item.id] = item
    })
    decisions.value = map
  } catch {
    decisions.value = {}
  }
}

/** 适用期次文案：仅 202607、202609 期次 */
const periodsText = (row: any) => '仅 ' + (row.periods || []).join('、') + ' 期次'

/** 生效期文本：两端都留空 = 长期有效；只填一端时另一端显示「不限」 */
const effectiveText = (row: FieldApi.DesensFieldVO) => {
  const from = row.effectiveFrom || ''
  const to = row.effectiveTo || ''
  if (!from && !to) return '长期有效'
  return (from || '不限') + ' ~ ' + (to || '不限')
}

/** 生效状态：未生效（开始日期还没到）/ 已过期（结束日期已过）/ 生效中；today 取不到时返回空串 */
const effectiveState = (row: FieldApi.DesensFieldVO): '' | 'active' | 'notStarted' | 'expired' => {
  if (!today.value) return ''
  const from = row.effectiveFrom || ''
  const to = row.effectiveTo || ''
  if (from && today.value < from) return 'notStarted'
  if (to && today.value > to) return 'expired'
  return 'active'
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await FieldApi.getFieldPage(queryParams)
    list.value = data.list
    total.value = data.total
    // 判定结果跟着列表一起刷新，避免启停/删除后标签还是旧的
    await getDecisions()
  } finally {
    loading.value = false
  }
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 新增 / 修改：修改直接把行数据带过去回填，不再回查详情 */
const formRef = ref()
const openForm = (type: string, row?: FieldApi.DesensFieldVO) => {
  formRef.value.open(type, row)
}

/** 启用 / 停用：停用的配置不参与命中，成功后按操作前的状态给提示 */
const handleToggle = async (row: FieldApi.DesensFieldVO) => {
  try {
    await FieldApi.toggleField(row.id!)
    message.success(row.status === 1 ? '已停用' : '已启用')
    await getList()
  } catch {}
}

/** 删除：orgId = 0 的全局兜底配置也允许删除，删完该数据项就没有默认规则了 */
const handleDelete = async (row: FieldApi.DesensFieldVO) => {
  try {
    await message.delConfirm(
      '确认删除「' +
        row.orgName +
        ' · ' +
        row.reportName +
        ' · ' +
        row.columnName +
        '」的字段配置？' +
        (row.orgId === 0 ? '（全局兜底配置删除后，未单独配置的机构将不再脱敏该数据项）' : '')
    )
    await FieldApi.deleteField(row.id!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await FieldApi.exportField(queryParams)
    download.excel(data, '脱敏字段配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  // 机构与报表下拉一次拉全量：筛选是本地条件，翻页时无需重复请求
  orgOptions.value = (await getDesensOrgOptions()) || []
  reportOptions.value = (await getDesensReportOptions()) || []
  // 生效期状态以服务端的「今天」为准（前端不自己取系统时间，避免和判定口径不一致）
  try {
    const meta = await getDesensConditionMeta()
    today.value = meta?.today || ''
  } catch {
    today.value = ''
  }
  getList()
})
</script>
