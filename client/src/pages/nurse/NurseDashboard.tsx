import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import io from 'socket.io-client';
import { formatDistanceToNow, format } from 'date-fns';
import { Check, X, Clock, AlertTriangle, AlertCircle, Calendar, CalendarCheck2, Activity } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import Card, { CardContent, CardHeader } from '../../components/ui/Card';

export default function NurseDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [expandedVitalsForm, setExpandedVitalsForm] = useState<string | null>(null);
  const [expandedTriageForm, setExpandedTriageForm] = useState<string | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ isOpen: boolean; patient: any }>({ isOpen: false, patient: null });

  // Form States
  const [vitalsForm, setVitalsForm] = useState({ note: '', bp: '', hr: '', temp: '', spo2: '', weight: '', height: '' });
  const [triageForm, setTriageForm] = useState({ updatedTag: '', updatedReason: '' });
  const [submittingVitals, setSubmittingVitals] = useState(false);
  const [submittingTriage, setSubmittingTriage] = useState(false);

  useEffect(() => {
    fetchMyPatients();
    fetchUpcoming();

    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000', {
      withCredentials: true,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : {}
    });

    socket.on('patient_assigned', (data) => {
      toast.success(`👩‍⚕️ Dr. ${data.doctorName} assigned you to ${data.patientName} — ${data.triage_tag}`, { autoClose: 5000 });
      fetchMyPatients();
    });

    socket.on('patient_unassigned', (data) => {
      toast.warn(`Patient unassigned`, { autoClose: 3000 });
      setPatients(prev => prev.filter(p => p._id !== data.appointmentId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchMyPatients = async () => {
    try {
      setLoading(true);
      const res = await api.get('/nurse/my-patients');
      setPatients(res.data.appointments);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load your patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcoming = async () => {
    try {
      const res = await api.get('/nurse/upcoming-appointments');
      setUpcoming(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const submitVitals = async (appointmentId: string) => {
    if (!vitalsForm.bp && !vitalsForm.hr && !vitalsForm.temp && !vitalsForm.spo2) {
      toast.error('Please enter at least one vital sign');
      return;
    }
    
    try {
      setSubmittingVitals(true);
      const payload = {
        note: vitalsForm.note,
        vitals: {
          bloodPressure: vitalsForm.bp,
          heartRate: vitalsForm.hr ? Number(vitalsForm.hr) : undefined,
          temperature: vitalsForm.temp ? Number(vitalsForm.temp) : undefined,
          oxygenSat: vitalsForm.spo2 ? Number(vitalsForm.spo2) : undefined,
          weight: vitalsForm.weight ? Number(vitalsForm.weight) : undefined,
          height: vitalsForm.height ? Number(vitalsForm.height) : undefined,
        }
      };

      const res = await api.post(`/nurse/appointments/${appointmentId}/vitals`, payload);
      toast.success('Vitals recorded ✓');
      setExpandedVitalsForm(null);
      setVitalsForm({ note: '', bp: '', hr: '', temp: '', spo2: '', weight: '', height: '' });
      fetchMyPatients();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record vitals');
    } finally {
      setSubmittingVitals(false);
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
      fetchMyPatients();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit triage override');
    } finally {
      setSubmittingTriage(false);
    }
  };

  const getTriageBadge = (tag: string) => {
    switch (tag) {
      case 'RED': return <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm shadow-red-500/20">🚨 EMERGENCY</span>;
      case 'ORANGE': return <span className="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm shadow-amber-500/20">⚠️ URGENT</span>;
      case 'GREEN': return <span className="bg-emerald-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm shadow-emerald-500/20">📋 ROUTINE</span>;
      default: return <span className="bg-slate-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm shadow-slate-500/20">UNKNOWN</span>;
    }
  };

  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nurse Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {user?.name}</p>
      </div>

      {/* SECTION A - KPI Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">My Assigned Patients</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{patients.length}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Clock size={24} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Upcoming Today</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{upcoming.length}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><Calendar size={24} /></div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <Card className="mb-8">
        <CardHeader
          title="Quick Actions"
          subtitle="Jump into the most relevant areas."
        />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-gray-100 shadow-sm" padding="lg" hover>
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-primary-50">
                  <CalendarCheck2 className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Upcoming Appointments</h3>
                  <p className="text-sm text-slate-600 mt-1">Review what's scheduled for today and prepare in advance.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/appointments')}>
                    Open
                  </Button>
                </div>
              </div>
            </Card>
            <Card className="border border-red-100 shadow-sm bg-red-50/50" padding="lg" hover>
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <Activity className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Triage Queue</h3>
                  <p className="text-sm text-slate-600 mt-1">Smart AI routing & emergencies.</p>
                  <Button variant="outline" size="sm" className="mt-3 border-red-200 hover:bg-red-50 text-red-700" onClick={() => navigate('/triage')}>
                    Open Priorities
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION B - My Patients Queue */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-800">My Patients Queue</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading your patients...</div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No patients assigned to you right now.</div>
          ) : (
            <div className="divide-y divide-slate-100">
            {patients.map(patient => {
              const latestVitals = patient.nurseNotes && patient.nurseNotes.length > 0 ? patient.nurseNotes[patient.nurseNotes.length - 1].vitals : null;

              return (
                <div key={patient._id} className="p-5 hover:bg-slate-50/50 transition-colors">
                  {/* Header Row */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-slate-900">{patient.patient?.name}</h3>
                      {getTriageBadge(patient.triage_tag)}
                      {patient.triageOverride?.updatedTag && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold border border-purple-200">
                          ⚑ Nurse Override: {patient.triageOverride.updatedTag}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={14} /> Waiting {formatDistanceToNow(new Date(patient.createdAt))}</span>
                      <span>Score: {(patient.weightedScore || 0).toFixed(1)}/10</span>
                      <span className="text-slate-400 border-l pl-4 border-slate-200">Dr. {patient.assignedDoctor?.name}</span>
                    </div>
                  </div>

                  {/* Vitals Summary Row */}
                  {latestVitals && (
                    <div className="mt-3 text-sm text-slate-600 bg-slate-50 p-2 rounded inline-flex gap-3 font-mono">
                      {latestVitals.bloodPressure && <span>BP: {latestVitals.bloodPressure}</span>}
                      {latestVitals.heartRate && <span>HR: {latestVitals.heartRate}</span>}
                      {latestVitals.temperature && <span>Temp: {latestVitals.temperature}°C</span>}
                      {latestVitals.oxygenSat && <span>SpO2: {latestVitals.oxygenSat}%</span>}
                      {latestVitals.weight && <span>Wt: {latestVitals.weight}kg</span>}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button 
                      variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => { setExpandedVitalsForm(expandedVitalsForm === patient._id ? null : patient._id); setExpandedTriageForm(null); }}
                    >
                      📋 Record Vitals
                    </Button>
                    <Button 
                      variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => { setExpandedTriageForm(expandedTriageForm === patient._id ? null : patient._id); setExpandedVitalsForm(null); }}
                    >
                      ⚑ Update Triage
                    </Button>
                    <button 
                      onClick={() => setHistoryDrawer({ isOpen: true, patient })}
                      className="text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-1.5"
                    >
                      📜 View History
                    </button>
                  </div>

                  {/* Inline Vitals Form */}
                  {expandedVitalsForm === patient._id && (
                    <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
                        <div><label className="text-xs text-slate-600 block mb-1">Blood Pressure</label><input type="text" placeholder="120/80" className="w-full text-sm p-2 border rounded" value={vitalsForm.bp} onChange={e => setVitalsForm({...vitalsForm, bp: e.target.value})} /></div>
                        <div><label className="text-xs text-slate-600 block mb-1">Heart Rate</label><input type="number" placeholder="bpm" className="w-full text-sm p-2 border rounded" value={vitalsForm.hr} onChange={e => setVitalsForm({...vitalsForm, hr: e.target.value})} /></div>
                        <div><label className="text-xs text-slate-600 block mb-1">Temp (°C)</label><input type="number" step="0.1" placeholder="37.0" className="w-full text-sm p-2 border rounded" value={vitalsForm.temp} onChange={e => setVitalsForm({...vitalsForm, temp: e.target.value})} /></div>
                        <div><label className="text-xs text-slate-600 block mb-1">SpO2 (%)</label><input type="number" placeholder="98" className="w-full text-sm p-2 border rounded" value={vitalsForm.spo2} onChange={e => setVitalsForm({...vitalsForm, spo2: e.target.value})} /></div>
                        <div><label className="text-xs text-slate-600 block mb-1">Weight (kg)</label><input type="number" step="0.1" placeholder="70" className="w-full text-sm p-2 border rounded" value={vitalsForm.weight} onChange={e => setVitalsForm({...vitalsForm, weight: e.target.value})} /></div>
                        <div><label className="text-xs text-slate-600 block mb-1">Height (cm)</label><input type="number" placeholder="175" className="w-full text-sm p-2 border rounded" value={vitalsForm.height} onChange={e => setVitalsForm({...vitalsForm, height: e.target.value})} /></div>
                      </div>
                      <textarea 
                        placeholder="Clinical observations..." 
                        className="w-full p-2 text-sm border rounded mb-3" rows={2}
                        value={vitalsForm.note} onChange={e => setVitalsForm({...vitalsForm, note: e.target.value})}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setExpandedVitalsForm(null)}>Cancel</Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={submittingVitals} onClick={() => submitVitals(patient._id)}>
                          {submittingVitals ? 'Saving...' : 'Save Vitals'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Inline Triage Form */}
                  {expandedTriageForm === patient._id && (
                    <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-lg">
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

      {/* SECTION C - Upcoming Appointments */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-800">Upcoming Today</h2>
        </div>
        
        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No upcoming appointments today.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.map(apt => (
              <div key={apt._id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900">{apt.patient?.name}</h3>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Clock size={14} /> {apt.startTime} - {apt.endTime}</span>
                      <span>Dr. {apt.assignedDoctor?.name}</span>
                    </div>
                  </div>
                  {getTriageBadge(apt.triage_tag)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* View History Slide-in Drawer */}
      {historyDrawer.isOpen && historyDrawer.patient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Calendar size={18} /> Vitals History</h2>
              <button onClick={() => setHistoryDrawer({ isOpen: false, patient: null })} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {(!historyDrawer.patient.nurseNotes || historyDrawer.patient.nurseNotes.length === 0) ? (
                <div className="text-center text-slate-500 py-8">No vitals recorded yet.</div>
              ) : (
                <div className="space-y-6">
                  {/* Sort newest first */}
                  {[...historyDrawer.patient.nurseNotes].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()).map((entry: any, i: number) => (
                    <div key={i} className="relative pl-6 border-l-2 border-slate-200">
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1 border-2 border-white"></div>
                      <div className="text-xs text-slate-500 mb-1">{format(new Date(entry.recordedAt), 'MMM dd, yyyy HH:mm')}</div>
                      
                      {entry.vitals && (
                        <div className="grid grid-cols-2 gap-2 text-sm font-mono bg-slate-50 p-2 rounded mb-2">
                          {entry.vitals.bloodPressure && <div>BP: {entry.vitals.bloodPressure}</div>}
                          {entry.vitals.heartRate && <div>HR: {entry.vitals.heartRate}</div>}
                          {entry.vitals.temperature && <div>Temp: {entry.vitals.temperature}°C</div>}
                          {entry.vitals.oxygenSat && <div>SpO2: {entry.vitals.oxygenSat}%</div>}
                          {entry.vitals.weight && <div>Wt: {entry.vitals.weight}kg</div>}
                        </div>
                      )}
                      
                      {entry.note && <p className="text-sm text-slate-700 bg-blue-50/50 p-2 rounded">{entry.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
