<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="900">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="机构" prop="orgId">
            <el-select
              v-model="formData.orgId"
              placeholder="不选 = 全部机构（默认模板）"
              clearable
              filterable
              class="w-full"
            >
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.orgName"
                :value="org.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="报表" prop="reportId">
            <el-select
              v-model="formData.reportId"
              placeholder="不选 = 全部报表（默认模板）"
              clearable
              filterable
              class="w-full"
            >
              <el-option
                v-for="report in reportOptions"
                :key="report.id"
                :label="report.reportCode + ' ' + report.reportName"
                :value="report.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-alert
        class="mb-15px"
        type="info"
        :closable="false"
        show-icon
        title="机构 + 报表都选中时是精确匹配模板；只选其一是默认模板；都不选即全局默认模板。同一档只保留一条。"
      />
      <el-row :gutter="16">
        <el-col :span="10">
          <el-form-item label="文件类型" prop="fileType">
            <el-select v-model="formData.fileType" placeholder="请选择文件类型" class="w-full">
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_FILE_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="7">
          <el-form-item label="分隔符" prop="separator">
            <el-select
              v-model="formData.separator"
              placeholder="请选择或输入"
              filterable
              allow-create
              default-first-option
              class="w-full"
            >
              <el-option
                v-for="item in SEPARATOR_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="7">
          <el-form-item label="编码" prop="charset">
            <el-select v-model="formData.charset" placeholder="请选择编码" class="w-full">
              <el-option v-for="item in CHARSET_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="7">
          <el-form-item label="表头行数" prop="headerRows">
            <el-input-number v-model="formData.headerRows" :min="0" :max="5" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="7">
          <el-form-item label="数据起始行" prop="startRow">
            <el-input-number v-model="formData.startRow" :min="1" :max="99" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="10">
          <el-form-item label="日期格式" prop="dateFormat">
            <el-select v-model="formData.dateFormat" placeholder="请选择日期格式" class="w-full">
              <el-option
                v-for="item in DATE_FORMAT_OPTIONS"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="严格校验" prop="strictCheck">
            <el-switch v-model="formData.strictCheck" active-text="是" inactive-text="否" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="允许覆盖" prop="allowOverwrite">
            <el-switch v-model="formData.allowOverwrite" active-text="是" inactive-text="否" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="入库前审核" prop="needAudit">
            <el-switch v-model="formData.needAudit" active-text="是" inactive-text="否" />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 字段映射：文件列序号 → 系统字段，导入解析时按这个顺序取值 -->
      <el-divider content-position="left"
        >字段映射（共 {{ formData.mapping.length }} 列）</el-divider
      >
      <div class="mb-8px text-[12px] text-[#909399]">
        文件第 N 列对应哪个系统字段：一行代表文件里的一列，列序号请与文件实际列顺序一致。
      </div>
      <el-table :data="formData.mapping" size="small" border max-height="300">
        <el-table-column label="列序号" align="center" width="130">
          <template #default="scope">
            <el-input-number
              v-model="scope.row.column"
              :min="1"
              :max="99"
              size="small"
              controls-position="right"
              class="w-full"
            />
          </template>
        </el-table-column>
        <el-table-column label="系统字段" align="left" min-width="240">
          <template #default="scope">
            <el-select
              v-model="scope.row.field"
              placeholder="请选择系统字段"
              filterable
              size="small"
              class="w-full"
              @change="handleFieldChange(scope.row)"
            >
              <el-option
                v-for="item in fieldOptions"
                :key="item.field"
                :label="item.label + '（' + item.field + '）'"
                :value="item.field"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="字段名称" align="left" min-width="140">
          <template #default="scope">{{ scope.row.label || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="80">
          <template #default="scope">
            <el-button link type="danger" @click="handleRemoveColumn(scope.$index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-8px flex items-center justify-between">
        <span class="text-[12px] text-[#909399]"
          >删除的行不会被解析用到，请在删除后确认剩余列序号仍然连续。</span
        >
        <div>
          <el-button link type="primary" @click="handleAddColumn">添加一列</el-button>
          <el-button link type="primary" @click="handleResetMapping">按标准模板重置</el-button>
        </div>
      </div>

      <el-row :gutter="16" class="mt-15px">
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
                :key="dict.value"
                :value="dict.value"
              >
                {{ dict.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 旧系统导出 TXT，日期为 yyyyMMdd"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as ImportConfigApi from '@/api/cr/collect/importConfig'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'

defineOptions({ name: 'CrCollectImportConfigForm' })

/** 启停状态取值来自字典 cr_enable_status：1 = 启用（与脚手架 COMMON_STATUS 的 0/1 语义相反，不能复用 CommonStatusEnum） */
const ENABLE_STATUS_ENABLED = 1

/** 编码与日期格式是解析约定，写死成有限选项，避免填错导致解析歧义 */
const CHARSET_OPTIONS = ['UTF-8', 'GBK', 'GB18030']
const DATE_FORMAT_OPTIONS = ['yyyy-MM-dd', 'yyyyMMdd', 'yyyy/MM/dd']
const SEPARATOR_OPTIONS = [
  { label: '逗号 ,', value: ',' },
  { label: '分号 ;', value: ';' },
  { label: '竖线 |', value: '|' },
  { label: '制表符 Tab', value: '\t' }
]

/** 可映射的系统字段（由接口下发，避免前后端各写一份） */
interface FieldOptionVO {
  field: string
  label: string
}

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const fieldOptions = ref<FieldOptionVO[]>([])

const defaultForm = (): ImportConfigApi.ImportConfigVO => ({
  id: undefined,
  orgId: undefined as unknown as number,
  orgName: '',
  reportId: undefined as unknown as number,
  reportCode: '',
  reportName: '',
  fileType: 1,
  separator: ',',
  charset: 'UTF-8',
  headerRows: 1,
  startRow: 2,
  dateFormat: 'yyyy-MM-dd',
  mapping: [],
  strictCheck: false,
  allowOverwrite: true,
  needAudit: false,
  status: ENABLE_STATUS_ENABLED,
  remark: ''
})

const formData = ref<ImportConfigApi.ImportConfigVO>(defaultForm())

const formRules = reactive({
  fileType: [{ required: true, message: '文件类型不能为空', trigger: 'change' }],
  separator: [{ required: true, message: '分隔符不能为空', trigger: 'change' }],
  charset: [{ required: true, message: '编码不能为空', trigger: 'change' }],
  headerRows: [{ required: true, message: '表头行数不能为空', trigger: 'change' }],
  startRow: [{ required: true, message: '数据起始行不能为空', trigger: 'change' }],
  dateFormat: [{ required: true, message: '日期格式不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 按 field-options 的顺序生成 1..N 列，即标准保单类模板 */
const buildStandardMapping = (): ImportConfigApi.ImportMappingItemVO[] =>
  fieldOptions.value.map((item, index) => ({
    column: index + 1,
    field: item.field,
    label: item.label
  }))

const handleAddColumn = () => {
  // 新列序号接着当前最大值，避免用户改过序号后两列撞号
  const next =
    formData.value.mapping.reduce((max, row) => Math.max(max, Number(row.column) || 0), 0) + 1
  formData.value.mapping.push({ column: next, field: '', label: '' })
}

const handleRemoveColumn = (index: number) => {
  formData.value.mapping.splice(index, 1)
}

/** 选中系统字段时同步写入中文名，列表与预览都直接读 label */
const handleFieldChange = (row: ImportConfigApi.ImportMappingItemVO) => {
  const option = fieldOptions.value.find((item) => item.field === row.field)
  row.label = option ? option.label : ''
}

const handleResetMapping = () => {
  formData.value.mapping = buildStandardMapping()
  message.info('已按标准模板重置字段映射')
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增导入设置' : '修改导入设置'
  formType.value = type
  resetForm()
  formLoading.value = true
  try {
    // 下拉与字段选项都是弹窗级缓存，只有首次打开才请求
    if (!orgOptions.value.length) orgOptions.value = (await getCollectOrgOptions()) || []
    if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
    if (!fieldOptions.value.length)
      fieldOptions.value = (await ImportConfigApi.getFieldOptions()) || []
    if (id) {
      const data = await ImportConfigApi.getImportConfig(id)
      // mapping 是数组，深拷一份再编辑，否则会直接改到列表里的那一行
      formData.value = { ...data, mapping: (data.mapping || []).map((item) => ({ ...item })) }
    } else {
      formData.value.mapping = buildStandardMapping()
    }
  } finally {
    formLoading.value = false
  }
}
defineExpose({ open })

/** 提交前的映射自检：空字段 / 重复列序号都会让导入解析错位 */
const validateMapping = (): boolean => {
  const rows = formData.value.mapping
  if (!rows.length) {
    message.warning('请至少配置一列字段映射')
    return false
  }
  if (rows.some((row) => !row.field || !row.column)) {
    message.warning('存在未选择系统字段或未填列序号的映射行，请补全或删除')
    return false
  }
  const columns = rows.map((row) => Number(row.column))
  if (new Set(columns).size !== columns.length) {
    message.warning('列序号不能重复，请检查字段映射')
    return false
  }
  return true
}

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (!validateMapping()) return
  formLoading.value = true
  try {
    const orgId = formData.value.orgId || 0
    const reportId = formData.value.reportId || 0
    const org = orgOptions.value.find((item) => item.id === orgId)
    const report = reportOptions.value.find((item) => item.id === reportId)
    // 名称随 id 一起落库：id 为 0 时列表才会显示成「全部机构 / 全部报表」
    const payload: ImportConfigApi.ImportConfigVO = {
      ...formData.value,
      orgId,
      orgName: orgId ? org?.orgName || '' : '全部机构',
      reportId,
      reportCode: reportId ? report?.reportCode || '' : '',
      reportName: reportId ? report?.reportName || '全部报表' : '全部报表',
      mapping: [...formData.value.mapping].sort((a, b) => Number(a.column) - Number(b.column))
    }
    if (formType.value === 'create') {
      await ImportConfigApi.createImportConfig(payload)
      message.success(t('common.createSuccess'))
    } else {
      await ImportConfigApi.updateImportConfig(payload)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置 */
const resetForm = () => {
  formData.value = defaultForm()
  formRef.value?.resetFields()
}
</script>
