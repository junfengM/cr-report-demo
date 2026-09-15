<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="680">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属字典" prop="localDict">
            <!-- 只列启用中的字典：停用字典不允许再维护码值，接口也会再判一次 -->
            <el-select
              v-model="formData.localDict"
              placeholder="请选择本地字典"
              filterable
              class="w-full"
              @change="handleDictChange"
            >
              <el-option
                v-for="dict in dictOptions"
                :key="dict.code"
                :label="dict.label"
                :value="dict.code"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="本地码值" prop="localCode">
            <el-input v-model="formData.localCode" placeholder="如 L01" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="本地名称" prop="localName">
            <el-input v-model="formData.localName" placeholder="如 个险" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-switch
              v-model="formData.status"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="停用"
            />
            <dict-tag class="ml-10px" :type="DICT_TYPE.CR_ENABLE_STATUS" :value="formData.status" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 互联网渠道按监管口径归入「A05 互联网」"
        />
      </el-form-item>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="码值只维护本地口径；这条码值最终报送时取哪个监管码值，要到「本地标准映射」页配置映射后才生效。"
      />
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as LocalCodeApi from '@/api/cr/dict/localCode'
import * as LocalDictApi from '@/api/cr/dict/localDict'

defineOptions({ name: 'CrDictLocalCodeForm' })

const { t } = useI18n()
const message = useMessage()

/** 本地字典下拉项（GET /cr/local-dict/simple-list 返回） */
interface LocalDictOption {
  id: number
  code: string
  name: string
  status: number
  /** 服务端拼好的展示名，如「LOCAL_CHANNEL 本地渠道」 */
  label: string
}

interface LocalCodeFormModel {
  id?: number
  localDict: string
  localDictName: string
  localCode: string
  localName: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status（注意 1 = 启用） */
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const dictOptions = ref<LocalDictOption[]>([])

const defaultForm = (): LocalCodeFormModel => ({
  id: undefined,
  localDict: '',
  localDictName: '',
  localCode: '',
  localName: '',
  status: 1,
  remark: ''
})

const formData = ref<LocalCodeFormModel>(defaultForm())

const formRules = reactive({
  localDict: [{ required: true, message: '所属字典不能为空', trigger: 'change' }],
  localCode: [{ required: true, message: '本地码值不能为空', trigger: 'blur' }],
  localName: [{ required: true, message: '本地名称不能为空', trigger: 'blur' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 字典下拉只列启用中的字典；修改历史码值时它的字典可能已停用，补回选项避免下拉空白看不出归属 */
const loadDictOptions = async () => {
  const data = await LocalDictApi.getLocalDictOptions()
  const options = (data || []).filter((item: LocalDictOption) => Number(item.status) === 1)
  const current = (data || []).find(
    (item: LocalDictOption) => item.code === formData.value.localDict
  )
  if (current && Number(current.status) !== 1) {
    options.push({ ...current, label: current.label + '（已停用）' })
  }
  dictOptions.value = options
}

/** 切换字典时同步冗余的字典名称（列表 / 导出直接用，无需回查） */
const handleDictChange = (code: string) => {
  const dict = dictOptions.value.find((item) => item.code === code)
  formData.value.localDictName = dict ? dict.name : ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增本地枚举' : '修改本地枚举'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await LocalCodeApi.getLocalCode(id)
      formData.value = { ...defaultForm(), ...data }
    } finally {
      formLoading.value = false
    }
  }
  await loadDictOptions()
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
    const payload = { ...formData.value } as LocalCodeApi.LocalCodeVO
    if (formType.value === 'create') {
      await LocalCodeApi.createLocalCode(payload)
      message.success(t('common.createSuccess'))
    } else {
      await LocalCodeApi.updateLocalCode(payload)
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
