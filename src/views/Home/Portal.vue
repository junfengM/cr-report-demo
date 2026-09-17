<template>
  <div class="portal-page">
    <div class="portal-shell">
      <div class="portal-header">
        <div class="portal-brand">
          <div class="portal-logo">
            <Icon icon="ep:connection" />
          </div>
          <div>
            <div class="portal-eyebrow">REGULATORY REPORTING PLATFORM</div>
            <h1 class="portal-title">统一监管报送平台</h1>
            <p class="portal-subtitle">统一入口 · 分系统管理 · 一站式监管报送</p>
          </div>
        </div>
        <div class="portal-guide">
          <Icon icon="ep:arrow-right" class="mr-5px" />
          请选择要进入的报送系统
        </div>
      </div>

      <el-row :gutter="20" class="portal-entry-row">
        <el-col v-for="entry in entries" :key="entry.name" :xs="24" :sm="12" :lg="8">
          <el-card
            class="portal-entry-card"
            :class="{ 'is-disabled': !entry.enabled }"
            shadow="hover"
            @click="handleEntry(entry)"
          >
            <div class="entry-topline">
              <div class="entry-icon" :class="entry.iconClass">
                <Icon :icon="entry.icon" />
              </div>
              <el-tag :type="entry.enabled ? 'success' : 'info'" effect="plain">
                {{ entry.status }}
              </el-tag>
            </div>
            <div class="entry-name">{{ entry.name }}</div>
            <div class="entry-description">{{ entry.description }}</div>
            <el-button
              class="entry-action"
              :type="entry.enabled ? 'primary' : 'info'"
              :plain="!entry.enabled"
              :disabled="!entry.enabled"
              @click.stop="handleEntry(entry)"
            >
              {{ entry.enabled ? '进入系统' : '暂未开放' }}
              <Icon v-if="entry.enabled" icon="ep:arrow-right" class="ml-5px" />
            </el-button>
          </el-card>
        </el-col>
      </el-row>

      <div class="portal-footer">华信人寿保险股份有限公司 · 统一监管报送平台</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
type PortalEntry = {
  name: string
  description: string
  icon: string
  iconClass: string
  status: string
  enabled: boolean
}

defineOptions({ name: 'HomePortal' })

const router = useRouter()
const message = useMessage()

const entries: PortalEntry[] = [
  {
    name: 'EAST报送',
    description: 'EAST监管数据报送系统，内部功能后续建设。',
    icon: 'ep:data-analysis',
    iconClass: 'entry-icon-blue',
    status: '暂未开放',
    enabled: false
  },
  {
    name: '保单登记报送',
    description: '保单登记数据报送系统，内部功能后续建设。',
    icon: 'ep:document-checked',
    iconClass: 'entry-icon-orange',
    status: '暂未开放',
    enabled: false
  },
  {
    name: '新统信报送',
    description: '新统信监管报送全流程功能，进入后使用当前已建设页面。',
    icon: 'ep:finished',
    iconClass: 'entry-icon-green',
    status: '可进入',
    enabled: true
  }
]

const handleEntry = (entry: PortalEntry) => {
  if (!entry.enabled) {
    message.info(`${entry.name}功能暂未开放`)
    return
  }
  router.push('/new-unified/home')
}
</script>

<style lang="scss" scoped>
.portal-page {
  min-height: 100%;
  padding: 36px 32px 24px;
  background:
    radial-gradient(circle at 8% 8%, rgb(64 158 255 / 12%), transparent 28%),
    linear-gradient(135deg, var(--el-fill-color-light), var(--el-bg-color));
}

.portal-shell {
  max-width: 1180px;
  margin: 0 auto;
}

.portal-header {
  display: flex;
  padding: 26px 30px;
  background: rgb(255 255 255 / 84%);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgb(31 56 88 / 8%);
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.portal-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.portal-logo {
  display: flex;
  width: 58px;
  height: 58px;
  font-size: 30px;
  color: #fff;
  background: linear-gradient(135deg, #409eff, #36cfc9);
  border-radius: 16px;
  box-shadow: 0 8px 18px rgb(64 158 255 / 26%);
  align-items: center;
  justify-content: center;
}

.portal-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.6px;
  color: var(--el-color-primary);
}

.portal-title {
  margin: 5px 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.portal-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.portal-guide {
  display: flex;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  align-items: center;
}

.portal-entry-row {
  margin-top: 24px;
}

.portal-entry-card {
  min-height: 260px;
  cursor: pointer;
  border-radius: 14px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.portal-entry-card:not(.is-disabled):hover {
  transform: translateY(-4px);
}

.portal-entry-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.78;
}

.entry-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.entry-icon {
  display: flex;
  width: 56px;
  height: 56px;
  font-size: 28px;
  border-radius: 15px;
  align-items: center;
  justify-content: center;
}

.entry-icon-blue {
  color: #409eff;
  background: #ecf5ff;
}

.entry-icon-orange {
  color: #e6a23c;
  background: #fdf6ec;
}

.entry-icon-green {
  color: #67c23a;
  background: #f0f9eb;
}

.entry-name {
  margin-top: 24px;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.entry-description {
  min-height: 44px;
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.entry-action {
  margin-top: 20px;
}

.portal-footer {
  padding: 28px 0 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

@media (width <= 700px) {
  .portal-page {
    padding: 20px 16px;
  }

  .portal-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px;
  }

  .portal-guide {
    display: none;
  }
}
</style>
