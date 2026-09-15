<template>
  <el-row :gutter="16">
    <!-- 左侧：报送机构树 -->
    <el-col :span="8">
      <ContentWrap title="报送机构树">
        <el-input v-model="filterText" placeholder="机构名称 / 编码" clearable class="mb-10px">
          <template #prefix><Icon icon="ep:search" /></template>
        </el-input>
        <el-tree
          ref="treeRef"
          v-loading="loading"
          :data="treeData"
          :props="{ label: 'orgName', children: 'children' }"
          node-key="id"
          default-expand-all
          highlight-current
          :expand-on-click-node="false"
          :filter-node-method="filterNode"
          @node-click="handleNodeClick"
        >
          <template #default="{ data }">
            <span class="flex items-center">
              <span>{{ data.orgName }}</span>
              <el-tag size="small" class="ml-5px" disable-transitions>{{ data.orgCode }}</el-tag>
              <el-tag
                v-if="data.status === 1"
                size="small"
                type="info"
                class="ml-5px"
                disable-transitions
              >
                停用
              </el-tag>
            </span>
          </template>
        </el-tree>
      </ContentWrap>
    </el-col>

    <!-- 右侧：机构详情 -->
    <el-col :span="16">
      <ContentWrap :title="panelTitle">
        <el-alert
          class="mb-10px"
          type="info"
          :closable="false"
          show-icon
          title="机构树按「总公司 → 分公司 → 中心支公司」维护；机构编码为监管口径编码，保存后立即生效。"
        />
        <el-form
          ref="formRef"
          v-loading="formLoading"
          :model="formData"
          :rules="formRules"
          label-width="110px"
        >
          <el-form-item label="上级机构" prop="parentId">
            <el-tree-select
              v-model="formData.parentId"
              :data="parentOptions"
              :props="{ label: 'orgName', children: 'children' }"
              node-key="id"
              check-strictly
              default-expand-all
              placeholder="请选择上级机构"
              class="w-full"
            />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="机构编码" prop="orgCode">
                <el-input v-model="formData.orgCode" placeholder="如 110000" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="机构名称" prop="orgName">
                <el-input v-model="formData.orgName" placeholder="如 北京分公司" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="机构层级" prop="orgLevel">
                <el-select v-model="formData.orgLevel" class="w-full" placeholder="请选择机构层级">
                  <el-option
                    v-for="dict in getIntDictOptions(DICT_TYPE.CR_ORG_LEVEL)"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="机构类型" prop="orgType">
                <el-select v-model="formData.orgType" class="w-full" placeholder="请选择机构类型">
                  <el-option
                    v-for="dict in getIntDictOptions(DICT_TYPE.CR_ORG_LEVEL)"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="所属监管局" prop="regulator">
                <el-input v-model="formData.regulator" placeholder="如 北京监管局" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="负责人" prop="leader">
                <el-input v-model="formData.leader" placeholder="请输入负责人" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="联系电话" prop="phone">
                <el-input v-model="formData.phone" placeholder="如 010-66660000" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="显示排序" prop="sort">
                <el-input-number
                  v-model="formData.sort"
                  :min="0"
                  controls-position="right"
                  class="w-full"
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
              placeholder="请输入备注"
            />
          </el-form-item>
        </el-form>
        <div class="flex justify-end">
          <el-button @click="handleAddChild" v-hasPermi="['cr:meta-org:create']">
            <Icon icon="ep:plus" class="mr-5px" /> 新增下级
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="formType !== 'update'"
            @click="handleDelete"
            v-hasPermi="['cr:meta-org:delete']"
          >
            <Icon icon="ep:delete" class="mr-5px" /> 删除
          </el-button>
          <el-button @click="handleReset">
            <Icon icon="ep:refresh" class="mr-5px" /> 重置
          </el-button>
          <el-button
            v-if="formType === 'create'"
            type="primary"
            :loading="submitLoading"
            @click="submitForm"
            v-hasPermi="['cr:meta-org:create']"
          >
            <Icon icon="ep:check" class="mr-5px" /> 保存
          </el-button>
          <el-button
            v-else
            type="primary"
            :loading="submitLoading"
            @click="submitForm"
            v-hasPermi="['cr:meta-org:update']"
          >
            <Icon icon="ep:check" class="mr-5px" /> 保存
          </el-button>
        </div>
      </ContentWrap>
    </el-col>
  </el-row>
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { CommonStatusEnum } from '@/utils/constants'
import * as OrgApi from '@/api/cr/meta/org'

defineOptions({ name: 'CrMetaOrg' })

const message = useMessage()

const loading = ref(true)
const formLoading = ref(false)
const submitLoading = ref(false)
const treeData = ref<OrgApi.OrgVO[]>([])
const treeRef = ref()
const formRef = ref()
const filterText = ref('')
/** 当前选中机构 id */
const currentId = ref<number>()
const formType = ref<'create' | 'update'>('update')

const defaultFormData = (): OrgApi.OrgVO => ({
  id: undefined,
  orgCode: '',
  orgName: '',
  parentId: 0,
  orgLevel: 1,
  orgType: 1,
  regulator: '',
  leader: '',
  phone: '',
  status: CommonStatusEnum.ENABLE,
  sort: 1,
  remark: ''
})

const formData = ref<OrgApi.OrgVO>(defaultFormData())

const formRules = reactive({
  orgCode: [{ required: true, message: '机构编码不能为空', trigger: 'blur' }],
  orgName: [{ required: true, message: '机构名称不能为空', trigger: 'blur' }],
  parentId: [{ required: true, message: '上级机构不能为空', trigger: 'change' }],
  orgLevel: [{ required: true, message: '机构层级不能为空', trigger: 'change' }],
  orgType: [{ required: true, message: '机构类型不能为空', trigger: 'change' }]
})

const panelTitle = computed(() => (formType.value === 'create' ? '新增下级机构' : '机构详情'))

/** 深度遍历查找节点 */
const findNode = (nodes: OrgApi.OrgVO[], id?: number): OrgApi.OrgVO | undefined => {
  if (!id) return undefined
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = findNode(node.children || [], id)
    if (hit) return hit
  }
  return undefined
}

/** 去掉某个节点及其子树（避免把机构挂到自己的下级） */
const pruneNode = (nodes: OrgApi.OrgVO[], id?: number): OrgApi.OrgVO[] =>
  nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: pruneNode(node.children || [], id) }))

/** 上级机构下拉：顶级哨兵 + 机构树（编辑时排除自身及下级） */
const parentOptions = computed(() => {
  const nodes =
    formType.value === 'update' ? pruneNode(treeData.value, formData.value.id) : treeData.value
  return [{ id: 0, orgName: '顶级机构（无上级）', children: nodes } as OrgApi.OrgVO]
})

watch(filterText, (value) => {
  treeRef.value?.filter(value)
})

const filterNode = (value: string, data: OrgApi.OrgVO) => {
  if (!value) return true
  const keyword = value.trim().toLowerCase()
  return (
    String(data.orgName || '')
      .toLowerCase()
      .includes(keyword) ||
    String(data.orgCode || '')
      .toLowerCase()
      .includes(keyword)
  )
}

/** 加载机构树（可指定选中节点） */
const getTree = async (selectId?: number) => {
  loading.value = true
  try {
    treeData.value = (await OrgApi.getOrganizationTree()) || []
    await nextTick()
    const targetId = selectId ?? currentId.value ?? treeData.value[0]?.id
    const target = findNode(treeData.value, targetId)
    if (target) {
      treeRef.value?.setCurrentKey(target.id)
      await handleNodeClick(target)
    } else {
      formType.value = 'update'
      formData.value = defaultFormData()
    }
  } finally {
    loading.value = false
  }
}

/** 查询机构详情 */
const handleNodeClick = async (node: OrgApi.OrgVO) => {
  currentId.value = node.id
  formType.value = 'update'
  formLoading.value = true
  try {
    const data = await OrgApi.getOrganization(node.id!)
    formData.value = { ...defaultFormData(), ...data }
  } finally {
    formLoading.value = false
  }
}

/** 新增下级：以当前机构为上级 */
const handleAddChild = () => {
  const parent = findNode(treeData.value, currentId.value)
  formType.value = 'create'
  formData.value = {
    ...defaultFormData(),
    parentId: parent?.id ?? 0,
    orgLevel: Math.min((parent?.orgLevel ?? 0) + 1, 3),
    orgType: Math.min((parent?.orgType ?? 0) + 1, 3),
    regulator: parent?.regulator || '',
    sort: (parent?.children?.length ?? 0) + 1
  }
}

/** 重置：重新拉取当前机构数据 */
const handleReset = async () => {
  if (formType.value === 'create') {
    const target = findNode(treeData.value, currentId.value)
    if (target) {
      await handleNodeClick(target)
    } else {
      formType.value = 'update'
      formData.value = defaultFormData()
    }
    return
  }
  const target = findNode(treeData.value, formData.value.id)
  if (target) await handleNodeClick(target)
}

/** 保存（新增下级 / 修改） */
const submitForm = async () => {
  await formRef.value.validate()
  submitLoading.value = true
  try {
    if (formType.value === 'create') {
      const id = await OrgApi.createOrganization(formData.value)
      message.success('新增成功')
      currentId.value = Number(id)
      await getTree(Number(id))
    } else {
      await OrgApi.updateOrganization(formData.value)
      message.success('保存成功')
      await getTree(formData.value.id)
    }
  } finally {
    submitLoading.value = false
  }
}

/** 删除当前机构（有下级时不允许删除） */
const handleDelete = async () => {
  const node = findNode(treeData.value, formData.value.id)
  if (!node) return
  if (node.children?.length) {
    message.error('该机构下存在下级机构，请先删除下级机构')
    return
  }
  try {
    await message.delConfirm()
    await OrgApi.deleteOrganization(node.id!)
    message.success('删除成功')
    currentId.value = undefined
    await getTree()
  } catch {}
}

onMounted(() => {
  getTree()
})
</script>
