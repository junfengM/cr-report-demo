<template>
  <el-drawer v-model="visible" title="拆分批次详情" size="65%" :destroy-on-close="true">
    <div v-loading="loading">
      <!-- 批次基本信息 -->
      <el-descriptions :column="2" border>
        <el-descriptions-item label="批次号">{{ detail.batchNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <dict-tag :type="DICT_TYPE.CR_SPLIT_STATUS" :value="detail.status ?? ''" />
        </el-descriptions-item>
        <el-descriptions-item label="拆分范围">{{ detail.scopeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="期次">{{ detail.period || '-' }}</el-descriptions-item>
        <el-descriptions-item label="机构">{{ detail.orgName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报表">
          {{
            detail.reportCode
              ? detail.reportCode + ' ' + detail.reportName
              : detail.reportName || '-'
          }}
        </el-descriptions-item>
        <el-descriptions-item label="命中规则">
          {{ detail.ruleCode ? detail.ruleCode + ' ' + detail.ruleName : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="拆分方式">
          <dict-tag :type="DICT_TYPE.CR_SPLIT_MODE" :value="detail.mode ?? ''" />
        </el-descriptions-item>
        <el-descriptions-item label="拆分行数">{{ detail.totalRows ?? 0 }} 行</el-descriptions-item>
        <el-descriptions-item label="包数">{{ detail.pkgCount ?? 0 }} 个</el-descriptions-item>
        <el-descriptions-item label="开始 / 结束">
          {{ (detail.startTime || '-') + ' → ' + (detail.endTime || '-') }}
        </el-descriptions-item>
        <el-descriptions-item label="耗时">{{ detail.cost ?? 0 }} ms</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ detail.operator || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="执行结果" :span="2">
          <span class="whitespace-pre-wrap break-all">{{ detail.message || '-' }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <template v-if="stats">
        <!-- 一致性校验：各包行数之和是否等于拆分前的总行数 -->
        <el-divider content-position="left">一致性校验</el-divider>
        <el-alert
          v-if="stats.consistent"
          type="success"
          :closable="false"
          show-icon
          title="各包行数之和 = 拆分前总行数，无丢行"
          :description="
            '各包行数之和 ' +
            stats.totalRows +
            ' 行 = 拆分前总行数 ' +
            (detail.totalRows ?? 0) +
            ' 行。拆分只做分组与清单，不复制行，也不改写填报数据里的任何字段值。'
          "
        />
        <el-alert
          v-else
          type="error"
          :closable="false"
          show-icon
          title="一致性校验未通过：各包行数之和与拆分前总行数不一致"
          :description="
            '各包行数之和 ' +
            stats.totalRows +
            ' 行 ≠ 拆分前总行数 ' +
            (detail.totalRows ?? 0) +
            ' 行，请核对下面的包清单'
          "
        />

        <!-- 包统计 -->
        <el-divider content-position="left">包统计</el-divider>
        <el-row :gutter="12">
          <el-col :span="6">
            <el-card shadow="never">
              <div class="text-13px text-gray-500">包数</div>
              <div class="mt-5px text-20px font-700">{{ stats.pkgCount }} 个</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never">
              <div class="text-13px text-gray-500">最大包</div>
              <div class="mt-5px text-20px font-700">{{ stats.maxRows }} 行</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never">
              <div class="text-13px text-gray-500">最小包</div>
              <div class="mt-5px text-20px font-700">{{ stats.minRows }} 行</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never">
              <div class="text-13px text-gray-500">平均每包行数</div>
              <div class="mt-5px text-20px font-700">{{ stats.avgRows }} 行</div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 包清单 -->
        <el-divider content-position="left">包清单（{{ packages.length }} 个包）</el-divider>
        <el-alert
          class="mb-10px"
          type="info"
          :closable="false"
          show-icon
          title="每个包都可以下载成真实文件（与「一键报送」共用同一套报文文件生成器：格式 / 分隔符 / 表头行数取机构的《报送文件配置》），下载到的字节数与行数就是下表显示的数字。包内的明细行与报文文件同口径，是按定宽规则生成的模拟数据（不是把填报数据逐行导出），所以文件里的保单号位数与下表样例不同。"
        />
        <el-table :data="packages" size="small" border>
          <el-table-column label="包名" align="left" prop="pkgName" min-width="130" />
          <el-table-column label="行数" align="right" prop="rows" width="70" />
          <el-table-column
            v-if="detail.mode === MODE_BY_FIELD"
            label="分组值"
            align="left"
            prop="fieldValue"
            min-width="100"
          />
          <el-table-column
            label="包文件"
            align="left"
            prop="fileName"
            min-width="300"
            show-overflow-tooltip
          />
          <el-table-column label="大小" align="right" width="95">
            <template #default="scope">{{ sizeText(scope.row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="首个保单号" align="left" prop="firstPolicyNo" width="130" />
          <el-table-column label="末个保单号" align="left" prop="lastPolicyNo" width="130" />
          <el-table-column
            label="样例行（保单号 投保人 渠道 保费）"
            align="left"
            min-width="300"
            show-overflow-tooltip
          >
            <template #default="scope">{{ sampleText(scope.row.samples) }}</template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="110" fixed="right">
            <template #default="scope">
              <el-button
                link
                type="primary"
                :loading="downloading === scope.row.pkgNo"
                @click="handleDownload(scope.row)"
              >
                下载包文件
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="mt-10px text-12px text-gray-500">
          样例行只放保单号 / 投保人 / 渠道 /
          保费，不带证件号等敏感字段；拆分批次本身不存储明细行副本。
        </div>
      </template>
    </div>
    <template #footer>
      <el-button @click="visible = false">关 闭</el-button>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as TaskApi from '@/api/cr/split/task'

defineOptions({ name: 'CrSplitPackageDrawer' })

const message = useMessage()

/** 拆分方式取值（与字典 cr_split_mode 对齐）：只用于「按字段值分组时才有分组值列」的判断 */
const MODE_BY_FIELD = 2

const visible = ref(false)
const loading = ref(false)
/** 正在下载的包号（同一时间只允许一个，避免重复点） */
const downloading = ref(0)
/** 先用列表行数据立即渲染，再用 /detail 补齐包清单与一致性校验 */
const detail = ref<Partial<TaskApi.SplitTaskDetailVO>>({})

const stats = computed(() => detail.value.stats)
const packages = computed(() => detail.value.packages || [])

/** 样例行紧凑文本：保单号 投保人 渠道 保费，最多 3 条 */
const sampleText = (samples: any[] | undefined) =>
  (samples || [])
    .slice(0, 3)
    .map((item) => [item.policyNo, item.holderName, item.channel, item.premiumAmount].join(' '))
    .join('；')

/** 字节数可读文案（与报文模块的口径一致） */
const sizeText = (size: number) => {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(2) + ' MB'
}

/** 下载某个包的报文文件：真实 Blob，不是假链接 */
const handleDownload = async (row: any) => {
  if (!detail.value.id) return
  downloading.value = row.pkgNo
  try {
    const blob = await TaskApi.downloadSplitPackage(Number(detail.value.id), Number(row.pkgNo))
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = row.fileName
    link.click()
    URL.revokeObjectURL(url)
    message.success(
      '已下载 ' + row.fileName + '（' + sizeText(row.fileSize) + '，' + row.rows + ' 行）'
    )
  } catch (error) {
    console.warn('[数据拆分] 包文件下载失败', error)
  } finally {
    downloading.value = 0
  }
}

/** 打开抽屉：详情接口失败只告警，页面继续展示列表行已有的信息 */
const open = async (row: TaskApi.SplitTaskVO) => {
  visible.value = true
  detail.value = { ...row }
  loading.value = true
  try {
    detail.value = await TaskApi.getSplitTaskDetail(Number(row.id))
  } catch (error) {
    console.warn('[数据拆分] 批次详情加载失败', error)
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
