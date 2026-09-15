<template>
  <Dialog v-model="dialogVisible" title="映射校验" width="900" :loading="loading">
    <el-alert
      v-if="report"
      class="mb-10px"
      :type="report.stats.errorCount ? 'error' : 'success'"
      :closable="false"
      show-icon
      :title="report.summary"
    />
    <!-- 统计口径与列表页顶部统计条一致，多列几个分类型计数 -->
    <div v-if="stats" class="mb-10px flex flex-wrap items-center gap-8px">
      <el-tag type="info" effect="plain">启用中的本地码值 {{ stats.localTotal }}</el-tag>
      <el-tag type="success" effect="plain">已映射 {{ stats.mappedLocalCount }}</el-tag>
      <el-tag :type="stats.unmappedCount ? 'danger' : 'info'" effect="plain">
        未映射 {{ stats.unmappedCount }}
      </el-tag>
      <el-tag type="primary" effect="plain">覆盖率 {{ stats.coverRate }}%</el-tag>
      <el-tag :type="stats.errorCount ? 'danger' : 'success'" effect="plain">
        必须处理 {{ stats.errorCount }}
      </el-tag>
      <el-tag v-if="stats.duplicateCount" type="warning" effect="plain">
        重复映射 {{ stats.duplicateCount }}
      </el-tag>
      <el-tag v-if="stats.missingRegCount" type="danger" effect="plain">
        监管码值不存在 {{ stats.missingRegCount }}
      </el-tag>
      <el-tag v-if="stats.disabledCount" type="info" effect="plain">
        已停用映射 {{ stats.disabledCount }}
      </el-tag>
    </div>
    <el-table v-if="issues.length" :data="issues" max-height="420">
      <el-table-column label="级别" align="center" width="90">
        <template #default="scope">
          <el-tag
            :type="scope.row.level === 'error' ? 'danger' : 'warning'"
            size="small"
            effect="plain"
            disable-transitions
          >
            {{ scope.row.level === 'error' ? '必须处理' : '提示' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" align="left" prop="type" width="120" />
      <el-table-column
        label="对象"
        align="left"
        prop="target"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        label="问题"
        align="left"
        prop="message"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column
        label="建议"
        align="left"
        prop="suggestion"
        min-width="200"
        show-overflow-tooltip
      />
    </el-table>
    <el-empty v-else-if="report" description="校验通过" />
    <el-empty v-else description="校验数据没拿到，请点「重新校验」" :image-size="60" />
    <template #footer>
      <el-button :disabled="loading" type="primary" @click="getReport">
        <Icon icon="ep:refresh" class="mr-5px" /> 重新校验
      </el-button>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import * as LocalMapApi from '@/api/cr/dict/localMap'

defineOptions({ name: 'CrDictLocalMapValidateDialog' })

const dialogVisible = ref(false)
const loading = ref(false)
/** 校验报告：issues 为空即视为校验通过 */
const report = ref<LocalMapApi.LocalMapReportVO | null>(null)
const stats = computed(() => report.value?.stats || null)
const issues = computed(() => report.value?.issues || [])

/** 校验只算不写，每次打开 / 点重新校验都重算一遍 */
const getReport = async () => {
  loading.value = true
  try {
    report.value = await LocalMapApi.validateLocalMap()
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
}

/** 打开弹窗 */
const open = () => {
  dialogVisible.value = true
  getReport()
}
defineExpose({ open })
</script>
