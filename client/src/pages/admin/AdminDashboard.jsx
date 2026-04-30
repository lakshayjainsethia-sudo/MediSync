import { useAuth } from '../../hooks/useAuth';
import { AdminAnalytics } from '../../components/admin/AdminAnalytics';

/**
 * Classy Admin Dashboard utilizing real MongoDB aggregation analytics.
 */
const AdminDashboard = () => {
  const { user } = useAuth(); 

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">System Analytics</h2>
        <p className="text-slate-500 mt-1">Welcome back, {user?.name || 'Administrator'}. Here is your hospital summary.</p>
      </div>

      {/* Real-time Data-Driven Analytics Component */}
      <AdminAnalytics />
    </div>
  );
};

export default AdminDashboard;
