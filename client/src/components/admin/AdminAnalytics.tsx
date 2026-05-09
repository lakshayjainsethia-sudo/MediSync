import React, { useState, useEffect } from 'react';
import { adminApi } from '../../utils/api';
import { 
  Users, RefreshCw, BarChart2, TrendingUp, AlertTriangle, ShieldCheck
} from 'lucide-react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  PieChart, Pie, Cell as PieCell, Legend,
  ComposedChart, Line
} from 'recharts';
import { toast } from 'react-toastify';

export const AdminAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [stats, setStats] = useState<any>(null);

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) setLoading(true);
    try {
      // Unified query using $facet natively on Backend
      const response = await adminApi.getDashboardStats();
      setStats(response.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Analytics unified fetch error', err);
      toast.error('Failed to load real-time analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const SkeletonChart = () => (
    <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
      <p className="text-gray-400 dark:text-gray-500">Loading Command Center...</p>
    </div>
  );

  const EmptyState = () => (
    <div className="w-full h-64 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600">
      <p className="text-gray-500 hidden sm:block">No data available for the current scope.</p>
    </div>
  );

  const {
    revenueVsAppointments = [],
    departmentProfitability = [],
    patientRetention = { newPatients: 0, returningPatients: 0 },
    billingStatusDistribution = [],
    demandForecast = { lastWeeks: [], predictedNextWeek: 0, predictiveAlert: null }
  } = stats || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">Unified Command Center</h2>
          <p className="text-sm text-gray-500 ml-4 mt-1">
            Real-time analytics engine fueled by single-query pipeline. Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => fetchAnalytics(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors text-sm font-medium w-fit"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Sync Data
        </button>
      </div>

      {/* Predictive Alert Banner */}
      {!loading && demandForecast.predictiveAlert && (
         <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-xl shadow-md text-white flex items-start gap-4">
           <AlertTriangle className="shrink-0 mt-0.5 text-yellow-300" size={24} />
           <div>
             <h4 className="font-bold text-lg mb-1 flex items-center gap-2">Predictive Intelligence Active</h4>
             <p className="text-sm text-indigo-100">{demandForecast.predictiveAlert}</p>
           </div>
         </div>
      )}

      {loading && !stats && (
         <div className="bg-gray-100 h-20 animate-pulse rounded-xl" />
      )}

      {/* Top Value Cards (Retention and Core Overviews) */}
      {!loading && stats && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">New Patients (30D)</p>
                <p className="text-3xl font-black text-indigo-600 mt-1">{patientRetention.newPatients}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-full text-indigo-500">
                 <Users size={28} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Returning Loyalty (30D)</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">{patientRetention.returningPatients}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-full text-emerald-500">
                 <ShieldCheck size={28} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Predicted Load (Next Wk)</p>
                <p className="text-3xl font-black text-purple-600 mt-1">{demandForecast.predictedNextWeek}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-full text-purple-500">
                 <TrendingUp size={28} />
              </div>
            </div>
         </div>
      )}

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Row 1, Col 1 & 2: Revenue vs Appointments (Composed Chart) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart2 className="text-indigo-500" size={20} /> Revenue vs Appointments
          </h3>
          {loading ? <SkeletonChart /> : revenueVsAppointments.length === 0 ? <EmptyState /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueVsAppointments}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill:"#6b7280"}} />
                  <YAxis yAxisId="left" tickFormatter={(val) => `₹${val}`} axisLine={false} tickLine={false} tick={{fontSize: 12, fill:"#6b7280"}} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 12, fill:"#6b7280"}} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenueGenerated" name="Revenue" fill="url(#colorRev)" stroke="#10b981" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="appointmentsCount" name="Appointments" stroke="#4f46e5" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Row 1, Col 3: Department Profitability (Pie Chart) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6">Department Profitability</h3>
          {loading ? <SkeletonChart /> : departmentProfitability.length === 0 ? <EmptyState /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentProfitability}
                    cx="50%" cy="45%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="revenue"
                    nameKey="department"
                  >
                    {departmentProfitability.map((_: any, index: number) => {
                      const colors = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
                      return <PieCell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <RechartsTooltip formatter={(val: number) => `₹${val.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Row 2, Col 1: Billing Status Distribution */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6">Billing Collections Status</h3>
          {loading ? <SkeletonChart /> : billingStatusDistribution.length === 0 ? <EmptyState /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={billingStatusDistribution} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{fontSize: 13, fontWeight: "bold"}} width={80} />
                  <RechartsTooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                    {billingStatusDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.status === 'Paid' ? '#10b981' : entry.status === 'Unpaid' ? '#f59e0b' : '#9ca3af'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
