<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属主题域" prop="subjectId">
            <el-select
              v-model="formData.subjectId"
              placeholder="请选择所属主题域"
              class="w-full"
              @change="handleSubjectChange"
            >
              <el-option
                v-for="item in subjectOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="表编码" prop="tableCode">
            <el-input v-model="formData.tableCode" placeholder="如 T28" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="表名称" prop="tableName">
            <el-input
              v-model="formData.tableName"
              placeholder="英文物理表名，如 policy_base_info"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="中文表名" prop="cnName">
            <el-input v-model="formData.cnName" placeholder="如 人身险保单基本信息表" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="是否上报" prop="reportFlag">
            <el-switch v-model="formData.reportFlag" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否采集" prop="collectFlag">
            <el-switch v-model="formData.collectFlag" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="是否校验" prop="checkFlag">
            <el-switch v-model="formData.checkFlag" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否审核" prop="auditFlag">
            <el-switch v-model="formData.auditFlag" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="是否拆分报送" prop="splitFlag">
            <el-switch v-model="formData.splitFlag" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio
                v-for="dict in getIntDictOptions(DICT_TYPE.COMMON_STATUS)"
                :key="dict.value"
                :value="dict.value"
              >
                {{ dict.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="增量方式" prop="incrementType">
            <el-select v-model="formData.incrementType" class="w-full" placeholder="请选择增量方式">
              <el-option
                v-for="item in INCREMENT_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="采集方式" prop="collectType">
            <el-select v-model="formData.collectType" class="w-full" placeholder="请选择采集方式">
              <el-option
                v-for="item in COLLECT_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
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
import { CommonStatusEnum } from '@/utils/constants'
import * as MetaTableApi from '@/api/cr/meta/table'

defineOptions({ name: 'CrMetaTableForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()
const subjectOptions = ref<{ id: number; name: string }[]>([])

/** 增量方式 / 采集方式（无字典，页面内维护） */
const INCREMENT_TYPE_OPTIONS = [
  { value: 'FULL', label: '全量' },
  { value: 'INC', label: '增量' },
  { value: 'DELTA', label: '变化量' }
]
const COLLECT_TYPE_OPTIONS = [
  { value: 'AUTO', label: '数据加工' },
  { value: 'MANUAL', label: '手工采集' }
]

const defaultFormData = (): MetaTableApi.MetaTableVO => ({
  id: undefined,
  subjectId: undefined as unknown as number,
  subjectName: '',
  tableCode: '',
  tableName: '',
  cnName: '',
  reportFlag: true,
  collectFlag: true,
  checkFlag: true,
  auditFlag: true,
  splitFlag: false,
  incrementType: 'INC',
  collectType: 'AUTO',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<MetaTableApi.MetaTableVO>(defaultFormData())

const formRules = reactive({
  subjectId: [{ required: true, message: '所属主题域不能为空', trigger: 'change' }],
  tableCode: [{ required: true, message: '表编码不能为空', trigger: 'blur' }],
  tableName: [{ required: true, message: '表名称不能为空', trigger: 'blur' }],
  cnName: [{ required: true, message: '中文表名不能为空', trigger: 'blur' }],
  incrementType: [{ required: true, message: '增量方式不能为空', trigger: 'change' }],
  collectType: [{ required: true, message: '采集方式不能为空', trigger: 'change' }]
})

/** 选择主题域时同步冗余的主题域名称 */
const handleSubjectChange = (subjectId: number) => {
  formData.value.subjectName =
    subjectOptions.value.find((item) => item.id === subjectId)?.name || ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增数据表' : '修改数据表'
  formType.value = type
  resetForm()
  subjectOptions.value = await MetaTableApi.getSubjectOptions()
  if (id) {
    formLoading.value = true
    try {
      const data = await MetaTableApi.getMetaTable(id)
      formData.value = { ...defaultFormData(), ...data }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await MetaTableApi.createMetaTable(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await MetaTableApi.updateMetaTable(formData.value)
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
  formData.value = defaultFormData()
  formRef.value?.resetFields()
}
</script>
