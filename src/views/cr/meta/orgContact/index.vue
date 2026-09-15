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
      <el-form-item label="所属机构" prop="orgName">
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
      <el-form-item label="联系人" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="联系人 / 电话 / 邮箱"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
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
          v-hasPermi="['cr:meta-org-contact:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增联系人
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:meta-org-contact:delete']"
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
      title="联系人用于监管报送的通知与催报：填报、复核、审核环节的待办提醒会同时发送给对应机构联系人。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="所属机构"
        align="left"
        prop="orgName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="联系人" align="center" prop="contactName" width="120" />
      <el-table-column label="联系电话" align="center" prop="contactPhone" width="140" />
      <el-table-column
        label="联系邮箱"
        align="left"
        prop="contactEmail"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="职责" align="center" prop="duty" width="130">
        <template #default="scope">
          <el-tag type="primary" disable-transitions>{{ scope.row.duty }}</el-tag>
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
            v-hasPermi="['cr:meta-org-contact:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:meta-org-contact:delete']"
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
  <OrgContactForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as OrgContactApi from '@/api/cr/meta/orgContact'
import * as OrgApi from '@/api/cr/meta/org'
import OrgContactForm from './OrgContactForm.vue'

defineOptions({ name: 'CrMetaOrgContact' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<OrgContactApi.OrgContactVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgName: undefined as string | undefined,
  keyword: '',
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<OrgApi.OrgOptionVO[]>([])

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await OrgContactApi.getOrgContactPage(queryParams)
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
    await OrgContactApi.deleteOrgContact(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: OrgContactApi.OrgContactVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await OrgContactApi.deleteOrgContactList(checkedIds.value)
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
    const data = await OrgContactApi.exportOrgContact(queryParams)
    download.excel(data, '机构联系人配置.xls')
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
