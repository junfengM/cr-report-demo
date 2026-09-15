<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="860">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="120px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="数据集编码" prop="datasetCode">
            <el-input
              v-model="formData.datasetCode"
              placeholder="如 DSET_TASK"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据集名称" prop="datasetName">
            <el-input
              v-model="formData.datasetName"
              placeholder="如 报送任务明细"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="取数方式" prop="sourceType">
            <el-radio-group v-model="formData.sourceType">
              <el-radio v-for="item in SOURCE_TYPE_OPTIONS" :key="item.value" :value="item.value">
                {{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据源" prop="datasourceId">
            <el-select
              v-model="formData.datasourceId"
              placeholder="请选择数据源"
              filterable
              class="w-full"
            >
              <el-option
                v-for="item in datasourceOptions"
                :key="item.id"
                :label="item.dsCode + ' ' + item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="取数来源（表）" prop="tableCode">
            <el-input
              v-model="formData.tableCode"
              placeholder="如 cr.crTask"
              maxlength="128"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="取数来源标识" prop="previewSource">
            <el-select
              v-model="formData.previewSource"
              placeholder="请选择预览取数的真实来源"
              class="w-full"
            >
              <el-option
                v-for="item in sourceOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="formData.sourceType === 2" label="SQL" prop="sqlText">
        <el-input
          v-model="formData.sqlText"
          type="textarea"
          :rows="3"
          placeholder="如 select batch_no, org_name from cr_import_task（取数方式为 SQL 时必填）"
        />
      </el-form-item>
      <el-form-item label="字段清单">
        <div class="w-full">
          <el-table :data="formData.fields" size="small" border>
            <el-table-column label="字段名（真实列名）" min-width="180">
              <template #default="scope">
                <el-input v-model="scope.row.name" size="small" placeholder="如 orgName" />
              </template>
            </el-table-column>
            <el-table-column label="中文名" min-width="180">
              <template #default="scope">
                <el-input v-model="scope.row.label" size="small" placeholder="如 机构" />
              </template>
            </el-table-column>
            <el-table-column label="字段类型" width="150">
              <template #default="scope">
                <el-select v-model="scope.row.type" size="small" class="w-full">
                  <el-option
                    v-for="item in FIELD_TYPE_OPTIONS"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="scope">
                <el-button
                  link
                  type="danger"
                  :disabled="formData.fields.length <= 1"
                  @click="removeField(scope.$index)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button class="mt-8px" size="small" type="primary" plain @click="addField">
            <Icon icon="ep:plus" class="mr-4px" /> 添加字段
          </el-button>
          <div class="mt-5px text-12px text-[#909399]">
            字段名要与取数来源里的真实列名一致，预览与报表按这里的清单裁剪列；至少登记一个字段。
          </div>
        </div>
      </el-form-item>
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
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          maxlength="120"
          show-word-limit
          placeholder="如 任务域取数，报表功能的基础数据集"
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
import * as DatasetApi from '@/api/cr/report/dataset'
import * as DatasourceApi from '@/api/cr/report/datasource'

defineOptions({ name: 'CrReportDatasetForm' })

const message = useMessage()
const { t } = useI18n()

const SOURCE_TYPE_OPTIONS = [
  { value: 1, label: '数据表' },
  { value: 2, label: 'SQL' }
]
const FIELD_TYPE_OPTIONS = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'boolean', label: '布尔' }
]

interface DatasetField {
  name: string
  label: string
  type: string
}

interface DatasetFormModel {
  id?: number
  datasetCode: string
  datasetName: string
  sourceType: number
  datasourceId?: number
  tableCode: string
  sqlText: string
  previewSource: string
  fields: DatasetField[]
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formType = ref('create')
const formLoading = ref(false)
const formRef = ref()
interface DatasourceOption {
  id: number
  name: string
  dsCode: string
}

interface SourceOption {
  value: string
  label: string
}

const datasourceOptions = ref<DatasourceOption[]>([])
/** 取数来源标识由服务端给（/cr/report-dataset/source-options） */
const sourceOptions = ref<SourceOption[]>([])

const defaultForm = (): DatasetFormModel => ({
  id: undefined,
  datasetCode: '',
  datasetName: '',
  sourceType: 1,
  datasourceId: undefined,
  tableCode: '',
  sqlText: '',
  previewSource: '',
  fields: [{ name: '', label: '', type: 'string' }],
  status: 1,
  remark: ''
})
const formData = ref<DatasetFormModel>(defaultForm())

/** 只做必填提示：唯一性、SQL 必填、取数来源合法性等由服务端校验并返回中文原因 */
const formRules = reactive({
  datasetCode: [{ required: true, message: '请填写数据集编码', trigger: 'blur' }],
  datasetName: [{ required: true, message: '请填写数据集名称', trigger: 'blur' }],
  sourceType: [{ required: true, message: '请选择取数方式', trigger: 'change' }],
  datasourceId: [{ required: true, message: '请选择数据源', trigger: 'change' }],
  tableCode: [{ required: true, message: '请填写取数来源（表名）', trigger: 'blur' }],
  previewSource: [{ required: true, message: '请选择取数来源标识', trigger: 'change' }]
})

const addField = () => {
  formData.value.fields.push({ name: '', label: '', type: 'string' })
}

const removeField = (index: number) => {
  formData.value.fields.splice(index, 1)
}

const resetForm = () => {
  formData.value = defaultForm()
  formRef.value?.resetFields()
}

const fillForm = (row: DatasetApi.ReportDatasetVO) => {
  const fields = Array.isArray(row.fields) && row.fields.length ? row.fields : []
  formData.value = {
    id: row.id,
    datasetCode: row.datasetCode || '',
    datasetName: row.datasetName || '',
    sourceType: Number(row.sourceType || 1),
    datasourceId:
      row.datasourceId === undefined || row.datasourceId === null
        ? undefined
        : Number(row.datasourceId),
    tableCode: row.tableCode || '',
    sqlText: row.sqlText || '',
    previewSource: row.previewSource || '',
    fields: fields.map((field) => ({
      name: field.name || '',
      label: field.label || '',
      type: field.type || 'string'
    })),
    status: Number(row.status === undefined || row.status === null ? 1 : row.status),
    remark: row.remark || ''
  }
  if (!formData.value.fields.length) addField()
}

/** 打开弹窗：create 新增 / update 修改（第二个参数可以是行数据，也可以是 id） */
const open = async (type: string, rowOrId?: DatasetApi.ReportDatasetVO | number) => {
  dialogVisible.value = true
  formType.value = type
  dialogTitle.value = type === 'create' ? '新增数据集' : '修改数据集'
  resetForm()
  formLoading.value = true
  try {
    // 下拉每次都取最新的（新建数据源后立刻可用）
    const [datasources, meta] = await Promise.all([
      DatasourceApi.getDatasourceOptions(),
      DatasetApi.getDatasetMeta()
    ])
    datasourceOptions.value = datasources || []
    sourceOptions.value = meta?.sources || []
    if (type !== 'update') return
    if (rowOrId && typeof rowOrId === 'object') {
      fillForm(rowOrId)
      return
    }
    if (!rowOrId) return
    fillForm(await DatasetApi.getDetail(Number(rowOrId)))
  } catch {
    // 取下拉失败 / 详情不存在时由请求拦截器提示
  } finally {
    formLoading.value = false
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  // 必填项的前端提示（服务端同样会校验，这里只是省一次往返）
  if (formData.value.sourceType === 2 && !formData.value.sqlText.trim()) {
    message.warning('取数方式为 SQL 时必须填写 SQL')
    return
  }
  const fields = formData.value.fields
    .map((field) => ({
      name: (field.name || '').trim(),
      label: (field.label || '').trim(),
      type: field.type || 'string'
    }))
    .filter((field) => field.name)
  if (!fields.length) {
    message.warning('字段清单不能为空，至少要登记一个字段')
    return
  }
  formLoading.value = true
  try {
    const payload: DatasetApi.ReportDatasetVO = {
      datasetCode: formData.value.datasetCode.trim(),
      datasetName: formData.value.datasetName.trim(),
      sourceType: Number(formData.value.sourceType),
      datasourceId: Number(formData.value.datasourceId),
      tableCode: formData.value.tableCode.trim(),
      sqlText: formData.value.sqlText.trim(),
      previewSource: formData.value.previewSource,
      fields,
      status: Number(formData.value.status),
      remark: formData.value.remark
    }
    if (formType.value === 'create') {
      await DatasetApi.create(payload)
      message.success(t('common.createSuccess'))
    } else {
      await DatasetApi.update({ ...payload, id: formData.value.id })
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } catch {
    // 服务端校验失败（编码重复 / SQL 必填 / 取数来源非法）由请求拦截器提示中文原因
  } finally {
    formLoading.value = false
  }
}
</script>
