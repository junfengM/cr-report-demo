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
          class="!w-220px"
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
          class="!w-240px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="采集方式" prop="channelType">
        <el-select
          v-model="queryParams.channelType"
          placeholder="请选择采集方式"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_COLLECT_CHANNEL)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-140px">
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
          placeholder="机构 / 报表 / 源系统 / 地址 / 责任人"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:collect-channel:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:collect-channel:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增配置
        </el-button>
        <el-button
          type="warning"
          plain
          :loading="batchLoading"
          :disabled="checkedIds.length === 0"
          @click="handleCollectBatch"
          v-hasPermi="['cr:collect-channel:collect']"
        >
          <Icon icon="ep:operation" class="mr-5px" /> 批量采集
        </el-button>
        <el-button type="info" plain @click="openJobs()" v-hasPermi="['cr:collect-channel:job']">
          <Icon icon="ep:tickets" class="mr-5px" /> 取数记录
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:collect-channel:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:collect-channel:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
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
      title="采集方式配置决定每家机构每张报表的数据「怎么进来」：系统直连与接口推送可按调度自动采集，文件导入与手工录入由填报人提交；立即采集会生成导入批次，按导入设置决定直接入库还是转人工审核。行上的「连接测试」只握手不取数（探源系统通不通），每次测试与采集都会在「取数记录」里留下任务号、追踪号、请求参数与耗时。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="报表" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.reportCode }} {{ scope.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="采集方式" align="center" prop="channelType" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_COLLECT_CHANNEL" :value="scope.row.channelType" />
        </template>
      </el-table-column>
      <el-table-column
        label="源系统"
        align="left"
        prop="dataSource"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column label="采集地址" align="left" min-width="220">
        <template #default="scope">
          <el-tooltip
            v-if="scope.row.endpoint"
            :content="scope.row.endpoint"
            placement="top"
            :show-after="200"
          >
            <span class="block truncate">{{ scope.row.endpoint }}</span>
          </el-tooltip>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="协议" align="center" prop="protocol" width="100" />
      <el-table-column
        label="调度周期"
        align="left"
        prop="cronText"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column
        label="上次采集时间"
        align="center"
        prop="lastCollectTime"
        width="165"
        :formatter="dateFormatter"
      />
      <el-table-column label="上次结果" align="center" width="150">
        <template #default="scope">
          <el-tooltip
            :content="scope.row.lastMessage || '暂无采集记录'"
            placement="top"
            :show-after="200"
          >
            <div class="cursor-default">
              <el-tag :type="scope.row.lastStatus === 1 ? 'success' : 'danger'" size="small">
                {{ scope.row.lastStatus === 1 ? '成功' : '失败' }}
              </el-tag>
              <div class="mt-2px truncate text-12px text-gray-400">
                {{ scope.row.lastMessage || '暂无采集记录' }}
              </div>
            </div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="责任人" align="center" prop="owner" width="100" />
      <el-table-column label="操作" align="center" width="250" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:collect-channel:update']"
          >
            修改
          </el-button>
          <el-button
            link
            :type="scope.row.status === 1 ? 'warning' : 'success'"
            @click="handleToggle(scope.row)"
            v-hasPermi="['cr:collect-channel:toggle']"
          >
            {{ scope.row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button
            v-if="scope.row.channelType === 1 || scope.row.channelType === 3"
            link
            type="primary"
            @click="handleTest(scope.row)"
            v-hasPermi="['cr:collect-channel:test']"
          >
            连接测试
          </el-button>
          <el-button
            v-if="scope.row.channelType === 1 || scope.row.channelType === 3"
            link
            type="primary"
            @click="handleCollect(scope.row)"
            v-hasPermi="['cr:collect-channel:collect']"
          >
            立即采集
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:collect-channel:delete']"
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

  <ChannelForm ref="formRef" @success="getList" />

  <!-- 取数记录：系统直连 / 接口推送的每一次调用（含连接测试）都留痕，排查问题看这里 -->
  <el-drawer v-model="jobVisible" title="取数记录" size="90%">
    <el-form :model="jobQuery" :inline="true" label-width="80px" class="-mb-15px">
      <el-form-item label="任务类型">
        <el-select v-model="jobQuery.jobType" placeholder="全部" clearable class="!w-140px">
          <el-option label="取数任务" :value="1" />
          <el-option label="连接测试" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="结果">
        <el-select v-model="jobQuery.status" placeholder="全部" clearable class="!w-120px">
          <el-option label="成功" :value="1" />
          <el-option label="失败" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字">
        <el-input
          v-model="jobQuery.keyword"
          placeholder="任务号 / 追踪号 / 机构 / 报表 / 批次号 / 说明"
          clearable
          class="!w-260px"
          @keyup.enter="handleJobQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleJobQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetJobQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
      </el-form-item>
    </el-form>
    <!--
      列顺序按「先看结论、再看细节」排：任务号 → 类型 → 范围 → 结果 → 行数 → 耗时 → 时间，
      这 8 列在抽屉默认宽度里能一眼看完；请求参数 / 追踪号 / 说明 这些排查细节排在右侧横向滚动区。
    -->
    <el-table v-loading="jobLoading" :data="jobList" class="mt-15px" size="small">
      <el-table-column label="任务号" align="center" prop="jobNo" width="140" />
      <el-table-column label="类型" align="center" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.jobType === 2 ? 'info' : 'primary'" size="small">
            {{ scope.row.jobType === 2 ? '连接测试' : '取数任务' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="机构 / 报表" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.orgName }} · {{ scope.row.reportCode }} {{ scope.row.reportName }}
        </template>
      </el-table-column>
      <el-table-column label="采集方式" align="center" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_COLLECT_CHANNEL" :value="scope.row.channelType" />
        </template>
      </el-table-column>
      <el-table-column label="结果" align="center" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'" size="small">
            {{ scope.row.status === 1 ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="行数" align="center" prop="rowCount" width="80" />
      <el-table-column label="耗时" align="center" width="90">
        <template #default="scope">{{ scope.row.cost }} ms</template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" prop="startTime" width="165" />
      <el-table-column label="源系统 / 协议" align="left" min-width="170" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.dataSource }} · {{ scope.row.protocol }} · {{ scope.row.mode }}
        </template>
      </el-table-column>
      <el-table-column label="请求参数" align="left" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          <span class="text-12px text-gray-500">{{ scope.row.requestParams }}</span>
        </template>
      </el-table-column>
      <el-table-column label="追踪号" align="center" prop="traceId" width="150" />
      <el-table-column
        label="说明"
        align="left"
        prop="message"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="关联批次" align="center" prop="batchNo" width="140">
        <template #default="scope">
          <span v-if="scope.row.batchNo">{{ scope.row.batchNo }}</span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作人" align="center" prop="operator" width="100" />
    </el-table>
    <Pagination
      :total="jobTotal"
      v-model:page="jobQuery.pageNo"
      v-model:limit="jobQuery.pageSize"
      @pagination="getJobs"
    />
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as ChannelApi from '@/api/cr/collect/channel'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import ChannelForm from './ChannelForm.vue'

defineOptions({ name: 'CrCollectChannel' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ChannelApi.CollectChannelVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  channelType: undefined as number | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const batchLoading = ref(false)
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ChannelApi.getChannelPage(queryParams)
    list.value = data.list
    total.value = data.total
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

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 启用 / 停用：停用会让调度不再跑，所以只有停用需要二次确认 */
const handleToggle = async (row: ChannelApi.CollectChannelVO) => {
  const disable = row.status === 1
  try {
    if (disable) {
      await message.confirm(
        '停用后不再自动采集，确认停用「' + row.orgName + ' - ' + row.reportName + '」？'
      )
    }
    await ChannelApi.toggleChannel({ id: row.id!, status: disable ? 0 : 1 })
    message.success(disable ? '已停用采集方式' : '已启用采集方式')
    await getList()
  } catch {}
}

/** 立即采集：真实动作是生成导入批次，落库与否取决于导入设置，所以提示里要说清去哪个页面看结果 */
const handleCollect = async (row: ChannelApi.CollectChannelVO) => {
  try {
    await message.confirm(
      '将按采集方式生成一个导入批次，按导入设置决定直接入库还是转人工审核，确认立即采集「' +
        row.reportCode +
        ' ' +
        row.reportName +
        '」？'
    )
    const res = await ChannelApi.collectNow({ id: row.id! })
    const where = res.needAudit
      ? '批次已转人工审核，请到「导入审核」处理'
      : '批次已直接入库，请到「数据导入」查看'
    message.success(
      '采集完成：批次 ' +
        res.batchNo +
        '（取数任务 ' +
        res.jobNo +
        '，追踪号 ' +
        res.traceId +
        '），采集 ' +
        res.rows +
        ' 行，写入 ' +
        res.writtenRows +
        ' 行；' +
        where
    )
    if (jobVisible.value) await getJobs()
    await getList()
  } catch {}
}

/** 连接测试：探一次源系统（不取数、不入库），结果落一条取数记录，方便事后对账 */
const handleTest = async (row: ChannelApi.CollectChannelVO) => {
  try {
    await message.confirm(
      '将按配置的地址与协议向「' +
        row.dataSource +
        '」发起一次连接测试（只握手、不取数、不入库），确认测试？'
    )
    const res = await ChannelApi.testConnection({ id: row.id! })
    if (res.reachable) {
      message.success(
        '连接成功：' +
          res.dataSource +
          '（' +
          res.protocol +
          '）握手 ' +
          res.handshake +
          'ms，预计本期可抽取 ' +
          res.expectRows +
          ' 行；任务号 ' +
          res.jobNo +
          '（可在「取数记录」里查看）'
      )
    } else {
      message.error('连接失败：' + res.message + '（任务号 ' + res.jobNo + '）')
    }
    if (jobVisible.value) await getJobs()
  } catch {}
}

/* ---------------- 取数记录 ---------------- */
const jobVisible = ref(false)
const jobLoading = ref(false)
const jobTotal = ref(0)
const jobList = ref<ChannelApi.CollectJobVO[]>([])
const jobQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  jobType: undefined as number | undefined,
  status: undefined as number | undefined,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  keyword: ''
})

/** 打开取数记录：从某一行点进来时带上机构 / 报表，直接筛出这条配置的调用历史 */
const openJobs = (row?: ChannelApi.CollectChannelVO) => {
  jobQuery.orgId = row ? row.orgId : undefined
  jobQuery.reportId = row ? row.reportId : undefined
  jobQuery.jobType = undefined
  jobQuery.status = undefined
  jobQuery.keyword = ''
  jobQuery.pageNo = 1
  jobVisible.value = true
  getJobs()
}

const getJobs = async () => {
  jobLoading.value = true
  try {
    const data = await ChannelApi.getCollectJobPage(jobQuery)
    jobList.value = data.list
    jobTotal.value = data.total
  } finally {
    jobLoading.value = false
  }
}

const handleJobQuery = () => {
  jobQuery.pageNo = 1
  getJobs()
}

const resetJobQuery = () => {
  jobQuery.jobType = undefined
  jobQuery.status = undefined
  jobQuery.keyword = ''
  handleJobQuery()
}

/** 批量采集：只处理系统直连 / 接口推送，逐条调用且单条失败不打断，最后汇总 */
const handleCollectBatch = async () => {
  const collectible = checkedRows.value.filter(
    (row) => row.channelType === 1 || row.channelType === 3
  )
  const skipType = checkedRows.value.length - collectible.length
  const skipDisabled = collectible.filter((row) => row.status !== 1).length
  const targets = collectible.filter((row) => row.status === 1)
  if (targets.length === 0) {
    message.warning('选中的配置都不支持自动采集（文件导入 / 手工录入或已停用），无需批量采集')
    return
  }
  try {
    await message.confirm(
      '将为选中的 ' +
        targets.length +
        ' 条配置各生成一个导入批次，按导入设置决定直接入库还是转人工审核，确认批量采集？'
    )
  } catch {
    return
  }
  batchLoading.value = true
  let okCount = 0
  let failCount = 0
  try {
    for (const row of targets) {
      try {
        await ChannelApi.collectNow({ id: row.id! })
        okCount++
      } catch {
        // 单条失败不中断后续采集，错误原因由请求拦截器逐条提示
        failCount++
      }
    }
  } finally {
    batchLoading.value = false
  }
  const skipCount = skipType + skipDisabled
  const parts = ['成功 ' + okCount + ' 个']
  if (skipCount > 0) {
    const reasons: string[] = []
    if (skipType > 0) reasons.push('文件导入 / 手工录入 ' + skipType + ' 个')
    if (skipDisabled > 0) reasons.push('已停用 ' + skipDisabled + ' 个')
    parts.push('跳过 ' + skipCount + ' 个（' + reasons.join('、') + '）')
  }
  if (failCount > 0) parts.push('失败 ' + failCount + ' 个（见错误提示）')
  const summary = '批量采集完成：' + parts.join('，') + '；结果可在「数据导入」或「导入审核」查看'
  if (failCount > 0) {
    message.warning(summary)
  } else {
    message.success(summary)
  }
  await getList()
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ChannelApi.deleteChannel(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const checkedRows = ref<ChannelApi.CollectChannelVO[]>([])
const handleRowCheckboxChange = (rows: ChannelApi.CollectChannelVO[]) => {
  checkedRows.value = rows
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ChannelApi.deleteChannelList(checkedIds.value)
    checkedIds.value = []
    checkedRows.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ChannelApi.exportChannel(queryParams)
    download.excel(data, '采集方式配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  orgOptions.value = (await getCollectOrgOptions()) || []
  reportOptions.value = (await getCollectReportOptions()) || []
  getList()
})
</script>
