<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="620">
    <el-form
      ref="formRef"
      v-loading="formLoading"
      :model="formData"
      :rules="formRules"
      label-width="90px"
    >
      <el-form-item label="节点名" prop="nodeName">
        <el-input v-model="formData.nodeName" placeholder="如 HX-APP-05" />
        <div class="text-12px text-[#909399] leading-18px"
          >节点名在集群内唯一，重复的会被接口拦下</div
        >
      </el-form-item>
      <el-form-item label="节点地址" prop="address">
        <el-input v-model="formData.address" placeholder="10.20.31.11:8080" />
        <div class="text-12px text-[#909399] leading-18px">
          格式为 IP:端口（IP 或主机名 + 冒号 + 2~5 位端口），接口保存时会再校验一次
        </div>
      </el-form-item>
      <el-form-item label="角色" prop="role">
        <el-select v-model="formData.role" class="w-full">
          <el-option
            v-for="dict in getStrDictOptions(DICT_TYPE.CR_CLUSTER_ROLE)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
        <div class="text-12px text-[#909399] leading-18px">
          主节点负责任务分发与调度决策，工作节点承担实际跑批
        </div>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-switch
          v-model="formData.status"
          :active-value="1"
          :inactive-value="0"
          active-text="在线"
          inactive-text="离线"
        />
        <dict-tag class="ml-10px" :type="DICT_TYPE.CR_CLUSTER_STATUS" :value="formData.status" />
        <div class="text-12px text-[#909399] leading-18px">
          离线节点不会再接收到调度，任务会分给在线的节点
        </div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="如 工作节点，承担基础数据采集"
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
import { DICT_TYPE, getStrDictOptions } from '@/utils/dict'
import { getCluster, createCluster, updateCluster, type ClusterVO } from '@/api/cr/schedule/cluster'

defineOptions({ name: 'CrScheduleClusterForm' })

const { t } = useI18n()
const message = useMessage()

interface ClusterFormModel {
  id?: number
  /** 节点名（集群内唯一） */
  nodeName: string
  /** 节点地址（IP:端口） */
  address: string
  /** 角色：master / worker，见字典 cr_cluster_role */
  role: string
  /** 状态：1 在线 / 0 离线，见字典 cr_cluster_status */
  status: number
  remark: string
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const formLoading = ref(false)
const formType = ref('')

/** 新增默认给 worker：新节点默认当 master 很容易配出第二个分发者 */
const defaultForm = (): ClusterFormModel => ({
  id: undefined,
  nodeName: '',
  address: '',
  role: 'worker',
  status: 1,
  remark: ''
})

const formData = ref<ClusterFormModel>(defaultForm())

const formRules = reactive({
  nodeName: [{ required: true, message: '节点名不能为空', trigger: 'blur' }],
  address: [
    { required: true, message: '节点地址不能为空', trigger: 'blur' },
    {
      // 空值交给 required 报错，这里只在填了内容时校验格式，避免两条规则同时弹
      validator: (rule: any, value: string, callback: any) => {
        if (!value || /^[\w.-]+:\d{2,5}$/.test(value)) return callback()
        callback(new Error('节点地址格式应为 IP:端口，如 10.20.31.11:8080'))
      },
      trigger: 'blur'
    }
  ],
  role: [{ required: true, message: '角色不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
})

const formRef = ref()

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '新增集群节点' : '修改集群节点'
  formType.value = type
  resetForm()
  if (id) {
    formLoading.value = true
    try {
      const data = await getCluster(id)
      formData.value = { ...defaultForm(), ...data }
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
  formLoading.value = true
  try {
    const payload = { ...formData.value } as ClusterVO
    if (formType.value === 'create') {
      await createCluster(payload)
      message.success(t('common.createSuccess'))
    } else {
      await updateCluster(payload)
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
