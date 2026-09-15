<template>
  <Dialog v-model="dialogVisible" title="新增报表备注" width="620">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-form-item label="机构" prop="orgId">
        <el-input v-model="formData.orgName" disabled />
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-input v-model="formData.reportName" disabled />
      </el-form-item>
      <el-form-item label="报送期次" prop="period">
        <el-input v-model="formData.period" disabled />
      </el-form-item>
      <el-form-item label="备注内容" prop="content">
        <el-input
          v-model="formData.content"
          type="textarea"
          :rows="5"
          maxlength="500"
          show-word-limit
          placeholder="请填写数据口径说明、异常原因、与业务部门核对结论等"
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
import * as ComprehensiveApi from '@/api/cr/query/comprehensive'

defineOptions({ name: 'CrQueryRemarkForm' })

const message = useMessage()

const dialogVisible = ref(false)
const formLoading = ref(false)
const formRef = ref()

const formData = ref<ComprehensiveApi.RemarkVO>({
  orgId: 0,
  orgName: '',
  reportId: 0,
  reportCode: '',
  reportName: '',
  period: '',
  content: '',
  creator: '',
  createTime: ''
})

const formRules = reactive({
  content: [
    { required: true, message: '备注内容不能为空', trigger: 'blur' },
    { min: 5, message: '备注内容至少 5 个字', trigger: 'blur' }
  ]
})

const emit = defineEmits(['success'])

/** 打开弹窗：带入当前选中的机构 / 报表 / 期次 */
const open = (params: Partial<ComprehensiveApi.RemarkVO>) => {
  dialogVisible.value = true
  formRef.value?.resetFields()
  formData.value = {
    orgId: params.orgId || 0,
    orgName: params.orgName || '',
    reportId: params.reportId || 0,
    reportCode: params.reportCode || '',
    reportName: params.reportName || '',
    period: params.period || '',
    content: '',
    creator: '',
    createTime: ''
  }
}

/** 提交 */
const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    await ComprehensiveApi.createRemark(formData.value)
    message.success('备注新增成功')
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

defineExpose({ open })
</script>
