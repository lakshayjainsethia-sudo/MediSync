import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { aiApi } from '../../utils/api';
import Card, { CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { toast } from 'react-toastify';

export default function ConsultationView() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  
  const [appointment, setAppointment] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [billingSummary, setBillingSummary] = useState('');
  const [prescription, setPrescription] = useState(() => {
    return localStorage.getItem(`prescription_draft_${appointmentId}`) || '';
  });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showHighRiskModal, setShowHighRiskModal] = useState(false);
  const [analysisBannerMsg, setAnalysisBannerMsg] = useState<{type: 'success' | 'warning' | 'error' | 'info', msg: string, details?: any[]} | null>(null);

  const [nurses, setNurses] = useState<any[]>([]);
  const [fetchingNurses, setFetchingNurses] = useState(false);
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [assigningNurse, setAssigningNurse] = useState(false);

  useEffect(() => {
    fetchAppointment();
    fetchNurses();
  }, [appointmentId]);

  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem(`prescription_draft_${appointmentId}`, prescription);
    }, 10000);
    return () => clearInterval(timer);
  }, [prescription, appointmentId]);

  const fetchAppointment = async () => {
    try {
      const res = await api.get(`/appointments/${appointmentId}`);
      if (res.data) {
        const apt = res.data;
        setAppointment(apt);
        if (apt.diagnosis) setDiagnosis(apt.diagnosis);
        if (apt.clinicalNotes) setClinicalNotes(apt.clinicalNotes);
        if (apt.billingSummary) setBillingSummary(apt.billingSummary);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointment');
    }
  };

  const fetchNurses = async () => {
    try {
      setFetchingNurses(true);
      const res = await api.get('/users/nurses');
      setNurses(res.data.data);
    } catch (err) {
      console.error('Failed to fetch nurses', err);
    } finally {
      setFetchingNurses(false);
    }
  };

  const handleAssignNurse = async () => {
    if (!selectedNurseId) return;
    try {
      setAssigningNurse(true);
      const res = await api.patch(`/appointments/${appointmentId}/assign-nurse`, { nurseId: selectedNurseId });
      setAppointment(res.data);
      toast.success('Nurse assigned successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign nurse');
    } finally {
      setAssigningNurse(false);
    }
  };

  const handleUnassignNurse = async () => {
    try {
      setAssigningNurse(true);
      const res = await api.patch(`/appointments/${appointmentId}/unassign-nurse`);
      setAppointment(res.data);
      toast.success('Nurse unassigned successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to unassign nurse');
    } finally {
      setAssigningNurse(false);
    }
  };

  const handleAnalyze = async () => {
    if (!prescription.trim()) {
      toast.error('Please enter a prescription to analyze');
      return;
    }
    setAnalyzing(true);
    setAnalysisBannerMsg(null);
    setAnalysisResult(null);
    try {
      const res = await aiApi.analyzePrescription({
        prescription,
        appointmentId,
        patientAge: appointment?.patient?.age || 'Unknown',
        existingConditions: appointment?.patient?.medicalHistory || 'Unknown'
      });
      const data = res.data;
      setAnalysisResult(data);

      if (data.fallback) {
        setAnalysisBannerMsg({ type: 'info', msg: 'AI analysis unavailable. Review manually.' });
        return;
      }

      const hasHighRisk = data.interactions.some((i: any) => i.severity === 'HIGH') || data.dosageWarnings.some((d: any) => d.severity === 'HIGH');
      
      if (hasHighRisk) {
        setShowHighRiskModal(true);
      } else if (data.interactions.length > 0 || data.dosageWarnings.length > 0) {
        const details = [...data.interactions.map((i: any) => `Interaction: ${i.drug1} + ${i.drug2} - ${i.reason}`), ...data.dosageWarnings.map((d: any) => `Dosage: ${d.drug} - ${d.issue}`)];
        setAnalysisBannerMsg({ type: 'warning', msg: 'Medium/Low risk issues detected.', details });
      } else {
        setAnalysisBannerMsg({ type: 'success', msg: '✓ No interactions detected' });
        setTimeout(() => setAnalysisBannerMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze prescription');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm("This will complete the consultation and send the prescription to Reception for billing. This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      // Use the comprehensive end-consultation endpoint
      await api.put(`/appointments/${appointmentId}/end-consultation`, { 
        diagnosis, 
        prescription, 
        clinicalNotes, 
        billingSummary 
      });
      
      localStorage.removeItem(`prescription_draft_${appointmentId}`);
      toast.success('Consultation completed successfully');
      navigate('/doctor/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete consultation');
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return <div className="p-8 text-center text-slate-500">Loading clinical data...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* PANEL A - Triage Insight */}
      <Card>
        <CardHeader title="Triage Insight" />
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              {appointment.triage_tag === 'RED' && <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-md shadow-red-500/20">🚨 EMERGENCY</span>}
              {appointment.triage_tag === 'ORANGE' && <span className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-md shadow-amber-500/20">⚠️ URGENT</span>}
              {appointment.triage_tag === 'GREEN' && <span className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-md shadow-emerald-500/20">📋 ROUTINE</span>}
              <span className="text-xl font-bold text-slate-700">Clinical Score: {(appointment.weightedScore || 0).toFixed(1)} / 10</span>
            </div>
            <p className="text-slate-600 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">{appointment.triage_reason || 'No specific triage reason provided.'}</p>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Severity</span>
                  <span className="text-sm font-medium text-slate-700">{appointment.severity || 0}/10</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(appointment.severity || 0) * 10}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Urgency</span>
                  <span className="text-sm font-medium text-slate-700">{appointment.urgency_score || 0}/10</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${(appointment.urgency_score || 0) * 10}%` }}></div>
                </div>
              </div>
            </div>
            
            {appointment.aiRedFlags && appointment.aiRedFlags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {appointment.aiRedFlags.map((flag: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full border border-red-200">
                    {flag}
                  </span>
                ))}
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-3">Nursing Assignment</h4>
              {appointment.assignedNurse ? (
                <div className="flex items-center gap-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  <span className="font-medium text-blue-900 flex items-center gap-2">
                    👩‍⚕️ Assigned to: {appointment.assignedNurse?.name || 'Nurse'}
                  </span>
                  <button 
                    onClick={handleUnassignNurse}
                    disabled={assigningNurse}
                    className="text-xs font-semibold text-red-600 hover:text-red-800 px-3 py-1 bg-white rounded-md border border-red-200 shadow-sm transition"
                  >
                    Remove Assignment
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <select
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 max-w-xs"
                    value={selectedNurseId}
                    onChange={(e) => setSelectedNurseId(e.target.value)}
                    disabled={fetchingNurses || assigningNurse}
                  >
                    <option value="">{fetchingNurses ? 'Loading nurses...' : (nurses.length === 0 ? 'No nurses available' : 'Select a nurse...')}</option>
                    {nurses.map(nurse => (
                      <option key={nurse._id} value={nurse._id}>{nurse.name}</option>
                    ))}
                  </select>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleAssignNurse}
                    disabled={!selectedNurseId || assigningNurse}
                  >
                    {assigningNurse ? 'Assigning...' : 'Assign'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PANEL B - Prescription & Consultation Details */}
      <Card>
        <CardHeader title="Consultation Details & Prescription" />
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Primary diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prescription & Orders</label>
              <div className="relative">
                <textarea
                  className="w-full font-mono text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y min-h-[150px]"
                  placeholder="Enter medications, dosage, lab orders, or referrals..."
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  rows={6}
                />
                <div className="absolute bottom-4 right-4 text-xs font-medium text-slate-400 bg-white/80 px-2 py-1 rounded-md backdrop-blur-sm border border-slate-100">
                  {prescription.length} chars | Auto-saves
                </div>
              </div>
            </div>
            
            <div className="mt-2">
              <Button onClick={handleAnalyze} disabled={analyzing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {analyzing ? 'Analyzing...' : 'Analyze Prescription with AI'}
              </Button>
            </div>

            {analysisBannerMsg && (
              <div className={`mt-4 p-4 rounded-lg border ${
                analysisBannerMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                analysisBannerMsg.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                <p className="font-medium">{analysisBannerMsg.msg}</p>
                {analysisBannerMsg.details && (
                  <ul className="mt-2 text-sm list-disc pl-5">
                    {analysisBannerMsg.details.map((detail, idx) => <li key={idx}>{detail}</li>)}
                  </ul>
                )}
              </div>
            )}
            {analysisResult && (
              <div className="mt-2 text-xs text-slate-500 italic">
                {analysisResult.disclaimer}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 mt-4">
              <div>
                <label className="block text-sm font-bold text-red-700 mb-1">Clinical Notes (Private)</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-red-50 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="Private doctor notes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Billing Summary (Shared)</label>
                <textarea
                  value={billingSummary}
                  onChange={(e) => setBillingSummary(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Summary for receptionist/pharmacy..."
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PANEL C - Complete & Handoff */}
      <div className="sticky bottom-6 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-slate-200/50 flex justify-end">
        <Button
          onClick={handleComplete}
          disabled={loading || !diagnosis.trim() || !prescription.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Complete & Hand Off to Reception →'}
        </Button>
      </div>

      {/* High Risk Modal */}
      {showHighRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-red-500">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-xl font-bold text-red-800">High Risk Interaction Detected</h3>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {analysisResult?.interactions?.filter((i: any) => i.severity === 'HIGH').map((i: any, idx: number) => (
                <div key={idx} className="mb-4 bg-red-50/50 p-3 rounded-lg">
                  <p className="font-bold text-slate-800">{i.drug1} + {i.drug2}</p>
                  <p className="text-sm text-slate-600 mt-1">{i.reason}</p>
                </div>
              ))}
              {analysisResult?.dosageWarnings?.filter((d: any) => d.severity === 'HIGH').map((d: any, idx: number) => (
                <div key={`d${idx}`} className="mb-4 bg-red-50/50 p-3 rounded-lg">
                  <p className="font-bold text-slate-800">{d.drug}</p>
                  <p className="text-sm text-slate-600 mt-1">{d.issue}</p>
                </div>
              ))}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowHighRiskModal(false)}>Edit Prescription</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowHighRiskModal(false)}>
                Acknowledge & Proceed
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
