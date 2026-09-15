<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="760">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="机构" prop="orgId">
            <el-select
              v-model="formData.orgId"
              placeholder="请选择机构"
              filterable
              class="w-full"
              @change="handleOrgChange"
            >
              <el-option
                v-for="org in orgOptions"
                :key="org.id"
                :label="org.orgName"
                :value="org.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="报表" prop="reportId">
            <el-select
              v-model="formData.reportId"
              placeholder="请选择报表"
              filterable
              class="w-full"
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
        </el-col>
      </el-row>
      <el-form-item label="采集方式" prop="channelType">
        <el-radio-group v-model="formData.channelType">
          <el-radio
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_COLLECT_CHANNEL)"
            :key="dict.value"
            :value="dict.value"
          >
            {{ dict.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="源系统" prop="dataSource">
            <el-input v-model="formData.dataSource" placeholder="如 核心业务系统 / 银保通系统" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="协议" prop="protocol">
            <!-- 允许自定义：对接方偶尔用约定外的协议，下拉里没有时直接输入 -->
            <el-select
              v-model="formData.protocol"
              placeholder="请选择或输入协议"
              filterable
              allow-create
              default-first-option
              class="w-full"
            >
              <el-option v-for="item in PROTOCOL_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="采集地址" prop="endpoint">
        <el-input
          v-model="formData.endpoint"
          placeholder="接口 URL / FTP 目录 / 库表连接串，如 jdbc:oracle:thin:@10.1.9.11:1521/CRDB"
        />
      </el-form-item>
      <el-form-item label="调度周期" prop="cronText">
        <el-input
          v-model="formData.cronText"
          placeholder="如 每月 1 日 02:00 全量抽取；人工上传可填 每月 3 日前人工上传"
        />
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
        <el-col :span="12">
          <el-form-item label="责任人" prop="owner">
            <el-select
              v-model="formData.owner"
              placeholder="请选择责任人"
              filterable
              clearable
              class="w-full"
            >
              <el-option
                v-for="user in userOptions"
                :key="user.id"
                :label="user.nickname"
                :value="user.nickname"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 总公司统一抽取后下发分公司"
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
import * as ChannelApi from '@/api/cr/collect/channel'
import {
  getCollectOrgOptions,
  getCollectReportOptions,
  getCollectUserOptions,
  type CollectOrgOptionVO,
  type CollectReportOptionVO,
  type CollectUserOptionVO
} from '@/api/cr/collect/common'

defineOptions({ name: 'CrCollectChannelForm' })

const { t } = useI18n()
const message = useMessage()

/** 采集地址常用的几种协议，允许自定义输入 */
const PROTOCOL_OPTIONS = ['DB-LINK', 'SFTP', 'HTTPS', 'FTP']

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const userOptions = ref<CollectUserOptionVO[]>([])

const defaultForm = (): ChannelApi.CollectChannelVO => ({
  id: undefined,
  orgId: undefined as unknown as number,
  orgName: '',
  reportId: undefined as unknown as number,
  reportCode: '',
  reportName: '',
  channelType: 1,
  dataSource: '',
  endpoint: '',
  // 默认按「系统直连 + DB-LINK」预填，多数配置就是库表直连抽取
  protocol: 'DB-LINK',
  cronText: '',
  lastCollectTime: '',
  lastStatus: 0,
  lastMessage: '',
  // 字典 cr_enable_status：1 启用 / 0 停用（与脚手架 COMMON_STATUS 的取值相反，不要用 CommonStatusEnum）
  status: 1,
  owner: '',
  remark: ''
})

const formData = ref<ChannelApi.CollectChannelVO>(defaultForm())

const formRules = reactive({
  orgId: [{ required: true, message: '机构不能为空', trigger: 'change' }],
  reportId: [{ required: true, message: '报表不能为空', trigger: 'change' }],
  channelType: [{ required: true, message: '采集方式不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 机构 / 报表下拉只存 id，名称要一并冗余进配置，列表与导出才不用回查 */
const handleOrgChange = (orgId: number) => {
  const org = orgOptions.value.find((item) => item.id === orgId)
  formData.value.orgName = org ? org.orgName : ''
}

const handleReportChange = (reportId: number) => {
  const report = reportOptions.value.find((item) => item.id === reportId)
  if (!report) return
  formData.value.reportCode = report.reportCode
  formData.value.reportName = report.reportName
}

/** 历史责任人可能已不在用户下拉里，补一条兜底项，避免编辑时下拉显示空白 */
const ensureOwnerOption = () => {
  const owner = formData.value.owner
  if (owner && !userOptions.value.some((user) => user.nickname === owner)) {
    userOptions.value.push({ id: 0, nickname: owner, deptId: 0 })
  }
}

const loadOptions = async () => {
  if (!orgOptions.value.length) orgOptions.value = (await getCollectOrgOptions()) || []
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
  if (!userOptions.value.length) userOptions.value = (await getCollectUserOptions()) || []
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增采集方式' : '修改采集方式'
  formType.value = type
  resetForm()
  await loadOptions()
  if (id) {
    formLoading.value = true
    try {
      formData.value = await ChannelApi.getChannel(id)
      ensureOwnerOption()
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
  // 下拉只校验了 id，名称缺失说明拿到了无效选项，宁可拦住也不要写入半条配置
  if (!formData.value.orgName || !formData.value.reportName) {
    message.warning('请选择有效的机构与报表')
    return
  }
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await ChannelApi.createChannel(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await ChannelApi.updateChannel(formData.value)
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
