<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="本地字典" prop="localDict">
        <el-select
          v-model="queryParams.localDict"
          placeholder="请选择本地字典"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="dict in localDicts"
            :key="dict.localDict"
            :label="dictOptionLabel(dict)"
            :value="dict.localDict"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="监管字典" prop="regDict">
        <el-select
          v-model="queryParams.regDict"
          placeholder="请选择监管字典"
          clearable
          filterable
          class="!w-220px"
        >
          <el-option
            v-for="dict in regDicts"
            :key="dict.regDict"
            :label="dictOptionLabel(dict)"
            :value="dict.regDict"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option
            v-for="dict in getIntDictOptions(DICT_TYPE.CR_ENABLE_STATUS)"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input
          v-model="queryParams.keyword"
          placeholder="本地码值 / 名称 / 监管码值"
          clearable
          class="!w-220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery" v-hasPermi="['cr:local-map:query']">
          <Icon icon="ep:search" class="mr-5px" /> 搜索
        </el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['cr:local-map:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增映射
        </el-button>
        <el-button
          type="warning"
          plain
          @click="openValidate"
          v-hasPermi="['cr:local-map:validate']"
        >
          <Icon icon="ep:circle-check" class="mr-5px" /> 映射校验
        </el-button>
        <el-button
          type="success"
          plain
          :loading="exportLoading"
          @click="handleExport"
          v-hasPermi="['cr:local-map:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="checkedIds.length === 0"
          @click="handleDeleteBatch"
          v-hasPermi="['cr:local-map:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert
      class="mb-10px"
      type="info"
      :closable="false"
      show-icon
      title="报文字段取的是监管码值，本地码值要先映射；同一本地码值有多条启用映射时，优先级数字小的生效，被覆盖的那条会在「生效判断」列标出来。"
    />
    <!-- 统计条：映射完整性口径（未映射 = 启用中的本地码值一条启用映射都没有） -->
    <div class="mb-10px flex flex-wrap items-center gap-8px">
      <template v-if="stats">
        <el-tag type="info" effect="plain">启用中的本地码值 {{ stats.localTotal }}</el-tag>
        <el-tag type="success" effect="plain">已映射 {{ stats.mappedLocalCount }}</el-tag>
        <el-tag :type="stats.unmappedCount ? 'danger' : 'info'" effect="plain">
          未映射 {{ stats.unmappedCount }}
        </el-tag>
        <el-tag type="primary" effect="plain">覆盖率 {{ stats.coverRate }}%</el-tag>
        <el-tag :type="stats.errorCount ? 'danger' : 'success'" effect="plain">
          必须处理 {{ stats.errorCount }}
        </el-tag>
      </template>
      <span v-else class="text-12px text-[#909399]">统计计算中……</span>
      <el-button link type="primary" @click="openValidate" v-hasPermi="['cr:local-map:validate']">
        <Icon icon="ep:circle-check" class="mr-5px" /> 映射校验
      </el-button>
    </div>
    <el-table v-loading="loading" :data="list" @selection-change="handleRowCheckboxChange">
      <el-table-column type="selection" width="55" />
      <el-table-column
        label="本地字典"
        align="left"
        prop="localDictName"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column label="本地码值" align="left" min-width="120" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.localCode }} {{ scope.row.localName }}</template>
      </el-table-column>
      <el-table-column label="监管码值" align="left" min-width="150" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.regCode }} {{ scope.row.regName }}</span>
          <!-- 指向的监管码值在监管码值表里查不到时点名，别让人对着空名称猜 -->
          <el-tag
            v-if="!scope.row.regName"
            class="ml-5px"
            type="danger"
            size="small"
            effect="plain"
            disable-transitions
          >
            码值不存在
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="优先级" align="center" prop="priority" width="90" />
      <!-- 生效判断：服务端判定"这条到底生不生效"，被同码值更小优先级的映射盖住时直接点名 -->
      <el-table-column label="生效判断" align="center" width="110">
        <template #default="scope">
          <el-tooltip
            v-if="decisionOf(scope.row)"
            :content="decisionOf(scope.row)!.reason"
            placement="top"
          >
            <el-tag
              :type="decisionTagType(decisionOf(scope.row)!.state)"
              size="small"
              effect="plain"
              disable-transitions
            >
              {{ decisionLabel(decisionOf(scope.row)!) }}
            </el-tag>
          </el-tooltip>
          <span v-else class="text-[#c0c4cc]">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="更新人" align="center" prop="updateUser" width="110" />
      <el-table-column label="更新时间" align="center" prop="updateTime" width="170" />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['cr:local-map:update']"
          >
            修改
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['cr:local-map:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <LocalMapForm ref="formRef" @success="refresh" />
  <LocalMapValidateDialog ref="validateDialogRef" />
</template>

<script lang="ts" setup>
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import download from '@/utils/download'
import * as LocalMapApi from '@/api/cr/dict/localMap'
import LocalMapForm from './LocalMapForm.vue'
import LocalMapValidateDialog from './LocalMapValidateDialog.vue'

defineOptions({ name: 'CrDictLocalMap' })

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const total = ref(0)
const list = ref<LocalMapApi.LocalMapVO[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  localDict: undefined as string | undefined,
  regDict: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: ''
})
const queryFormRef = ref()
const exportLoading = ref(false)
const localDicts = ref<LocalMapApi.LocalDictOptionVO[]>([])
const regDicts = ref<LocalMapApi.RegDictOptionVO[]>([])
/** 生效判断：映射 id → 服务端判定结果（生效中 / 被覆盖 / 已停用） */
const decisions = ref<Record<number, LocalMapApi.LocalMapDecisionVO>>({})
/** 映射完整性校验报告：统计条直接取 stats，弹窗里看逐条问题 */
const report = ref<LocalMapApi.LocalMapReportVO | null>(null)
const stats = computed(() => report.value?.stats || null)

/** 字典下拉文案带码值条数，页面上一眼能看出字典规模 */
const dictOptionLabel = (dict: { dictName: string; count: number }) =>
  dict.dictName + '（' + dict.count + ' 个码值）'

/** 取一条映射的生效判定（取不到就显示 "-"，不猜） */
const decisionOf = (row: LocalMapApi.LocalMapVO) => decisions.value[row.id!] || null

/** 判定三态对应的标签色：生效中 success / 被覆盖 warning / 已停用 info */
const decisionTagType = (state: string): 'success' | 'warning' | 'info' => {
  if (state === 'EFFECTIVE') return 'success'
  if (state === 'COVERED') return 'warning'
  return 'info'
}

/** 三态中文名兜底：服务端给了 stateLabel 就用服务端的，口径以服务端为准 */
const DECISION_LABELS: Record<string, string> = {
  EFFECTIVE: '生效中',
  COVERED: '被覆盖',
  DISABLED: '已停用'
}
const decisionLabel = (decision: LocalMapApi.LocalMapDecisionVO) =>
  decision.stateLabel || DECISION_LABELS[decision.state] || decision.state

/** 生效判定跟着列表一起刷新：启停 / 改优先级 / 增删都会改判定结果 */
const getDecisions = async () => {
  try {
    const data = await LocalMapApi.getLocalMapDecisions()
    const raw = data?.decisions || {}
    const map: Record<number, LocalMapApi.LocalMapDecisionVO> = {}
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (item?.id) map[item.id] = item
      })
    } else {
      Object.keys(raw).forEach((key) => {
        map[Number(key)] = raw[key]
      })
    }
    decisions.value = map
  } catch {
    decisions.value = {}
  }
}

/** 映射完整性校验（只算不写）：统计条与校验弹窗共用同一份口径 */
const getReport = async () => {
  try {
    report.value = await LocalMapApi.validateLocalMap()
  } catch {
    report.value = null
  }
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await LocalMapApi.getLocalMapPage(queryParams)
    list.value = data.list
    total.value = data.total
    await getDecisions()
  } finally {
    loading.value = false
  }
}

/** 列表与统计一起刷新：映射的任何增删改都会改完整性结论 */
const refresh = async () => {
  await getList()
  await getReport()
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

/** 新增 / 修改 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 映射校验弹窗 */
const validateDialogRef = ref()
const openValidate = () => {
  validateDialogRef.value.open()
}

/** 删除 */
const handleDelete = async (row: LocalMapApi.LocalMapVO) => {
  try {
    await message.delConfirm(
      '确认删除「' +
        row.localCode +
        ' ' +
        row.localName +
        ' → ' +
        row.regCode +
        ' ' +
        row.regName +
        '」这条映射？'
    )
    await LocalMapApi.deleteLocalMap(row.id!)
    message.success(t('common.delSuccess'))
    await refresh()
  } catch {}
}

/** 批量删除 */
const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (rows: LocalMapApi.LocalMapVO[]) => {
  checkedIds.value = rows.map((row) => row.id!)
}

const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await LocalMapApi.deleteLocalMapList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await refresh()
  } catch {}
}

/** 导出 */
const handleExport = async () => {
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await LocalMapApi.exportLocalMap(queryParams)
    download.excel(data, '本地标准映射.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  // 字典下拉一次拉全量：筛选是本地条件，翻页时无需重复请求
  const data = await LocalMapApi.getLocalMapDictOptions()
  localDicts.value = data?.localDicts || []
  regDicts.value = data?.regDicts || []
  refresh()
})
</script>
