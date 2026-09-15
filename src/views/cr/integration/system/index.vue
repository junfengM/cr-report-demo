<template>
  <ContentWrap title="接入系统">
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
          placeholder="系统编码 / 名称 / 负责人 / 联系人"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="系统类型" prop="sysType">
        <el-select
          v-model="queryParams.sysType"
          placeholder="请选择系统类型"
          clearable
          class="!w-180px"
        >
          <el-option
            v-for="item in SYS_TYPE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
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
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:integration-system:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:integration-system:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增系统
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:integration-system:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:integration-system:delete']"
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
      title="接入系统登记对端系统与回调地址（必须以 http:// 或 https:// 开头，系统编码全局唯一）。心跳检测为确定性模拟：停用系统与「监管回执对接」（id=3）会返回失败结论，这是正常返回、不是接口异常，页面按失败态展示。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="系统编码"
        align="left"
        prop="sysCode"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="系统名称"
        align="left"
        prop="sysName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="系统类型" align="center" prop="sysType" width="100">
        <template #default="scope">
          <el-tag size="small" disable-transitions>{{ sysTypeLabel(scope.row.sysType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="负责人"
        align="center"
        prop="owner"
        width="110"
        show-overflow-tooltip
      />
      <el-table-column
        label="联系人"
        align="center"
        prop="contact"
        width="160"
        show-overflow-tooltip
      />
      <el-table-column
        label="回调地址"
        align="left"
        prop="callbackUrl"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column label="密钥掩码" align="center" prop="secretMask" width="120" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="最近心跳" align="center" prop="lastHeartbeat" width="170" />
      <el-table-column
        label="心跳结论"
        align="left"
        prop="heartbeatResult"
        min-width="230"
        show-overflow-tooltip
      >
        <template #default="scope">
          <el-tag
            v-if="scope.row.heartbeatResult"
            :type="isHeartbeatFailed(scope.row.heartbeatResult) ? 'danger' : 'success'"
            size="small"
            disable-transitions
          >
            {{ scope.row.heartbeatResult }}
          </el-tag>
          <span v-else class="text-gray-400">未检测</span>
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
      <el-table-column label="操作" align="center" width="220" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            :loading="heartbeatId === scope.row.id"
            @click="handleHeartbeat(scope.row)"
            v-hasPermi="['cr:integration-system:heartbeat']"
          >
            心跳检测
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:integration-system:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:integration-system:delete']"
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
  <SystemForm ref="formRef" @success="getList" />
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as IntegrationSystemApi from '@/api/cr/integration/system'
import SystemForm from './SystemForm.vue'

defineOptions({ name: 'CrIntegrationSystem' })

/** 系统类型口径（与后端 sysType: 1 报送交换 / 2 数据采集 / 3 监管对接 一致） */
const SYS_TYPE_OPTIONS = [
  { value: 1, label: '报送交换' },
  { value: 2, label: '数据采集' },
  { value: 3, label: '监管对接' }
]

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<IntegrationSystemApi.IntegrationSystemVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  sysType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在心跳检测的行 id，避免整表 loading */
const heartbeatId = ref<number | undefined>(undefined)
const checkedIds = ref<number[]>([])

/** 系统类型文案：查不到就原样显示，避免空数据时报错 */
const sysTypeLabel = (value?: number) => {
  const hit = SYS_TYPE_OPTIONS.find((item) => item.value === Number(value))
  return hit ? hit.label : String(value === undefined || value === null ? '-' : value)
}

/** 失败态判定：心跳结论是服务端返回的中文文本，含「失败」即按失败展示（如 id=3 对端 502） */
const isHeartbeatFailed = (result?: string) => !!result && result.indexOf('失败') >= 0

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await IntegrationSystemApi.getPage(queryParams)
    // 空数据容忍：接口返回 0 行时给空数组，表格显示空态
    list.value = (data && data.list) || []
    total.value = (data && data.total) || 0
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/**
 * 心跳检测：接口正常返回（哪怕结论是失败），把 lastHeartbeat / heartbeatResult 写回当前行。
 * 失败结论既写回行内失败态，也单独提醒一次，避免只看到「操作成功」的误解。
 */
const handleHeartbeat = async (row: IntegrationSystemApi.IntegrationSystemVO) => {
  heartbeatId.value = row.id
  try {
    const data = await IntegrationSystemApi.heartbeatSystem(row.id as number)
    row.lastHeartbeat = data.lastHeartbeat
    row.heartbeatResult = data.heartbeatResult
    if (isHeartbeatFailed(data.heartbeatResult)) {
      message.warning(row.sysName + '：' + data.heartbeatResult)
    } else {
      message.success(row.sysName + '：' + (data.heartbeatResult || '心跳检测完成'))
    }
  } catch {
    // 服务端中文原因（系统不存在等）已由 axios 拦截器统一提示
  } finally {
    heartbeatId.value = undefined
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
  } catch {
    return
  }
  try {
    await IntegrationSystemApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  }
}

/** 批量删除 */
const handleRowCheckboxChange = (rows: IntegrationSystemApi.IntegrationSystemVO[]) => {
  checkedIds.value = rows.map((row) => row.id as number)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
  } catch {
    return
  }
  try {
    await IntegrationSystemApi.removeList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
  }
}

/** 导出按钮操作 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await IntegrationSystemApi.exportExcel(queryParams)
    download.excel(data, '接入系统.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 */
onMounted(() => {
  getList()
})
</script>
