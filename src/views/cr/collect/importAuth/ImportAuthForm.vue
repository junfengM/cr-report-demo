<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="主体类型" prop="subjectType">
            <el-radio-group v-model="formData.subjectType" @change="handleSubjectTypeChange">
              <el-radio
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_SUBJECT_TYPE)"
                :key="dict.value"
                :value="dict.value"
              >
                {{ dict.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="授权主体" prop="subjectId">
            <el-select
              v-model="formData.subjectId"
              placeholder="请选择授权主体"
              filterable
              class="w-full"
              @change="handleSubjectChange"
            >
              <el-option
                v-for="subject in currentSubjects"
                :key="subject.id"
                :label="subject.name"
                :value="subject.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="机构范围" prop="orgId">
            <el-select
              v-model="formData.orgId"
              placeholder="不选表示全部机构"
              clearable
              filterable
              class="w-full"
              @change="handleOrgChange"
            >
              <el-option label="全部机构" :value="0" />
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
          <el-form-item label="报表范围" prop="reportId">
            <el-select
              v-model="formData.reportId"
              placeholder="不选表示全部报表"
              clearable
              filterable
              class="w-full"
              @change="handleReportChange"
            >
              <el-option label="全部报表" :value="0" />
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
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="允许导入" prop="canImport">
            <el-switch v-model="formData.canImport" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="允许覆盖" prop="canOverwrite">
            <el-switch v-model="formData.canOverwrite" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="需要审核" prop="needAudit">
            <el-switch v-model="formData.needAudit" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="单批上限" prop="maxRows">
            <el-input-number
              v-model="formData.maxRows"
              :min="0"
              :max="1000000"
              :step="1000"
              controls-position="right"
              class="w-full"
            />
          </el-form-item>
        </el-col>
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
          placeholder="如 该主体只允许导入不允许覆盖"
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
import * as ImportAuthApi from '@/api/cr/collect/importAuth'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  getCollectSubjectOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'

defineOptions({ name: 'CrCollectImportAuthForm' })

const { t } = useI18n()
const message = useMessage()

/** 授权主体下拉项（角色 / 用户共用同一形状，仅数据源不同） */
interface SubjectOption {
  id: number
  name: string
}

/** 表单模型：三个范围字段未选择时留空，提交前统一兜底为 0（0 = 全部） */
interface ImportAuthFormModel {
  id?: number
  subjectType: number
  subjectId?: number
  subjectName: string
  orgId?: number
  orgName: string
  reportId?: number
  reportCode: string
  reportName: string
  canImport: boolean
  canOverwrite: boolean
  needAudit: boolean
  maxRows: number
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const subjectOptions = reactive<{ roles: SubjectOption[]; users: SubjectOption[] }>({
  roles: [],
  users: []
})

/** 当前主体类型对应的数据源：1 角色 / 2 用户（字典 cr_subject_type） */
const currentSubjects = computed(() =>
  formData.value.subjectType === 2 ? subjectOptions.users : subjectOptions.roles
)

const defaultForm = (): ImportAuthFormModel => ({
  id: undefined,
  // 默认授权给角色，是导入权限最常见的用法
  subjectType: 1,
  subjectId: undefined,
  subjectName: '',
  orgId: 0,
  orgName: '全部机构',
  reportId: 0,
  reportCode: '',
  reportName: '全部报表',
  canImport: true,
  canOverwrite: false,
  needAudit: true,
  maxRows: 5000,
  status: 1,
  remark: ''
})

const formData = ref<ImportAuthFormModel>(defaultForm())

const formRules = reactive({
  subjectType: [{ required: true, message: '主体类型不能为空', trigger: 'change' }],
  subjectId: [{ required: true, message: '授权主体不能为空', trigger: 'change' }],
  maxRows: [{ required: true, message: '单批上限不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 切角色 / 用户时清空已选主体：两种主体的 id 空间不通用，留着会串到另一种主体上 */
const handleSubjectTypeChange = () => {
  formData.value.subjectId = undefined
  formData.value.subjectName = ''
}

/** 选中主体后同时落 id 与名称，列表直接用名称展示，避免回查 */
const handleSubjectChange = (id?: number) => {
  const subject = currentSubjects.value.find((item) => item.id === id)
  formData.value.subjectName = subject ? subject.name : ''
}

/** 机构留空 = 不限机构，落库统一写 0 / 全部机构 */
const handleOrgChange = (id?: number) => {
  const org = orgOptions.value.find((item) => item.id === id)
  formData.value.orgId = org ? org.id : 0
  formData.value.orgName = org ? org.orgName : '全部机构'
}

/** 报表留空 = 不限报表，落库统一写 0 / 全部报表 */
const handleReportChange = (id?: number) => {
  const report = reportOptions.value.find((item) => item.id === id)
  formData.value.reportId = report ? report.id : 0
  formData.value.reportCode = report ? report.reportCode : ''
  formData.value.reportName = report ? report.reportName : '全部报表'
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增导入权限' : '修改导入权限'
  formType.value = type
  resetForm()
  // 角色与用户一次取全，表单里切主体类型只换数据源，不再请求
  if (!subjectOptions.roles.length && !subjectOptions.users.length) {
    const data = await getCollectSubjectOptions()
    subjectOptions.roles = data?.roles || []
    subjectOptions.users = data?.users || []
  }
  if (!orgOptions.value.length) orgOptions.value = (await getCollectOrgOptions()) || []
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
  if (id) {
    formLoading.value = true
    try {
      formData.value = await ImportAuthApi.getImportAuth(id)
    } finally {
      formLoading.value = false
    }
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
  if (!formData.value.subjectName) {
    message.warning('请选择有效的授权主体')
    return
  }
  formLoading.value = true
  try {
    const payload: ImportAuthApi.ImportAuthVO = {
      ...formData.value,
      subjectId: formData.value.subjectId as number,
      orgId: formData.value.orgId || 0,
      reportId: formData.value.reportId || 0
    }
    if (formType.value === 'create') {
      await ImportAuthApi.createImportAuth(payload)
      message.success(t('common.createSuccess'))
    } else {
      await ImportAuthApi.updateImportAuth(payload)
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
