/**
 * Mock Handler — 报送数据统计系列查询（P2，10 个查询）
 *
 * 接口：
 *   GET /cr/stat/meta   → 10 个查询的定义（标题 / 说明 / 口径）+ 筛选下拉
 *   GET /cr/stat/data   → 按 code + 机构 / 报表 / 期次 当场汇总出表格 + 卡片 + 图表数据
 *
 * 只读接口，不锁角色：统计是"给谁看"由菜单决定，锁了反而会把审核岗关在门外。
 * 所有数字都从真实业务表汇总（见 db/crStat.ts 顶部说明），没有独立的统计结果表。
 */
import { onGet } from '../route'
import { STAT_DEFS, statFilterOptions, statPayload } from '../db/crStat'

onGet('/cr/stat/meta', () => ({
  defs: STAT_DEFS.map((item) => ({ ...item })),
  filterOptions: statFilterOptions()
}))

onGet('/cr/stat/data', (ctx) => {
  const code = String(ctx.params.code || '')
  if (!code) throw new Error('缺少统计查询编码 code')
  return statPayload(code, ctx.params)
})
