<template>
  <ContentWrap title="提醒记录统计">
    <div v-loading="statLoading">
      <el-row :gutter="12">
        <el-col :span="6">
          <div class="rounded-4px border border-solid border-gray-200 p-12px text-center">
            <div class="text-12px text-gray-500">提醒总数</div>
            <div class="text-22px font-700">{{ stat.total }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="rounded-4px border border-solid border-gray-200 p-12px text-center">
            <div class="text-12px text-gray-500">已读</div>
            <div class="text-22px font-700 text-green-600">{{ stat.read }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="rounded-4px border border-solid border-gray-200 p-12px text-center">
            <div class="text-12px text-gray-500">发送失败</div>
            <div class="text-22px font-700" :class="stat.failed > 0 ? 'text-red-500' : ''">
              {{ stat.failed }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="rounded-4px border border-solid border-gray-200 p-12px text-center">
            <div class="text-12px text-gray-500">跑批生成</div>
            <div class="text-22px font-700 text-blue-600">{{ stat.generatedByRun }}</div>
          </div>
        </el-col>
      </el-row>
      <el-row v-if="stat.scenes.length > 0" :gutter="12" class="mt-12px">
        <el-col v-for="item in stat.scenes" :key="item.scene" :span="4">
          <div class="rounded-4px bg-gray-100 p-10px">
            <div class="truncate text-12px text-gray-500" :title="item.sceneLabel">
              {{ item.sceneLabel }}
            </div>
            <div class="text-18px font-700">{{ item.total }}</div>
            <div class="text-12px text-gray-500">
              已读 {{ item.read }} · 未读 {{ item.running }} · 失败
              <span :class="item.failed > 0 ? 'text-red-500' : ''">{{ item.failed }}</span>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </ContentWrap>

  <ContentWrap title="提醒记录">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="每条提醒都记着「哪条规则、因为哪张单据、发给了谁、走哪个渠道」。种子里的历史留痕标「历史记录」，跑批或立即执行生成的标「由立即执行生成」；重发是追加一条新记录，历史记录不会被改写。"
    />
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="规则 / 标题 / 内容 / 接收人 / 单据 / 备注"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="触发场景" prop="scene">
        <el-select v-model="queryParams.scene" placeholder="全部" clearable class="!w-200px">
          <el-option
            v-for="item in meta.scenes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="渠道" prop="channel">
        <el-select v-model="queryParams.channel" placeholder="全部" clearable class="!w-140px">
          <el-option
            v-for="item in meta.channels"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-150px">
          <el-option
            v-for="item in meta.statuses"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:remind-log:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          :loading="readLoading"
          :disabled="checkedIds.length === 0"
          @click="handleReadBatch"
          v-hasPermi="['cr:remind-log:read']"
        >
          <Icon icon="ep:check" class="mr-5px" /> 标记已读
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:remind-log:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:remind-log:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="提醒记录列表">
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column
        type="selection"
        width="55"
        :selectable="(row: any) => Number(row.status) !== 3"
      />
      <el-table-column label="发送时间" align="center" prop="sendTime" width="165" />
      <el-table-column
        label="提醒规则"
        align="left"
        prop="ruleName"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="触发场景" align="center" width="150">
        <template #default="scope">
          <el-tag size="small" type="info">{{
            scope.row.sceneLabel || labelOf(meta.scenes, scope.row.scene)
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="提醒标题"
        align="left"
        prop="title"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column label="接收人" align="center" prop="receiverName" width="110" />
      <el-table-column label="渠道" align="center" width="100">
        <template #default="scope">
          <el-tag
            size="small"
            :type="
              scope.row.channel === 'inner'
                ? 'info'
                : scope.row.channel === 'email'
                  ? 'primary'
                  : 'warning'
            "
          >
            {{ labelOf(meta.channels, scope.row.channel) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="110">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.status)" size="small">
            {{ statusLabel(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="关联单据"
        align="left"
        prop="bizKey"
        width="170"
        show-overflow-tooltip
      />
      <el-table-column label="来源" align="center" width="130">
        <template #default="scope">
          <el-tag :type="sourceTagType(scope.row)" size="small" effect="plain">
            {{ sourceLabel(scope.row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" fixed="right" width="180">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openDetail(scope.row.id)"
            v-hasPermi="['cr:remind-log:query']"
          >
            详情
          </el-button>
          <el-button
            link
            type="warning"
            :loading="resendId === scope.row.id"
            @click="handleResend(scope.row)"
            v-hasPermi="['cr:remind-log:resend']"
          >
            重发
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:remind-log:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页组件 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 详情 + 重发 -->
  <RemindLogDetailDialog ref="detailRef" @success="handleDetailSuccess" />
</template>

<script setup lang="ts">
import download from '@/utils/download'
import * as RemindLogApi from '@/api/cr/remind/log'
import * as RemindRuleApi from '@/api/cr/remind/rule'
import RemindLogDetailDialog from './RemindLogDetailDialog.vue'

defineOptions({ name: 'CrRemindLog' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<RemindLogApi.RemindLogVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  scene: undefined as number | undefined,
  status: undefined as number | undefined,
  channel: undefined as string | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const readLoading = ref(false)
const resendId = ref<number | undefined>(undefined)
/** 场景 / 渠道 / 状态中文名一律取服务端口径 */
const meta = reactive<RemindRuleApi.RemindMetaVO>({
  scenes: [],
  channels: [],
  statuses: [],
  roles: [],
  users: [],
  today: ''
})

/** 顶部统计：全部来自 getRemindLogStat()，页面不写死数字 */
const statLoading = ref(false)
const stat = reactive<RemindLogApi.RemindLogStatVO>({
  total: 0,
  read: 0,
  failed: 0,
  generatedByRun: 0,
  scenes: []
})

const labelOf = (
  options: Array<{ value: number | string; label: string }>,
  value?: number | string
) => {
  const hit = options.find((item) => String(item.value) === String(value))
  return hit ? hit.label : '—'
}

/** 记录来源：历史留痕 / 立即执行生成 / 重发生成（老数据没有 source 字段时按 seeded 兜底） */
const sourceOf = (row: any) => String(row.source || (row.seeded ? 'seed' : 'run'))
const sourceLabel = (row: any) =>
  ({ seed: '历史留痕', run: '由立即执行生成', resend: '由重发生成' })[sourceOf(row)] ||
  sourceOf(row)
const sourceTagType = (row: any) =>
  sourceOf(row) === 'resend' ? 'warning' : sourceOf(row) === 'seed' ? 'info' : 'success'

/** 状态：1 已发送 / 2 已读 / 3 发送失败（失败必须红色） */
const statusLabel = (status?: number) => labelOf(meta.statuses, status)
const statusTagType = (status?: number) => {
  if (Number(status) === 3) return 'danger'
  if (Number(status) === 2) return 'success'
  return 'info'
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await RemindLogApi.getPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

/** 查询统计 */
const getStat = async () => {
  statLoading.value = true
  try {
    const data = await RemindLogApi.getRemindLogStat()
    stat.total = data.total || 0
    stat.read = data.read || 0
    stat.failed = data.failed || 0
    stat.generatedByRun = data.generatedByRun || 0
    stat.scenes = data.scenes || []
  } finally {
    statLoading.value = false
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

/** 详情 */
const detailRef = ref()
const openDetail = (id: number) => {
  detailRef.value.open(id)
}

/** 详情里重发成功后，列表与统计一起刷新 */
const handleDetailSuccess = async () => {
  await getList()
  await getStat()
}

/** 标记已读：勾选后批量，提示语用服务端返回的文案 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: RemindLogApi.RemindLogVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleReadBatch = async () => {
  if (checkedIds.value.length === 0) {
    message.warning('请至少勾选一条提醒记录')
    return
  }
  try {
    await message.confirm('将把勾选的 ' + checkedIds.value.length + ' 条提醒标记为已读，确认操作？')
  } catch {
    return
  }
  readLoading.value = true
  try {
    const res = await RemindLogApi.readRemindLogs(checkedIds.value)
    message.success(res.message || '已把 ' + (res.updated || 0) + ' 条提醒标记为已读')
    checkedIds.value = []
    await getList()
    await getStat()
  } finally {
    readLoading.value = false
  }
}

/** 重发：追加一条新记录，历史记录不动 */
const handleResend = async (row: RemindLogApi.RemindLogVO) => {
  try {
    await message.confirm(
      '将向「' +
        row.receiverName +
        '」重发这条提醒（渠道 ' +
        labelOf(meta.channels, row.channel) +
        '），会追加一条新记录、历史记录不变。确认重发？'
    )
  } catch {
    return
  }
  resendId.value = row.id
  try {
    const res = await RemindLogApi.resendRemindLog(row.id!)
    message.success(res.message || '已重发')
    await getList()
    await getStat()
  } finally {
    resendId.value = undefined
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await RemindLogApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
    await getStat()
  } catch {}
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await RemindLogApi.removeList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
    await getStat()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await RemindLogApi.exportExcel(queryParams)
    download.excel(data, '提醒记录.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(async () => {
  const remindMeta = await RemindRuleApi.getRemindMeta()
  meta.scenes = remindMeta.scenes || []
  meta.channels = remindMeta.channels || []
  meta.statuses = remindMeta.statuses || []
  await getStat()
  getList()
})
</script>
