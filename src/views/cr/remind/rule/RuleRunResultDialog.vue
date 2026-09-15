<template>
  <Dialog v-model="dialogVisible" title="立即执行结果" width="760">
    <el-alert
      class="mb-10px"
      :type="result && result.generated > 0 ? 'success' : 'warning'"
      :closable="false"
      show-icon
      :title="result ? result.message : ''"
    />
    <el-row :gutter="12" class="mb-10px">
      <el-col :span="6">
        <div class="rounded-4px bg-gray-100 p-10px text-center">
          <div class="text-12px text-gray-500">命中待提醒单据</div>
          <div class="text-20px font-700">{{ result ? result.scanned : 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="rounded-4px bg-gray-100 p-10px text-center">
          <div class="text-12px text-gray-500">新生成提醒</div>
          <div class="text-20px font-700 text-green-600">{{ result ? result.generated : 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="rounded-4px bg-gray-100 p-10px text-center">
          <div class="text-12px text-gray-500">去重跳过</div>
          <div class="text-20px font-700 text-orange-500">{{ result ? result.skipped : 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="rounded-4px bg-gray-100 p-10px text-center">
          <div class="text-12px text-gray-500">涉及规则</div>
          <div class="text-20px font-700">{{ details.length }}</div>
        </div>
      </el-col>
    </el-row>
    <el-table :data="details" size="small" border show-summary :summary-method="summaryMethod">
      <el-table-column
        label="提醒规则"
        align="left"
        prop="rule"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="命中单据" align="center" prop="items" width="100" />
      <el-table-column label="新生成" align="center" prop="generated" width="100" />
      <el-table-column label="去重跳过" align="center" prop="skipped" width="100" />
    </el-table>
    <div class="mt-6px text-12px text-gray-500">
      去重键 = 规则 + 单据 +
      接收人：同一条单据不会被同一条规则反复提醒，生成结果可在「提醒记录」查看。
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import * as RemindRuleApi from '@/api/cr/remind/rule'

defineOptions({ name: 'CrRemindRuleRunResultDialog' })

const dialogVisible = ref(false)
const result = ref<RemindRuleApi.RemindRunResultVO | null>(null)
const details = computed(() => result.value?.details || [])

/** 合计行：数字列求和，文本列显示合计 */
const summaryMethod = (param: { columns: any[]; data: any[] }) => {
  return param.columns.map((column, index) => {
    if (index === 0) return '合计'
    const total = param.data.reduce((acc, row) => acc + Number(row[column.property] || 0), 0)
    return total
  })
}

/** 打开结果弹窗：直接展示接口返回，页面不写死任何数字 */
const open = (data: RemindRuleApi.RemindRunResultVO) => {
  result.value = data
  dialogVisible.value = true
}
defineExpose({ open })
</script>
