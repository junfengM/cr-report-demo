<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="620">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-form-item label="字典编码" prop="code">
        <!-- 编码是本地枚举与映射的关联键：改名可以，改编码会把已有码值变成孤儿，所以修改时锁住 -->
        <el-input
          v-model="formData.code"
          :disabled="formType === 'update'"
          placeholder="如 LOCAL_CHANNEL"
        />
        <div class="text-12px text-[#909399] leading-18px">
          大写字母、数字与下划线，以字母开头；编码是码值与映射的关联键，创建后不可修改
        </div>
      </el-form-item>
      <el-form-item label="字典名称" prop="name">
        <el-input v-model="formData.name" placeholder="如 本地渠道" />
        <div class="text-12px text-[#909399] leading-18px">改名会同步到该字典下的码值与映射</div>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-switch
          v-model="formData.status"
          :active-value="1"
          :inactive-value="0"
          active-text="启用"
          inactive-text="停用"
        />
        <dict-tag class="ml-10px" :type="DICT_TYPE.CR_ENABLE_STATUS" :value="formData.status" />
        <div class="text-12px text-[#909399] leading-18px">停用后不能再维护这本字典下的码值</div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 内部渠道代码，报文字段取监管码值需在映射页配置"
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
import { DICT_TYPE } from '@/utils/dict'
import * as LocalDictApi from '@/api/cr/dict/localDict'

defineOptions({ name: 'CrDictLocalDictForm' })

const { t } = useI18n()
const message = useMessage()

interface LocalDictFormModel {
  id?: number
  code: string
  name: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status（注意 1 = 启用） */
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')

const defaultForm = (): LocalDictFormModel => ({
  id: undefined,
  code: '',
  name: '',
  status: 1,
  remark: ''
})

const formData = ref<LocalDictFormModel>(defaultForm())

const formRules = reactive({
  code: [
    { required: true, message: '字典编码不能为空', trigger: 'blur' },
    {
      // 空值交给 required 报错，这里只在填了内容时校验格式，避免两条规则同时弹
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (!value || /^[A-Z][A-Z0-9_]*$/.test(value)) return callback()
        callback(new Error('字典编码只能用大写字母、数字与下划线，且以字母开头'))
      },
      trigger: 'blur'
    }
  ],
  name: [{ required: true, message: '字典名称不能为空', trigger: 'blur' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增本地字典' : '修改本地字典'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await LocalDictApi.getLocalDict(id)
      formData.value = { ...defaultForm(), ...data }
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
    const payload = { ...formData.value } as LocalDictApi.LocalDictVO
    if (formType.value === 'create') {
      await LocalDictApi.createLocalDict(payload)
      message.success(t('common.createSuccess'))
    } else {
      await LocalDictApi.updateLocalDict(payload)
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
