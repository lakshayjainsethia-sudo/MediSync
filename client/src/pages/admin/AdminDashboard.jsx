import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AdminAnalytics } from '../../components/admin/AdminAnalytics';
import AuditLog from './AuditLog';

/**
 * Classy Admin Dashboard utilizing real MongoDB aggregation analytics.
 */
const AdminDashboard = () => {
  const { user } = useAuth(); 
  const [activeTab, setActiveTab] = useState('analytics');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">System Analytics</h2>
          <p className="text-slate-500 mt-1">Welcome back, {user?.name || 'Administrator'}. Here is your hospital summary.</p>
        </div>
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition ${activeTab === 'analytics' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition ${activeTab === 'audit' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setActiveTab('audit')}
          >
            Audit Log
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? <AdminAnalytics /> : <AuditLog />}
    </div>
  );
};

export default AdminDashboard;
