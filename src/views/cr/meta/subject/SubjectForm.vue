<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="600">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="主题域编码" prop="subjectCode">
            <el-input v-model="formData.subjectCode" placeholder="如 S12" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="主题域名称" prop="subjectName">
            <el-input v-model="formData.subjectName" placeholder="请输入主题域名称" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item v-if="formType === 'update'" label="表数量">
            <el-input :model-value="formData.tableCount ?? 0" disabled>
              <template #append>张</template>
            </el-input>
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
import * as SubjectApi from '@/api/cr/meta/subject'

defineOptions({ name: 'CrMetaSubjectForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()

const defaultFormData = (): SubjectApi.SubjectVO => ({
  id: undefined,
  subjectCode: '',
  subjectName: '',
  tableCount: 0,
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<SubjectApi.SubjectVO>(defaultFormData())

const formRules = reactive({
  subjectCode: [{ required: true, message: '主题域编码不能为空', trigger: 'blur' }],
  subjectName: [{ required: true, message: '主题域名称不能为空', trigger: 'blur' }]
})

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增主题域' : '修改主题域'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await SubjectApi.getSubject(id)
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
      await SubjectApi.createSubject(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await SubjectApi.updateSubject(formData.value)
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
