import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Card, { CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page, filterRole, filterAction]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit-logs', {
        params: { page, limit: 25, role: filterRole, action: filterAction }
      });
      if (res.success) {
        setLogs(res.data.logs);
        setHasMore(res.data.hasMore);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const actionColors: Record<string, string> = {
    APPOINTMENT_CREATED: 'bg-blue-100 text-blue-800',
    TRIAGE_ASSESSED: 'bg-purple-100 text-purple-800',
    RISK_OVERRIDE: 'bg-red-100 text-red-800',
    CONSULTATION_COMPLETED: 'bg-green-100 text-green-800',
    BILL_GENERATED: 'bg-yellow-100 text-yellow-800',
    BILL_PAID: 'bg-emerald-100 text-emerald-800'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Immutable Audit Trail</h2>
        <div className="flex space-x-4">
          <select 
            className="border-slate-300 rounded-md shadow-sm text-sm"
            value={filterRole}
            onChange={e => { setFilterRole(e.target.value); setPage(1); }}
          >
            <option value="">All Roles</option>
            <option value="doctor">Doctor</option>
            <option value="receptionist">Receptionist</option>
            <option value="admin">Admin</option>
          </select>
          <select 
            className="border-slate-300 rounded-md shadow-sm text-sm"
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
          >
            <option value="">All Actions</option>
            <option value="APPOINTMENT_CREATED">Appointment Created</option>
            <option value="TRIAGE_ASSESSED">Triage Assessed</option>
            <option value="RISK_OVERRIDE">Risk Override</option>
            <option value="CONSULTATION_COMPLETED">Consultation Completed</option>
            <option value="BILL_GENERATED">Bill Generated</option>
            <option value="BILL_PAID">Bill Paid</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Performed By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Target</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {logs.map((log: any) => (
                  <React.Fragment key={log._id}>
                    <tr className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${actionColors[log.action] || 'bg-slate-100 text-slate-800'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {log.performedBy?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                        {log.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {log.targetModel} ({log.targetId.slice(-6)})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => toggleExpand(log._id)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          {expandedRow === log._id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === log._id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-4">
                          <pre className="text-xs text-slate-700 bg-white p-4 rounded border overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500">No audit logs found matching the criteria.</div>
          )}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-500">Page {page}</span>
            <Button 
              variant="outline" 
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
