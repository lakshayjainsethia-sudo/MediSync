import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { adminApi } from '../../../utils/api'
import { DashboardStats, User } from '../../../types'

interface UseAdminDashboardResponse {
  analytics: DashboardStats | null
  users: User[]
  loading: {
    analytics: boolean
    users: boolean
    moreUsers: boolean
  }
  error: string | null
  hasMore: boolean
  page: number
  refetchAnalytics: () => Promise<void>
  refetchUsers: () => Promise<void>
  fetchMoreUsers: () => Promise<void>
}

export function useAdminDashboard(): UseAdminDashboardResponse {
  const [analytics, setAnalytics] = useState<DashboardStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState({ analytics: true, users: true, moreUsers: false })
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(prev => ({ ...prev, analytics: true }))
    try {
      const response = await adminApi.getAnalytics()
      setAnalytics(response.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Unable to load analytics data right now.')
    } finally {
      setLoading(prev => ({ ...prev, analytics: false }))
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(prev => ({ ...prev, users: true }))
    try {
      setPage(1)
      const response = await adminApi.getAllUsers(1)
      setUsers(response.data.users)
      setHasMore(response.data.hasMore)
    } catch (err) {
      console.error('Failed to fetch users:', err)
      toast.error('Unable to load users')
    } finally {
      setLoading(prev => ({ ...prev, users: false }))
    }
  }, [])

  const fetchMoreUsers = useCallback(async () => {
    if (!hasMore || loading.moreUsers) return
    
    setLoading(prev => ({ ...prev, moreUsers: true }))
    try {
      const nextPage = page + 1
      const response = await adminApi.getAllUsers(nextPage)
      setUsers(prev => [...prev, ...response.data.users])
      setHasMore(response.data.hasMore)
      setPage(nextPage)
    } catch (err) {
      console.error('Failed to fetch more users:', err)
      toast.error('Unable to load more users')
    } finally {
      setLoading(prev => ({ ...prev, moreUsers: false }))
    }
  }, [hasMore, loading.moreUsers, page])

  useEffect(() => {
    fetchAnalytics()
    fetchUsers()
  }, [fetchAnalytics, fetchUsers])

  return {
    analytics,
    users,
    loading,
    error,
    hasMore,
    page,
    refetchAnalytics: fetchAnalytics,
    refetchUsers: fetchUsers,
    fetchMoreUsers
  }
}


