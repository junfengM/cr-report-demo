<template>
  <el-dialog :title="dialogTitle" v-model="dialogVisible" width="720px" append-to-body>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input
          v-model="form.ruleName"
          placeholder="如：北京分公司明细表按 20 行分包"
          maxlength="40"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="机构" prop="orgId">
        <el-select v-model="form.orgId" placeholder="请选择机构" filterable class="!w-full">
          <el-option
            v-for="item in orgOptions"
            :key="item.id"
            :label="item.orgName"
            :value="item.id"
          />
        </el-select>
        <div class="mt-5px text-12px text-gray-500"
          >选「全部机构」= 没有机构级规则的机构都用这条兜底</div
        >
      </el-form-item>
      <el-form-item label="报表" prop="reportId">
        <el-select v-model="form.reportId" placeholder="请选择报表" filterable class="!w-full">
          <el-option
            v-for="item in reportOptions"
            :key="item.id"
            :label="item.reportCode ? item.reportCode + ' ' + item.reportName : item.reportName"
            :value="item.id"
          />
        </el-select>
        <div class="mt-5px text-12px text-gray-500"
          >选「全部报表」= 该机构下没有报表级规则的报表都用这条兜底</div
        >
      </el-form-item>
      <el-form-item label="拆分方式" prop="mode">
        <el-select
          v-model="form.mode"
          placeholder="请选择拆分方式"
          class="!w-full"
          @change="handleModeChange"
        >
          <el-option
            v-for="item in meta.modes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <div class="mt-5px text-12px text-gray-500">{{ modeHint }}</div>
      </el-form-item>
      <el-form-item v-if="form.mode === MODE_BY_ROWS" label="每包行数" prop="rowsPerPackage">
        <el-input-number
          v-model="form.rowsPerPackage"
          :min="1"
          :max="5000"
          :step="1"
          class="!w-200px"
        />
        <div class="mt-5px text-12px text-gray-500"
          >1 ~ 5000 行；超出部分顺延到下一包，包内不重新排序</div
        >
      </el-form-item>
      <el-form-item v-if="form.mode === MODE_BY_FIELD" label="拆分字段" prop="splitField">
        <el-select v-model="form.splitField" placeholder="请选择拆分字段" class="!w-full">
          <el-option
            v-for="item in meta.fields"
            :key="item.field"
            :label="item.label"
            :value="item.field"
          />
        </el-select>
        <div class="mt-5px text-12px text-gray-500">
          可选字段由服务端给出；同一个字段值的明细行进同一个包，拆分只做分组、不改字段值
        </div>
      </el-form-item>
      <el-form-item label="包名前缀" prop="pkgPrefix">
        <el-input v-model="form.pkgPrefix" placeholder="如 BJ-BX011" />
        <div class="mt-5px text-12px text-gray-500">
          包名形如 BJ-BX011-P01（前缀 + 两位包序号）；前缀只能用字母/数字/下划线/短横线，长度
          2~20，保存时由服务端校验
        </div>
      </el-form-item>
      <el-form-item label="优先级" prop="priority">
        <el-input-number v-model="form.priority" :min="0" :max="999" :step="10" class="!w-160px" />
        <div class="ml-10px inline-block text-12px text-gray-500">
          数字小的先生效（缺省 50）；同一「机构 × 报表」配了多条时用它决定谁生效
        </div>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
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
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import {
  getSplitMeta,
  getSplitOrgOptions,
  getSplitReportOptions,
  type SplitMetaVO
} from '@/api/cr/split/common'
import * as RuleApi from '@/api/cr/split/rule'

defineOptions({ name: 'CrSplitRuleForm' })

const emit = defineEmits(['success'])
const message = useMessage()

/** 拆分方式取值（与字典 cr_split_mode、服务端 SPLIT_MODE 对齐），选项文案全部来自 getSplitMeta() */
const MODE_BY_ROWS = 1
const MODE_BY_FIELD = 2

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formType = ref('create')
const saving = ref(false)
const formRef = ref()
/** 与页面同源：都取 /cr/split-common 的下拉与 meta，不自己写一份枚举 */
const orgOptions = ref<any[]>([])
const reportOptions = ref<any[]>([])
const meta = ref<SplitMetaVO>({ modes: [], fields: [], maxPackages: 0 })

const form = reactive({
  id: undefined as number | undefined,
  ruleName: '',
  orgId: 0,
  reportId: 0,
  mode: MODE_BY_ROWS,
  rowsPerPackage: undefined as number | undefined,
  splitField: '',
  pkgPrefix: '',
  priority: 50,
  status: 1,
  remark: ''
})

const modeHint = computed(() => {
  if (form.mode === MODE_BY_ROWS)
    return '按行数均分：每包最多 N 行，超出顺延到下一包，包内不重新排序'
  if (form.mode === MODE_BY_FIELD)
    return '按字段值分组：按某个字段的取值拆包，适合分渠道 / 分机构交付'
  return '不拆分：整表一个包，用来对比与兜底'
})

/** 只做必填与范围校验；包名前缀的字符规则等业务校验由服务端返回中文错误 */
const rules = computed(() => {
  const base: Record<string, any> = {
    ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
    orgId: [
      { required: true, message: '请选择机构（不限机构请选「全部机构」）', trigger: 'change' }
    ],
    reportId: [
      { required: true, message: '请选择报表（不限报表请选「全部报表」）', trigger: 'change' }
    ],
    mode: [{ required: true, message: '请选择拆分方式', trigger: 'change' }],
    pkgPrefix: [{ required: true, message: '请输入包名前缀', trigger: 'blur' }]
  }
  if (form.mode === MODE_BY_ROWS) {
    base.rowsPerPackage = [
      { required: true, message: '「按行数均分」必须填写每包行数', trigger: 'change' },
      { type: 'number', min: 1, max: 5000, message: '每包行数只能是 1 ~ 5000', trigger: 'change' }
    ]
  }
  if (form.mode === MODE_BY_FIELD) {
    base.splitField = [
      { required: true, message: '「按字段值分组」必须选择拆分字段', trigger: 'change' }
    ]
  }
  return base
})

/** 切换方式时清掉另一种方式才用的字段，避免脏数据传到服务端 */
const handleModeChange = () => {
  if (form.mode !== MODE_BY_ROWS) form.rowsPerPackage = undefined
  if (form.mode !== MODE_BY_FIELD) form.splitField = ''
}

const reset = () => {
  form.id = undefined
  form.ruleName = ''
  form.orgId = 0
  form.reportId = 0
  form.mode = MODE_BY_ROWS
  form.rowsPerPackage = undefined
  form.splitField = ''
  form.pkgPrefix = ''
  form.priority = 50
  form.status = 1
  form.remark = ''
  formRef.value?.resetFields()
}

/** 打开弹窗：create 新增 / update 修改（修改时拉详情回填） */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  formType.value = type
  dialogTitle.value = type === 'create' ? '新增拆分规则' : '修改拆分规则'
  reset()
  if (!orgOptions.value.length || !reportOptions.value.length) {
    const [orgs, reports] = await Promise.all([getSplitOrgOptions(), getSplitReportOptions()])
    orgOptions.value = orgs || []
    reportOptions.value = reports || []
  }
  if (!meta.value.modes.length) {
    meta.value = (await getSplitMeta()) || meta.value
  }
  if (type === 'update' && id) {
    const data = await RuleApi.getSplitRule(id)
    Object.assign(form, data)
    // 每包行数为 0（非「按行数均分」）时留空，避免打开就是 0 让人误以为要改
    if (!Number(data.rowsPerPackage)) form.rowsPerPackage = undefined
  }
}

const submit = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (formType.value === 'create') {
      // createSplitRule 返回的是新记录的 id（不是整行），再查一次拿服务端生成的规则编码
      const id: any = await RuleApi.createSplitRule({ ...form } as any)
      const created = id ? await RuleApi.getSplitRule(Number(id)) : null
      message.success(created ? '已新增：' + created.ruleCode + ' ' + created.ruleName : '新增成功')
    } else {
      await RuleApi.updateSplitRule({ ...form } as any)
      message.success('已保存：' + form.ruleName)
    }
    dialogVisible.value = false
    emit('success')
  } catch {
    // 业务校验失败：mock 返回中文错误并自动 toast，这里保持弹窗打开让用户修改
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>
