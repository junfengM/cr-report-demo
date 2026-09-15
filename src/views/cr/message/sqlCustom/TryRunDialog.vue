<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="860">
    <div v-loading="loading">
      <template v-if="result">
        <!-- 结论先摆出来：通过 / 不通过一眼可见，细节在下面 -->
        <el-alert
          class="mb-12px"
          :type="result.passed ? 'success' : 'error'"
          :closable="false"
          show-icon
          :title="result.conclusion"
        />
        <el-alert
          class="mb-12px"
          type="info"
          :closable="false"
          show-icon
          title="试运行只做静态解析、不执行 SQL，所以不会改任何数据，也不会返回查询结果。结论是确定性的：同一段 SQL 每次得到同样的检查结果。"
        />
        <el-descriptions :column="3" border size="small" class="mb-12px">
          <el-descriptions-item label="公式">{{ result.formulaCode }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ result.formulaName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="检查时间">{{ result.checkedAt }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="result.checks" border size="small">
          <el-table-column label="检查项" prop="name" width="140" />
          <el-table-column label="结论" width="100" align="center">
            <template #default="scope">
              <el-tag
                :type="
                  scope.row.level === 'pass'
                    ? 'success'
                    : scope.row.level === 'warn'
                      ? 'warning'
                      : 'danger'
                "
                size="small"
                disable-transitions
              >
                {{
                  scope.row.level === 'pass'
                    ? '通过'
                    : scope.row.level === 'warn'
                      ? '提示'
                      : '不通过'
                }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="说明" prop="detail" min-width="420" show-overflow-tooltip />
        </el-table>

        <div class="mt-12px">
          <div class="mb-6px text-13px text-[#606266]">
            占位参数（保存后由调度 / 页面传值，本页不执行）：
            <el-tag
              v-for="item in result.placeholders"
              :key="item"
              class="ml-5px"
              size="small"
              type="primary"
              effect="plain"
            >
              {{ item }}
            </el-tag>
            <span v-if="!result.placeholders.length" class="text-[#909399]">无</span>
          </div>
          <div class="text-13px text-[#606266]">
            引用表（对照《报送配置 → 表管理》）：
            <template v-if="result.tables.length">
              <el-tag
                v-for="item in result.tables"
                :key="item.name"
                class="ml-5px"
                size="small"
                type="success"
                effect="plain"
              >
                {{ item.tableCode }} {{ item.cnName }}（{{ item.name }}）
              </el-tag>
            </template>
            <span v-else class="text-[#909399]">未解析到</span>
            <el-tag
              v-for="item in result.unknownTables"
              :key="item"
              class="ml-5px"
              size="small"
              type="danger"
              effect="plain"
            >
              {{ item }}（未登记）
            </el-tag>
          </div>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="暂无试运行结果" />
    </div>
    <template #footer>
      <el-button :disabled="loading" @click="handleRun">重新试运行</el-button>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { tryRunSqlFormula } from '@/api/cr/message/sqlCustom'
import type { FormulaTryRunVO } from '@/api/cr/message/sqlCustom'

defineOptions({ name: 'CrMessageSqlCustomTryRunDialog' })

const dialogVisible = ref(false)
const dialogTitle = ref('SQL 试运行')
const loading = ref(false)
const result = ref<FormulaTryRunVO>()

/** 试运行目标：库里那条（id）或表单里还没保存的草稿（sqlText） */
const target = ref<{ id?: number; sqlText?: string; code?: string; name?: string }>({})

const handleRun = async () => {
  loading.value = true
  try {
    result.value = await tryRunSqlFormula({ id: target.value.id, sqlText: target.value.sqlText })
  } catch {
    // 业务校验（例如既没 id 也没正文）由请求拦截器弹中文提示，这里只要不留旧结果
    result.value = undefined
  } finally {
    loading.value = false
  }
}

const open = async (options: { id?: number; sqlText?: string; code?: string; name?: string }) => {
  target.value = options
  dialogTitle.value = 'SQL 试运行 — ' + (options.code || '未保存的草稿')
  result.value = undefined
  dialogVisible.value = true
  await handleRun()
}
defineExpose({ open })
</script>
