<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="820">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="报表编码" prop="reportCode">
            <el-input
              v-model="formData.reportCode"
              placeholder="如 RPT_TASK_ORG"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="报表名称" prop="reportName">
            <el-input
              v-model="formData.reportName"
              placeholder="如 各机构任务完成情况"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="数据集" prop="datasetId">
            <el-select
              v-model="formData.datasetId"
              placeholder="请选择数据集"
              filterable
              class="w-full"
              @change="handleDatasetChange"
            >
              <el-option
                v-for="item in datasetOptions"
                :key="item.id"
                :label="datasetLabel(item)"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="展示方式" prop="chartType">
            <el-select v-model="formData.chartType" class="w-full">
              <el-option
                v-for="item in chartTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="维度字段" prop="dimensionField">
        <el-select
          v-model="formData.dimensionField"
          placeholder="请选择分组用的维度字段（单选）"
          filterable
          :disabled="!formData.datasetId"
          class="w-full"
        >
          <el-option
            v-for="field in currentFields"
            :key="field.name"
            :label="fieldLabel(field)"
            :value="field.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="度量字段" prop="measureFields">
        <div class="w-full">
          <el-select
            v-model="formData.measureFields"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :disabled="!formData.datasetId"
            placeholder="请选择求和用的度量字段（可多选）"
            class="w-full"
          >
            <el-option
              v-for="field in currentFields"
              :key="field.name"
              :label="fieldLabel(field)"
              :value="field.name"
            />
          </el-select>
          <div class="mt-5px text-12px text-[#909399]">
            维度字段用于分组（单选），度量字段用于求和（可多选）；度量留空表示按记录条数统计。
          </div>
        </div>
      </el-form-item>
      <el-form-item label="过滤条件" prop="filterText">
        <el-input
          v-model="formData.filterText"
          placeholder="如 期次 = 202608（仅登记展示，暂不解析）"
          maxlength="120"
          clearable
        />
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
          placeholder="如 度量 rowCount 求和"
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
import * as DesignApi from '@/api/cr/report/design'
import * as DatasetApi from '@/api/cr/report/dataset'

defineOptions({ name: 'CrReportDesignForm' })

const message = useMessage()
const { t } = useI18n()

interface DatasetField {
  name: string
  label: string
  type?: string
}

interface DatasetOption {
  id: number
  name: string
  datasetCode?: string
  fields?: DatasetField[]
}

interface DesignFormModel {
  id?: number
  reportCode: string
  reportName: string
  datasetId?: number
  chartType: number
  dimensionField: string
  measureFields: string[]
  filterText: string
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formType = ref('create')
const formLoading = ref(false)
const formRef = ref()
const datasetOptions = ref<DatasetOption[]>([])
interface ChartTypeOption {
  value: number
  label: string
}

const chartTypeOptions = ref<ChartTypeOption[]>([])
/** 修改时若数据集已停用（不在下拉里），保留一个占位项，避免已选字段显示不出来 */
const datasetNameFallback = ref('')

const defaultForm = (): DesignFormModel => ({
  id: undefined,
  reportCode: '',
  reportName: '',
  datasetId: undefined,
  chartType: 1,
  dimensionField: '',
  measureFields: [],
  filterText: '',
  status: 1,
  remark: ''
})
const formData = ref<DesignFormModel>(defaultForm())

/** 只做必填提示：编码唯一性、字段是否属于该数据集等由服务端校验并返回中文原因 */
const formRules = reactive({
  reportCode: [{ required: true, message: '请填写报表编码', trigger: 'blur' }],
  reportName: [{ required: true, message: '请填写报表名称', trigger: 'blur' }],
  datasetId: [{ required: true, message: '请选择数据集', trigger: 'change' }],
  chartType: [{ required: true, message: '请选择展示方式', trigger: 'change' }],
  dimensionField: [{ required: true, message: '请选择维度字段', trigger: 'change' }]
})

/** 所选数据集的字段清单（服务端随数据集下拉一起给） */
const currentFields = computed<DatasetField[]>(() => {
  const found = datasetOptions.value.find(
    (item) => Number(item.id) === Number(formData.value.datasetId)
  )
  return found?.fields || []
})

const datasetLabel = (item: DatasetOption) =>
  (item.datasetCode ? item.datasetCode + ' ' : '') + item.name
const fieldLabel = (field: DatasetField) => field.label + '（' + field.name + '）'

/** 换数据集：字段清单变了，已选的维度 / 度量要清掉（服务端按字段清单校验） */
const handleDatasetChange = () => {
  formData.value.dimensionField = ''
  formData.value.measureFields = []
}

const resetForm = () => {
  formData.value = defaultForm()
  datasetNameFallback.value = ''
  formRef.value?.resetFields()
}

const fillForm = (row: DesignApi.ReportDesignVO) => {
  formData.value = {
    id: row.id,
    reportCode: row.reportCode || '',
    reportName: row.reportName || '',
    datasetId:
      row.datasetId === undefined || row.datasetId === null ? undefined : Number(row.datasetId),
    chartType: Number(row.chartType || 1),
    dimensionField: row.dimensionField || '',
    measureFields: Array.isArray(row.measureFields) ? row.measureFields.slice() : [],
    filterText: row.filterText || '',
    status: Number(row.status === undefined || row.status === null ? 1 : row.status),
    remark: row.remark || ''
  }
  datasetNameFallback.value = row.datasetName || ''
}

/** 数据集不在启用列表里（已停用/已删除）时补一个占位项，让已配字段可见 */
const ensureDatasetOption = () => {
  const id = formData.value.datasetId
  if (!id) return
  if (datasetOptions.value.some((item) => Number(item.id) === Number(id))) return
  const names = [formData.value.dimensionField].concat(formData.value.measureFields).filter(Boolean)
  datasetOptions.value.unshift({
    id: Number(id),
    name: (datasetNameFallback.value || '数据集 #' + id) + '（已停用）',
    fields: names.map((name) => ({ name, label: name, type: 'string' }))
  })
}

/** 打开弹窗：create 新增 / update 修改（第二个参数可以是行数据，也可以是 id） */
const open = async (type: string, rowOrId?: DesignApi.ReportDesignVO | number) => {
  dialogVisible.value = true
  formType.value = type
  dialogTitle.value = type === 'create' ? '新增报表' : '修改报表'
  resetForm()
  formLoading.value = true
  try {
    // 数据集下拉（带字段清单）与展示方式口径每次都取最新的
    const [datasets, meta] = await Promise.all([
      DatasetApi.getDatasetOptions(),
      DatasetApi.getDatasetMeta()
    ])
    datasetOptions.value = datasets || []
    chartTypeOptions.value = meta?.chartTypes || []
    if (type !== 'update') return
    if (rowOrId && typeof rowOrId === 'object') {
      fillForm(rowOrId)
    } else if (rowOrId) {
      fillForm(await DesignApi.getDetail(Number(rowOrId)))
    }
    ensureDatasetOption()
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
  formLoading.value = true
  try {
    const payload: DesignApi.ReportDesignVO = {
      reportCode: formData.value.reportCode.trim(),
      reportName: formData.value.reportName.trim(),
      datasetId: Number(formData.value.datasetId),
      chartType: Number(formData.value.chartType),
      dimensionField: formData.value.dimensionField,
      measureFields: formData.value.measureFields,
      filterText: formData.value.filterText,
      status: Number(formData.value.status),
      remark: formData.value.remark
    }
    if (formType.value === 'create') {
      await DesignApi.create(payload)
      message.success(t('common.createSuccess'))
    } else {
      await DesignApi.update({ ...payload, id: formData.value.id })
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } catch {
    // 服务端校验失败（编码重复 / 维度字段不在数据集里等）由请求拦截器提示中文原因
  } finally {
    formLoading.value = false
  }
}
</script>
