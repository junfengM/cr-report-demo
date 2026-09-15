<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="680">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-form-item label="所属机构" prop="orgName">
        <el-select
          v-model="formData.orgName"
          placeholder="请选择或输入机构名称"
          filterable
          allow-create
          default-first-option
          class="w-full"
        >
          <el-option v-for="name in orgNameOptions" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="联系人" prop="contactName">
            <el-input v-model="formData.contactName" placeholder="请输入联系人姓名" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="职责" prop="duty">
            <el-select
              v-model="formData.duty"
              placeholder="请选择或输入职责"
              filterable
              allow-create
              default-first-option
              class="w-full"
            >
              <el-option v-for="item in DUTY_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="联系电话" prop="contactPhone">
            <el-input v-model="formData.contactPhone" maxlength="20" placeholder="请输入联系电话" />
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
      <el-form-item label="联系邮箱" prop="contactEmail">
        <el-input v-model="formData.contactEmail" placeholder="请输入联系邮箱" />
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
import * as OrgContactApi from '@/api/cr/meta/orgContact'
import * as OrgApi from '@/api/cr/meta/org'

defineOptions({ name: 'CrMetaOrgContactForm' })

const { t } = useI18n()
const message = useMessage()

/** 报送职责（无字典，页面内维护） */
const DUTY_OPTIONS = ['报送负责人', '数据填报人', '复核人', '审核人']

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()
const orgOptions = ref<OrgApi.OrgOptionVO[]>([])

const defaultFormData = (): OrgContactApi.OrgContactVO => ({
  id: undefined,
  orgName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  duty: '报送负责人',
  status: CommonStatusEnum.ENABLE
})

const formData = ref<OrgContactApi.OrgContactVO>(defaultFormData())

/** 机构下拉：报送机构树 + 当前值，保证编辑时可正常回显 */
const orgNameOptions = computed(() => {
  const names = orgOptions.value.map((item) => item.name)
  if (formData.value.orgName && !names.includes(formData.value.orgName)) {
    names.unshift(formData.value.orgName)
  }
  return names
})

const formRules = reactive({
  orgName: [{ required: true, message: '所属机构不能为空', trigger: 'change' }],
  contactName: [{ required: true, message: '联系人不能为空', trigger: 'blur' }],
  contactPhone: [
    { required: true, message: '联系电话不能为空', trigger: 'blur' },
    { pattern: /^[0-9-]{7,20}$/, message: '请输入正确的联系电话', trigger: 'blur' }
  ],
  contactEmail: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
  duty: [{ required: true, message: '职责不能为空', trigger: 'change' }]
})

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增机构联系人' : '修改机构联系人'
  formType.value = type
  resetForm()
  orgOptions.value = await OrgApi.getOrganizationSimpleList()
  if (id) {
    formLoading.value = true
    try {
      const data = await OrgContactApi.getOrgContact(id)
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
      await OrgContactApi.createOrgContact(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await OrgContactApi.updateOrgContact(formData.value)
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
