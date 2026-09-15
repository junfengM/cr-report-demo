<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="数据源代码" prop="dsCode">
            <el-input
              v-model="formData.dsCode"
              placeholder="如 DS_CR_BIZ"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据源名称" prop="dsName">
            <el-input
              v-model="formData.dsName"
              placeholder="如 报送业务库"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="数据源类型" prop="dsType">
            <el-select v-model="formData.dsType" class="w-full" @change="handleDsTypeChange">
              <el-option
                v-for="item in DS_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据库类型" prop="dbType">
            <el-select v-model="formData.dbType" class="w-full">
              <el-option
                v-for="item in DB_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="连接信息" prop="connText">
        <el-input
          v-model="formData.connText"
          type="textarea"
          :rows="3"
          :placeholder="connPlaceholder"
        />
        <div class="mt-5px text-12px text-[#909399]">
          数据库填 JDBC 串、文件目录填路径与协议、接口填地址；口令与密钥只留占位（如 password=****）
        </div>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="责任人" prop="owner">
            <el-input v-model="formData.owner" placeholder="如 信息技术部" maxlength="32" />
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
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          maxlength="120"
          show-word-limit
          placeholder="如 报送主库，只读账号接入"
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
import * as DatasourceApi from '@/api/cr/report/datasource'

defineOptions({ name: 'CrReportDatasourceForm' })

const message = useMessage()
const { t } = useI18n()

const DS_TYPE_OPTIONS = [
  { value: 1, label: '数据库' },
  { value: 2, label: '文件目录' },
  { value: 3, label: '接口' }
]
const DB_TYPE_OPTIONS = [
  { value: 1, label: 'MySQL' },
  { value: 2, label: 'Oracle' },
  { value: 3, label: '达梦' },
  { value: 0, label: '不适用' }
]

interface DatasourceFormModel {
  id?: number
  dsCode: string
  dsName: string
  dsType: number
  dbType: number
  connText: string
  status: number
  owner: string
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formType = ref('create')
const formLoading = ref(false)
const formRef = ref()

const defaultForm = (): DatasourceFormModel => ({
  id: undefined,
  dsCode: '',
  dsName: '',
  dsType: 1,
  dbType: 1,
  connText: '',
  status: 1,
  owner: '信息技术部',
  remark: ''
})
const formData = ref<DatasourceFormModel>(defaultForm())

/** 只做必填提示，唯一性 / 类型合法性等服务端校验由 mock 返回中文原因并自动提示 */
const formRules = reactive({
  dsCode: [{ required: true, message: '请填写数据源代码', trigger: 'blur' }],
  dsName: [{ required: true, message: '请填写数据源名称', trigger: 'blur' }],
  dsType: [{ required: true, message: '请选择数据源类型', trigger: 'change' }],
  dbType: [{ required: true, message: '请选择数据库类型', trigger: 'change' }],
  connText: [{ required: true, message: '请填写连接信息', trigger: 'blur' }]
})

/** 连接信息按类型给不同的填写示例 */
const connPlaceholder = computed(() => {
  if (formData.value.dsType === 1) {
    return '如 jdbc:mysql://10.1.2.30:3306/cr_report?user=cr_ro&password=****'
  }
  if (formData.value.dsType === 2) {
    return '如 /data/cr/check-report（SFTP，key: CR_SFTP_PROD）'
  }
  return '如 https://api.reg-demo.gov.cn/cr/receipt（API Key: sk-****3f7c）'
})

/** 非数据库类数据源没有数据库类型，自动归到「不适用」 */
const handleDsTypeChange = () => {
  if (formData.value.dsType !== 1) {
    formData.value.dbType = 0
  } else if (formData.value.dbType === 0) {
    formData.value.dbType = 1
  }
}

const resetForm = () => {
  formData.value = defaultForm()
  formRef.value?.resetFields()
}

const fillForm = (row: DatasourceApi.ReportDatasourceVO) => {
  formData.value = {
    id: row.id,
    dsCode: row.dsCode || '',
    dsName: row.dsName || '',
    dsType: Number(row.dsType || 1),
    dbType: Number(row.dbType === undefined || row.dbType === null ? 0 : row.dbType),
    connText: row.connText || '',
    status: Number(row.status === undefined || row.status === null ? 1 : row.status),
    owner: row.owner || '',
    remark: row.remark || ''
  }
}

/** 打开弹窗：create 新增 / update 修改（第二个参数可以是行数据，也可以是 id） */
const open = async (type: string, rowOrId?: DatasourceApi.ReportDatasourceVO | number) => {
  dialogVisible.value = true
  formType.value = type
  dialogTitle.value = type === 'create' ? '新增数据源' : '修改数据源'
  resetForm()
  if (type !== 'update') return
  if (rowOrId && typeof rowOrId === 'object') {
    fillForm(rowOrId)
    return
  }
  if (!rowOrId) return
  formLoading.value = true
  try {
    fillForm(await DatasourceApi.getDetail(Number(rowOrId)))
  } catch {
    dialogVisible.value = false
  } finally {
    formLoading.value = false
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
    const payload: DatasourceApi.ReportDatasourceVO = {
      dsCode: formData.value.dsCode.trim(),
      dsName: formData.value.dsName.trim(),
      dsType: Number(formData.value.dsType),
      dbType: Number(formData.value.dbType),
      connText: formData.value.connText.trim(),
      status: Number(formData.value.status),
      owner: formData.value.owner,
      remark: formData.value.remark
    }
    if (formType.value === 'create') {
      await DatasourceApi.create(payload)
      message.success(t('common.createSuccess'))
    } else {
      await DatasourceApi.update({ ...payload, id: formData.value.id })
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    emit('success')
  } catch {
    // 服务端校验失败（代码重复 / 类型非法 / 连接信息必填）由请求拦截器提示中文原因
  } finally {
    formLoading.value = false
  }
}
</script>
