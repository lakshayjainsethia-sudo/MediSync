import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../utils/api'
import Card from '../components/ui/Card'
import { useAdminDashboard } from '../features/admin/hooks/useAdminDashboard'
import StatsOverview from '../features/admin/components/StatsOverview'
import AppointmentsInsights from '../features/admin/components/AppointmentsInsights'
import RevenueInsights from '../features/admin/components/RevenueInsights'
import BloodInsights from '../features/admin/components/BloodInsights'
import TopDoctorsTable from '../features/admin/components/TopDoctorsTable'
import UserManagementPanel from '../features/admin/components/UserManagementPanel'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { analytics, users, loading, error, refetchAnalytics, refetchUsers } = useAdminDashboard()
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
    setPendingActionIds(prev => ({ ...prev, [userId]: true }))

  const clearActionPending = (userId: string) =>
    setPendingActionIds(prev => {
      const updated = { ...prev }
      delete updated[userId]
      return updated
    })

  const handleApproveUser = async (pendingUserId: string) => {
    markActionPending(pendingUserId)
    try {
      await adminApi.approveUser(pendingUserId)
      toast.success('User approved successfully')
      await Promise.all([refetchUsers(), refetchAnalytics()])
    } catch (err) {
      console.error('Failed to approve user:', err)
      toast.error('Failed to approve user')
    } finally {
      clearActionPending(pendingUserId)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) {
      return
    }

    markActionPending(userId)
    try {
      await adminApi.deleteUser(userId)
      toast.success('User removed successfully')
      await Promise.all([refetchUsers(), refetchAnalytics()])
    } catch (err) {
      console.error('Failed to delete user:', err)
      toast.error('Failed to delete user')
    } finally {
      clearActionPending(userId)
    }
  }

  const isAnalyticsLoading = loading.analytics && !analytics

  if (isAnalyticsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
            {error}
          </div>
        )}

        {analytics ? (
          <>
            <StatsOverview stats={analytics} loading={loading.analytics} onRefresh={refetchAnalytics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AppointmentsInsights
                statusData={analytics.appointmentsByStatus}
                trendData={analytics.appointmentsByDay}
              />
              <RevenueInsights
                trendData={analytics.revenueTrend}
                breakdownData={analytics.revenueBreakdown}
                userDistribution={analytics.userDistribution}
              />
              <BloodInsights data={analytics.bloodLevels} />
            </div>

            <TopDoctorsTable doctors={analytics.topDoctors} />
          </>
        ) : (
          <Card className="p-6">
            <p className="text-slate-600">
              We couldn't load analytics data. Please try refreshing the dashboard.
            </p>
          </Card>
        )}

        <UserManagementPanel
          users={users}
          loading={loading.users}
          pendingActionIds={pendingActionIds}
          onApprove={handleApproveUser}
          onDelete={handleDeleteUser}
        />
      </div>
    </div>
  )
}
