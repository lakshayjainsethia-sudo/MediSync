import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import Card, { CardContent, CardHeader } from '../../../components/ui/Card'
import { DashboardStats } from '../../../types'

interface RevenueInsightsProps {
  trendData?: DashboardStats['revenueTrend']
  breakdownData?: DashboardStats['revenueBreakdown']
  userDistribution?: DashboardStats['userDistribution']
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value || 0)

function prepareTrend(trendData?: DashboardStats['revenueTrend']) {
  let cumulative = 0;
  return (trendData || []).map(point => {
    cumulative += point.total;
    return {
      date: point._id,
      total: cumulative,
      daily: point.total
    };
  });
}

export default function RevenueInsights({ trendData }: RevenueInsightsProps) {
  const trend = prepareTrend(trendData)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Revenue Trend (Last 30 Days)" subtitle="Tracks billing performance" />
        <CardContent>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-500">No revenue data captured for the selected range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Cumulative Revenue"
                    stroke="#059669"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="daily"
                    name="Daily Revenue"
                    stroke="#10b981"
                    fillOpacity={0.3}
                    fill="none"
                  />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

    </div>
  )
}


