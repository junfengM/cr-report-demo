<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="780">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="接入系统" prop="sysCode">
            <el-select
              v-model="formData.sysCode"
              placeholder="请选择接入系统"
              filterable
              class="w-full"
            >
              <el-option
                v-for="item in systemOptions"
                :key="item.sysCode"
                :label="item.sysName + '（' + item.sysCode + '）'"
                :value="item.sysCode"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="优先级" prop="priority">
            <el-input-number
              v-model="formData.priority"
              :min="0"
              :max="999"
              :step="1"
              controls-position="right"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="接口范围" prop="apiScope">
        <el-input
          v-model="formData.apiScope"
          placeholder="如 /cr/collect-import/*（通配越少越精确，精确的先生效）"
        />
      </el-form-item>
      <el-form-item label="机构范围" prop="orgIds">
        <el-select
          v-model="formData.orgIds"
          placeholder="不选表示全部机构"
          multiple
          collapse-tags
          collapse-tags-tooltip
          filterable
          class="w-full"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="报表范围" prop="reportIds">
        <el-select
          v-model="formData.reportIds"
          placeholder="不选表示全部报表"
          multiple
          collapse-tags
          collapse-tags-tooltip
          filterable
          class="w-full"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
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
          placeholder="如 银保通只能往两家分公司的保费收入统计表推数据"
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
import * as IntegrationAuthApi from '@/api/cr/integration/auth'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'

defineOptions({ name: 'CrIntegrationAuthForm' })

/** 接入系统下拉由列表页拉好后传入，避免每开一次弹窗重复请求 */
const props = defineProps<{ systemOptions?: any[] }>()

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const formRef = ref()

/** 机构 / 报表下拉：用数据采集域的公共下拉（与接入权限的服务端校验同一份机构表、报表表） */
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])

const defaultForm = (): IntegrationAuthApi.IntegrationAuthVO => ({
  id: undefined,
  sysCode: '',
  sysName: '',
  apiScope: '',
  orgIds: [],
  reportIds: [],
  priority: 50,
  status: 1,
  remark: ''
})

const formData = ref<IntegrationAuthApi.IntegrationAuthVO>(defaultForm())

const formRules = reactive({
  sysCode: [{ required: true, message: '请选择接入系统', trigger: 'change' }],
  apiScope: [{ required: true, message: '接口范围不能为空', trigger: 'blur' }],
  priority: [{ required: true, message: '优先级不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

/** 打开弹窗：下拉只取一次，后续打开复用 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增接入权限' : '修改接入权限'
  formType.value = type
  resetForm()
  if (!orgOptions.value.length) orgOptions.value = (await getCollectOrgOptions()) || []
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
  if (id) {
    formLoading.value = true
    try {
      const detail = await IntegrationAuthApi.getDetail(id)
      formData.value = {
        ...defaultForm(),
        ...detail,
        orgIds: Array.isArray(detail?.orgIds) ? detail.orgIds : [],
        reportIds: Array.isArray(detail?.reportIds) ? detail.reportIds : []
      }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open })

/** 提交：服务端中文校验原因（系统必须存在 / 接口范围必填 / 优先级 0~999 / 机构报表必须存在）由拦截器提示 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  const priority = Number(formData.value.priority)
  if (!Number.isInteger(priority) || priority < 0 || priority > 999) {
    message.warning('优先级必须是 0~999 之间的整数（数字小的先生效）')
    return
  }
  formLoading.value = true
  try {
    const payload: IntegrationAuthApi.IntegrationAuthVO = {
      ...formData.value,
      priority,
      orgIds: formData.value.orgIds || [],
      reportIds: formData.value.reportIds || []
    }
    if (formType.value === 'create') {
      await IntegrationAuthApi.create(payload)
      message.success(t('common.createSuccess'))
    } else {
      await IntegrationAuthApi.update(payload)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } catch {
    // 服务端中文原因已由 axios 拦截器统一提示
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
