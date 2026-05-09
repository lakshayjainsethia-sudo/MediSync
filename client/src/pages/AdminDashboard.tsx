import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../utils/api'
import Card from '../components/ui/Card'
import { useAdminDashboard } from '../features/admin/hooks/useAdminDashboard'
import StatsOverview from '../features/admin/components/StatsOverview'
import AppointmentsInsights from '../features/admin/components/AppointmentsInsights'
import RevenueInsights from '../features/admin/components/RevenueInsights'
import { User } from '../types'
import { Star } from 'lucide-react'

import UserManagementPanel from '../features/admin/components/UserManagementPanel'
import EquipmentManager from '../features/admin/components/EquipmentManager'
import PharmacyManager from '../features/admin/components/PharmacyManager'

type TabType = 'analytics' | 'users' | 'equipment' | 'medicines'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { analytics, users, loading, error, refetchAnalytics, refetchUsers } = useAdminDashboard()
  const [pendingActionIds, setPendingActionIds] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<TabType>('analytics')
  const [topDoctors, setTopDoctors] = useState<User[]>([])

  useEffect(() => {
    fetchTopDoctors()
  }, [])

  const fetchTopDoctors = async () => {
    try {
      const { doctorsApi } = await import('../utils/api')
      const response = await doctorsApi.getTop()
      setTopDoctors(response.data)
    } catch (error) {
      console.error('Failed to fetch top doctors', error)
    }
  }

  useEffect(() => {
    if (user && user.role === 'admin') {
      const socket = io('http://localhost:5000', { withCredentials: true });
      
      socket.on('connect', () => {
        // Connected
      });

      socket.on('low_stock_alert', (data) => {
        toast.warning(`Low Stock Alert: ${data.name} is down to ${data.currentStock} units!`);
      });

      socket.on('dashboard_update', () => {
        refetchAnalytics();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

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

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`${
                activeTab === 'analytics'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Analytics & Insights
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('equipment')}
              className={`${
                activeTab === 'equipment'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Equipment Tracking
            </button>
            <button
              onClick={() => setActiveTab('medicines')}
              className={`${
                activeTab === 'medicines'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Medicines
            </button>
          </nav>
        </div>

        {activeTab === 'analytics' && (
          analytics ? (
          <>
            <StatsOverview stats={analytics} loading={loading.analytics} onRefresh={refetchAnalytics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AppointmentsInsights
                statusData={analytics.appointmentsByStatus}
                trendData={analytics.appointmentsByDay}
                triageData={analytics.triageDistribution}
              />
              <RevenueInsights
                trendData={analytics.revenueTrend}
                breakdownData={analytics.revenueBreakdown}
                userDistribution={analytics.userDistribution}
              />
            </div>
            
            <div className="mt-6">
              <Card>
                <div className="px-6 py-4 border-b border-gray-200 bg-amber-50/50">
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-amber-500 fill-current" />
                    <h2 className="text-xl font-semibold text-slate-900">Top Rated Doctors</h2>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {topDoctors.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      No ratings available yet.
                    </div>
                  ) : (
                    topDoctors.map(doc => (
                      <div key={doc._id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">Dr. {doc.name}</h3>
                          <p className="text-xs text-slate-500">{doc.specialization}</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center text-amber-500">
                            <Star className="h-4 w-4 fill-current" />
                            <span className="ml-1 font-bold">{doc.averageRating?.toFixed(1) || '5.0'}</span>
                          </div>
                          <span className="text-xs text-slate-400">{doc.totalRatings} reviews</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        ) : (
          <Card className="p-6">
            <p className="text-slate-600">
              We couldn't load analytics data. Please try refreshing the dashboard.
            </p>
          </Card>
        ))}

        {activeTab === 'users' && (
          <UserManagementPanel
            users={users}
            loading={loading.users}
            pendingActionIds={pendingActionIds}
            onApprove={handleApproveUser}
            onDelete={handleDeleteUser}
            onRefresh={refetchUsers}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentManager />
        )}

        {activeTab === 'medicines' && (
          <PharmacyManager />
        )}
      </div>
    </div>
  )
}
