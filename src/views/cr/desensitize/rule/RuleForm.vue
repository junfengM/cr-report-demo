<template>
  <el-dialog :title="dialogTitle" v-model="dialogVisible" width="680px" append-to-body>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="规则编码" prop="ruleCode">
        <el-input v-model="form.ruleCode" placeholder="保存时自动生成（DR001 起）" disabled />
      </el-form-item>
      <el-form-item label="规则名称" prop="ruleName">
        <el-input
          v-model="form.ruleName"
          placeholder="如：证件号掩码"
          maxlength="30"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="规则类型" prop="ruleType">
        <el-select v-model="form.ruleType" placeholder="请选择规则类型" class="!w-full">
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_DESENSITIZE_TYPE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="规则参数" prop="ruleParam">
        <el-input v-model="form.ruleParam" :placeholder="paramPlaceholder" />
        <div class="mt-5px text-12px text-gray-500">{{ paramHint }}</div>
      </el-form-item>
      <el-form-item label="适用数据项" prop="scope">
        <el-select v-model="form.scope" placeholder="请选择数据类型" class="!w-full">
          <el-option v-for="item in SCOPE_OPTIONS" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="示例原文" prop="sampleFrom">
        <el-input
          v-model="form.sampleFrom"
          placeholder="填一个真实样子的值，如 110101199001011234"
        />
      </el-form-item>
      <el-form-item label="示例结果">
        <div class="text-13px">
          <span v-if="form.sampleTo" class="font-medium">{{ form.sampleTo }}</span>
          <span v-else class="text-gray-400">保存后由规则算法生成（与执行时的结果一致）</span>
        </div>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="说明" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          maxlength="120"
          show-word-limit
          placeholder="这条规则用在什么场景、有什么注意事项"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确 定</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getStrDictOptions } from '@/utils/dict'
import * as RuleApi from '@/api/cr/desensitize/rule'

defineOptions({ name: 'DesensRuleForm' })

const emit = defineEmits(['success'])
const message = useMessage()

const SCOPE_OPTIONS = ['姓名', '证件号', '手机号', '邮箱', '地址', '业务标识']

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formType = ref('create')
const saving = ref(false)
const formRef = ref()
const form = reactive<RuleApi.DesensRuleVO>({
  id: undefined,
  ruleCode: '',
  ruleName: '',
  ruleType: 'MASK',
  ruleParam: '',
  scope: '姓名',
  sampleFrom: '',
  sampleTo: '',
  status: 1,
  remark: ''
})

/** 参数提示：不同类型参数的写法不一样，页面上直接给例子 */
const paramPlaceholder = computed(() => {
  if (form.ruleType === 'HASH') return 'salt=HX2026'
  if (form.ruleType === 'REPLACE') return '已脱敏'
  if (form.ruleType === 'TRUNCATE') return '保留前6位'
  return '前3后4'
})
const paramHint = computed(() => {
  if (form.ruleType === 'HASH') return '哈希：盐值可省略，默认 HX2026；结果为 64 位十六进制，不可逆'
  if (form.ruleType === 'REPLACE') return '替换：整个值替换为这里填的固定文本'
  if (form.ruleType === 'TRUNCATE') return '截断：只保留前 N 位，其余用省略号，如「保留前6位」'
  return '掩码：保留前 N 位与后 M 位，中间打星，如「前3后4」；邮箱填「首字符（保留域名）」'
})

const rules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  ruleType: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  ruleParam: [{ required: true, message: '请输入规则参数', trigger: 'blur' }],
  scope: [{ required: true, message: '请选择适用数据项', trigger: 'change' }],
  sampleFrom: [{ required: true, message: '请输入示例原文', trigger: 'blur' }]
}

const reset = () => {
  form.id = undefined
  form.ruleCode = ''
  form.ruleName = ''
  form.ruleType = 'MASK'
  form.ruleParam = ''
  form.scope = '姓名'
  form.sampleFrom = ''
  form.sampleTo = ''
  form.status = 1
  form.remark = ''
  formRef.value?.resetFields()
}

/** 打开弹窗：create 新增 / update 修改（修改时拉详情回填） */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  formType.value = type
  dialogTitle.value = type === 'create' ? '新增脱敏规则' : '修改脱敏规则'
  reset()
  if (type === 'update' && id) {
    const data = await RuleApi.getRule(id)
    Object.assign(form, data)
  }
}

const submit = async () => {
  await formRef.value.validate()
  saving.value = true
  try {
    if (formType.value === 'create') {
      const id: any = await RuleApi.createRule(form)
      const created = id ? await RuleApi.getRule(Number(id)) : null
      message.success(
        created ? '已新增：' + created.sampleFrom + ' → ' + created.sampleTo : '新增成功'
      )
    } else {
      await RuleApi.updateRule(form)
      const updated = form.id ? await RuleApi.getRule(form.id) : null
      message.success(
        updated ? '已保存：' + updated.sampleFrom + ' → ' + updated.sampleTo : '保存成功'
      )
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>
