<template>
  <el-dialog v-model="dialogVisible" title="数据导入" width="960px" append-to-body @closed="reset">
    <el-steps :active="step" simple class="mb-15px">
      <el-step title="选择机构 / 报表 / 期次" icon="ep:office-building" />
      <el-step title="上传并按生效模板解析文件" icon="ep:upload" />
      <el-step title="确认入库（写进数据填报）" icon="ep:finished" />
    </el-steps>

    <el-form label-width="110px">
      <el-form-item label="导入目标" required>
        <el-select
          v-model="form.orgId"
          filterable
          placeholder="报送机构"
          class="!w-200px"
          :disabled="parsed"
          @change="loadConfig"
        >
          <el-option v-for="org in orgOptions" :key="org.id" :label="org.orgName" :value="org.id" />
        </el-select>
        <el-select
          v-model="form.reportId"
          filterable
          placeholder="报表"
          class="!w-300px ml-8px"
          :disabled="parsed"
          @change="loadConfig"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
        <el-select
          v-model="form.period"
          placeholder="期次"
          class="!w-190px ml-8px"
          :disabled="parsed"
        >
          <el-option
            v-for="item in periodOptions"
            :key="item.period"
            :label="item.period + ' ' + item.periodName"
            :value="item.period"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="effective" label="生效导入设置">
        <div class="w-full">
          <el-descriptions :column="4" size="small" border>
            <el-descriptions-item label="生效层级">{{ effective.level }}</el-descriptions-item>
            <el-descriptions-item label="文件类型">
              <dict-tag :type="DICT_TYPE.CR_FILE_TYPE" :value="effective.config.fileType" />
            </el-descriptions-item>
            <el-descriptions-item label="分隔符">{{
              effective.config.separator
            }}</el-descriptions-item>
            <el-descriptions-item label="编码">{{ effective.config.charset }}</el-descriptions-item>
            <el-descriptions-item label="表头行数">{{
              effective.config.headerRows
            }}</el-descriptions-item>
            <el-descriptions-item label="数据起始行">{{
              effective.config.startRow
            }}</el-descriptions-item>
            <el-descriptions-item label="日期格式">{{
              effective.config.dateFormat
            }}</el-descriptions-item>
            <el-descriptions-item label="本期已有数据"
              >{{ effective.existRows }} 行</el-descriptions-item
            >
          </el-descriptions>
          <div class="mt-6px text-12px text-gray-500">
            允许覆盖：{{ effective.config.allowOverwrite ? '是' : '否' }} · 入库前审核：{{
              effective.config.needAudit ? '是' : '否'
            }}
            · 严格校验：{{ effective.config.strictCheck ? '是' : '否' }}
            （导入设置的调整入口：数据采集 → 导入设置）
          </div>
          <!-- 导入权限：与后端拦截同源；不允许导入时下面的「解析文件」也会被拦住 -->
          <el-alert
            v-if="myAuth"
            class="mt-8px"
            :closable="false"
            show-icon
            :type="myAuth.auth.canImport ? 'success' : 'error'"
            :title="
              '我的导入权限：' +
              myAuth.auth.userName +
              '（' +
              (myAuth.auth.roleNames.join(' / ') || '无角色') +
              '）'
            "
            :description="myAuth.message + '　生效来源：' + myAuth.auth.source"
          />
        </div>
      </el-form-item>

      <el-form-item label="导入文件" required>
        <el-upload
          ref="uploadRef"
          v-model:file-list="fileList"
          :auto-upload="false"
          :limit="1"
          accept=".csv,.txt,.xlsx"
          drag
          class="w-full"
        >
          <Icon icon="ep:upload" class="text-30px" />
          <div class="el-upload__text"
            >把 CSV / TXT / XLSX 文件拖到这里，或 <em>点击选择文件</em></div
          >
          <template #tip>
            <div class="el-upload__tip">
              CSV / TXT 按生效模板的编码与分隔符解析；<b>.xlsx 在浏览器里直接读取</b
              >（取第一张工作表，日期自动归一化，不用再另存为 CSV）； 旧版 .xls 请先另存为 .xlsx 或
              CSV。列顺序要按下面的生效模板。
              <el-button link type="primary" @click="downloadTemplate">下载导入模板</el-button>
            </div>
          </template>
        </el-upload>
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          :loading="parsing"
          :disabled="!fileList.length || !effective"
          @click="handleParse"
        >
          <Icon icon="ep:magic-stick" class="mr-5px" /> 解析文件
        </el-button>
        <span v-if="parsed" class="ml-10px text-12px text-gray-500"
          >已按生效模板解析，确认前不会写库</span
        >
      </el-form-item>
    </el-form>

    <!-- 解析结果 -->
    <template v-if="parsed">
      <el-alert
        class="mb-10px"
        :closable="false"
        show-icon
        :type="errorRows.length ? 'warning' : 'success'"
        :title="resultSummary"
      />
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="'数据预览（' + validRows.length + ' 行）'" name="data">
          <el-table :data="validRows.slice(0, 10)" size="small" border max-height="260">
            <el-table-column label="行号" type="index" width="60" align="center" />
            <el-table-column
              v-for="column in previewColumns"
              :key="column.field"
              :label="column.label"
              :prop="column.field"
              min-width="120"
              show-overflow-tooltip
            />
          </el-table>
          <div class="mt-6px text-12px text-gray-500">
            文件共 {{ totalRows }} 行数据，成功 {{ validRows.length }} 行、失败
            {{ errorRows.length }} 行；本批最多提交 {{ capRows }} 行（演示环境上限{{
              myAuth?.auth?.maxRows ? '与当前账号的单批上限取小' : ''
            }}），超出部分不写入。
          </div>
        </el-tab-pane>
        <el-tab-pane :label="'错误 / 警告（' + errorRows.length + '）'" name="error">
          <el-table :data="errorRows" size="small" border max-height="260">
            <el-table-column label="文件行号" prop="rowNo" width="90" align="center" />
            <el-table-column label="级别" width="80" align="center">
              <template #default="scope">
                <el-tag :type="scope.row.level === 1 ? 'danger' : 'warning'" size="small">{{
                  scope.row.level === 1 ? '错误' : '警告'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="字段" prop="errorField" width="130" align="center" />
            <el-table-column label="原因" prop="errorMsg" min-width="240" show-overflow-tooltip />
            <el-table-column
              label="原始内容"
              prop="content"
              min-width="280"
              show-overflow-tooltip
            />
          </el-table>
          <div v-if="!errorRows.length" class="mt-6px text-12px text-gray-500"
            >这一批没有错误行。</div
          >
        </el-tab-pane>
      </el-tabs>
    </template>

    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button v-if="parsed" plain @click="reset">重新选择文件</el-button>
      <el-button v-if="parsed" type="primary" :loading="submitting" @click="submit"
        >确认入库</el-button
      >
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import download from '@/utils/download'
import * as ImportTaskApi from '@/api/cr/collect/importTask'
import * as ImportConfigApi from '@/api/cr/collect/importConfig'
import {
  getCollectOrgOptions,
  getCollectPeriodOptions,
  getCollectReportOptions,
  type CollectOrgOptionVO,
  type CollectPeriodOptionVO,
  type CollectReportOptionVO
} from '@/api/cr/collect/common'
// 解析规则抽在 ./parseFile.ts 里（纯函数，方便单独验证）；xlsx 读取在 ./xlsx.ts 里（自研零依赖）
import {
  MAX_IMPORT_ROWS,
  buildTemplateCsv,
  decodeFile,
  parseImportRows,
  parseImportText,
  rowsFromXlsxSheet,
  templateFileName
} from './parseFile'
import { isXlsxSupported, readXlsxSheet } from './xlsx'

defineOptions({ name: 'CollectImportDialog' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const step = ref(1)
const orgOptions = ref<CollectOrgOptionVO[]>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const periodOptions = ref<CollectPeriodOptionVO[]>([])
const effective = ref<any>(null)
/** 当前登录人在该「机构 × 报表」上生效的导入权限（后端算的，与拦截同源） */
const myAuth = ref<ImportTaskApi.MyImportAuthVO | null>(null)
const form = reactive({
  orgId: undefined as number | undefined,
  reportId: undefined as number | undefined,
  period: ''
})

const uploadRef = ref()
const fileList = ref<any[]>([])
const parsing = ref(false)
const submitting = ref(false)
const parsed = ref(false)
const activeTab = ref('data')
const totalRows = ref(0)
const validRows = ref<Array<Record<string, any>>>([])
const errorRows = ref<Array<any>>([])
const parseCost = ref(0)
const fileName = ref('')
const fileSize = ref(0)
/** xlsx 解析出来的工作表名（给用户一个"确实读了这张表"的反馈） */
const sheetName = ref('')

/** 数据预览列：直接来自生效模板的字段映射 */
const previewColumns = computed(() =>
  (effective.value?.config?.mapping || []).map((item: any) => ({
    field: item.field,
    label: item.label
  }))
)
/** 批次记录的文件类型以**实际上传的文件**为准（导入设置里的类型只是模板默认值） */
const fileTypeOf = (name: string) => (/\.xlsx$/i.test(name) ? 3 : /\.txt$/i.test(name) ? 2 : 1)
/** 与字典 CR_FILE_TYPE 对齐的类型名，用于把"实际类型 ≠ 配置类型"讲清楚 */
const FILE_TYPE_LABEL: Record<number, string> = { 1: 'CSV', 2: 'TXT', 3: 'XLSX' }
const resultSummary = computed(() => {
  const parts = [
    '文件 ' +
      fileName.value +
      (sheetName.value ? '（工作表：' + sheetName.value + '）' : '') +
      ' 共 ' +
      totalRows.value +
      ' 行',
    '成功 ' + validRows.value.length + ' 行',
    '失败 ' + errorRows.value.length + ' 行'
  ]
  if (errorRows.value.length)
    parts.push(
      effective.value?.config?.strictCheck
        ? '当前是严格校验，提交后会整批判为失败'
        : '提交后转人工审核'
    )
  if (effective.value?.config?.needAudit) parts.push('该模板要求入库前审核')
  // 导入设置里的「文件类型」是模板默认值，实际按上传的文件类型解析 —— 不一致时说明清楚，别让人以为是解析错了
  const configuredType = Number(effective.value?.config?.fileType || 0)
  if (configuredType && configuredType !== fileTypeOf(fileName.value)) {
    parts.push(
      '提示：该报表的导入设置里模板文件类型是 ' +
        FILE_TYPE_LABEL[configuredType] +
        '，本次按实际上传的 ' +
        FILE_TYPE_LABEL[fileTypeOf(fileName.value)] +
        ' 解析（批次会记成实际类型）'
    )
  }
  return parts.join('，')
})

/** 打开弹窗 */
const open = async (options?: { orgId?: number; reportId?: number; period?: string }) => {
  dialogVisible.value = true
  reset()
  myAuth.value = null
  if (!orgOptions.value.length) {
    orgOptions.value = (await getCollectOrgOptions()) || []
    reportOptions.value = (await getCollectReportOptions()) || []
    periodOptions.value = (await getCollectPeriodOptions()) || []
  }
  const current = periodOptions.value.find((item) => item.status === 1)
  form.period = options?.period || (current ? current.period : periodOptions.value[0]?.period) || ''
  form.orgId = options?.orgId
  form.reportId = options?.reportId
  if (form.orgId && form.reportId) await loadConfig()
}
defineExpose({ open })

const emit = defineEmits(['success'])

const loadConfig = async () => {
  if (!form.orgId || !form.reportId) return
  effective.value = await ImportConfigApi.getEffectiveConfig(form.orgId, form.reportId)
  myAuth.value = await ImportTaskApi.getMyImportAuth({ orgId: form.orgId, reportId: form.reportId })
}

/**
 * 本批实际能提交的行数上限 = min(演示环境上限, 导入权限的单批上限)。
 * 取权限里的上限是为了让"超上限"在页面上就被拦住并说明原因，而不是提交后才被后端拒。
 */
const capRows = computed(() => {
  const authMax = myAuth.value?.auth?.maxRows || 0
  return authMax > 0 ? Math.min(MAX_IMPORT_ROWS, authMax) : MAX_IMPORT_ROWS
})

const reset = () => {
  parsed.value = false
  step.value = effective.value ? 2 : 1
  fileList.value = []
  validRows.value = []
  errorRows.value = []
  totalRows.value = 0
  sheetName.value = ''
  activeTab.value = 'data'
  uploadRef.value?.clearFiles?.()
}

/**
 * 下载导入模板：按生效模板的字段映射生成表头 + 3 行示例数据，
 * 用户填好后直接上传，省得猜分隔符与列顺序。
 */
const downloadTemplate = () => {
  const config = effective.value?.config
  if (!config) {
    message.warning('请先选择报送机构与报表')
    return
  }
  const csv = buildTemplateCsv(config, form.period)
  download.file(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    templateFileName(form.reportId, form.period)
  )
  message.success('模板已下载：按模板填好后上传即可')
}

/** 真实解析选中的文件：按分隔符拆列、按字段映射取值、逐行校验 */
const handleParse = async () => {
  const file: File | undefined = fileList.value[0]?.raw
  if (!file) {
    message.warning('请先选择要导入的文件')
    return
  }
  const config = effective.value?.config
  if (!config) {
    message.warning('请先选择报送机构与报表')
    return
  }
  // 权限不允许就别说"解析成功"了：后端也会拦，这里提前给一句人话
  if (myAuth.value && !myAuth.value.auth.canImport) {
    message.warning(myAuth.value.auth.userName + ' 没有数据导入权限：' + myAuth.value.auth.source)
    return
  }
  if (/\.xls$/i.test(file.name)) {
    message.warning('不支持旧版 .xls：请在 Excel 里另存为 .xlsx 或 CSV 后再导入')
    return
  }
  parsing.value = true
  const startedAt = Date.now()
  try {
    let result
    if (/\.xlsx$/i.test(file.name)) {
      // Excel 在浏览器里直接解析（自研 ZIP + sheet XML 读取，零依赖），不用再让用户另存为 CSV
      if (!isXlsxSupported()) {
        message.warning(
          '当前浏览器不支持读取 .xlsx（缺少 DecompressionStream），请把文件另存为 CSV 后再导入'
        )
        return
      }
      const sheet = await readXlsxSheet(file)
      sheetName.value = sheet.sheetName
      // 日期在 xlsx 里被归一化成 yyyy-MM-dd，按生效模板的日期格式改写后再走同一套校验
      result = parseImportRows(rowsFromXlsxSheet(sheet.rows, config), config)
    } else {
      sheetName.value = ''
      const text = await decodeFile(file, config.charset)
      // 解析规则在 ./parseFile.ts 里（切列 / 取值 / 四条校验）
      result = parseImportText(text, config)
    }
    totalRows.value = result.totalRows
    validRows.value = result.validRows
    errorRows.value = result.errorRows
    parseCost.value = Date.now() - startedAt
    fileName.value = file.name
    fileSize.value = file.size
    parsed.value = true
    step.value = 3
    if (!totalRows.value) {
      message.warning('文件里没有解析到数据行，请检查表头行数与数据起始行配置')
    } else if (result.errorRows.length) {
      message.warning(
        '解析完成：成功 ' +
          result.validRows.length +
          ' 行，错误 / 警告 ' +
          result.errorRows.length +
          ' 行'
      )
    } else {
      message.success('解析完成：' + result.validRows.length + ' 行全部通过校验')
    }
  } catch (e: any) {
    // xlsx 读取失败会抛中文原因（不是有效的 xlsx / 行数超限 / 不支持的压缩方式）
    message.error(e?.message || '文件解析失败，请检查文件格式后重试')
  } finally {
    parsing.value = false
  }
}

/** 提交解析结果：后端按导入设置 + 导入权限决定「直接入库」还是「转人工审核」 */
const submit = async () => {
  if (!validRows.value.length && !errorRows.value.length) {
    message.warning('没有可提交的数据')
    return
  }
  // 只提交上限内的行，并且 totalRows 与真正提交的行数保持一致
  // （否则批次上写的总行数会大于实际入库行数，后面看报表会对不上账）
  const submitValidRows = validRows.value.slice(0, capRows.value)
  const submitErrorRows = errorRows.value.slice(0, 200)
  const submitTotal = submitValidRows.length + submitErrorRows.length
  if (totalRows.value > submitTotal) {
    message.warning(
      '文件共 ' +
        totalRows.value +
        ' 行，本批只提交前 ' +
        submitTotal +
        ' 行（上限 ' +
        capRows.value +
        ' 行）'
    )
  }
  submitting.value = true
  try {
    const result = await ImportTaskApi.parseImport({
      orgId: form.orgId!,
      reportId: form.reportId!,
      period: form.period,
      fileName: fileName.value,
      fileSize: fileSize.value,
      fileType: fileTypeOf(fileName.value),
      totalRows: submitTotal,
      cost: parseCost.value,
      validRows: submitValidRows,
      errorRows: submitErrorRows
    })
    if (result.strictFailed) {
      message.warning(
        result.message + '（批次号 ' + result.batchNo + '，可在数据导入列表里查看错误明细）'
      )
    } else if (result.status === 4) {
      message.success(result.message + '（批次号 ' + result.batchNo + '，可到「数据填报」页查看）')
    } else {
      message.success(result.message + '（批次号 ' + result.batchNo + '，可到「导入审核」处理）')
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}
</script>
