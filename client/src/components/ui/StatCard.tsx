import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import SkeletonLoader from './SkeletonLoader'

interface StatCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  subtitle?: string
  className?: string
  loading?: boolean
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  className = '',
  loading = false
}: StatCardProps) {
  if (loading) {
    return (
      <div className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-sm p-6 border border-slate-100 ${className}`}>
        <SkeletonLoader className="mb-4 w-1/2 h-5" />
        <SkeletonLoader className="mb-2 w-3/4 h-8" />
        {subtitle && <SkeletonLoader className="w-1/3 h-4 mt-2" />}
      </div>
    )
  }

  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-sm p-6 border border-slate-100 transition-all hover:shadow-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}



