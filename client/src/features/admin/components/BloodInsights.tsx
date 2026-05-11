import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import Card, { CardContent, CardHeader } from '../../../components/ui/Card'
import { DashboardStats } from '../../../types'

interface BloodInsightsProps {
  data?: DashboardStats['bloodLevels']
}

export default function BloodInsights({ data }: BloodInsightsProps) {
  const bloodData = data || []

  // Color mapping logic for blood types
  const getColor = (group: string) => {
    if (group.includes('-')) return '#ef4444' // Negative types in red
    return '#3b82f6' // Positive types in blue
  }

  return (
    <Card>
      <CardHeader title="Live Blood Inventory" subtitle="Real-time stock of blood units" />
      <CardContent>
        {bloodData.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No blood inventory data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bloodData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip formatter={(value: number) => [`${value} Units`, 'Quantity']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {bloodData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry._id)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
