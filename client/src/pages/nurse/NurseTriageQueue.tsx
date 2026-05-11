import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import io from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function NurseTriageQueue() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedTriageForm, setExpandedTriageForm] = useState<string | null>(null);
  const [triageForm, setTriageForm] = useState({ updatedTag: '', updatedReason: '' });
  const [submittingTriage, setSubmittingTriage] = useState(false);

  useEffect(() => {
    fetchAllAppointments();

    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000', {
      withCredentials: true,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : {}
    });

    socket.on('emergency_update', () => {
      toast.error(`🚨 Emergency Triage Update Received!`, { autoClose: 5000 });
      fetchAllAppointments();
    });

    socket.on('red_triage_alert', (data) => {
      toast.error(`🚨 New RED Triage Patient: ${data.patientName}`, { autoClose: 10000 });
      fetchAllAppointments();
    });
    
    socket.on('triage_escalated', (data) => {
      toast.error(`🚨 Patient Escalted to RED: ${data.patientName}`, { autoClose: 10000 });
      fetchAllAppointments();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchAllAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/nurse/all-appointments');
      // Sort: RED first, then descending weightedScore
      const sorted = res.data.sort((a: any, b: any) => {
        if (a.triage_tag === 'RED' && b.triage_tag !== 'RED') return -1;
        if (b.triage_tag === 'RED' && a.triage_tag !== 'RED') return 1;
        return (b.weightedScore || 0) - (a.weightedScore || 0);
      });
      setAppointments(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load triage queue');
    } finally {
      setLoading(false);
    }
  };

  const submitTriage = async (appointmentId: string) => {
    if (!triageForm.updatedTag || !triageForm.updatedReason) {
      toast.error('Please select a triage tag and provide a reason');
      return;
    }
    if (triageForm.updatedTag === 'RED') {
      if (!window.confirm('Escalating to RED will alert the doctor and receptionist immediately. Proceed?')) return;
    }

    try {
      setSubmittingTriage(true);
      await api.patch(`/nurse/appointments/${appointmentId}/triage-override`, triageForm);
      toast.success('Triage override submitted');
      setExpandedTriageForm(null);
      setTriageForm({ updatedTag: '', updatedReason: '' });
      fetchAllAppointments();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit triage override');
    } finally {
      setSubmittingTriage(false);
    }
  };

  const getTriageBadge = (tag: string) => {
    switch (tag) {
      case 'RED': return <span className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm shadow-red-500/20">🚨 RED</span>;
      case 'ORANGE': return <span className="bg-amber-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm shadow-amber-500/20">⚠️ ORANGE</span>;
      case 'GREEN': return <span className="bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm shadow-emerald-500/20">📋 GREEN</span>;
      default: return <span className="bg-slate-500 text-white px-3 py-1 rounded text-xs font-bold">UNKNOWN</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="text-red-500" /> Ward Triage Queue
          </h1>
          <p className="text-sm text-slate-500">Live view of all active patients in the ward</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading triage queue...</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No active patients in the queue.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {appointments.map(patient => {
              const isAssignedToMe = patient.assignedNurse?._id === user?._id;
              const isAssignedToOther = patient.assignedNurse && !isAssignedToMe;

              return (
                <div key={patient._id} className="p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg text-slate-900">{patient.patient?.name}</h3>
                        {getTriageBadge(patient.triage_tag)}
                        {patient.triageOverride?.updatedTag && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold border border-purple-200">
                            ⚑ Nurse Override: {patient.triageOverride.updatedTag}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        Dr. {patient.assignedDoctor?.name || 'Unassigned'} • Age: {patient.patient?.age || 'N/A'}
                      </div>
                      <div className="text-sm font-medium">
                        {isAssignedToMe ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Assigned to You</span>
                        ) : isAssignedToOther ? (
                          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Assigned to: {patient.assignedNurse.name}</span>
                        ) : (
                          <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Unassigned Nursing</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        Score: {(patient.weightedScore || 0).toFixed(1)}/10
                      </span>
                      <span className="flex items-center gap-1"><Clock size={14} /> Waiting {formatDistanceToNow(new Date(patient.createdAt))}</span>
                      
                      {isAssignedToMe ? (
                        <Button 
                          variant="outline" size="sm" className="mt-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                          onClick={() => setExpandedTriageForm(expandedTriageForm === patient._id ? null : patient._id)}
                        >
                          ⚑ Update Triage
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" size="sm" className="mt-2 opacity-50 cursor-not-allowed"
                          title={isAssignedToOther ? `Only ${patient.assignedNurse.name} can update triage` : "Must be assigned to update triage"}
                        >
                          ⚑ Update Triage
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Inline Triage Form */}
                  {expandedTriageForm === patient._id && isAssignedToMe && (
                    <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-lg animate-in slide-in-from-top-2">
                      <p className="text-sm font-semibold text-slate-800 mb-3">Override AI Triage Assessment</p>
                      <div className="flex gap-2 mb-4">
                        {['RED', 'ORANGE', 'GREEN'].map(tag => (
                          <button 
                            key={tag}
                            onClick={() => setTriageForm({...triageForm, updatedTag: tag})}
                            className={`px-4 py-2 rounded text-xs font-bold border transition-colors ${triageForm.updatedTag === tag ? (tag === 'RED' ? 'bg-red-500 text-white border-red-600' : tag === 'ORANGE' ? 'bg-amber-500 text-white border-amber-600' : 'bg-emerald-500 text-white border-emerald-600') : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className="relative mb-3">
                        <textarea 
                          placeholder="Reason for override (max 150 chars)..." 
                          maxLength={150}
                          className="w-full p-2 text-sm border rounded resize-none" rows={2}
                          value={triageForm.updatedReason} onChange={e => setTriageForm({...triageForm, updatedReason: e.target.value})}
                        />
                        <span className="absolute bottom-2 right-2 text-xs text-slate-400">{triageForm.updatedReason.length}/150</span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setExpandedTriageForm(null)}>Cancel</Button>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={submittingTriage || !triageForm.updatedTag || !triageForm.updatedReason} onClick={() => submitTriage(patient._id)}>
                          {submittingTriage ? 'Submitting...' : 'Submit Override'}
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
