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
      <el-form-item label="机构" prop="orgId">
        <el-select
          v-model="queryParams.orgId"
          placeholder="请选择机构"
          clearable
          filterable
          class="!w-200px"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select
          v-model="queryParams.reportId"
          placeholder="请选择报表"
          clearable
          filterable
          class="!w-240px"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="文件类型" prop="fileType">
        <el-select
          v-model="queryParams.fileType"
          placeholder="请选择文件类型"
          clearable
          class="!w-140px"
        >
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_FILE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="机构 / 报表 / 备注"
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
          v-hasPermi="['cr:import-config:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增导入设置
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:import-config:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:import-config:delete']"
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
      title="导入设置决定文件「怎么解析」：按 机构 + 报表精确匹配 → 报表默认 → 机构默认 → 全局默认 逐级回退取生效模板，数据导入页在解析文件前先取用该模板。"
    />
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="机构" align="left" min-width="180" show-overflow-tooltip>
        <template #default="scope">
          <!-- orgId 为 0 的是默认模板，与具体机构配置区分开 -->
          <el-tag v-if="!scope.row.orgId" type="info" size="small">全部机构（默认模板）</el-tag>
          <span v-else>{{ scope.row.orgName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="报表" align="left" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <el-tag v-if="!scope.row.reportId" type="info" size="small">全部报表（默认模板）</el-tag>
          <span v-else>{{ scope.row.reportName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="文件类型" align="center" prop="fileType" width="100">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_FILE_TYPE" :value="scope.row.fileType" />
        </template>
      </el-table-column>
      <el-table-column label="分隔符" align="center" prop="separator" width="90">
        <template #default="scope">{{ separatorText(scope.row.separator) }}</template>
      </el-table-column>
      <el-table-column label="编码" align="center" prop="charset" width="100" />
      <el-table-column label="表头行数" align="center" prop="headerRows" width="90" />
      <el-table-column label="数据起始行" align="center" prop="startRow" width="100" />
      <el-table-column label="日期格式" align="center" prop="dateFormat" width="120" />
      <el-table-column label="映射字段数" align="center" width="110">
        <template #default="scope">{{ mappingCount(scope.row) }}</template>
      </el-table-column>
      <el-table-column label="严格校验" align="center" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.strictCheck ? 'success' : 'info'" size="small">
            {{ scope.row.strictCheck ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="允许覆盖" align="center" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.allowOverwrite ? 'success' : 'info'" size="small">
            {{ scope.row.allowOverwrite ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="需要审核" align="center" width="90">
        <template #default="scope">
          <el-tag :type="scope.row.needAudit ? 'warning' : 'info'" size="small">
            {{ scope.row.needAudit ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column
        label="更新时间"
        align="center"
        prop="updateTime"
        width="170"
        :formatter="dateFormatter"
      />
      <el-table-column label="操作" align="center" width="220" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openPreview(scope.row)"
            v-hasPermi="['cr:import-config:query']"
          >
            预览生效模板
          </el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:import-config:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:import-config:delete']"
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

  <ImportConfigForm ref="formRef" @success="getList" />

  <!-- 生效模板预览：只读，用来核对「这条设置最终会不会被用上」 -->
  <el-dialog v-model="previewVisible" title="生效导入模板" width="760">
    <div v-loading="previewLoading">
      <el-alert class="mb-10px" type="success" :closable="false" show-icon :title="previewTitle" />
      <el-descriptions :column="2" border label-width="100px">
        <el-descriptions-item label="生效层级">
          <el-tag type="primary" size="small">{{ preview?.level || '-' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="命中模板">
          <span v-if="preview?.matchedId">模板 #{{ preview.matchedId }}</span>
          <span v-else>无精确匹配（按回退层级取默认模板）</span>
        </el-descriptions-item>
        <el-descriptions-item label="分隔符">
          {{ separatorText(preview?.config?.separator) }}
        </el-descriptions-item>
        <el-descriptions-item label="编码">{{
          preview?.config?.charset || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="表头行数">
          {{ preview?.config?.headerRows ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="数据起始行">
          {{ preview?.config?.startRow ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="日期格式">
          {{ preview?.config?.dateFormat || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="本期已有填报">
          <span class="font-bold">{{ preview?.existRows ?? 0 }}</span> 行
        </el-descriptions-item>
      </el-descriptions>

      <div class="mt-15px mb-5px text-[13px] text-[#606266]">
        字段映射（{{ previewMapping.length }} 列，导入时按列序号取值）
      </div>
      <el-table :data="previewMapping" size="small" border max-height="260">
        <el-table-column label="列序号" align="center" prop="column" width="90" />
        <el-table-column label="系统字段" align="left" prop="field" min-width="200" />
        <el-table-column label="字段名称" align="left" prop="label" min-width="200" />
      </el-table>

      <el-alert
        v-if="preview && preview.existRows > 0"
        class="mt-10px"
        type="warning"
        :closable="false"
        show-icon
        :title="
          '本期该机构该报表已有 ' +
          preview.existRows +
          ' 行填报数据，导入是否覆盖取决于本模板的「允许覆盖」设置。'
        "
      />
    </div>
    <template #footer>
      <el-button @click="previewVisible = false">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import * as ImportConfigApi from '@/api/cr/collect/importConfig'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import ImportConfigForm from './ImportConfigForm.vue'

defineOptions({ name: 'CrCollectImportConfig' })

/** 生效模板接口的返回：api 层只声明了入参，这里按 mock 约定补上返回结构 */
interface EffectiveConfigVO {
  config: ImportConfigApi.ImportConfigVO
  level: string
  matchedId: number
  existRows: number
}

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ImportConfigApi.ImportConfigVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  fileType: undefined as number | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])

/** 分隔符展示：制表符肉眼不可见，转成字面量更直观 */
const separatorText = (value?: string) => {
  if (!value) return '-'
  if (value === '\t') return '\\t'
  if (value === ' ') return '空格'
  return value
}

/** 映射字段数：模板里配了几列 */
const mappingCount = (row: ImportConfigApi.ImportConfigVO) => (row.mapping?.length || 0) + ' 个'

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ImportConfigApi.getImportConfigPage(queryParams)
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

/** 预览生效模板：这条设置能不能被命中，看的是逐级回退后的结果 */
const previewVisible = ref(false)
const previewLoading = ref(false)
const preview = ref<EffectiveConfigVO>()
const previewRow = ref<ImportConfigApi.ImportConfigVO>()
const previewMapping = computed(() => preview.value?.config?.mapping || [])
const previewTitle = computed(() => {
  if (!previewRow.value) return ''
  return (
    '按「' +
    (previewRow.value.orgName || '全部机构') +
    ' / ' +
    (previewRow.value.reportName || '全部报表') +
    '」逐级回退后的生效模板'
  )
})

const openPreview = async (row: ImportConfigApi.ImportConfigVO) => {
  previewRow.value = row
  preview.value = undefined
  previewVisible.value = true
  previewLoading.value = true
  try {
    preview.value = await ImportConfigApi.getEffectiveConfig(row.orgId, row.reportId)
  } finally {
    previewLoading.value = false
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ImportConfigApi.deleteImportConfig(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ImportConfigApi.ImportConfigVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ImportConfigApi.deleteImportConfigList(checkedIds.value)
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
    const data = await ImportConfigApi.exportImportConfig(queryParams)
    download.excel(data, '导入设置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  // 下拉数据量小，进页面就取，避免搜索时再等一次请求
  const [orgs, reports] = await Promise.all([getCollectOrgOptions(), getCollectReportOptions()])
  orgOptions.value = orgs || []
  reportOptions.value = reports || []
  getList()
})
</script>
