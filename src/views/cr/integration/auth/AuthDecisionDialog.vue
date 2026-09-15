<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="980">
    <div v-loading="loading" class="min-h-120px">
      <template v-if="data">
        <el-descriptions :column="3" border class="mb-12px">
          <el-descriptions-item label="接入系统">
            {{ data.system.sysName }}（{{ data.system.sysCode }}）
          </el-descriptions-item>
          <el-descriptions-item label="系统类型">{{
            data.system.sysTypeLabel
          }}</el-descriptions-item>
          <el-descriptions-item label="系统状态">
            <el-tag
              :type="data.system.status === 1 ? 'success' : 'info'"
              size="small"
              disable-transitions
            >
              {{ data.system.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 生效结论：命中哪一条 / 未命中即默认拒绝 -->
        <el-alert
          v-if="data.effective.matched"
          class="mb-12px"
          type="success"
          :closable="false"
          show-icon
          :title="data.effective.source"
        >
          <div class="text-13px leading-22px">
            <div>生效接口范围：{{ data.effective.apiScope || '-' }}</div>
            <div>生效机构范围：{{ data.effective.orgNames || '全部机构' }}</div>
            <div>生效报表范围：{{ data.effective.reportNames || '全部报表' }}</div>
          </div>
        </el-alert>
        <el-alert
          v-else
          class="mb-12px"
          type="error"
          :closable="false"
          show-icon
          title="未命中任何启用授权 → 默认拒绝"
          :description="data.effective.source"
        />

        <el-table v-loading="loading" :data="data.rows" size="small" border>
          <el-table-column label="授权ID" align="center" prop="id" width="80" />
          <el-table-column
            label="接口范围"
            align="left"
            prop="apiScope"
            min-width="170"
            show-overflow-tooltip
          />
          <el-table-column
            label="机构范围"
            align="left"
            prop="orgNames"
            min-width="190"
            show-overflow-tooltip
          />
          <el-table-column
            label="报表范围"
            align="left"
            prop="reportNames"
            min-width="170"
            show-overflow-tooltip
          />
          <el-table-column label="优先级" align="center" prop="priority" width="80" />
          <el-table-column label="状态" align="center" prop="status" width="80">
            <template #default="scope">
              <el-tag
                :type="scope.row.status === 1 ? 'success' : 'info'"
                size="small"
                disable-transitions
              >
                {{ scope.row.status === 1 ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="判定" align="center" prop="state" width="90">
            <template #default="scope">
              <el-tag :type="stateTagType(scope.row.state)" size="small" disable-transitions>
                {{ scope.row.state }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="判定说明"
            align="left"
            prop="reason"
            min-width="230"
            show-overflow-tooltip
          />
        </el-table>
        <div class="mt-8px text-12px text-gray-500">
          判定口径：同一接入系统的多条授权，接口范围更精确（无通配
          *）优先，其次优先级小的优先，再按创建顺序；「被覆盖」与「已停用」的授权不生效，不能当作可用授权使用。
        </div>
      </template>
      <el-empty v-else-if="!loading" description="暂无判定结果" />
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import * as IntegrationAuthApi from '@/api/cr/integration/auth'

defineOptions({ name: 'CrIntegrationAuthDecisionDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const loading = ref(false)
const dialogTitle = ref('生效判断')
const data = ref<IntegrationAuthApi.IntegrationAuthDecisionVO | null>(null)

/** 判定结论 → 标签颜色：生效中 / 被覆盖 / 已停用 */
const stateTagType = (state?: string) => {
  if (state === '生效中') return 'success'
  if (state === '被覆盖') return 'warning'
  return 'info'
}

/** 打开弹窗：只读判定，不写任何数据 */
const open = async (sysCode: string, sysName?: string) => {
  dialogVisible.value = true
  dialogTitle.value = '生效判断' + (sysName ? '：' + sysName : sysCode ? '：' + sysCode : '')
  data.value = null
  loading.value = true
  try {
    data.value = await IntegrationAuthApi.getAuthDecisions(sysCode)
  } catch {
    // 服务端中文原因（请先选择接入系统 / 接入系统不存在）已由 axios 拦截器统一提示
    if (!sysCode) message.warning('请先选择接入系统')
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
