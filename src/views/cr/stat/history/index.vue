<template>
  <!-- 历史数据查询：复用 StatPage 组件，附加筛选（截止时点 / 归档月份）由接口返回的 def.filters 决定 -->
  <StatPage code="history" />
</template>

<script setup lang="ts">
import StatPage from '../components/StatPage.vue'

defineOptions({ name: 'CrStatHistory' })
</script>
