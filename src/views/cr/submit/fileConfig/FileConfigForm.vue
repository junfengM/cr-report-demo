<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="配置名称" prop="configName">
        <el-input v-model="formData.configName" placeholder="如 北京分公司月报报文配置（TXT）" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="适用机构" prop="orgId">
            <el-select
              v-model="formData.orgId"
              placeholder="请选择适用机构"
              filterable
              class="w-full"
            >
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.name"
                :value="org.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="文件类型" prop="fileType">
            <el-select v-model="formData.fileType" placeholder="请选择文件类型" class="w-full">
              <el-option
                v-for="item in FILE_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="命名规则" prop="fileNameRule">
        <el-input
          v-model="formData.fileNameRule"
          placeholder="如 HX_{orgCode}_{reportCode}_{period}.txt"
        />
      </el-form-item>
      <el-alert type="info" :closable="false" show-icon class="mb-15px">
        <template #title> 命名规则占位符（生成报文时自动替换）： </template>
        <template #default>
          <div class="rule-hint">
            <div v-for="item in FILE_RULE_PLACEHOLDERS" :key="item.name">
              <b>{{ item.name }}</b> —— {{ item.desc }}
            </div>
            <div class="mt-5px text-[#909399]">
              示例：HX_{orgCode}_{reportCode}_{period}.txt →
              HX_110000_BX001_202608.txt；文件扩展名由 「文件类型」决定，请保持与规则后缀一致。
            </div>
          </div>
        </template>
      </el-alert>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="字段分隔符" prop="fieldSeparator">
            <el-select v-model="formData.fieldSeparator" placeholder="请选择分隔符" class="w-full">
              <el-option
                v-for="item in SEPARATOR_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="字符编码" prop="charset">
            <el-select v-model="formData.charset" placeholder="请选择字符编码" class="w-full">
              <el-option v-for="item in CHARSET_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="表头行数" prop="headerRows">
            <el-input-number v-model="formData.headerRows" :min="0" :max="5" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否压缩" prop="compress">
            <el-switch
              v-model="formData.compress"
              active-text="压缩后上报"
              inactive-text="不压缩"
            />
          </el-form-item>
        </el-col>
      </el-row>
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
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 监管局前置机对编码 / 压缩的额外要求"
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
import { CommonStatusEnum } from '@/utils/constants'
import * as SubmitFileConfigApi from '@/api/cr/submit/fileConfig'
import { getOrganizationSimpleList, type OrgOptionVO } from '@/api/cr/meta/org'
import {
  CHARSET_OPTIONS,
  FILE_RULE_PLACEHOLDERS,
  FILE_TYPE_OPTIONS,
  SEPARATOR_OPTIONS
} from '../constants'

defineOptions({ name: 'SubmitFileConfigForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const orgOptions = ref<OrgOptionVO[]>([])

const defaultForm = (): SubmitFileConfigApi.SubmitFileConfigVO => ({
  id: undefined,
  configName: '',
  orgId: undefined,
  orgName: '',
  fileType: 'TXT',
  fileNameRule: 'HX_{orgCode}_{reportCode}_{period}.txt',
  fieldSeparator: '|',
  compress: false,
  charset: 'UTF-8',
  headerRows: 1,
  status: CommonStatusEnum.ENABLE,
  remark: ''
})

const formData = ref<SubmitFileConfigApi.SubmitFileConfigVO>(defaultForm())

const formRules = reactive({
  configName: [{ required: true, message: '配置名称不能为空', trigger: 'blur' }],
  orgId: [{ required: true, message: '适用机构不能为空', trigger: 'change' }],
  fileType: [{ required: true, message: '文件类型不能为空', trigger: 'change' }],
  fileNameRule: [{ required: true, message: '文件命名规则不能为空', trigger: 'blur' }],
  fieldSeparator: [{ required: true, message: '字段分隔符不能为空', trigger: 'change' }],
  charset: [{ required: true, message: '字符编码不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增报送文件配置' : '修改报送文件配置'
  formType.value = type
  resetForm()
  if (!orgOptions.value.length) {
    orgOptions.value = (await getOrganizationSimpleList()) || []
  }
  if (id) {
    formLoading.value = true
    try {
      formData.value = await SubmitFileConfigApi.getSubmitFileConfig(id)
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  // 校验不通过时直接返回，避免 el-form 的 reject 冒泡成控制台未处理异常
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  formLoading.value = true
  try {
    // 机构名称由所选机构派生，避免列表里出现空白的「适用机构」
    const org = orgOptions.value.find((item) => item.id === formData.value.orgId)
    if (!org) {
      message.warning('请选择有效的适用机构')
      return
    }
    const payload = { ...formData.value, orgName: org.name }
    if (formType.value === 'create') {
      await SubmitFileConfigApi.createSubmitFileConfig(payload)
      message.success(t('common.createSuccess'))
    } else {
      await SubmitFileConfigApi.updateSubmitFileConfig(payload)
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

<style lang="scss" scoped>
.rule-hint {
  font-size: 12px;
  line-height: 20px;
}
</style>
