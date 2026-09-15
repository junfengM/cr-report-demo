<template>
  <ContentWrap>
    <!-- 待办 / 已办 -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="待办" name="todo" />
      <el-tab-pane label="已办" name="done" />
    </el-tabs>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="queryParams.period" placeholder="请选择期次" clearable class="!w-160px">
          <el-option
            v-for="period in periodOptions"
            :key="period"
            :label="period"
            :value="period"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="任务状态" prop="status">
        <el-select
          v-model="queryParams.status"
          placeholder="请选择任务状态"
          clearable
          class="!w-180px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_TASK_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表名称" prop="reportName">
        <el-input
          v-model="queryParams.reportName"
          placeholder="报表名称 / 任务编号"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
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
      :title="
        activeTab === 'todo'
          ? '待办任务为当前登录用户名下尚未办结的填报任务，请在截止日期前完成填报并提交复核。'
          : '已办任务为已完成复核或审核通过的填报任务，仅可查看。'
      "
    />
    <el-table v-loading="loading" :data="list">
      <el-table-column label="任务编号" align="center" prop="taskCode" width="150" />
      <el-table-column
        label="报表名称"
        align="left"
        prop="reportName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        label="机构"
        align="left"
        prop="orgName"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="报送期次" align="center" prop="period" width="100" />
      <el-table-column label="任务状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_TASK_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="截止日期" align="center" prop="deadline" width="110" />
      <el-table-column label="剩余天数" align="center" width="120">
        <template #default="scope">
          <el-tag :type="remainInfo(scope.row).type" effect="plain">
            {{ remainInfo(scope.row).text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="100" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="handleOpen(scope.row)"
            v-hasPermi="['cr:query-my-task:query']"
          >
            {{ activeTab === 'todo' ? '去填报' : '查看' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as MyTaskApi from '@/api/cr/query/myTask'
import * as QueryCommonApi from '@/api/cr/query/common'

defineOptions({ name: 'CrQueryMyTask' })

/** el-tag 主题色 */
type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const router = useRouter()

const loading = ref(true)
const total = ref(0)
const list = ref<MyTaskApi.MyTaskVO[]>([])
const periodOptions = ref<string[]>([])
const activeTab = ref('todo')

const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  tab: 'todo',
  period: '',
  status: undefined as number | undefined,
  reportName: ''
})
const queryFormRef = ref()

/** 已办状态：复核通过 / 审核通过 */
const DONE_STATUS = [50, 90]

/** 剩余天数：负数表示已逾期，已办任务不再提示 */
const remainInfo = (row: MyTaskApi.MyTaskVO): { text: string; type: TagType } => {
  if (DONE_STATUS.includes(Number(row.status))) {
    return { text: '已完成', type: 'success' }
  }
  if (!row.deadline) return { text: '-', type: 'info' }
  const days = dayjs(row.deadline).startOf('day').diff(dayjs().startOf('day'), 'day')
  if (days < 0) return { text: `已逾期 ${Math.abs(days)} 天`, type: 'danger' }
  if (days === 0) return { text: '今天到期', type: 'danger' }
  if (days <= 3) return { text: `${days} 天`, type: 'danger' }
  if (days <= 7) return { text: `${days} 天`, type: 'warning' }
  return { text: `${days} 天`, type: 'info' }
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await MyTaskApi.getMyTaskPage(queryParams)
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
  queryParams.status = undefined
  handleQuery()
}

/** 切换页签 */
const handleTabChange = (name: string | number) => {
  queryParams.tab = String(name)
  handleQuery()
}

/** 目标页需要的上下文参数：机构 / 报表 / 期次 */
const contextQuery = (row: MyTaskApi.MyTaskVO) => {
  const query: Record<string, string> = {}
  if (row.orgId) query.orgId = String(row.orgId)
  if (row.reportId) query.reportId = String(row.reportId)
  if (row.period) query.period = String(row.period)
  return query
}

/** 去填报（待办 → 数据填报） / 查看（已办 → 报表状态查询），带上任务上下文 */
const handleOpen = (row: MyTaskApi.MyTaskVO) => {
  router.push({
    path: activeTab.value === 'done' ? '/cr-query/status' : '/cr-data/fill',
    query: contextQuery(row)
  })
}

onMounted(async () => {
  periodOptions.value = (await QueryCommonApi.getQueryPeriodOptions()) || []
  await getList()
})
</script>
