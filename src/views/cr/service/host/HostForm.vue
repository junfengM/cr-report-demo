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
          <el-form-item label="主机编码" prop="hostCode">
            <el-input v-model="formData.hostCode" placeholder="如 HOST_REG_SFTP（全局唯一）" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="主机名称" prop="hostName">
            <el-input v-model="formData.hostName" placeholder="如 监管报送前置机" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="主机类型" prop="hostType">
            <el-select v-model="formData.hostType" placeholder="请选择主机类型" class="w-full">
              <el-option
                v-for="item in meta.hostTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="协议" prop="protocol">
            <el-input
              v-model="formData.protocol"
              placeholder="留空按主机类型自动取，如 sftp / ftps / https"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="16">
          <el-form-item label="主机地址" prop="address">
            <el-input v-model="formData.address" placeholder="IP 或域名，如 10.20.1.15" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="端口" prop="port" label-width="70px">
            <el-input-number
              v-model="formData.port"
              :min="1"
              :max="65535"
              :controls="false"
              placeholder="1~65535"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="登录账号" prop="username">
            <el-input v-model="formData.username" placeholder="如 cr_report" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="认证方式" prop="authType">
            <el-radio-group v-model="formData.authType" @change="handleAuthTypeChange">
              <el-radio v-for="item in meta.authTypes" :key="item.value" :value="item.value">
                {{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="绑定密钥" prop="secretId">
        <el-select
          v-model="formData.secretId"
          placeholder="认证方式选「密钥」时必须绑定一个密钥"
          clearable
          filterable
          class="w-full"
        >
          <el-option
            v-for="item in secretOptions"
            :key="item.id"
            :label="
              item.name + '（' + item.secretCode + '）' + (item.status === 1 ? '' : '（已停用）')
            "
            :value="item.id"
          />
        </el-select>
        <div class="mt-2px text-12px text-gray-400">
          只绑定密钥名称与指纹，密钥明文不会在页面出现，也不会随主机表单下发。
        </div>
      </el-form-item>
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
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 报文文件上传主通道"
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
import * as ServiceHostApi from '@/api/cr/service/host'

defineOptions({ name: 'CrServiceHostForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const meta = reactive<ServiceHostApi.ServiceMetaVO>({
  hostTypes: [],
  authTypes: [],
  secretTypes: []
})
const secretOptions = ref<Array<{ id: number; name: string; secretCode: string; status: number }>>(
  []
)

const defaultForm = (): ServiceHostApi.ServiceHostVO => ({
  id: undefined,
  hostCode: '',
  hostName: '',
  hostType: 1,
  address: '',
  port: 22,
  username: '',
  authType: 1,
  secretId: undefined as unknown as number,
  secretName: '',
  protocol: '',
  status: 1,
  lastCheckTime: '',
  checkResult: '',
  checkCost: 0,
  remark: ''
})

const formData = ref<ServiceHostApi.ServiceHostVO>(defaultForm())

/** 认证方式选「密钥」时密钥必填（与服务端校验同一句话） */
const validateSecret = (_rule: any, value: any, callback: any) => {
  if (Number(formData.value.authType) === 2 && !value) {
    callback(new Error('认证方式选了「密钥」时必须绑定一个密钥'))
    return
  }
  callback()
}

const formRules = reactive({
  hostCode: [{ required: true, message: '请填写主机编码', trigger: 'blur' }],
  hostName: [{ required: true, message: '请填写主机名称', trigger: 'blur' }],
  hostType: [{ required: true, message: '请选择主机类型', trigger: 'change' }],
  address: [{ required: true, message: '请填写主机地址', trigger: 'blur' }],
  port: [
    { required: true, message: '请填写端口', trigger: 'change' },
    {
      type: 'number',
      min: 1,
      max: 65535,
      message: '端口必须是 1~65535 之间的整数',
      trigger: 'change'
    }
  ],
  authType: [{ required: true, message: '请选择认证方式', trigger: 'change' }],
  secretId: [{ validator: validateSecret, trigger: 'change' }]
})

const formRef = ref()

/** 切回「密码」时提示但不强行清空：历史主机可能同时留着一个备用密钥 */
const handleAuthTypeChange = (authType: number) => {
  if (Number(authType) === 1) {
    message.info('认证方式为「密码」时不需要绑定密钥，如无备用密钥可清空该字段')
  }
}

const loadOptions = async () => {
  const serviceMeta = await ServiceHostApi.getServiceMeta()
  meta.hostTypes = serviceMeta.hostTypes || []
  meta.authTypes = serviceMeta.authTypes || []
  meta.secretTypes = serviceMeta.secretTypes || []
  secretOptions.value = (await ServiceHostApi.getSecretOptions()) || []
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增服务主机' : '修改服务主机'
  formType.value = type
  resetForm()
  await loadOptions()
  if (id) {
    formLoading.value = true
    try {
      formData.value = await ServiceHostApi.getDetail(id)
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
      await ServiceHostApi.create(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await ServiceHostApi.update(formData.value)
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
