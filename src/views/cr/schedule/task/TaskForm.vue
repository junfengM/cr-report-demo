<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="680">
    <el-alert
      class="mb-15px"
      type="info"
      :closable="false"
      show-icon
      title="任务编码是跑批日志的关联键，创建后不可修改；执行顺序按「优先级 → 任务编号」，前置任务不在本弹窗维护，请在列表操作列的「前置任务」里配置（接口会拦下自我依赖与循环依赖）。"
    />
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属分组" prop="groupId">
            <el-select v-model="formData.groupId" placeholder="请选择所属分组" class="w-full">
              <el-option
                v-for="group in groups"
                :key="group.id"
                :label="group.groupName"
                :value="group.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="优先级" prop="priority">
            <!-- 优先级/实现类型的中文名由服务端 meta 给，页面不写第二套（数字小的先跑） -->
            <el-select v-model="formData.priority" placeholder="请选择优先级" class="w-full">
              <el-option
                v-for="item in meta.priorities"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="任务编码" prop="code">
        <!-- 编码是跑批日志的关联键：改名可以，改编码会让历史日志对不上任务，所以修改时锁住 -->
        <el-input
          v-model="formData.code"
          :disabled="formType === 'update'"
          placeholder="如 PKG_HX_BASE_POLICY"
        />
        <div class="text-12px text-[#909399] leading-18px">
          大写字母、数字与下划线，创建后不可修改
        </div>
      </el-form-item>
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="formData.name" placeholder="如 保单基础信息采集" />
        <div class="text-12px text-[#909399] leading-18px">
          中文名会同步显示在跑批日志里，建议与存储过程业务含义一致
        </div>
      </el-form-item>
      <el-form-item label="实现类型" prop="implType">
        <el-select v-model="formData.implType" placeholder="请选择实现类型" class="w-full">
          <el-option
            v-for="item in meta.implTypes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="实现方法" prop="implMethod">
        <el-input
          v-model="formData.implMethod"
          type="textarea"
          :rows="2"
          :placeholder="implMethodPlaceholder"
        />
        <div class="text-12px text-[#909399] leading-18px">
          选择了存储过程时，需在名称前加上所属用户，如 HXUSER.PKG_HX_BASE_POLICY
        </div>
      </el-form-item>
      <el-form-item label="任务描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="如 从核心业务库抽取保单主表与险种明细，供后续所有监管报表使用"
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
import {
  getCollectTask,
  createCollectTask,
  updateCollectTask,
  getCollectTaskGroupTree,
  getCollectTaskMeta,
  type CollectTaskVO,
  type CollectTaskGroupVO
} from '@/api/cr/schedule/task'

defineOptions({ name: 'CrScheduleTaskForm' })

const { t } = useI18n()
const message = useMessage()

interface CollectTaskFormModel {
  id?: number
  groupId?: number
  code: string
  name: string
  /** 1 高 / 2 中 / 3 低，数字小的先跑 */
  priority: number
  /** 1 存储过程 / 2 Shell 脚本 / 3 SQL 语句 / 4 Java 类，见字典 cr_task_impl_type */
  implType: number
  implMethod: string
  description: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')

const defaultForm = (): CollectTaskFormModel => ({
  id: undefined,
  groupId: undefined,
  code: '',
  name: '',
  priority: 2,
  implType: 1,
  implMethod: '',
  description: ''
})

const formData = ref<CollectTaskFormModel>(defaultForm())

const formRules = reactive({
  groupId: [{ required: true, message: '所属分组不能为空', trigger: 'change' }],
  priority: [{ required: true, message: '优先级不能为空', trigger: 'change' }],
  implType: [{ required: true, message: '实现类型不能为空', trigger: 'change' }],
  code: [
    { required: true, message: '任务编码不能为空', trigger: 'blur' },
    {
      // 空值交给 required 报错，这里只在填了内容时校验格式，避免两条规则同时弹
      validator: (rule: any, value: string, callback: any) => {
        if (!value || /^[A-Z][A-Z0-9_]*$/.test(value)) return callback()
        callback(new Error('任务编码只能用大写字母、数字与下划线，且以字母开头'))
      },
      trigger: 'blur'
    }
  ],
  name: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
  implMethod: [{ required: true, message: '实现方法不能为空', trigger: 'blur' }]
})

const formRef = ref()

/** 实现方法的填写形态随实现类型变：存储过程必须带所属用户，否则跑批会找不到对象 */
const implMethodPlaceholder = computed(() => {
  if (Number(formData.value.implType) === 1) return '如 HXUSER.PKG_HX_BASE_POLICY'
  if (Number(formData.value.implType) === 2) return '如 /opt/hx/collect/export_check.sh'
  if (Number(formData.value.implType) === 3) {
    return '如 SELECT * FROM HXUSER.V_FIN_PAYMENT WHERE DATA_DATE = :dataDate'
  }
  return '如 com.hx.collect.ArchiveJob'
})

/** 分组下拉（任务必须挂在已有分组下）与 meta 选项每次都重新拉：分组可以新增，缓存会选到过期数据 */
const groups = ref<CollectTaskGroupVO[]>([])
const meta = ref<{
  implTypes: { value: number; label: string }[]
  priorities: { value: number; label: string }[]
}>({ implTypes: [], priorities: [] })

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增采集任务' : '修改采集任务'
  formType.value = type
  resetForm()
  formLoading.value = true
  try {
    const [groupList, metaData] = await Promise.all([
      getCollectTaskGroupTree(),
      getCollectTaskMeta()
    ])
    groups.value = groupList || []
    meta.value = { implTypes: metaData?.implTypes || [], priorities: metaData?.priorities || [] }
    if (id) {
      const data = await getCollectTask(id)
      formData.value = { ...defaultForm(), ...data }
    }
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
    const payload = { ...formData.value } as CollectTaskVO
    if (formType.value === 'create') {
      await createCollectTask(payload)
      message.success(t('common.createSuccess'))
    } else {
      await updateCollectTask(payload)
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
