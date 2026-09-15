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
          <el-form-item label="所属字典" prop="regDict">
            <!-- 只列启用中的字典：停用字典不允许再维护码值，接口也会再判一次 -->
            <el-select
              v-model="formData.regDict"
              placeholder="请选择监管字典"
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
          <el-form-item label="监管码值" prop="regCode">
            <el-input v-model="formData.regCode" placeholder="如 A01" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="监管名称" prop="regName">
            <el-input v-model="formData.regName" placeholder="如 个人代理" />
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
          placeholder="如 监管方 2024 版渠道分类新增码值"
        />
      </el-form-item>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="监管码值来自监管方下发的码值表；本地码值要报出这个码值，得到「本地标准映射」页配好映射后才生效。"
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
import { getRegCode, createRegCode, updateRegCode, type RegCodeVO } from '@/api/cr/dict/regCode'
import { getRegDictOptions, type RegDictVO } from '@/api/cr/dict/regDict'

defineOptions({ name: 'CrDictRegCodeForm' })

const { t } = useI18n()
const message = useMessage()

/** 监管字典下拉项（GET /cr/reg-dict/simple-list 返回） */
type RegDictOption = Pick<RegDictVO, 'id' | 'code' | 'name' | 'status'> & { label: string }

interface RegCodeFormModel {
  id?: number
  regDict: string
  regDictName: string
  regCode: string
  regName: string
  /** 0 停用 / 1 启用，见字典 cr_enable_status（注意 1 = 启用） */
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const dictOptions = ref<RegDictOption[]>([])

const defaultForm = (): RegCodeFormModel => ({
  id: undefined,
  regDict: '',
  regDictName: '',
  regCode: '',
  regName: '',
  status: 1,
  remark: ''
})

const formData = ref<RegCodeFormModel>(defaultForm())

const formRules = reactive({
  regDict: [{ required: true, message: '所属字典不能为空', trigger: 'change' }],
  regCode: [{ required: true, message: '监管码值不能为空', trigger: 'blur' }],
  regName: [{ required: true, message: '监管名称不能为空', trigger: 'blur' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 字典下拉只列启用中的字典；修改历史码值时它的字典可能已停用，补回选项避免下拉空白看不出归属 */
const loadDictOptions = async () => {
  const data = await getRegDictOptions()
  const options = (data || []).filter((item: RegDictOption) => Number(item.status) === 1)
  const current = (data || []).find((item: RegDictOption) => item.code === formData.value.regDict)
  if (current && Number(current.status) !== 1) {
    options.push({ ...current, label: current.label + '（已停用）' })
  }
  dictOptions.value = options
}

/** 切换字典时同步冗余的字典名称（列表 / 导出直接用，无需回查） */
const handleDictChange = (code: string) => {
  const dict = dictOptions.value.find((item) => item.code === code)
  formData.value.regDictName = dict ? dict.name : ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增监管码值' : '修改监管码值'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await getRegCode(id)
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
    const payload = { ...formData.value } as RegCodeVO
    if (formType.value === 'create') {
      await createRegCode(payload)
      message.success(t('common.createSuccess'))
    } else {
      await updateRegCode(payload)
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
