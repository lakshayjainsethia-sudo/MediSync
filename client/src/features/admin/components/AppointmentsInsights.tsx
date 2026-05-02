import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, CartesianGrid, XAxis, YAxis, Legend, Line } from 'recharts'
import Card, { CardContent, CardHeader } from '../../../components/ui/Card'
import { DashboardStats } from '../../../types'

interface AppointmentsInsightsProps {
  statusData: DashboardStats['appointmentsByStatus']
  trendData: DashboardStats['appointmentsByDay']
  triageData?: DashboardStats['triageDistribution']
}

const STATUS_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1']

const TRIAGE_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
  Normal: '#0ea5e9',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  unspecified: 'Unknown'
}

function formatStatus(status: string) {
  if (!status) return 'Unknown'
  return STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDateLabel(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AppointmentsInsights({ statusData, trendData, triageData }: AppointmentsInsightsProps) {
  const formattedStatus = (statusData || []).map(item => ({
    name: formatStatus(item._id),
    value: item.count
  }))

  const formattedTrend = (trendData || []).map(item => ({
    date: formatDateLabel(item._id),
    count: item.count
  }))

  const formattedTriage = (triageData || []).map(item => ({
    name: item._id,
    value: item.count
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Appointments by Status" subtitle="Snapshot of current workflow" />
          <CardContent>
            {formattedStatus.length === 0 ? (
              <p className="text-sm text-gray-500">No appointment data found.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={formattedStatus} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={90} dataKey="value">
                    {formattedStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Triage Priority Distribution" subtitle="AI-Assigned priority levels" />
          <CardContent>
            {formattedTriage.length === 0 ? (
              <p className="text-sm text-gray-500">No triage data found.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={formattedTriage} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={90} dataKey="value">
                    {formattedTriage.map((entry) => (
                      <Cell key={entry.name} fill={TRIAGE_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Appointments Trend (Last 30 Days)" subtitle="Tracks booking momentum" />
        <CardContent>
          {formattedTrend.length === 0 ? (
            <p className="text-sm text-gray-500">No recent appointment trend data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formattedTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


