import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useAdminDashboard } from '../features/admin/hooks/useAdminDashboard'
import UserManagementPanel from '../features/admin/components/UserManagementPanel'
import { adminApi } from '../utils/api'

export default function AdminUsers() {
  const { user } = useAuth()
  const { users, loading, hasMore, fetchMoreUsers, refetchUsers, refetchAnalytics } = useAdminDashboard()
  const [pendingActionIds, setPendingActionIds] = useState<Record<string, boolean>>({})

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  const markActionPending = (userId: string) =>
    setPendingActionIds((prev) => ({ ...prev, [userId]: true }))

  const clearActionPending = (userId: string) =>
    setPendingActionIds((prev) => {
      const updated = { ...prev }
      delete updated[userId]
      return updated
    })

  const handleApprove = async (userId: string) => {
    markActionPending(userId)
    try {
      await adminApi.approveUser(userId)
      toast.success('User approved successfully')
      await Promise.all([refetchUsers(), refetchAnalytics()])
    } catch (error) {
      console.error('Failed to approve user:', error)
      toast.error('Failed to approve user')
    } finally {
      clearActionPending(userId)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) {
      return
    }

    markActionPending(userId)
    try {
      await adminApi.deleteUser(userId)
      toast.success('User removed successfully')
      await Promise.all([refetchUsers(), refetchAnalytics()])
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.error('Failed to delete user')
    } finally {
      clearActionPending(userId)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-600 mt-1">Review and manage platform users</p>
        </div>

        <UserManagementPanel
          users={users}
          loading={loading.users}
          loadingMore={loading.moreUsers}
          hasMore={hasMore}
          onLoadMore={fetchMoreUsers}
          pendingActionIds={pendingActionIds}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

