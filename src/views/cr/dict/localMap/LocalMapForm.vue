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
          <el-form-item label="本地字典" prop="localDict">
            <el-select
              v-model="formData.localDict"
              placeholder="请选择本地字典"
              filterable
              class="w-full"
              @change="handleLocalDictChange"
            >
              <el-option
                v-for="dict in localDicts"
                :key="dict.localDict"
                :label="dictOptionLabel(dict)"
                :value="dict.localDict"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="本地码值" prop="localCode">
            <!-- 必须先选本地字典：不同字典的码值空间不通用，没选就拉不出选项 -->
            <el-select
              v-model="formData.localCode"
              :placeholder="formData.localDict ? '请选择本地码值' : '请先选择本地字典'"
              :disabled="!formData.localDict"
              filterable
              class="w-full"
              @change="handleLocalCodeChange"
            >
              <el-option
                v-for="item in localCodeOptions"
                :key="item.id"
                :label="item.name"
                :value="item.localCode"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="监管字典" prop="regDict">
            <el-select
              v-model="formData.regDict"
              placeholder="请选择监管字典"
              filterable
              class="w-full"
              @change="handleRegDictChange"
            >
              <el-option
                v-for="dict in regDicts"
                :key="dict.regDict"
                :label="dictOptionLabel(dict)"
                :value="dict.regDict"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="监管码值" prop="regCode">
            <el-select
              v-model="formData.regCode"
              :placeholder="formData.regDict ? '请选择监管码值' : '请先选择监管字典'"
              :disabled="!formData.regDict"
              filterable
              class="w-full"
              @change="handleRegCodeChange"
            >
              <el-option
                v-for="item in regCodeOptions"
                :key="item.id"
                :label="item.name"
                :value="item.regCode"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
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
            <div class="text-12px text-[#909399] leading-18px">数字小的先生效，缺省 50</div>
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
          placeholder="如 互联网渠道按监管口径归入「A05 互联网」"
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
import * as LocalMapApi from '@/api/cr/dict/localMap'

defineOptions({ name: 'CrDictLocalMapForm' })

const { t } = useI18n()
const message = useMessage()

/** 本地码值下拉项（local-code/simple-list 返回） */
interface LocalCodeOption {
  id: number
  /** 服务端拼好的展示名，如「L01 个险」 */
  name: string
  localDict: string
  localCode: string
  localName: string
}

/** 监管码值下拉项（reg-code/simple-list 返回） */
interface RegCodeOption {
  id: number
  /** 服务端拼好的展示名，如「A01 个人代理」 */
  name: string
  regDict: string
  regCode: string
  regName: string
}

interface LocalMapFormModel {
  id?: number
  localDict: string
  localDictName: string
  localCode: string
  localName: string
  regDict: string
  regDictName: string
  regCode: string
  regName: string
  priority: number
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const localDicts = ref<LocalMapApi.LocalDictOptionVO[]>([])
const regDicts = ref<LocalMapApi.RegDictOptionVO[]>([])
/** 码值下拉按已选字典加载，字典没选时为空 */
const localCodeOptions = ref<LocalCodeOption[]>([])
const regCodeOptions = ref<RegCodeOption[]>([])

const defaultForm = (): LocalMapFormModel => ({
  id: undefined,
  localDict: '',
  localDictName: '',
  localCode: '',
  localName: '',
  regDict: '',
  regDictName: '',
  regCode: '',
  regName: '',
  // 缺省 50：同一本地码值多条启用映射时数字小的先生效
  priority: 50,
  // 1 = 启用（字典 cr_enable_status，注意与通用启停字典相反）
  status: 1,
  remark: ''
})

const formData = ref<LocalMapFormModel>(defaultForm())

const formRules = reactive({
  localDict: [{ required: true, message: '本地字典不能为空', trigger: 'change' }],
  localCode: [{ required: true, message: '本地码值不能为空', trigger: 'change' }],
  regDict: [{ required: true, message: '监管字典不能为空', trigger: 'change' }],
  regCode: [{ required: true, message: '监管码值不能为空', trigger: 'change' }],
  priority: [{ required: true, message: '优先级不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 字典下拉文案带码值条数，与列表页口径一致 */
const dictOptionLabel = (dict: { dictName: string; count: number }) =>
  dict.dictName + '（' + dict.count + ' 个码值）'

/** 字典下拉一次拉全量，弹窗之间复用 */
const loadDictOptions = async () => {
  if (localDicts.value.length && regDicts.value.length) return
  const data = await LocalMapApi.getLocalMapDictOptions()
  localDicts.value = data?.localDicts || []
  regDicts.value = data?.regDicts || []
}

/** 本地码值下拉：只给启用中的码值（停用码值不允许新建映射） */
const loadLocalCodes = async (localDict: string) => {
  const data = await LocalMapApi.getLocalCodeOptions(localDict)
  localCodeOptions.value = data || []
}

/** 监管码值下拉：按监管字典取 */
const loadRegCodes = async (regDict: string) => {
  const data = await LocalMapApi.getRegCodeOptions(regDict)
  regCodeOptions.value = data || []
}

/** 切换到别的本地字典要清空已选本地码值：不同字典的码值空间不通用 */
const handleLocalDictChange = async (localDict: string) => {
  formData.value.localCode = ''
  formData.value.localName = ''
  localCodeOptions.value = []
  const dict = localDicts.value.find((item) => item.localDict === localDict)
  formData.value.localDictName = dict ? dict.dictName : ''
  if (localDict) await loadLocalCodes(localDict)
}

/** 选中码值后同时落码值与名称，导出 / 列表无需回查 */
const handleLocalCodeChange = (localCode: string) => {
  const item = localCodeOptions.value.find((option) => option.localCode === localCode)
  formData.value.localName = item ? item.localName : ''
}

/** 切换监管字典同样清空已选监管码值 */
const handleRegDictChange = async (regDict: string) => {
  formData.value.regCode = ''
  formData.value.regName = ''
  regCodeOptions.value = []
  const dict = regDicts.value.find((item) => item.regDict === regDict)
  formData.value.regDictName = dict ? dict.dictName : ''
  if (regDict) await loadRegCodes(regDict)
}

const handleRegCodeChange = (regCode: string) => {
  const item = regCodeOptions.value.find((option) => option.regCode === regCode)
  formData.value.regName = item ? item.regName : ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增本地标准映射' : '修改本地标准映射'
  formType.value = type
  resetForm()
  await loadDictOptions()
  if (id) {
    formLoading.value = true
    try {
      const data = await LocalMapApi.getLocalMap(id)
      formData.value = { ...defaultForm(), ...data }
      // 先把已选字典对应的码值下拉拉出来，否则回显只剩码值、也改不了
      if (formData.value.localDict) await loadLocalCodes(formData.value.localDict)
      if (formData.value.regDict) await loadRegCodes(formData.value.regDict)
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
    const payload = { ...formData.value } as LocalMapApi.LocalMapVO
    if (formType.value === 'create') {
      await LocalMapApi.createLocalMap(payload)
      message.success(t('common.createSuccess'))
    } else {
      await LocalMapApi.updateLocalMap(payload)
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
  localCodeOptions.value = []
  regCodeOptions.value = []
  formRef.value?.resetFields()
}
</script>
