<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
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
                :label="formatSubject(subject)"
                :value="subject.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="报表范围" prop="reportId">
        <el-select
          v-model="formData.reportId"
          placeholder="请选择报表范围"
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
      <el-form-item label="机构范围" prop="scopeType">
        <el-radio-group
          v-model="formData.scopeType"
          class="flex flex-col items-start"
          @change="handleScopeTypeChange"
        >
          <div v-for="item in scopeTypes" :key="item.value" class="mb-4px">
            <el-radio :value="item.value">{{ item.label }}</el-radio>
            <div class="pl-24px text-12px text-gray-400 leading-16px">{{ item.tip }}</div>
          </div>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="formData.scopeType === 4" label="指定机构" prop="orgIds">
        <el-select
          v-model="formData.orgIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择机构（可多选，可跨分公司）"
          class="w-full"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="优先级" prop="priority">
            <el-input-number
              v-model="formData.priority"
              :min="0"
              :max="999"
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
          placeholder="如 用户级覆盖角色级：只允许看北京分公司的数据"
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
import * as DataScopeApi from '@/api/cr/system/dataScope'
import {
  getOrgOptions,
  getPermissionMeta,
  getSubjectOptions,
  type OrgOptionVO,
  type PermissionMetaVO
} from '@/api/cr/system/common'
import { getCollectReportOptions, type CollectReportOptionVO } from '@/api/cr/collect/common'

defineOptions({ name: 'CrSystemDataScopeForm' })

const { t } = useI18n()
const message = useMessage()

/** 授权主体下拉项：角色只有 name，用户还带部门，label 用 formatSubject 统一拼 */
interface SubjectOption {
  id: number
  name: string
  deptName?: string
}

/** 表单模型：reportId = 0 表示全部报表；orgIds 只在 scopeType = 4 时有意义 */
interface DataScopeFormModel {
  id?: number
  subjectType: number
  subjectId?: number
  subjectName: string
  reportId: number
  reportCode: string
  reportName: string
  scopeType: number
  orgIds: number[]
  priority: number
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const reportOptions = ref<CollectReportOptionVO[]>([])
const orgOptions = ref<OrgOptionVO[]>([])
const scopeTypes = ref<PermissionMetaVO['scopeTypes']>([])
const subjectOptions = reactive<{ roles: SubjectOption[]; users: SubjectOption[] }>({
  roles: [],
  users: []
})

/** 当前主体类型对应的数据源：1 角色 / 2 用户（字典 cr_subject_type） */
const currentSubjects = computed(() =>
  formData.value.subjectType === 2 ? subjectOptions.users : subjectOptions.roles
)

/** 用户选项带部门，便于在同名的人里选对人 */
const formatSubject = (subject: SubjectOption) =>
  subject.deptName ? subject.name + '（' + subject.deptName + '）' : subject.name

const defaultForm = (): DataScopeFormModel => ({
  id: undefined,
  // 默认授权给角色：数据权限最常见的用法是给岗位（角色）放开机构范围
  subjectType: 1,
  subjectId: undefined,
  subjectName: '',
  reportId: 0,
  reportCode: '',
  reportName: '全部报表',
  // 默认「本级及以下」：既是填报岗的常见口径，也避免默认放开全部数据
  scopeType: 2,
  orgIds: [],
  priority: 50,
  status: 1,
  remark: ''
})

const formData = ref<DataScopeFormModel>(defaultForm())

const formRules = reactive({
  subjectType: [{ required: true, message: '主体类型不能为空', trigger: 'change' }],
  subjectId: [{ required: true, message: '授权主体不能为空', trigger: 'change' }],
  reportId: [{ required: true, message: '报表范围不能为空', trigger: 'change' }],
  scopeType: [{ required: true, message: '机构范围不能为空', trigger: 'change' }],
  orgIds: [{ type: 'array', required: true, message: '至少要勾选一个机构', trigger: 'change' }],
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

/** 报表留空 / 选「全部报表」统一落 0，与接口口径一致 */
const handleReportChange = (id?: number) => {
  const report = reportOptions.value.find((item) => item.id === id)
  formData.value.reportId = report ? report.id : 0
  formData.value.reportCode = report ? report.reportCode : ''
  formData.value.reportName = report ? report.reportName : '全部报表'
}

/** 只有「指定机构」需要机构清单，切到别的类型必须清空，否则会把上一份勾选带进 payload */
const handleScopeTypeChange = () => {
  if (formData.value.scopeType !== 4) formData.value.orgIds = []
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增数据权限规则' : '修改数据权限规则'
  formType.value = type
  resetForm()
  // 下拉与口径说明一次取全：表单里切主体类型 / 机构范围只换数据源与文案，不再请求
  if (!subjectOptions.roles.length && !subjectOptions.users.length) {
    const data = await getSubjectOptions()
    subjectOptions.roles = data?.roles || []
    subjectOptions.users = data?.users || []
  }
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
  if (!orgOptions.value.length) orgOptions.value = (await getOrgOptions()) || []
  if (!scopeTypes.value.length) scopeTypes.value = (await getPermissionMeta())?.scopeTypes || []
  if (id) {
    formLoading.value = true
    try {
      const data = await DataScopeApi.getDataScope(id)
      formData.value = { ...formData.value, ...data, orgIds: data?.orgIds || [] }
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
  if (formData.value.scopeType === 4 && !formData.value.orgIds.length) {
    message.warning('机构范围选了「指定机构」，至少要勾选一个机构')
    return
  }
  formLoading.value = true
  try {
    const payload: DataScopeApi.DataScopeVO = {
      ...formData.value,
      subjectId: formData.value.subjectId as number,
      reportId: formData.value.reportId || 0,
      orgIds: formData.value.scopeType === 4 ? formData.value.orgIds : []
    }
    if (formType.value === 'create') {
      await DataScopeApi.createDataScope(payload)
      message.success(t('common.createSuccess'))
    } else {
      await DataScopeApi.updateDataScope(payload)
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
