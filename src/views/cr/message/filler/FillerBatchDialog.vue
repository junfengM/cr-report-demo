<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="mb-10px"
      title="批量分配按「机构 × 报表范围」逐条建立指派：报表范围留空表示机构级默认指派（该机构全部报表）。"
    />
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="报送机构" prop="orgIds">
        <el-select
          v-model="formData.orgIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择报送机构（可多选）"
          class="w-full"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
        <el-button link type="primary" class="mt-5px" @click="handleSelectAllOrgs">
          全部选中 / 取消全选
        </el-button>
      </el-form-item>
      <el-form-item label="报表范围" prop="reportIds">
        <el-select
          v-model="formData.reportIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="留空 = 该机构全部报表"
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
          <el-form-item label="填报人" prop="fillerId">
            <el-select
              v-model="formData.fillerId"
              placeholder="请选择填报人"
              filterable
              class="w-full"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="user.nickname"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="复核人" prop="reviewerId">
            <el-select
              v-model="formData.reviewerId"
              placeholder="请选择复核人"
              filterable
              clearable
              class="w-full"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="user.nickname"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="生效日期" prop="effectiveDate">
            <el-date-picker
              v-model="formData.effectiveDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择生效日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="失效日期" prop="expireDate">
            <el-date-picker
              v-model="formData.expireDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择失效日期"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="覆盖已有" prop="overwrite">
        <el-switch v-model="formData.overwrite" active-text="覆盖" inactive-text="跳过冲突" />
        <span class="ml-10px text-[12px] text-[#909399]">
          关闭时，已存在的「机构 + 报表」指派会被跳过并计入冲突
        </span>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 2026 年度人力条线调整"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">执行分配</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as FillerApi from '@/api/cr/message/filler'
import {
  getOrgOptions,
  getReportOptions,
  type MessageOrgOptionVO,
  type MessageReportOptionVO
} from '@/api/cr/message/common'
import { getSimpleUserList, type UserVO } from '@/api/system/user'

defineOptions({ name: 'CrMessageFillerBatchDialog' })

const message = useMessage()
const dialogVisible = ref(false)
const dialogTitle = ref('批量分配填报人')
const formLoading = ref(false)
const orgOptions = ref<MessageOrgOptionVO[]>([])
const reportOptions = ref<MessageReportOptionVO[]>([])
const users = ref<UserVO[]>([])

const defaultForm = (): FillerApi.FillerBatchVO => ({
  orgIds: [],
  reportIds: [],
  freq: 0,
  fillerId: undefined,
  reviewerId: undefined,
  effectiveDate: '2026-09-01',
  expireDate: '2026-12-31',
  overwrite: false,
  remark: '批量分配'
})

const formData = ref<FillerApi.FillerBatchVO>(defaultForm())

const formRules = reactive({
  orgIds: [{ required: true, message: '请至少选择一个报送机构', trigger: 'change' }],
  fillerId: [{ required: true, message: '填报人不能为空', trigger: 'change' }],
  effectiveDate: [{ required: true, message: '生效日期不能为空', trigger: 'change' }]
})

const formRef = ref()

const handleSelectAllOrgs = () => {
  formData.value.orgIds =
    formData.value.orgIds.length === orgOptions.value.length
      ? []
      : orgOptions.value.map((org) => org.id)
}

/** 打开弹窗 */
const open = async () => {
  dialogVisible.value = true
  formData.value = defaultForm()
  formRef.value?.resetFields()
  if (!orgOptions.value.length) orgOptions.value = (await getOrgOptions()) || []
  if (!reportOptions.value.length) reportOptions.value = (await getReportOptions()) || []
  if (!users.value.length) users.value = (await getSimpleUserList()) || []
}
defineExpose({ open })

/** 执行分配 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (formData.value.fillerId && formData.value.fillerId === formData.value.reviewerId) {
    message.warning('填报人与复核人不能为同一人')
    return
  }
  formLoading.value = true
  try {
    const result = await FillerApi.batchFillerAssign(formData.value)
    message.success(
      '批量分配完成：新增 ' +
        result.created +
        ' 条，覆盖 ' +
        result.updated +
        ' 条，冲突跳过 ' +
        result.conflictCount +
        ' 条'
    )
    if (result.conflictCount) {
      message.warning('已跳过的冲突指派：' + result.conflicts.join('；') + ' 等')
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
