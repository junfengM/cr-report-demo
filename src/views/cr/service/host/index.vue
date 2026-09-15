<template>
  <ContentWrap title="服务主机管理">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="服务主机是监管报文与回执交换的通道（SFTP / FTP / HTTP）。认证方式选「密钥」时必须绑定一个密钥，页面只显示密钥名称与指纹、永不显示明文；「连接测试」是确定性模拟（不发起真实网络请求、不取数），会把最近检查时间、结论与耗时写回本行，停用主机会得到失败结论（属正常返回）；改了地址 / 端口 / 协议 / 认证方式，上一次的检查结论会作废、提示重新检查。"
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
          placeholder="主机编码 / 名称 / 地址 / 账号 / 协议"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="主机类型" prop="hostType">
        <el-select v-model="queryParams.hostType" placeholder="全部" clearable class="!w-160px">
          <el-option
            v-for="item in meta.hostTypes"
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
        <el-button @click="handleQuery" v-hasPermi="['cr:service-host:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:service-host:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增主机
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:service-host:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:service-host:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="主机列表">
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="主机编码"
        align="left"
        prop="hostCode"
        width="170"
        show-overflow-tooltip
      />
      <el-table-column
        label="主机名称"
        align="left"
        prop="hostName"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="类型" align="center" width="90">
        <template #default="scope">
          <el-tag size="small">{{ labelOf(meta.hostTypes, scope.row.hostType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="地址"
        align="left"
        prop="address"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="端口" align="center" prop="port" width="80" />
      <el-table-column
        label="账号"
        align="left"
        prop="username"
        width="110"
        show-overflow-tooltip
      />
      <el-table-column label="认证方式" align="left" min-width="190">
        <template #default="scope">
          <el-tag :type="scope.row.authType === 2 ? 'warning' : 'info'" size="small">
            {{ labelOf(meta.authTypes, scope.row.authType) }}
          </el-tag>
          <span v-if="scope.row.secretName" class="ml-5px text-12px text-gray-500">
            {{ scope.row.secretName }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="协议" align="center" prop="protocol" width="90" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="最近检查" align="center" prop="lastCheckTime" width="165">
        <template #default="scope">
          <span v-if="scope.row.lastCheckTime">{{ scope.row.lastCheckTime }}</span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </el-table-column>
      <el-table-column label="检查结论" align="left" min-width="280">
        <template #default="scope">
          <div v-if="scope.row.checkResult">
            <el-tag
              :type="isCheckFailed(scope.row.checkResult) ? 'danger' : 'success'"
              size="small"
            >
              {{ isCheckFailed(scope.row.checkResult) ? '失败' : '成功' }}
            </el-tag>
            <span class="ml-5px text-12px text-gray-500">{{ scope.row.checkCost }} ms</span>
            <div class="mt-2px text-12px text-gray-500">{{ scope.row.checkResult }}</div>
          </div>
          <span v-else class="text-gray-400">未测试</span>
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
            v-hasPermi="['cr:service-host:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="warning"
            :loading="testId === scope.row.id"
            @click="handleTest(scope.row)"
            v-hasPermi="['cr:service-host:test']"
          >
            连接测试
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:service-host:delete']"
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
  <HostForm ref="formRef" @success="getList" />
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ServiceHostApi from '@/api/cr/service/host'
import HostForm from './HostForm.vue'

defineOptions({ name: 'CrServiceHost' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ServiceHostApi.ServiceHostVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  hostType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在连接测试的主机 id（只让被点的那一行转圈） */
const testId = ref<number | undefined>(undefined)
/** 主机类型 / 认证方式的中文名一律取服务端口径，页面不写第二份 */
const meta = reactive<ServiceHostApi.ServiceMetaVO>({
  hostTypes: [],
  authTypes: [],
  secretTypes: []
})

/** 下拉中文名：口径没取到或值非法时显示占位符，不编造 */
const labelOf = (options: Array<{ value: number; label: string }>, value?: number) => {
  const hit = options.find((item) => Number(item.value) === Number(value))
  return hit ? hit.label : '—'
}

/** 检查结论以文本返回（停用主机会返回失败结论，属正常返回，不是接口异常） */
const isCheckFailed = (checkResult?: string) => String(checkResult || '').indexOf('失败') >= 0

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ServiceHostApi.getPage(queryParams)
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

/** 连接测试：只握手不取数，结论写回本行；失败结论也照原样展示服务端文本 */
const handleTest = async (row: ServiceHostApi.ServiceHostVO) => {
  try {
    await message.confirm(
      '将向 ' +
        row.address +
        ':' +
        row.port +
        ' 发起一次连接测试（只握手、不取数、不入库），确认测试「' +
        row.hostName +
        '」？'
    )
  } catch {
    return
  }
  testId.value = row.id
  try {
    const res = await ServiceHostApi.testHost(row.id!)
    if (isCheckFailed(res.checkResult)) {
      message.error(res.checkResult)
    } else {
      message.success(res.checkResult)
    }
    await getList()
  } finally {
    testId.value = undefined
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ServiceHostApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ServiceHostApi.ServiceHostVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ServiceHostApi.removeList(checkedIds.value)
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
    const data = await ServiceHostApi.exportExcel(queryParams)
    download.excel(data, '服务主机.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(async () => {
  const serviceMeta = await ServiceHostApi.getServiceMeta()
  meta.hostTypes = serviceMeta.hostTypes || []
  meta.authTypes = serviceMeta.authTypes || []
  meta.secretTypes = serviceMeta.secretTypes || []
  getList()
})
</script>
