<template>
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px" append-to-body>
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="110px">
      <el-form-item label="期次" prop="period">
        <el-input
          v-model="formData.period"
          placeholder="6 位期次，如 202608"
          maxlength="6"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="期次名称" prop="periodName">
        <el-input v-model="formData.periodName" placeholder="如 2026年8月" class="!w-240px" />
      </el-form-item>
      <el-form-item label="数据频度" prop="freq">
        <el-select v-model="formData.freq" class="!w-240px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_REPORT_FREQ)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="采集窗口" prop="collectStart">
        <el-date-picker
          v-model="formData.collectStart"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="开始日期"
          class="!w-160px"
        />
        <span class="mx-8px">~</span>
        <el-date-picker
          v-model="formData.collectEnd"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="结束日期"
          class="!w-160px"
        />
      </el-form-item>
      <el-form-item label="报送截止日" prop="deadline">
        <el-date-picker
          v-model="formData.deadline"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="截止日期"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="允许补录" prop="allowSupplement">
        <el-switch v-model="formData.allowSupplement" />
        <span class="ml-10px text-12px text-gray-500"
          >关闭期次后，只有这里打开才允许提交补录申请</span
        >
      </el-form-item>
      <el-form-item label="期次状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_PERIOD_STATUS)"
            :key="dict.value"
            :value="dict.value"
          >
            {{ dict.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="3"
          placeholder="如：本期采集窗口遇节假日顺延"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" :loading="formLoading" @click="submitForm">确 定</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import * as PeriodApi from '@/api/cr/collect/period'

defineOptions({ name: 'PeriodForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formData = ref<PeriodApi.CollectPeriodVO>({
  period: '',
  periodName: '',
  freq: 3,
  collectStart: '',
  collectEnd: '',
  deadline: '',
  allowSupplement: true,
  status: 1,
  remark: ''
})
const formRules = reactive({
  period: [
    { required: true, message: '期次不能为空', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '期次为 6 位数字，如 202608', trigger: 'blur' }
  ],
  periodName: [{ required: true, message: '期次名称不能为空', trigger: 'blur' }],
  freq: [{ required: true, message: '数据频度不能为空', trigger: 'change' }],
  collectStart: [{ required: true, message: '请选择采集开始日期', trigger: 'change' }],
  collectEnd: [{ required: true, message: '请选择采集结束日期', trigger: 'change' }],
  deadline: [{ required: true, message: '请选择报送截止日', trigger: 'change' }]
})
const formRef = ref()

/** 打开弹窗：type = create / update */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增报送期次' : '修改报送期次'
  formType.value = type
  formData.value = {
    period: '',
    periodName: '',
    freq: 3,
    collectStart: '',
    collectEnd: '',
    deadline: '',
    allowSupplement: true,
    status: 1,
    remark: ''
  }
  if (id) {
    formData.value = { ...(await PeriodApi.getPeriod(id)) }
  }
  await nextTick()
  formRef.value.resetFields()
}
defineExpose({ open })

const emit = defineEmits(['success'])
const submitForm = async () => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await PeriodApi.createPeriod(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await PeriodApi.updatePeriod(formData.value)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
