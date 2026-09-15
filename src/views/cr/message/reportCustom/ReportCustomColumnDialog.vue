<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="900">
    <el-alert type="info" :closable="false" show-icon class="mb-10px" :title="tableHint" />
    <div class="mb-10px flex items-center justify-between">
      <span class="text-[13px] text-[#606266]">
        已选 <b>{{ selectedCount }}</b> / {{ rows.length }} 个字段（必填字段不可取消）
      </span>
      <div>
        <el-button link type="primary" @click="handleSelectAll(true)">全选</el-button>
        <el-button link type="primary" @click="handleSelectAll(false)">全不选</el-button>
      </div>
    </div>
    <el-table v-loading="loading" :data="rows" max-height="420">
      <el-table-column label="选用" align="center" width="70">
        <template #default="scope">
          <el-tooltip
            :disabled="!scope.row.required"
            content="监管必填字段，不允许裁剪"
            placement="top"
          >
            <el-switch v-model="scope.row.selected" :disabled="scope.row.required" />
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="字段编码" align="center" prop="columnCode" width="110" />
      <el-table-column
        label="字段名"
        align="left"
        prop="columnName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="字段中文名"
        align="left"
        prop="cnName"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="数据类型" align="center" prop="dataType" width="100" />
      <el-table-column label="必填" align="center" width="80">
        <template #default="scope">
          <el-tag v-if="scope.row.required" type="danger" size="small">必填</el-tag>
          <el-tag v-else type="info" size="small">可选</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="加工方式" align="center" width="140">
        <template #default="scope">
          <el-select v-model="scope.row.transform" :disabled="!scope.row.selected" size="small">
            <el-option
              v-for="item in TRANSFORM_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">保存字段配置</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as ReportCustomApi from '@/api/cr/message/reportCustom'

defineOptions({ name: 'CrMessageReportCustomColumnDialog' })

/** 加工方式：与 mock 层的 transform 取值一一对应 */
const TRANSFORM_OPTIONS = [
  { label: '直接取值', value: 'DIRECT' },
  { label: '汇总（SUM）', value: 'SUM' },
  { label: '计数（COUNT）', value: 'COUNT' },
  { label: '码值转换', value: 'CODE' }
]

const message = useMessage()
const dialogVisible = ref(false)
const dialogTitle = ref('配置定制字段')
const loading = ref(false)
const formLoading = ref(false)
const custom = ref<ReportCustomApi.ReportCustomVO>()
const rows = ref<ReportCustomApi.ColumnOptionVO[]>([])

const selectedCount = computed(() => rows.value.filter((row) => row.selected).length)

const tableHint = computed(() => {
  if (!custom.value) return ''
  return (
    '定制「' +
    custom.value.customName +
    '」取数自数据表 ' +
    custom.value.dataTableCode +
    ' ' +
    custom.value.dataTableName +
    '；保存后该报表的报文列数即等于所选字段数。'
  )
})

/** 打开弹窗 */
const open = async (row: ReportCustomApi.ReportCustomVO) => {
  custom.value = row
  dialogVisible.value = true
  dialogTitle.value = '配置定制字段 - ' + row.customName
  loading.value = true
  try {
    const data = await ReportCustomApi.getColumnOptions(row.id!)
    rows.value = data.options
  } finally {
    loading.value = false
  }
}
defineExpose({ open })

const handleSelectAll = (value: boolean) => {
  rows.value.forEach((row) => {
    if (row.required) {
      row.selected = true
      return
    }
    row.selected = value
  })
}

/** 保存 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  if (!custom.value) return
  const items = rows.value
    .filter((row) => row.selected)
    .map((row, index) => ({
      columnCode: row.columnCode,
      columnName: row.columnName,
      cnName: row.cnName,
      dataType: row.dataType,
      required: row.required,
      transform: row.transform,
      sortNo: index + 1,
      remark: row.remark
    }))
  if (!items.length) {
    message.warning('请至少选择一个定制字段')
    return
  }
  formLoading.value = true
  try {
    await ReportCustomApi.updateReportCustomItems(custom.value.id!, items)
    message.success('字段配置已保存')
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
