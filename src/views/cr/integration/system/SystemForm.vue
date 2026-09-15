<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="系统编码" prop="sysCode">
            <el-input v-model="formData.sysCode" placeholder="如 SYS_YINBAO，全局唯一" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="系统名称" prop="sysName">
            <el-input v-model="formData.sysName" placeholder="如 银保通数据采集" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="系统类型" prop="sysType">
            <el-radio-group v-model="formData.sysType">
              <el-radio v-for="item in SYS_TYPE_OPTIONS" :key="item.value" :value="item.value">
                {{ item.label }}
              </el-radio>
            </el-radio-group>
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
      <el-form-item label="回调地址" prop="callbackUrl">
        <el-input
          v-model="formData.callbackUrl"
          placeholder="必须以 http:// 或 https:// 开头，如 https://ybt.example.com/openapi/cr/push"
        />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="负责人" prop="owner">
            <el-input v-model="formData.owner" placeholder="如 银保业务部" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="联系人" prop="contact">
            <el-input v-model="formData.contact" placeholder="如 李银保 / 13800000021" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="密钥掩码" prop="secretMask">
        <el-input
          v-model="formData.secretMask"
          placeholder="只登记掩码，如 sk-****3f7c（明文密钥不落库）"
        />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 银保渠道每日推送导入文件"
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
import * as IntegrationSystemApi from '@/api/cr/integration/system'

defineOptions({ name: 'CrIntegrationSystemForm' })

/** 与列表页同一份系统类型口径 */
const SYS_TYPE_OPTIONS = [
  { value: 1, label: '报送交换' },
  { value: 2, label: '数据采集' },
  { value: 3, label: '监管对接' }
]

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()

const defaultForm = (): IntegrationSystemApi.IntegrationSystemVO => ({
  id: undefined,
  sysCode: '',
  sysName: '',
  sysType: 1,
  owner: '',
  contact: '',
  callbackUrl: '',
  secretMask: '',
  status: 1,
  remark: ''
})

const formData = ref<IntegrationSystemApi.IntegrationSystemVO>(defaultForm())

/** 回调地址是服务端硬校验，这里同口径先拦一道；其余必填与服务端一致 */
const validateCallbackUrl = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('回调地址不能为空'))
    return
  }
  if (!/^https?:\/\//.test(value)) {
    callback(new Error('回调地址必须以 http:// 或 https:// 开头'))
    return
  }
  callback()
}

const formRules = reactive({
  sysCode: [{ required: true, message: '系统编码不能为空', trigger: 'blur' }],
  sysName: [{ required: true, message: '系统名称不能为空', trigger: 'blur' }],
  sysType: [{ required: true, message: '系统类型不能为空', trigger: 'change' }],
  callbackUrl: [{ required: true, validator: validateCallbackUrl, trigger: 'blur' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

/** 打开弹窗：create 用默认值，update 回读详情 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增接入系统' : '修改接入系统'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      formData.value = { ...defaultForm(), ...(await IntegrationSystemApi.getDetail(id)) }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交：服务端的中文校验原因由 axios 拦截器统一提示，这里不吞不改 */
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
      await IntegrationSystemApi.create(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await IntegrationSystemApi.update(formData.value)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } catch {
    // 服务端中文原因（编码重复 / 名称必填 / 类型非法 / 回调地址前缀）已由拦截器统一提示
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
