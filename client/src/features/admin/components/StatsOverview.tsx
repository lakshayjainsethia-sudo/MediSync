import { RefreshCcw, Users, UserCheck, Calendar, Activity, Clock, IndianRupee, UserPlus } from 'lucide-react'
import Button from '../../../components/ui/Button'
import StatCard from '../../../components/ui/StatCard'
import { DashboardStats } from '../../../types'

interface StatsOverviewProps {
  stats: DashboardStats
  loading?: boolean
  onRefresh?: () => void
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
})

export default function StatsOverview({ stats, loading, onRefresh }: StatsOverviewProps) {
  const staffRoles = ['nurse', 'receptionist', 'pharmacist']
  const staffCount = stats.userDistribution?.reduce((total, entry) => {
    if (staffRoles.includes(entry._id)) {
      return total + entry.count
    }
    return total
  }, 0) ?? 0

  const cards = [
    {
      title: 'Total Patients',
      value: stats.totalPatients,
      icon: <Users className="h-8 w-8 text-primary-600 opacity-20" />
    },
    {
      title: 'Total Doctors',
      value: stats.totalDoctors,
      icon: <UserCheck className="h-8 w-8 text-green-600 opacity-20" />
    },
    {
      title: 'Total Appointments',
      value: stats.totalAppointments,
      icon: <Calendar className="h-8 w-8 text-blue-600 opacity-20" />
    },
    {
      title: "Today's Appointments",
      value: stats.todaysAppointments,
      icon: <Activity className="h-8 w-8 text-purple-600 opacity-20" />
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: <Clock className="h-8 w-8 text-amber-500 opacity-20" />,
      subtitle: 'Doctors awaiting verification'
    },
    {
      title: 'Total Revenue (30d)',
      value: currencyFormatter.format(stats.revenue || 0),
      icon: <IndianRupee className="h-8 w-8 text-emerald-600 opacity-20" />
    },
    {
      title: 'Active Staff',
      value: staffCount,
      icon: <UserPlus className="h-8 w-8 text-indigo-600 opacity-20" />,
      subtitle: 'Nurses, pharmacists, receptionists'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">System-wide performance overview</p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={loading}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(card => (
          <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} subtitle={card.subtitle} />
        ))}
      </div>
    </div>
  )
}

