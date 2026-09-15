<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="公式编码" prop="code">
            <el-input v-model="formData.code" placeholder="如 F_PREMIUM_BY_CHANNEL" />
            <div class="text-12px text-[#909399] leading-18px">
              大写字母、数字与下划线，以字母开头；编码是公式的引用键，接口会校验唯一
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="公式名称" prop="name">
            <el-input v-model="formData.name" placeholder="如 保费收入按渠道汇总" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="公式类型" prop="type">
            <el-select v-model="formData.type" class="!w-100%">
              <el-option
                v-for="dict in getIntDictOptions(DICT_TYPE.CR_FORMULA_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
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
      <el-form-item label="应用对象" prop="target">
        <el-input
          v-model="formData.target"
          placeholder="如 BX011 保费收入明细表 / 校验规则 R001 / 统计查询"
        />
        <div class="text-12px text-[#909399] leading-18px">
          说明这条公式挂在哪张报表、数据集或校验规则上；引用表请先登记在《报送配置 →
          表管理》里，试运行会对照它检查
        </div>
      </el-form-item>
      <el-form-item label="SQL 正文" prop="sqlText">
        <el-input
          v-model="formData.sqlText"
          type="textarea"
          :rows="9"
          placeholder="SELECT ... FROM ... WHERE period = :period"
          class="font-mono"
        />
        <div class="text-12px text-[#909399] leading-18px">
          只允许 SELECT；占位参数写成 :period 这种形式，执行时由调度或页面传值。这里不会真的执行 SQL
        </div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="口径或注意事项"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <!-- 试运行校验的是"当前编辑框里的 SQL"，没保存也能先试，避免存了坏 SQL 再回头改 -->
      <el-button
        v-if="canTryRun"
        class="float-left"
        :disabled="formLoading"
        @click="handleTryRun"
        v-hasPermi="['cr:sql-formula:try-run']"
      >
        <Icon icon="ep:video-play" class="mr-5px" /> 试运行
      </el-button>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
    <!-- 试运行弹窗：校验的是编辑框里的 SQL（没保存也能试） -->
    <TryRunDialog ref="tryRunRef" />
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { checkPermi } from '@/utils/permission'
import {
  createSqlFormula,
  getSqlFormula,
  updateSqlFormula,
  type SqlFormulaVO
} from '@/api/cr/message/sqlCustom'
import TryRunDialog from './TryRunDialog.vue'

defineOptions({ name: 'CrMessageSqlCustomForm' })

const { t } = useI18n()
const message = useMessage()

const canTryRun = computed(() => checkPermi(['cr:sql-formula:try-run']))

interface SqlFormulaFormModel {
  id?: number
  code: string
  name: string
  type: number
  target: string
  sqlText: string
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const tryRunRef = ref()

const defaultForm = (): SqlFormulaFormModel => ({
  id: undefined,
  code: '',
  name: '',
  type: 1,
  target: '',
  sqlText: '',
  status: 1,
  remark: ''
})

const formData = ref<SqlFormulaFormModel>(defaultForm())

const formRules = reactive({
  code: [
    { required: true, message: '公式编码不能为空', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (!value || /^[A-Z][A-Z0-9_]*$/.test(value)) return callback()
        callback(new Error('公式编码只能用大写字母、数字与下划线，且以字母开头'))
      },
      trigger: 'blur'
    }
  ],
  name: [{ required: true, message: '公式名称不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '公式类型不能为空', trigger: 'change' }],
  sqlText: [{ required: true, message: 'SQL 正文不能为空', trigger: 'blur' }]
})

const formRef = ref()

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增公式' : '修改公式'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await getSqlFormula(id)
      formData.value = { ...defaultForm(), ...data }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 试运行当前草稿：只解析不执行 */
const handleTryRun = () => {
  tryRunRef.value.open({
    id: formType.value === 'update' ? formData.value.id : undefined,
    sqlText: formData.value.sqlText,
    code: formData.value.code,
    name: formData.value.name
  })
}

const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  formLoading.value = true
  try {
    const payload = { ...formData.value } as SqlFormulaVO
    if (formType.value === 'create') {
      await createSqlFormula(payload)
      message.success(t('common.createSuccess'))
    } else {
      await updateSqlFormula(payload)
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
