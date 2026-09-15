<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="所属数据表" prop="tableId">
        <el-select
          v-model="formData.tableId"
          placeholder="请选择所属数据表"
          filterable
          class="w-full"
          @change="handleTableChange"
        >
          <el-option
            v-for="item in tableOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="字段编码" prop="columnCode">
            <el-input v-model="formData.columnCode" placeholder="如 DE276" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="字段名称" prop="columnName">
            <el-input v-model="formData.columnName" placeholder="英文物理字段名" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="字段中文名" prop="cnName">
            <el-input v-model="formData.cnName" placeholder="如 保单号" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据类型" prop="dataType">
            <el-select v-model="formData.dataType" class="w-full" placeholder="请选择数据类型">
              <el-option
                v-for="item in DATA_TYPE_OPTIONS"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="长度" prop="dataLength">
            <el-input-number
              v-model="formData.dataLength"
              :min="1"
              :max="4000"
              controls-position="right"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否必填" prop="required">
            <el-switch v-model="formData.required" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="是否主键" prop="primaryKey">
            <el-switch v-model="formData.primaryKey" />
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
          <el-form-item label="脱敏规则" prop="desensitizeRule">
            <el-select
              v-model="formData.desensitizeRule"
              class="w-full"
              placeholder="请选择脱敏规则"
              @change="handleRuleChange"
            >
              <el-option label="不脱敏" :value="DESENSITIZE_NONE" />
              <el-option
                v-for="dict in getStrDictOptions(DICT_TYPE.CR_DESENSITIZE_TYPE)"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item v-if="!isNoDesensitize" label="脱敏参数" prop="desensitizeParam">
            <el-input v-model="formData.desensitizeParam" placeholder="如 前3后4 / 保留前6位" />
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
import { DICT_TYPE, getIntDictOptions, getStrDictOptions } from '@/utils/dict'
import { CommonStatusEnum } from '@/utils/constants'
import * as MetaColumnApi from '@/api/cr/meta/column'
import type { MetaTableOptionVO } from '@/api/cr/meta/table'
import { DESENSITIZE_NONE } from '@/api/cr/meta/column'

defineOptions({ name: 'CrMetaColumnForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()
const tableOptions = ref<MetaTableOptionVO[]>([])

const DATA_TYPE_OPTIONS = ['VARCHAR', 'CHAR', 'DECIMAL', 'INT', 'DATE', 'DATETIME', 'TEXT']

const defaultFormData = (): MetaColumnApi.MetaColumnVO => ({
  id: undefined,
  tableId: undefined as unknown as number,
  tableName: '',
  cnTableName: '',
  columnCode: '',
  columnName: '',
  cnName: '',
  dataType: 'VARCHAR',
  dataLength: 32,
  required: false,
  primaryKey: false,
  desensitizeRule: DESENSITIZE_NONE,
  desensitizeParam: '',
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<MetaColumnApi.MetaColumnVO>(defaultFormData())

const formRules = reactive({
  tableId: [{ required: true, message: '所属数据表不能为空', trigger: 'change' }],
  columnCode: [{ required: true, message: '字段编码不能为空', trigger: 'blur' }],
  columnName: [{ required: true, message: '字段名称不能为空', trigger: 'blur' }],
  cnName: [{ required: true, message: '字段中文名不能为空', trigger: 'blur' }],
  dataType: [{ required: true, message: '数据类型不能为空', trigger: 'change' }],
  desensitizeRule: [{ required: true, message: '脱敏规则不能为空', trigger: 'change' }]
})

/** 是否不脱敏（不脱敏时隐藏脱敏参数） */
const isNoDesensitize = computed(
  () => !formData.value.desensitizeRule || formData.value.desensitizeRule === DESENSITIZE_NONE
)

/** 选择数据表时同步冗余的表名 */
const handleTableChange = (tableId: number) => {
  const table = tableOptions.value.find((item) => item.id === tableId)
  formData.value.tableName = table?.code || ''
  formData.value.cnTableName = table?.name || ''
}

/** 切换为不脱敏时清空脱敏参数 */
const handleRuleChange = (rule: string) => {
  if (!rule || rule === DESENSITIZE_NONE) formData.value.desensitizeParam = ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增字段' : '修改字段'
  formType.value = type
  resetForm()
  tableOptions.value = await MetaColumnApi.getTableOptions()
  if (id) {
    formLoading.value = true
    try {
      const data = await MetaColumnApi.getMetaColumn(id)
      formData.value = {
        ...defaultFormData(),
        ...data,
        // 库中空串表示不脱敏，页面上用哨兵值 NONE 展示
        desensitizeRule: data.desensitizeRule || DESENSITIZE_NONE
      }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交（不脱敏落库为空串，与种子数据口径保持一致） */
const emit = defineEmits(['success'])
const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    const payload: MetaColumnApi.MetaColumnVO = {
      ...formData.value,
      desensitizeRule: isNoDesensitize.value ? '' : formData.value.desensitizeRule,
      desensitizeParam: isNoDesensitize.value ? '' : formData.value.desensitizeParam
    }
    if (formType.value === 'create') {
      await MetaColumnApi.createMetaColumn(payload)
      message.success(t('common.createSuccess'))
    } else {
      await MetaColumnApi.updateMetaColumn(payload)
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
