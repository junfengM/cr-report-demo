<template>
  <Dialog v-model="dialogVisible" title="数据权限生效判断" width="960">
    <!-- 判断上下文：选人 + 选报表，结果由接口给，不在前端算第二遍 -->
    <el-form :inline="true" label-width="60px" class="-mb-15px">
      <el-form-item label="用户">
        <el-select
          v-model="userId"
          placeholder="请选择用户"
          filterable
          class="!w-260px"
          @change="handleDecide"
        >
          <el-option
            v-for="user in users"
            :key="user.id"
            :label="formatUser(user)"
            :value="user.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报表">
        <el-select
          v-model="reportId"
          placeholder="不选表示全部报表"
          clearable
          filterable
          class="!w-280px"
          @change="handleDecide"
        >
          <el-option
            v-for="report in reportOptions"
            :key="report.id"
            :label="report.reportCode + ' ' + report.reportName"
            :value="report.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="handleDecide">
          <Icon icon="ep:magic-stick" class="mr-5px" /> 生效判断
        </el-button>
      </el-form-item>
    </el-form>

    <el-empty
      v-if="!decision"
      class="mt-20px"
      description="选择用户与报表后点「生效判断」：这里会逐条说明哪条规则生效、哪条被覆盖、哪条因停用或范围不符没生效"
    />

    <template v-else>
      <el-descriptions class="mt-15px" title="用户归属" :column="3" border>
        <el-descriptions-item label="用户">{{ decision.user.nickname }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{
          decision.user.deptName || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="归属机构">
          {{ decision.user.orgName || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 生效结果卡片：一句话结论 + 可见机构清单 -->
      <el-card class="mt-15px" shadow="never">
        <template #header>
          <div class="flex items-center">
            <span class="text-14px font-700">生效结果</span>
            <el-tag class="ml-10px" :type="effectiveTagType" size="small" disable-transitions>
              {{ decision.effective.scopeTypeLabel }}
            </el-tag>
          </div>
        </template>
        <div class="mb-8px text-13px">{{ decision.effective.source }}</div>
        <div v-if="decision.effective.superAdmin" class="text-13px text-gray-500">
          <el-tag type="warning" size="small" disable-transitions>系统管理员不受限</el-tag>
          <span class="ml-8px">可见全部机构数据。</span>
        </div>
        <div v-else>
          <span class="mr-8px text-13px text-gray-500">可见机构：</span>
          <el-tag
            v-for="name in decision.effective.orgNames"
            :key="name"
            class="mr-5px mb-5px"
            size="small"
            disable-transitions
          >
            {{ name }}
          </el-tag>
          <span v-if="!decision.effective.orgNames.length" class="text-13px text-gray-400">
            无：该报表上看不到任何机构的数据
          </span>
        </div>
      </el-card>

      <!-- 逐条判断：生效中 / 被覆盖 / 已停用 / 主体不匹配 / 报表不匹配 -->
      <el-table class="mt-15px" :data="decision.rows" max-height="360">
        <el-table-column label="规则 ID" align="center" prop="id" width="80" />
        <el-table-column
          label="主体"
          align="left"
          prop="subjectName"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column
          label="报表范围"
          align="left"
          prop="reportName"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column label="机构范围类型" align="center" prop="scopeTypeLabel" width="120" />
        <el-table-column label="优先级" align="center" prop="priority" width="80" />
        <el-table-column label="状态" align="center" prop="status" width="90">
          <template #default="scope">
            <dict-tag :type="DICT_TYPE.CR_ENABLE_STATUS" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="判断" align="center" prop="stateLabel" width="110">
          <template #default="scope">
            <el-tag :type="stateTagType(scope.row.state)" size="small" disable-transitions>
              {{ scope.row.stateLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="原因"
          align="left"
          prop="reason"
          min-width="240"
          show-overflow-tooltip
        />
      </el-table>
    </template>

    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { DICT_TYPE } from '@/utils/dict'
import * as DataScopeApi from '@/api/cr/system/dataScope'
import { getSubjectOptions, type SubjectOptionVO } from '@/api/cr/system/common'
import { getCollectReportOptions, type CollectReportOptionVO } from '@/api/cr/collect/common'

defineOptions({ name: 'CrSystemDataScopeDecisionDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const loading = ref(false)
const userId = ref<number>()
const reportId = ref<number>()
const users = ref<SubjectOptionVO['users']>([])
const reportOptions = ref<CollectReportOptionVO[]>([])
const decision = ref<DataScopeApi.DataScopeDecisionVO>()

/** 用户选项带部门：同名的人靠部门区分 */
const formatUser = (user: SubjectOptionVO['users'][number]) =>
  user.deptName ? user.name + '（' + user.deptName + '）' : user.name

/** 判断标签配色：生效中 success / 被覆盖 warning / 已停用、主体不匹配、报表不匹配 info */
const stateTagType = (state: string): 'success' | 'warning' | 'info' => {
  if (state === 'EFFECTIVE') return 'success'
  if (state === 'COVERED') return 'warning'
  return 'info'
}

/** 结论标签：管理员 warning / 命中规则 success / 回落角色默认 info */
const effectiveTagType = computed<'success' | 'warning' | 'info'>(() => {
  if (!decision.value) return 'info'
  if (decision.value.effective.superAdmin) return 'warning'
  return decision.value.effective.matched ? 'success' : 'info'
})

/** 生效判断：结果全部来自接口，页面只做展示 */
const handleDecide = async () => {
  if (!userId.value) {
    message.warning('请先选择要判断的用户')
    return
  }
  loading.value = true
  try {
    decision.value = await DataScopeApi.getDataScopeDecisions(userId.value, reportId.value || 0)
  } finally {
    loading.value = false
  }
}

/**
 * 打开弹窗
 * @param presetUserId 规则主体是用户时带出该用户；角色规则留空，由使用人自己选人
 * @param presetReportId 带出该行规则的报表范围；空 / 0 表示全部报表
 */
const open = async (presetUserId?: number, presetReportId?: number) => {
  dialogVisible.value = true
  userId.value = presetUserId
  reportId.value = presetReportId || undefined
  decision.value = undefined
  if (!users.value.length) users.value = (await getSubjectOptions())?.users || []
  if (!reportOptions.value.length) reportOptions.value = (await getCollectReportOptions()) || []
  // 带出了用户就直接给结论，省一次点击
  if (userId.value) await handleDecide()
}
defineExpose({ open })
</script>
