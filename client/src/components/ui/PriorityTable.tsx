import SkeletonLoader from './SkeletonLoader';
import { Appointment } from '../../types';
import { format } from 'date-fns';

interface PriorityTableProps {
  appointments: Appointment[];
  loading: boolean;
  onAction?: (appointment: Appointment) => void;
  actionLabel?: string;
}

export default function PriorityTable({ appointments, loading, onAction, actionLabel }: PriorityTableProps) {
  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <SkeletonLoader className="w-1/4 h-6 mb-2" />
        </div>
        <div className="divide-y divide-slate-100 p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2">
              <div className="space-y-2 w-1/2">
                <SkeletonLoader type="text" className="w-3/4 h-5" />
                <SkeletonLoader type="text" className="w-1/2 h-4" />
              </div>
              <SkeletonLoader type="text" className="w-1/4 h-10 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200 overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-sm font-semibold text-slate-600 tracking-wider">
              <th className="p-4">Patient / Token</th>
              <th className="p-4 hidden md:table-cell">Date & Time</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              {onAction && <th className="p-4 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={onAction ? 5 : 4} className="p-8 text-center text-slate-500">
                  No appointments found
                </td>
              </tr>
            ) : (
              appointments.map((apt) => {
                const patient = typeof apt.patient === 'object' ? apt.patient : null;
                const priority = (apt as any).priority || 5;
                const isUrgent = priority <= 2;
                
                return (
                  <tr key={apt._id} className={`hover:bg-slate-50/80 transition-colors ${isUrgent ? 'bg-red-50/20' : ''}`}>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{patient?.name || 'Unknown Patient'}</div>
                      <div className="text-sm text-slate-500">{(apt as any).symptoms?.join(', ') || 'General Checkup'}</div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-slate-600">
                      <div>{format(new Date(apt.date), 'MMM dd, yyyy')}</div>
                      <div className="text-sm">{apt.startTime} - {apt.endTime}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isUrgent 
                          ? 'bg-red-100 text-red-700 ring-1 ring-red-200 animate-pulse'
                          : priority === 3 
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                            : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                      }`}>
                        Level {priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        apt.status === 'completed' ? 'text-green-600 bg-green-50' :
                        apt.status === 'scheduled' ? 'text-blue-600 bg-blue-50' :
                        'text-slate-600 bg-slate-50'
                      }`}>
                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                      </span>
                    </td>
                    {onAction && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => onAction(apt)}
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-sm text-sm font-semibold"
                        >
                          {actionLabel || 'Action'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
