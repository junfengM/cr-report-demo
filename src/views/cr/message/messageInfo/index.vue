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
      <el-form-item label="报文信息" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="报文编码 / 名称 / 监管文号"
          clearable
          class="!w-240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="报文类型" prop="messageType">
        <el-select
          v-model="queryParams.messageType"
          placeholder="请选择报文类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_MESSAGE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="数据频度" prop="freq">
        <el-select v-model="queryParams.freq" placeholder="请选择频度" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
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
          v-hasPermi="['cr:message-info:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增报文
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:message-info:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:message-info:delete']"
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
      title="报文信息描述一个报文文件的元数据（编码 / 类型 / 版本 / 监管文号 / 关联报表）；报文结构与样例与「一键报送」共用同一套报文生成器。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="报文编码" align="center" prop="messageCode" width="120" />
      <el-table-column
        label="报文名称"
        align="left"
        prop="messageName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="报文类型" align="center" prop="messageType" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_MESSAGE_TYPE" :value="scope.row.messageType" />
        </template>
      </el-table-column>
      <el-table-column label="数据频度" align="center" prop="freq" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_REPORT_FREQ" :value="scope.row.freq" />
        </template>
      </el-table-column>
      <el-table-column label="适用期次" align="center" prop="period" width="100" />
      <el-table-column label="报表数量" align="center" prop="reportCount" width="100">
        <template #default="scope">
          <el-link type="primary" @click="openStructure(scope.row)">
            {{ scope.row.reportCount }} 张
          </el-link>
        </template>
      </el-table-column>
      <el-table-column label="字段数量" align="center" prop="columnCount" width="100" />
      <el-table-column label="版本" align="center" prop="version" width="90" />
      <el-table-column
        label="监管文号"
        align="left"
        prop="regulatoryRef"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="260" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openStructure(scope.row)"
            v-hasPermi="['cr:message-info:structure']"
          >
            报文结构
          </el-button>
          <el-button
            link
            type="primary"
            @click="openSample(scope.row)"
            v-hasPermi="['cr:message-info:sample']"
          >
            报文样例
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:message-info:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:message-info:delete']"
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

  <MessageInfoForm ref="formRef" @success="getList" />
  <MessageStructureDialog ref="structureDialogRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions, getStrDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as MessageInfoApi from '@/api/cr/message/messageInfo'
import MessageInfoForm from './MessageInfoForm.vue'
import MessageStructureDialog from './MessageStructureDialog.vue'

defineOptions({ name: 'CrMessageInfo' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<MessageInfoApi.MessageInfoVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  messageType: '',
  freq: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await MessageInfoApi.getMessageInfoPage(queryParams)
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

/** 报文结构 / 样例 */
const structureDialogRef = ref()
const openStructure = (row: MessageInfoApi.MessageInfoVO) => {
  structureDialogRef.value.open(row, 'structure')
}
const openSample = (row: MessageInfoApi.MessageInfoVO) => {
  structureDialogRef.value.open(row, 'sample')
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await MessageInfoApi.deleteMessageInfo(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: MessageInfoApi.MessageInfoVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await MessageInfoApi.deleteMessageInfoList(checkedIds.value)
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
    const data = await MessageInfoApi.exportMessageInfo(queryParams)
    download.excel(data, '报文信息.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  getList()
})
</script>
