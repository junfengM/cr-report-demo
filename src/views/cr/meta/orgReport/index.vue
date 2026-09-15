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
      <el-form-item label="报送机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择报送机构"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="item in orgOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="上报方式" prop="reportType">
        <el-select
          v-model="queryParams.reportType"
          placeholder="请选择上报方式"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_REPORT_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="监管局" prop="regulator">
        <el-input
          v-model="queryParams.regulator"
          placeholder="监管局名称 / 上报路径"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:meta-org-report:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增上报配置
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:meta-org-report:delete']"
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
      title="机构上报配置保存各分支机构对应监管局的上报方式、路径与文件命名规则，报送任务按此生成上报文件。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="报送机构"
        align="left"
        prop="orgName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="上报方式" align="center" prop="reportType" width="110">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_TYPE" :value="scope.row.reportType" />
        </template>
      </el-table-column>
      <el-table-column
        label="监管局"
        align="center"
        prop="regulator"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column
        label="上报路径"
        align="left"
        prop="uploadPath"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        label="下载路径"
        align="left"
        prop="downloadPath"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        label="文件命名规则"
        align="left"
        prop="fileRule"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="是否压缩" align="center" prop="compress" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.compress ? 'success' : 'info'" disable-transitions>
            {{ scope.row.compress ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
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
            v-hasPermi="['cr:meta-org-report:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:meta-org-report:delete']"
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
  <OrgReportForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getStrDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as OrgReportApi from '@/api/cr/meta/orgReport'
import * as OrgApi from '@/api/cr/meta/org'
import OrgReportForm from './OrgReportForm.vue'

defineOptions({ name: 'CrMetaOrgReport' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<OrgReportApi.OrgReportVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportType: undefined as string | undefined,
  regulator: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<OrgApi.OrgOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await OrgReportApi.getOrgReportPage(queryParams)
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
    await OrgReportApi.deleteOrgReport(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: OrgReportApi.OrgReportVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await OrgReportApi.deleteOrgReportList(checkedIds.value)
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
    const data = await OrgReportApi.exportOrgReport(queryParams)
    download.excel(data, '机构上报配置.xls')
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
