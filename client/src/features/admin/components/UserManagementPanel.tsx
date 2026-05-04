import { useMemo, useState } from 'react'
import { Search, CheckCircle2, Trash2, Edit2, X } from 'lucide-react'
import Card, { CardContent, CardHeader } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { User } from '../../../types'

interface UserManagementPanelProps {
  users: User[]
  loading: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  pendingActionIds?: Record<string, boolean>
  onApprove: (userId: string) => Promise<void> | void
  onDelete: (userId: string) => Promise<void> | void
  onRefresh?: () => void
}

const ROLE_OPTIONS: Array<{ label: string; value: 'all' | User['role'] }> = [
  { label: 'All Roles', value: 'all' },
  { label: 'Patients', value: 'patient' },
  { label: 'Doctors', value: 'doctor' },
  { label: 'Receptionists', value: 'receptionist' },
  { label: 'Nurses', value: 'nurse' },
  { label: 'Pharmacists', value: 'pharmacist' }
]

const APPROVABLE_ROLES: User['role'][] = ['doctor', 'nurse', 'receptionist', 'pharmacist']

import { adminApi } from '../../../utils/api'
import { toast } from 'react-toastify'

export default function UserManagementPanel({
  users,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  pendingActionIds = {},
  onApprove,
  onDelete,
  onRefresh
}: UserManagementPanelProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | User['role']>('all')
  const [pendingOnly, setPendingOnly] = useState(false)

  // Edit Doctor Fee State
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null)
  const [editFee, setEditFee] = useState<string>('')
  const [isSavingFee, setIsSavingFee] = useState(false)

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDoctorId) return
    setIsSavingFee(true)
    try {
      await adminApi.updateDoctor(editingDoctorId, { consultationFee: Number(editFee) })
      toast.success('Consultation fee updated')
      setEditingDoctorId(null)
      if (onRefresh) onRefresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update fee')
    } finally {
      setIsSavingFee(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      const matchesPending = !pendingOnly || (APPROVABLE_ROLES.includes(user.role) && user.isApproved === false)
      return matchesRole && matchesSearch && matchesPending
    })
  }, [users, roleFilter, search, pendingOnly])

  const renderStatusBadge = (user: User) => {
    if (APPROVABLE_ROLES.includes(user.role)) {
      if (user.isApproved) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Approved
          </span>
        )
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          Pending
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    )
  }

  return (
    <Card>
      <CardHeader
        title="User Management"
        subtitle="Review, approve, or remove users from the system"
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | User['role'])}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              {ROLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(event) => setPendingOnly(event.target.checked)}
                className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Pending approvals
            </label>
          </div>
        }
      />
      <CardContent>
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-gray-500 py-10">No users match the current filters.</p>
        ) : (
          <div className="overflow-x-auto space-y-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-sm text-gray-700">{user.role}</td>
                    <td className="px-4 py-3">{renderStatusBadge(user)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {APPROVABLE_ROLES.includes(user.role) && user.isApproved === false && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => onApprove(user._id)}
                          isLoading={!!pendingActionIds[user._id]}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      )}
                      {user.role === 'doctor' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setEditingDoctorId(user._id)
                            setEditFee(user.consultationFee?.toString() || '0')
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        className="gap-1"
                        onClick={() => onDelete(user._id)}
                        isLoading={!!pendingActionIds[user._id]}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {hasMore && (
              <div className="flex justify-center mt-4 pt-4 border-t border-gray-100">
                <Button 
                  variant="outline" 
                  onClick={onLoadMore} 
                  isLoading={loadingMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load More Users'}
                </Button>
              </div>
            )}
          </div>
        )}

        {editingDoctorId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
              <button 
                onClick={() => setEditingDoctorId(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Edit Doctor Profile</h3>
              <form onSubmit={handleSaveFee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consultation Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min="0"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <Button variant="outline" type="button" onClick={() => setEditingDoctorId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSavingFee}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


