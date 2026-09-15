<template>
  <Dialog v-model="dialogVisible" :title="title" width="820">
    <div v-loading="loading">
      <el-alert
        class="mb-10px"
        type="info"
        :closable="false"
        show-icon
        title="留痕记录动作、操作人与当时的指纹（新建 / 修改 / 启用 / 停用 / 删除 / 轮换都记），任何环节都不会出现密钥明文：指纹变了就说明轮换发生过。"
      />
      <el-empty v-if="!loading && trailList.length === 0" description="暂无留痕记录" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="item in trailList"
          :key="item.id"
          :timestamp="item.time"
          placement="top"
          :type="item.action === '轮换' ? 'warning' : item.action === '停用' ? 'danger' : 'success'"
        >
          <div class="flex items-center">
            <el-tag
              size="small"
              :type="
                item.action === '轮换' ? 'warning' : item.action === '停用' ? 'danger' : 'success'
              "
            >
              {{ item.action }}
            </el-tag>
            <span class="ml-8px font-600">{{ item.secretCode }}</span>
            <span class="ml-8px text-12px text-gray-500">操作人：{{ item.user }}</span>
          </div>
          <div class="mt-4px text-12px">指纹：{{ item.fingerprint }}</div>
          <div class="mt-2px text-12px text-gray-500">说明：{{ item.remark || '—' }}</div>
        </el-timeline-item>
      </el-timeline>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import * as ServiceSecretApi from '@/api/cr/service/secret'

defineOptions({ name: 'CrServiceSecretTrailDialog' })

const dialogVisible = ref(false)
const loading = ref(false)
const trailList = ref<ServiceSecretApi.SecretTrailVO[]>([])
const title = ref('密钥留痕')

/** 打开留痕：传 secretId 看单条密钥，不传则看全部密钥的操作留痕总览 */
const open = async (secretId?: number, secretName?: string) => {
  dialogVisible.value = true
  title.value = secretName ? '密钥留痕：' + secretName : '密钥留痕总览'
  trailList.value = []
  loading.value = true
  try {
    trailList.value = (await ServiceSecretApi.getSecretTrail(secretId)) || []
  } finally {
    loading.value = false
  }
}
defineExpose({ open })
</script>
