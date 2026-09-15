<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="90px"
    >
      <el-form-item label="机构名称" prop="orgName">
        <el-select
          v-model="queryParams.orgName"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="item in orgOptions"
            :key="item.id"
            :label="item.name"
            :value="item.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="主机/用户" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="主机地址 / 用户名"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="协议" prop="protocol">
        <el-select
          v-model="queryParams.protocol"
          placeholder="请选择协议"
          clearable
          class="!w-140px"
        >
          <el-option v-for="item in PROTOCOL_OPTIONS" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.COMMON_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:meta-org-host:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增主机配置
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:meta-org-host:delete']"
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
      title="机构主机配置保存监管局 FTP/SFTP 目标服务器信息，一键报送时按此连接并上传报文。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="机构 / 监管局"
        align="left"
        prop="orgName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="主机地址" align="center" prop="remoteHost" width="140" />
      <el-table-column label="端口" align="center" prop="port" width="80" />
      <el-table-column label="协议" align="center" prop="protocol" width="90">
        <template #default="scope">
          <el-tag disable-transitions>{{ scope.row.protocol }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="上报规则"
        align="center"
        prop="reportRule"
        width="140"
        show-overflow-tooltip
      />
      <el-table-column
        label="上传路径"
        align="left"
        prop="uploadPath"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        label="下载路径"
        align="left"
        prop="downloadPath"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column label="用户名" align="center" prop="username" width="120" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        align="center"
        prop="createTime"
        width="180"
        :formatter="dateFormatter"
      />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:meta-org-host:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:meta-org-host:delete']"
          >
            删除
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

  <!-- 表单弹窗：添加/修改 -->
  <OrgHostForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as OrgHostApi from '@/api/cr/meta/orgHost'
import * as OrgApi from '@/api/cr/meta/org'
import OrgHostForm from './OrgHostForm.vue'

defineOptions({ name: 'CrMetaOrgHost' })

const message = useMessage()
const { t } = useI18n()

/** 上报协议（无字典，页面内维护） */
const PROTOCOL_OPTIONS = ['FTP', 'SFTP']

const loading = ref(true)
const total = ref(0)
const list = ref<OrgHostApi.OrgHostVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgName: undefined as string | undefined,
  keyword: '',
  protocol: undefined as string | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<OrgApi.OrgOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await OrgHostApi.getOrgHostPage(queryParams)
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

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await OrgHostApi.deleteOrgHost(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: OrgHostApi.OrgHostVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await OrgHostApi.deleteOrgHostList(checkedIds.value)
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
    const data = await OrgHostApi.exportOrgHost(queryParams)
    download.excel(data, '机构主机配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await getList()
  orgOptions.value = await OrgApi.getOrganizationSimpleList()
})
</script>
