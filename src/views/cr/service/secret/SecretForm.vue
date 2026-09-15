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
          <el-form-item label="密钥编码" prop="secretCode">
            <el-input v-model="formData.secretCode" placeholder="如 SEC_SSH_REG（全局唯一）" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="密钥名称" prop="secretName">
            <el-input v-model="formData.secretName" placeholder="如 监管前置机 SSH 密钥" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="密钥类型" prop="secretType">
            <el-select v-model="formData.secretType" placeholder="请选择密钥类型" class="w-full">
              <el-option
                v-for="item in meta.secretTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="算法" prop="algorithm">
            <el-input
              v-model="formData.algorithm"
              placeholder="如 ed25519 / HMAC-SHA256 / RSA-2048"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="生效日期" prop="effectiveFrom">
            <el-date-picker
              v-model="formData.effectiveFrom"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择生效日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="到期日期" prop="effectiveTo">
            <el-date-picker
              v-model="formData.effectiveTo"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择到期日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="formType === 'update'" label="当前指纹">
        <el-input :model-value="formData.fingerprint" disabled />
        <div class="mt-2px text-12px text-gray-400">
          指纹由系统维护，修改本表单不会改变指纹；只有「密钥轮换」才会生成新指纹。
        </div>
      </el-form-item>
      <el-alert
        v-else
        class="mb-15px"
        type="warning"
        :closable="false"
        show-icon
        title="密钥明文由系统生成并只在服务端使用：本表单没有明文输入框，保存后也只展示指纹。"
      />
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
        <div class="mt-2px text-12px text-gray-400">停用状态的密钥不允许轮换，需要先启用。</div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 每 12 个月轮换一次"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as ServiceSecretApi from '@/api/cr/service/secret'
import { getServiceMeta, type ServiceMetaVO } from '@/api/cr/service/host'

defineOptions({ name: 'CrServiceSecretForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const meta = reactive<ServiceMetaVO>({ hostTypes: [], authTypes: [], secretTypes: [] })

const defaultForm = (): ServiceSecretApi.ServiceSecretVO => ({
  id: undefined,
  secretCode: '',
  secretName: '',
  secretType: 1,
  algorithm: '',
  fingerprint: '',
  effectiveFrom: '',
  effectiveTo: '',
  status: 1,
  rotateCount: 0,
  remark: ''
})

const formData = ref<ServiceSecretApi.ServiceSecretVO>(defaultForm())

/** 到期日不能早于生效日（与服务端校验同一句话） */
const validatePeriod = (_rule: any, _value: any, callback: any) => {
  const from = formData.value.effectiveFrom
  const to = formData.value.effectiveTo
  if (from && to && from > to) {
    callback(new Error('生效期的开始日期不能晚于到期日期'))
    return
  }
  callback()
}

const formRules = reactive({
  secretCode: [{ required: true, message: '请填写密钥编码', trigger: 'blur' }],
  secretName: [{ required: true, message: '请填写密钥名称', trigger: 'blur' }],
  secretType: [{ required: true, message: '请选择密钥类型', trigger: 'change' }],
  effectiveFrom: [
    { required: true, message: '请填写生效期（起止日期）', trigger: 'change' },
    { validator: validatePeriod, trigger: 'change' }
  ],
  effectiveTo: [
    { required: true, message: '请填写生效期（起止日期）', trigger: 'change' },
    { validator: validatePeriod, trigger: 'change' }
  ]
})

const formRef = ref()

const loadOptions = async () => {
  if (meta.secretTypes.length) return
  const serviceMeta = await getServiceMeta()
  meta.secretTypes = serviceMeta.secretTypes || []
  meta.hostTypes = serviceMeta.hostTypes || []
  meta.authTypes = serviceMeta.authTypes || []
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增密钥' : '修改密钥'
  formType.value = type
  resetForm()
  await loadOptions()
  if (id) {
    formLoading.value = true
    try {
      // 详情里只有指纹，没有明文，编辑时也不回填明文
      formData.value = await ServiceSecretApi.getDetail(id)
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
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await ServiceSecretApi.create(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await ServiceSecretApi.update(formData.value)
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
