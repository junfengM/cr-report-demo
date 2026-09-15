<template>
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" append-to-body>
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="110px">
      <el-form-item label="报送机构" prop="orgId">
        <el-select
          v-model="formData.orgId"
          filterable
          placeholder="请选择报送机构"
          class="!w-100%"
          @change="handleOrgChange"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="监管报表" prop="reportId">
        <el-select
          v-model="formData.reportId"
          filterable
          placeholder="请选择报表"
          class="!w-100%"
          @change="handleReportChange"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报送期次" prop="period">
        <el-select v-model="formData.period" placeholder="请选择期次" class="!w-240px">
          <el-option
            v-for="item in periodOptions"
            :key="item.period"
            :label="item.period + ' ' + item.periodName"
            :value="item.period"
          />
        </el-select>
        <span
          v-if="selectedPeriod && !selectedPeriod.allowSupplement"
          class="ml-10px text-12px text-[var(--el-color-danger)]"
        >
          该期次未开放补录，执行补录时会被拦截
        </span>
      </el-form-item>
      <el-form-item label="补录范围" prop="scopeType">
        <el-radio-group v-model="formData.scopeType">
          <el-radio :value="1">整表补录（重新导入 / 重填全表）</el-radio>
          <el-radio :value="2">指定行补录</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="补录行数" prop="rowCount">
        <el-input-number v-model="formData.rowCount" :min="1" :max="99999" class="!w-180px" />
        <span class="ml-10px text-12px text-gray-500">预计需要补录的数据行数</span>
      </el-form-item>
      <el-form-item label="补录原因" prop="reason">
        <el-input
          v-model="formData.reason"
          type="textarea"
          :rows="3"
          placeholder="写清漏报 / 错报的原因与影响范围，审核人据此判断是否放行"
        />
      </el-form-item>
      <el-form-item label="申请人" prop="applyUser">
        <el-input v-model="formData.applyUser" class="!w-240px" />
      </el-form-item>
      <el-form-item label="附件" prop="attachment">
        <el-input
          v-model="formData.attachment"
          placeholder="情况说明材料名称，如 银保通漏报情况说明.pdf"
        />
      </el-form-item>
      <el-form-item label="附件文件">
        <div class="w-full">
          <template v-if="supplementId">
            <el-button
              type="primary"
              plain
              @click="openFileDialog"
              v-hasPermi="['cr:collect-supplement:query']"
            >
              <Icon icon="ep:paperclip" class="mr-5px" /> 管理附件{{
                fileCount === null ? '' : '（' + fileCount + '）'
              }}
            </el-button>
            <span class="ml-10px text-12px text-gray-500">
              可以在这里上传真实文件（≤ 1MB，最多 3 个），支持预览 / 下载 / 删除
            </span>
          </template>
          <template v-else>
            <el-button
              type="primary"
              plain
              :disabled="formLoading"
              @click="submitForm(true)"
              v-hasPermi="['cr:collect-supplement:upload-file']"
            >
              <Icon icon="ep:upload" class="mr-5px" /> 保存并上传附件
            </el-button>
            <span class="ml-10px text-12px text-gray-500">
              附件上传需要先有一个申请单号：先保存本申请，保存成功后会自动切到附件管理
            </span>
          </template>
        </div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="其它需要说明的信息"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" :loading="formLoading" @click="submitForm()">确 定</el-button>
    </template>
  </el-dialog>

  <!-- 附件管理：申请保存之后才有 id，新建时先保存再上传 -->
  <SupplementFileDialog ref="fileDialogRef" @file-count="handleFileCount" />
</template>

<script lang="ts" setup>
import * as SupplementApi from '@/api/cr/collect/supplement'
import {
  getCollectOrgOptions,
  getCollectPeriodOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectPeriodOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
import { useUserStore } from '@/store/modules/user'
import SupplementFileDialog from './SupplementFileDialog.vue'

defineOptions({ name: 'SupplementForm' })

const { t } = useI18n()
const message = useMessage()
const userStore = useUserStore()

const fileDialogRef = ref()
/** 当前表单对应的申请 id：新增时为空，保存成功后由服务端返回，再解锁附件区 */
const supplementId = ref<number | undefined>(undefined)
/** 已知的附件个数（null = 还没查过，不显示数量） */
const fileCount = ref<number | null>(null)

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const periodOptions = ref<CollectPeriodOptionVO[]>([])

const emptyForm = (): SupplementApi.SupplementVO => ({
  orgId: 0,
  orgName: '',
  reportId: 0,
  reportCode: '',
  reportName: '',
  period: '',
  scopeType: 2,
  rowCount: 1,
  reason: '',
  applyUser: userStore.getUser?.nickname || '系统管理员',
  status: 1,
  attachment: '',
  remark: ''
})
const formData = ref<SupplementApi.SupplementVO>(emptyForm())
const formRules = reactive({
  orgId: [{ required: true, message: '请选择报送机构', trigger: 'change' }],
  reportId: [{ required: true, message: '请选择报表', trigger: 'change' }],
  period: [{ required: true, message: '请选择期次', trigger: 'change' }],
  rowCount: [{ required: true, message: '请填写补录行数', trigger: 'blur' }],
  reason: [{ required: true, message: '请填写补录原因', trigger: 'blur' }],
  applyUser: [{ required: true, message: '请填写申请人', trigger: 'blur' }]
})
const formRef = ref()

const selectedPeriod = computed(() =>
  periodOptions.value.find((item) => item.period === formData.value.period)
)

const handleOrgChange = (orgId: number) => {
  formData.value.orgName = orgOptions.value.find((org) => org.id === orgId)?.orgName || ''
}

const handleReportChange = (reportId: number) => {
  const report = reportOptions.value.find((item) => item.id === reportId)
  formData.value.reportCode = report?.reportCode || ''
  formData.value.reportName = report?.reportName || ''
}

const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增补录申请' : '修改补录申请'
  formType.value = type
  formData.value = emptyForm()
  supplementId.value = id
  fileCount.value = null
  if (!orgOptions.value.length) {
    orgOptions.value = (await getCollectOrgOptions()) || []
    reportOptions.value = (await getCollectReportOptions()) || []
    periodOptions.value = (await getCollectPeriodOptions()) || []
  }
  if (id) {
    formData.value = { ...(await SupplementApi.getSupplement(id)) }
  }
  await nextTick()
  formRef.value.clearValidate()
}
defineExpose({ open })

const emit = defineEmits(['success'])

/** 附件弹窗：只对已保存的申请开放 */
const openFileDialog = () => {
  if (!supplementId.value) {
    message.warning('请先保存补录申请，拿到申请单号后再上传附件')
    return
  }
  fileDialogRef.value?.open(
    supplementId.value,
    formData.value.applyNo,
    formData.value.status === 1 || formData.value.status === 3
  )
}

const handleFileCount = (payload: { supplementId: number; count: number }) => {
  if (payload.supplementId === supplementId.value) fileCount.value = payload.count
}

/**
 * 保存申请。
 * withFile=true 时是「保存并上传附件」：保存成功后不关弹窗，切到附件管理继续上传
 * —— 新建时服务端才会返回真实 id，所以不能凭空造一个 id 去传附件。
 */
const submitForm = async (withFile = false) => {
  await formRef.value.validate()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      // create 接口返回的是新记录 id（脚手架 registerResource 的约定），
      // 再用 id 回查一次拿到服务端生成的申请单号，供附件弹窗标题使用。
      const newId: any = await SupplementApi.createSupplement(formData.value)
      if (newId) {
        supplementId.value = Number(newId)
        formType.value = 'update'
        dialogTitle.value = '修改补录申请'
        try {
          formData.value = { ...(await SupplementApi.getSupplement(supplementId.value!)) }
        } catch {}
      }
      message.success('申请已创建，可继续上传附件')
    } else {
      await SupplementApi.updateSupplement(formData.value)
      message.success(t('common.updateSuccess'))
    }
    emit('success')
    if (withFile && supplementId.value) {
      await openFileDialog()
      return
    }
    dialogVisible.value = false
  } finally {
    formLoading.value = false
  }
}
</script>
