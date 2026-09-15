<template>
  <ContentWrap title="提醒规则配置">
    <el-alert class="mb-10px" type="info" :closable="false" show-icon>
      <template #title>
        <span>
          提醒规则 = 触发场景 × 接收人 × 推送渠道。「立即执行一次」会真扫当前业务数据（任务 /
          填报记录 / 脱敏审批单 / 期次）， 按「规则 + 单据 +
          接收人」去重后生成提醒记录；提前天数按系统当天（{{
            meta.today || '—'
          }}）计算，停用的规则不会触发。
        </span>
      </template>
    </el-alert>
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
          placeholder="规则编码 / 名称 / 接收人 / 模板 / 备注"
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
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:remind-rule:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:remind-rule:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增规则
        </el-button>
        <el-button
          type="warning"
          plain
          :loading="runLoading"
          @click="handleRun()"
          v-hasPermi="['cr:remind-rule:run']"
        >
          <Icon icon="ep:operation" class="mr-5px" /> 立即执行一次
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:remind-rule:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:remind-rule:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="规则列表">
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="规则编码"
        align="left"
        prop="ruleCode"
        width="170"
        show-overflow-tooltip
      />
      <el-table-column
        label="规则名称"
        align="left"
        prop="ruleName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="触发场景" align="center" width="160">
        <template #default="scope">
          <el-tag size="small">{{ labelOf(meta.scenes, scope.row.scene) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提前天数" align="center" prop="offsetDays" width="100">
        <template #default="scope">
          <span v-if="scope.row.scene === 2 || scope.row.scene === 6"
            >{{ scope.row.offsetDays }} 天</span
          >
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column
        label="接收人"
        align="left"
        prop="receiverText"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="推送渠道" align="left" min-width="180">
        <template #default="scope">
          <el-tag
            v-for="channel in scope.row.channels"
            :key="channel"
            size="small"
            class="mr-5px"
            :type="channel === 'inner' ? 'info' : channel === 'email' ? 'primary' : 'warning'"
          >
            {{ channelLabel(channel) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="提醒内容模板"
        align="left"
        prop="templateText"
        min-width="280"
        show-overflow-tooltip
      />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" fixed="right" width="210">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:remind-rule:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="warning"
            :loading="runId === scope.row.id"
            :disabled="scope.row.status !== 1"
            @click="handleRun(scope.row)"
            v-hasPermi="['cr:remind-rule:run']"
          >
            执行本条
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:remind-rule:delete']"
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

  <!-- 表单弹窗：新增 / 修改 -->
  <RuleForm ref="formRef" @success="getList" />
  <!-- 立即执行结果 -->
  <RuleRunResultDialog ref="runResultRef" />
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as RemindRuleApi from '@/api/cr/remind/rule'
import RuleForm from './RuleForm.vue'
import RuleRunResultDialog from './RuleRunResultDialog.vue'

defineOptions({ name: 'CrRemindRule' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<RemindRuleApi.RemindRuleVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  scene: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在执行的规则 id（空 = 执行全部） */
const runId = ref<number | undefined>(undefined)
const runLoading = ref(false)
/** 场景 / 渠道 / 状态 / 接收人候选一律取服务端口径 */
const meta = reactive<RemindRuleApi.RemindMetaVO>({
  scenes: [],
  channels: [],
  statuses: [],
  roles: [],
  users: [],
  today: ''
})

const labelOf = (
  options: Array<{ value: number | string; label: string }>,
  value?: number | string
) => {
  const hit = options.find((item) => String(item.value) === String(value))
  return hit ? hit.label : '—'
}

const channelLabel = (channel: string) => labelOf(meta.channels, channel)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await RemindRuleApi.getPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
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

/** 立即执行：不传 id = 跑全部启用规则，传 id = 只跑这一条 */
const runResultRef = ref()
const handleRun = async (row?: RemindRuleApi.RemindRuleVO) => {
  const target = row ? '「' + row.ruleName + '」' : '全部启用中的规则'
  try {
    await message.confirm(
      '将立即扫描当前业务数据，按 ' + target + ' 生成提醒记录（同一单据不会重复提醒），确认执行？'
    )
  } catch {
    return
  }
  if (row) {
    runId.value = row.id
  } else {
    runLoading.value = true
  }
  try {
    const res = await RemindRuleApi.runRemindRule(row ? row.id : undefined)
    runResultRef.value.open(res)
    if (res.generated > 0) {
      message.success(res.message)
    } else {
      message.warning(res.message)
    }
    await getList()
  } finally {
    runId.value = undefined
    runLoading.value = false
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await RemindRuleApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: RemindRuleApi.RemindRuleVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await RemindRuleApi.removeList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await RemindRuleApi.exportExcel(queryParams)
    download.excel(data, '提醒规则.xls')
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
  meta.roles = remindMeta.roles || []
  meta.users = remindMeta.users || []
  meta.today = remindMeta.today || ''
  getList()
})
</script>
