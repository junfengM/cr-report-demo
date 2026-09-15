import request from '@/config/axios'

/** 集群节点 VO */
export interface ClusterVO {
  id?: number
  /** 节点名 */
  nodeName: string
  /** 节点地址（IP:端口） */
  address: string
  /** 角色：master / worker，见字典 cr_cluster_role */
  role: string
  /** 状态：1 在线 / 0 离线，见字典 cr_cluster_status */
  status: number
  remark: string
  createUser?: string
  createTime?: string
  updateUser?: string
  updateTime?: string
}

// 分页查询集群节点
export const getClusterPage = (params: any) => request.get({ url: '/cr/cluster/page', params })

// 查询集群节点详情
export const getCluster = (id: number) => request.get({ url: '/cr/cluster/get?id=' + id })

// 新增集群节点
export const createCluster = (data: ClusterVO) => request.post({ url: '/cr/cluster/create', data })

// 修改集群节点
export const updateCluster = (data: ClusterVO) => request.put({ url: '/cr/cluster/update', data })

// 删除集群节点
export const deleteCluster = (id: number) => request.delete({ url: '/cr/cluster/delete?id=' + id })

// 批量删除集群节点
export const deleteClusterList = (ids: number[]) =>
  request.delete({ url: '/cr/cluster/delete-list', params: { ids: ids.join(',') } })

// 导出集群节点
export const exportCluster = (params: any) =>
  request.download({ url: '/cr/cluster/export-excel', params })
