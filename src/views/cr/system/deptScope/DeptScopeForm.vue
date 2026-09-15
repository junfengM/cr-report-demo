<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="720">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-form-item label="部门" prop="deptId">
        <el-tree-select
          v-model="formData.deptId"
          :data="deptTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          check-strictly
          clearable
          filterable
          :render-after-expand="false"
          placeholder="请选择部门（规则对该部门及其全部下级部门生效）"
          class="w-full"
        />
      </el-form-item>
      <el-form-item label="报表范围" prop="reportId">
        <el-select
          v-model="formData.reportId"
          placeholder="不选表示全部报表"
          clearable
          filterable
          class="w-full"
        >
          <el-option label="全部报表" :value="0" />
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="允许动作" prop="actions">
        <el-checkbox-group v-model="formData.actions">
          <el-checkbox v-for="action in actionOptions" :key="action.value" :value="action.value">
            {{ action.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="优先级" prop="priority">
            <el-input-number
              v-model="formData.priority"
              :min="0"
              :max="999"
              controls-position="right"
              class="w-full"
            />
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
          placeholder="如 该部门只允许填报与批量提交，复核 / 审核由总公司承担"
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
import { handleTree } from '@/utils/tree'
import * as DeptScopeApi from '@/api/cr/system/deptScope'
import {
  getDeptOptions,
  getPermissionMeta,
  type DeptOptionVO,
  type PermissionMetaVO
} from '@/api/cr/system/common'
import { getCollectReportOptions, type CollectReportOptionVO } from '@/api/cr/collect/common'

defineOptions({ name: 'CrSystemDeptScopeForm' })

const { t } = useI18n()
const message = useMessage()

/** 部门树节点：接口给的是扁平数组（id / name / parentId），页面按 parentId 组树 */
type DeptTreeNode = DeptOptionVO & { children?: DeptTreeNode[] }

/** 表单模型：报表范围留空 = 全部报表，提交前统一兜底为 0（0 = 全部报表） */
interface DeptScopeFormModel {
  id?: number
  deptId?: number
  reportId?: number
  actions: string[]
  priority: number
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')
const deptTree = ref<DeptTreeNode[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
/** 允许动作的选项与中文名都取自服务端（getPermissionMeta().actions） */
const actionOptions = ref<PermissionMetaVO['actions']>([])

const defaultForm = (): DeptScopeFormModel => ({
  id: undefined,
  deptId: undefined,
  reportId: 0,
  actions: [],
  // 缺省 50：优先级数字小的先生效，与数据权限页的缺省口径一致
  priority: 50,
  status: 1,
  remark: ''
})

const formData = ref<DeptScopeFormModel>(defaultForm())

const formRules = reactive({
  deptId: [{ required: true, message: '部门不能为空', trigger: 'change' }],
  // type 用 array：空数组要按「一个都没勾」处理（默认的 required 不认空数组）
  actions: [
    { type: 'array', required: true, message: '至少勾选一个允许的动作', trigger: 'change' }
  ],
  priority: [{ required: true, message: '优先级不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增部门权限规则' : '修改部门权限规则'
  formType.value = type
  resetForm()
  // 部门树 / 动作清单 / 报表下拉一次取全，弹窗里只做选择
  if (!deptTree.value.length) deptTree.value = handleTree((await getDeptOptions()) || [])
  if (!actionOptions.value.length) actionOptions.value = (await getPermissionMeta())?.actions || []
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
  if (id) {
    formLoading.value = true
    try {
      const detail = await DeptScopeApi.getDeptScope(id)
      formData.value = {
        id: detail.id,
        deptId: detail.deptId,
        reportId: detail.reportId,
        actions: [...(detail.actions || [])],
        priority: detail.priority ?? 50,
        status: detail.status ?? 1,
        remark: detail.remark || ''
      }
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
  if (!formData.value.actions.length) {
    message.warning('至少勾选一个允许的动作')
    return
  }
  formLoading.value = true
  try {
    const payload: DeptScopeApi.DeptScopeVO = {
      ...formData.value,
      deptId: formData.value.deptId as number,
      reportId: formData.value.reportId || 0,
      actions: [...formData.value.actions]
    }
    if (formType.value === 'create') {
      await DeptScopeApi.createDeptScope(payload)
      message.success(t('common.createSuccess'))
    } else {
      await DeptScopeApi.updateDeptScope(payload)
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
