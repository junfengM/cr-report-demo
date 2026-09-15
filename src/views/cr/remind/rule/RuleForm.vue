<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="820">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="规则编码" prop="ruleCode">
            <el-input v-model="formData.ruleCode" placeholder="如 RM_DEADLINE_3D（全局唯一）" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="规则名称" prop="ruleName">
            <el-input v-model="formData.ruleName" placeholder="如 截止前 3 天提醒未提交" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="触发场景" prop="scene">
            <el-select v-model="formData.scene" placeholder="请选择触发场景" class="w-full">
              <el-option
                v-for="item in meta.scenes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="提前提醒窗口" prop="offsetDays">
            <el-input-number
              v-model="formData.offsetDays"
              :min="0"
              :max="30"
              :controls="false"
              class="w-full"
            />
            <div class="mt-2px text-12px text-gray-400">
              场景「截止前未提交」「期次即将关闭」用它，0~30 天。
            </div>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="接收人" prop="receivers">
        <div class="w-full">
          <el-checkbox v-model="ownerChecked">业务责任人（按单据上的填报人动态取）</el-checkbox>
          <el-select
            v-model="roleIds"
            multiple
            filterable
            placeholder="按角色推送（角色下全部用户）"
            class="mt-6px w-full"
          >
            <el-option
              v-for="role in meta.roles"
              :key="role.id"
              :label="role.name + (role.code ? '（' + role.code + '）' : '')"
              :value="role.id"
            />
          </el-select>
          <el-select
            v-model="userIds"
            multiple
            filterable
            placeholder="按指定人推送"
            class="mt-6px w-full"
          >
            <el-option
              v-for="user in meta.users"
              :key="user.id"
              :label="user.name + '（' + user.username + '）'"
              :value="user.id"
            />
          </el-select>
          <div class="mt-2px text-12px text-gray-400">
            三类可叠加，至少选一个；实际收件人 = 业务责任人 + 角色下全部用户 + 指定人，自动去重。
          </div>
        </div>
      </el-form-item>
      <el-form-item label="推送渠道" prop="channels">
        <el-select v-model="formData.channels" multiple placeholder="请选择推送渠道" class="w-full">
          <el-option
            v-for="item in meta.channels"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <div class="mt-2px text-12px text-gray-400">
          勾选的渠道会各生成一条提醒记录（渠道不同、去重互不影响）；其中「站内信」还会同时写进消息中心（右上角小铃铛）。
        </div>
      </el-form-item>
      <el-form-item label="内容模板" prop="templateText">
        <el-input
          v-model="formData.templateText"
          type="textarea"
          :rows="3"
          placeholder="如【报送提醒】{orgName} 的《{reportName}》（{period}）还有 {daysLeft} 天截止，尚未提交。"
        />
        <div class="mt-2px text-12px text-gray-400">
          可用变量（按场景取值，取不到的变量原样保留）：{taskCode} {reportName} {deadline} {orgName}
          {period} {daysLeft} {applyNo}
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
        <div class="mt-2px text-12px text-gray-400">停用的规则不会被「立即执行一次」扫描到。</div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 多渠道提醒：站内信 + 邮件 + 短信"
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
import * as RemindRuleApi from '@/api/cr/remind/rule'

defineOptions({ name: 'CrRemindRuleForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const meta = reactive<RemindRuleApi.RemindMetaVO>({
  scenes: [],
  channels: [],
  statuses: [],
  roles: [],
  users: [],
  today: ''
})

/** 接收人三类分开选，提交时合成 receivers 数组 */
const ownerChecked = ref(false)
const roleIds = ref<number[]>([])
const userIds = ref<number[]>([])

const defaultForm = (): RemindRuleApi.RemindRuleVO => ({
  id: undefined,
  ruleCode: '',
  ruleName: '',
  scene: 1,
  offsetDays: 0,
  receivers: [],
  receiverText: '',
  channels: [],
  templateText: '',
  status: 1,
  remark: ''
})

const formData = ref<RemindRuleApi.RemindRuleVO>(defaultForm())

/** 把三块选择合成为接口要的 receivers（名称一并带上，列表与导出直接用） */
const buildReceivers = () => {
  const list: RemindRuleApi.RemindRuleVO['receivers'] = []
  if (ownerChecked.value) list.push({ type: 'owner', name: '业务责任人' })
  roleIds.value.forEach((id) => {
    const role = meta.roles.find((item) => item.id === Number(id))
    if (role) list.push({ type: 'role', id: role.id, name: role.name })
  })
  userIds.value.forEach((id) => {
    const user = meta.users.find((item) => item.id === Number(id))
    if (user) list.push({ type: 'user', id: user.id, name: user.name })
  })
  return list
}

watch(
  [ownerChecked, roleIds, userIds],
  () => {
    formData.value.receivers = buildReceivers()
  },
  { deep: true }
)

const validateReceivers = (_rule: any, _value: any, callback: any) => {
  if (buildReceivers().length === 0) {
    callback(new Error('至少要选一个接收人（业务责任人 / 角色 / 指定人）'))
    return
  }
  callback()
}

const validateOffsetDays = (_rule: any, value: any, callback: any) => {
  const days = Number(value)
  if (Number.isNaN(days) || days < 0 || days > 30) {
    callback(new Error('提前天数必须在 0~30 之间'))
    return
  }
  callback()
}

const formRules = reactive({
  ruleCode: [{ required: true, message: '请填写规则编码', trigger: 'blur' }],
  ruleName: [{ required: true, message: '请填写规则名称', trigger: 'blur' }],
  scene: [{ required: true, message: '请选择触发场景', trigger: 'change' }],
  offsetDays: [{ validator: validateOffsetDays, trigger: 'change' }],
  receivers: [{ validator: validateReceivers, trigger: 'change' }],
  channels: [{ type: 'array', required: true, message: '至少要选一个推送渠道', trigger: 'change' }],
  templateText: [{ required: true, message: '请填写提醒内容模板', trigger: 'blur' }]
})

const formRef = ref()

const loadOptions = async () => {
  const remindMeta = await RemindRuleApi.getRemindMeta()
  meta.scenes = remindMeta.scenes || []
  meta.channels = remindMeta.channels || []
  meta.statuses = remindMeta.statuses || []
  meta.roles = remindMeta.roles || []
  meta.users = remindMeta.users || []
  meta.today = remindMeta.today || ''
}

/** 历史规则可能引用了不在候选里的角色 / 用户（如系统管理员角色），补一条兜底项，避免编辑时下拉空白 */
const ensureReceiverOptions = (receivers: RemindRuleApi.RemindRuleVO['receivers']) => {
  receivers.forEach((receiver) => {
    if (receiver.type === 'role' && !meta.roles.some((role) => role.id === Number(receiver.id))) {
      meta.roles.push({ id: Number(receiver.id), name: receiver.name, code: '' })
    }
    if (receiver.type === 'user' && !meta.users.some((user) => user.id === Number(receiver.id))) {
      meta.users.push({ id: Number(receiver.id), name: receiver.name, username: '' })
    }
  })
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增提醒规则' : '修改提醒规则'
  formType.value = type
  resetForm()
  await loadOptions()
  if (id) {
    formLoading.value = true
    try {
      formData.value = await RemindRuleApi.getDetail(id)
      const receivers = formData.value.receivers || []
      ensureReceiverOptions(receivers)
      ownerChecked.value = receivers.some((receiver) => receiver.type === 'owner')
      roleIds.value = receivers
        .filter((receiver) => receiver.type === 'role')
        .map((receiver) => Number(receiver.id))
      userIds.value = receivers
        .filter((receiver) => receiver.type === 'user')
        .map((receiver) => Number(receiver.id))
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
  formData.value.receivers = buildReceivers()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await RemindRuleApi.create(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await RemindRuleApi.update(formData.value)
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
  ownerChecked.value = false
  roleIds.value = []
  userIds.value = []
  formRef.value?.resetFields()
}
</script>
