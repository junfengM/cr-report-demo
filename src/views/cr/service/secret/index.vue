<template>
  <ContentWrap title="密钥管理">
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="密钥用于服务主机认证与监管接口签名：页面只展示指纹与有效期，密钥明文永不落库、永不下发，编辑时也不会回填。新建、修改、启用、停用、删除、轮换都会留痕（谁、什么时候、指纹变成什么）；停用状态的密钥不允许轮换。指纹由 Demo 用的轻量哈希（FNV32）生成，只为演示轮换与比对，不是真实摘要。"
    />

    <!-- 即将过期（含已过期）提示区：负数按「已过期」显示，不展示裸负数 -->
    <div v-loading="expiringLoading" class="mb-10px">
      <el-alert
        v-if="expiringList.length > 0"
        :type="expiredCount > 0 ? 'error' : 'warning'"
        :closable="false"
        show-icon
      >
        <template #title>
          <span>
            密钥到期提醒（{{ expiringDays }} 天内）：
            <b v-if="expiredCount > 0" class="text-red-500">已过期 {{ expiredCount }} 个</b>
            <span v-if="expiredCount > 0 && soonCount > 0">，</span>
            <span v-if="soonCount > 0">即将到期 {{ soonCount }} 个</span>
          </span>
        </template>
        <div class="mt-5px">
          <el-tag
            v-for="item in expiringList"
            :key="item.id"
            :type="expireTagType(item.daysLeft)"
            size="small"
            class="mr-5px mb-5px cursor-pointer"
            @click="fillKeyword(item)"
          >
            {{ item.secretName }} ·
            {{
              item.daysLeft < 0
                ? '已过期 ' + Math.abs(item.daysLeft) + ' 天'
                : '剩余 ' + item.daysLeft + ' 天'
            }}
            （{{ item.effectiveTo }}）
          </el-tag>
          <el-button link type="primary" class="ml-5px" @click="toggleExpiring">
            {{ showExpiringDetail ? '收起明细' : '展开明细' }}
          </el-button>
          <el-button link type="primary" @click="loadExpiring">刷新</el-button>
        </div>
      </el-alert>
      <el-alert
        v-else
        type="success"
        :closable="false"
        show-icon
        :title="
          '密钥到期提醒：' + expiringDays + ' 天内没有需要关注的密钥，当前密钥有效期都在安全范围内'
        "
      />
      <el-table v-if="showExpiringDetail" :data="expiringList" size="small" class="mt-10px">
        <el-table-column label="密钥编码" align="left" prop="secretCode" width="160" />
        <el-table-column label="密钥名称" align="left" prop="secretName" min-width="180" />
        <el-table-column label="到期日期" align="center" prop="effectiveTo" width="120" />
        <el-table-column label="剩余天数" align="center" width="140">
          <template #default="scope">
            <el-tag :type="expireTagType(scope.row.daysLeft)" size="small">
              {{
                scope.row.daysLeft < 0
                  ? '已过期 ' + Math.abs(scope.row.daysLeft) + ' 天'
                  : scope.row.daysLeft + ' 天'
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="指纹"
          align="left"
          prop="fingerprint"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column label="状态" align="center" width="90">
          <template #default="scope">
            <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="密钥编码 / 名称 / 算法 / 指纹 / 备注"
          clearable
          class="!w-260px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="密钥类型" prop="secretType">
        <el-select v-model="queryParams.secretType" placeholder="全部" clearable class="!w-160px">
          <el-option
            v-for="item in meta.secretTypes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-140px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:service-secret:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:service-secret:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增密钥
        </el-button>
        <el-button type="info" plain @click="openTrailAll" v-hasPermi="['cr:service-secret:query']">
          <Icon icon="ep:tickets" class="mr-5px" /> 留痕总览
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:service-secret:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:service-secret:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap title="密钥列表">
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="密钥编码"
        align="left"
        prop="secretCode"
        width="160"
        show-overflow-tooltip
      />
      <el-table-column
        label="密钥名称"
        align="left"
        prop="secretName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="类型" align="center" width="110">
        <template #default="scope">
          <el-tag size="small">{{ labelOf(meta.secretTypes, scope.row.secretType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="算法"
        align="left"
        prop="algorithm"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column label="指纹（唯一可见身份）" align="left" min-width="250">
        <template #default="scope">
          <span class="text-12px">{{ scope.row.fingerprint }}</span>
        </template>
      </el-table-column>
      <el-table-column label="有效期" align="center" width="200">
        <template #default="scope">
          <span>{{ scope.row.effectiveFrom }} ~ {{ scope.row.effectiveTo }}</span>
          <el-tag
            v-if="typeof scope.row.daysLeft === 'number'"
            :type="expireTagType(scope.row.daysLeft)"
            size="small"
            class="ml-5px"
          >
            {{ scope.row.daysLeft < 0 ? '已过期' : scope.row.daysLeft + ' 天' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="最近轮换" align="center" width="200">
        <template #default="scope">
          <div>{{ scope.row.rotateTime }}</div>
          <div class="text-12px text-gray-500">
            {{ scope.row.rotateUser }} · 第 {{ scope.row.rotateCount }} 轮
          </div>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" align="center" prop="updateTime" width="165" />
      <el-table-column
        label="备注"
        align="left"
        prop="remark"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column label="操作" align="center" fixed="right" width="230">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:service-secret:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="warning"
            :loading="rotateId === scope.row.id"
            :disabled="scope.row.status !== 1"
            @click="handleRotate(scope.row)"
            v-hasPermi="['cr:service-secret:rotate']"
          >
            密钥轮换
          </el-button>
          <el-button
            link
            type="info"
            @click="openTrail(scope.row)"
            v-hasPermi="['cr:service-secret:query']"
          >
            留痕
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['cr:service-secret:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页组件 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 表单弹窗：新增 / 修改 -->
  <SecretForm ref="formRef" @success="getList" />
  <!-- 留痕 -->
  <SecretTrailDialog ref="trailRef" />
</template>

<script setup lang="ts">
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as ServiceSecretApi from '@/api/cr/service/secret'
import { getServiceMeta, type ServiceMetaVO } from '@/api/cr/service/host'
import SecretForm from './SecretForm.vue'
import SecretTrailDialog from './SecretTrailDialog.vue'

defineOptions({ name: 'CrServiceSecret' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<ServiceSecretApi.ServiceSecretVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: '',
  secretType: undefined as number | undefined,
  status: undefined as number | undefined
})
const queryFormRef = ref()
const exportLoading = ref(false)
/** 正在轮换的密钥 id */
const rotateId = ref<number | undefined>(undefined)
/** 密钥类型中文名取服务端口径 */
const meta = reactive<ServiceMetaVO>({ hostTypes: [], authTypes: [], secretTypes: [] })
/** 即将过期：90 天内（含已过期，daysLeft 为负数） */
const expiringDays = 90

const labelOf = (options: Array<{ value: number; label: string }>, value?: number) => {
  const hit = options.find((item) => Number(item.value) === Number(value))
  return hit ? hit.label : '—'
}

/** 已过期（负数）必须显眼标红，不能只显示负数 */
const expireTagType = (daysLeft?: number) => {
  const days = Number(daysLeft)
  if (days < 0) return 'danger'
  if (days <= 30) return 'warning'
  return 'info'
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await ServiceSecretApi.getPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/* ---------------- 即将过期（90 天内，含已过期） ---------------- */
const expiringLoading = ref(false)
const expiringList = ref<ServiceSecretApi.ServiceSecretVO[]>([])
const showExpiringDetail = ref(false)
const expiredCount = computed(
  () => expiringList.value.filter((item) => Number(item.daysLeft) < 0).length
)
const soonCount = computed(() => expiringList.value.length - expiredCount.value)

const loadExpiring = async () => {
  expiringLoading.value = true
  try {
    expiringList.value = (await ServiceSecretApi.getExpiringSecrets(expiringDays)) || []
  } finally {
    expiringLoading.value = false
  }
}

const toggleExpiring = () => {
  showExpiringDetail.value = !showExpiringDetail.value
}

/** 点标签直接按名称筛出这条密钥 */
const fillKeyword = (item: ServiceSecretApi.ServiceSecretVO) => {
  queryParams.keyword = item.secretName
  handleQuery()
}

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/* ---------------- 留痕 ---------------- */
const trailRef = ref()
const openTrail = (row: ServiceSecretApi.ServiceSecretVO) => {
  trailRef.value.open(row.id, row.secretName)
}
const openTrailAll = () => {
  trailRef.value.open(undefined, '')
}

/** 轮换：生成新指纹 + 留痕，成功提示里回显新指纹，旧指纹一并说明 */
const handleRotate = async (row: ServiceSecretApi.ServiceSecretVO) => {
  try {
    await message.confirm(
      '轮换会为「' +
        row.secretName +
        '」生成新指纹并写入留痕，当前指纹 ' +
        row.fingerprint +
        ' 将失效。确认轮换？'
    )
  } catch {
    return
  }
  rotateId.value = row.id
  try {
    const res = await ServiceSecretApi.rotateSecret(row.id!, '页面手动轮换')
    message.success(
      '轮换成功：新指纹 ' +
        res.fingerprint +
        '（第 ' +
        res.rotateCount +
        ' 轮，' +
        res.rotateTime +
        '），旧指纹 ' +
        res.oldFingerprint
    )
    await getList()
    await loadExpiring()
  } finally {
    rotateId.value = undefined
  }
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await ServiceSecretApi.remove(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: ServiceSecretApi.ServiceSecretVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await ServiceSecretApi.removeList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await ServiceSecretApi.exportExcel(queryParams)
    download.excel(data, '密钥台账.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(async () => {
  const serviceMeta = await getServiceMeta()
  meta.secretTypes = serviceMeta.secretTypes || []
  meta.hostTypes = serviceMeta.hostTypes || []
  meta.authTypes = serviceMeta.authTypes || []
  await loadExpiring()
  getList()
})
</script>
