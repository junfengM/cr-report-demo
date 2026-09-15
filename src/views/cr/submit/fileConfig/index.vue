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
      <el-form-item label="配置名称" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="配置名称 / 命名规则"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="适用机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-200px"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="文件类型" prop="fileType">
        <el-select
          v-model="queryParams.fileType"
          placeholder="请选择文件类型"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="item in FILE_TYPE_OPTIONS"
            :key="item.value"
            :label="item.value"
            :value="item.value"
          />
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
          v-hasPermi="['cr:submit-file-config:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增配置
        </el-button>
        <el-button type="success" plain :loading="exportLoading" @click="handleExport">
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:submit-file-config:delete']"
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
      title="文件命名规则决定报文文件名，监管前置机会校验文件名是否合规；生成报文时按机构取用启用状态的配置。"
    >
      <template #default>
        可用占位符：
        <el-tag
          v-for="item in FILE_RULE_PLACEHOLDERS"
          :key="item.name"
          class="mr-6px"
          size="small"
          type="info"
        >
          {{ item.name }} = {{ item.desc }}
        </el-tag>
        示例：HX_{orgCode}_{reportCode}_{period}.txt → HX_110000_BX001_202608.txt
      </template>
    </el-alert>
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="配置名称"
        align="left"
        prop="configName"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        label="适用机构"
        align="left"
        prop="orgName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="文件类型" align="center" prop="fileType" width="90">
        <template #default="scope">
          <el-tag :type="FILE_TYPE_TAG[scope.row.fileType] || 'info'">{{
            scope.row.fileType
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="文件命名规则"
        align="left"
        prop="fileNameRule"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column label="字段分隔符" align="center" prop="fieldSeparator" width="100">
        <template #default="scope">{{ separatorText(scope.row.fieldSeparator) }}</template>
      </el-table-column>
      <el-table-column label="是否压缩" align="center" prop="compress" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.compress ? 'success' : 'info'">
            {{ scope.row.compress ? '压缩' : '不压缩' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="字符编码" align="center" prop="charset" width="100" />
      <el-table-column label="表头行数" align="center" prop="headerRows" width="90" />
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.COMMON_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        label="创建时间"
        align="center"
        prop="createTime"
        width="170"
        :formatter="dateFormatter"
      />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:submit-file-config:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:submit-file-config:delete']"
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
  <FileConfigForm ref="formRef" @success="getList" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as SubmitFileConfigApi from '@/api/cr/submit/fileConfig'
import { getOrganizationSimpleList, type OrgOptionVO } from '@/api/cr/meta/org'
import FileConfigForm from './FileConfigForm.vue'
import { FILE_RULE_PLACEHOLDERS, FILE_TYPE_OPTIONS } from '../constants'

defineOptions({ name: 'CrSubmitFileConfig' })

const message = useMessage()
const { t } = useI18n()

/** 文件类型 → 主题色 */
const FILE_TYPE_TAG: Record<string, string> = { TXT: 'primary', XML: 'warning', CSV: 'success' }

const loading = ref(true)
const total = ref(0)
const list = ref<SubmitFileConfigApi.SubmitFileConfigVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  orgId: undefined as number | undefined,
  fileType: '',
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<OrgOptionVO[]>([])

/** 分隔符展示：制表符显示为 \t */
const separatorText = (value: string) => (value === '\t' ? '\\t' : value || '-')

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await SubmitFileConfigApi.getSubmitFileConfigPage(queryParams)
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
    await SubmitFileConfigApi.deleteSubmitFileConfig(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: SubmitFileConfigApi.SubmitFileConfigVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await SubmitFileConfigApi.deleteSubmitFileConfigList(checkedIds.value)
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
    const data = await SubmitFileConfigApi.exportSubmitFileConfig(queryParams)
    download.excel(data, '报送文件配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 机构下拉（适用机构） */
const initOptions = async () => {
  orgOptions.value = (await getOrganizationSimpleList()) || []
}

onMounted(() => {
  initOptions()
  getList()
})
</script>
