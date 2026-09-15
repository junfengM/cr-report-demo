<template>
  <Dialog v-model="dialogVisible" title="生效判断" width="1080">
    <el-form :inline="true" :model="queryParams" label-width="60px">
      <el-form-item label="用户">
        <el-select
          v-model="queryParams.userId"
          placeholder="请选择用户"
          filterable
          class="!w-280px"
          @change="getDecision"
        >
          <el-option
            v-for="user in userOptions"
            :key="user.id"
            :label="user.name + '（' + (user.deptName || '未归属部门') + '）'"
            :value="user.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表">
        <el-select
          v-model="queryParams.reportId"
          placeholder="不选表示全部报表"
          clearable
          filterable
          class="!w-280px"
          @change="getDecision"
        >
          <el-option label="全部报表" :value="0" />
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <div v-loading="loading">
      <template v-if="decision">
        <!-- 1. 判断对象 -->
        <el-descriptions class="mb-10px" :column="2" border>
          <el-descriptions-item label="用户昵称">
            {{ decision.user.nickname || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="所在部门">
            {{ decision.user.deptName || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 2. 生效结果 -->
        <el-card class="mb-10px" shadow="never">
          <template #header>
            <span class="font-700">生效结果</span>
          </template>
          <template v-if="decision.effective.superAdmin">
            <el-tag class="mr-10px" type="success" size="small" disable-transitions>
              系统管理员不受限
            </el-tag>
            <span class="text-[var(--el-text-color-secondary)]">
              {{ decision.effective.source }}
            </span>
          </template>
          <template v-else>
            <el-alert
              v-if="!decision.effective.matched"
              class="mb-10px"
              type="warning"
              :closable="false"
              show-icon
              title="未命中规则 → 默认拒绝"
            />
            <div class="mb-10px">
              <span class="mr-5px">判定来源：</span>
              <span>{{ decision.effective.source }}</span>
            </div>
            <div>
              <span class="mr-5px">允许动作：</span>
              <template v-if="decision.effective.actionLabels.length">
                <el-tag
                  v-for="label in decision.effective.actionLabels"
                  :key="label"
                  class="mr-5px"
                  size="small"
                  disable-transitions
                >
                  {{ label }}
                </el-tag>
              </template>
              <span v-else class="text-[#c0c4cc]">无（默认拒绝）</span>
            </div>
          </template>
        </el-card>

        <!-- 3. 规则逐条判断 -->
        <el-table :data="decision.rows" size="small" max-height="360">
          <el-table-column label="规则" align="center" prop="id" width="70" />
          <el-table-column label="部门" prop="deptName" min-width="120" show-overflow-tooltip />
          <el-table-column
            label="报表范围"
            prop="reportName"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column label="允许动作" min-width="180">
            <template #default="scope">
              <el-tag
                v-for="label in scope.row.actionLabels"
                :key="label"
                class="mr-5px"
                size="small"
                disable-transitions
              >
                {{ label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="优先级" align="center" prop="priority" width="80" />
          <el-table-column label="状态" align="center" prop="status" width="80">
            <template #default="scope">
              <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
            </template>
          </el-table-column>
          <el-table-column label="判断" align="center" prop="stateLabel" width="100">
            <template #default="scope">
              <el-tag
                :type="stateTagType(scope.row.state)"
                size="small"
                effect="plain"
                disable-transitions
              >
                {{ scope.row.stateLabel }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原因" prop="reason" min-width="220" show-overflow-tooltip />
        </el-table>
      </template>
      <el-empty v-else-if="!loading" description="请选择用户后查看生效判断" />
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as DeptScopeApi from '@/api/cr/system/deptScope'
import { getSubjectOptions, type SubjectOptionVO } from '@/api/cr/system/common'
import { getCollectReportOptions, type CollectReportOptionVO } from '@/api/cr/collect/common'

defineOptions({ name: 'CrSystemDeptScopeDecisionDialog' })

const dialogVisible = ref(false)
const loading = ref(false)
const userOptions = ref<SubjectOptionVO['users']>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const decision = ref<DeptScopeApi.DeptScopeDecisionVO>()
const queryParams = reactive({
  userId: undefined as number | undefined,
  reportId: undefined as number | undefined
})

/** 逐条判断的标签配色：生效中用绿、被覆盖用黄、其余（已停用 / 部门不匹配 / 报表不匹配）用灰 */
const stateTagType = (state: string) => {
  if (state === 'EFFECTIVE') return 'success'
  if (state === 'COVERED') return 'warning'
  return 'info'
}

/** 打开弹窗：从列表行进来时带上该行的报表范围，未传则默认全部报表（0） */
const open = async (row?: DeptScopeApi.DeptScopeVO) => {
  dialogVisible.value = true
  decision.value = undefined
  queryParams.userId = undefined
  queryParams.reportId = row?.reportId ?? 0
  // 用户 / 报表下拉一次取全：弹窗内切换只重新判定，不再请求下拉
  if (!userOptions.value.length) userOptions.value = (await getSubjectOptions())?.users || []
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
}
defineExpose({ open })

/** 生效判断：必须带 userId（接口侧校验），报表为空按全部报表（0）传给服务端 */
const getDecision = async () => {
  if (!queryParams.userId) {
    decision.value = undefined
    return
  }
  loading.value = true
  try {
    decision.value = await DeptScopeApi.getDeptScopeDecisions(
      queryParams.userId,
      queryParams.reportId || 0
    )
  } finally {
    loading.value = false
  }
}
</script>
