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
  const [prescription, setPrescription] = useState(() => {
    return localStorage.getItem(`prescription_draft_${appointmentId}`) || '';
  });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showHighRiskModal, setShowHighRiskModal] = useState(false);
  const [analysisBannerMsg, setAnalysisBannerMsg] = useState<{type: 'success' | 'warning' | 'error' | 'info', msg: string, details?: any[]} | null>(null);

  useEffect(() => {
    fetchAppointment();
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
      if (res.success || res.data) {
        setAppointment(res.data || res); 
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointment');
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
      await api.patch(`/appointments/${appointmentId}/complete`, { prescription });
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
          </div>
        </CardContent>
      </Card>

      {/* PANEL B - Prescription Writer */}
      <Card>
        <CardHeader title="Prescription & Orders" />
        <CardContent>
          <div className="relative">
            <textarea
              className="w-full font-mono text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y min-h-[200px]"
              placeholder="Enter medications, dosage, lab orders, referrals, or clinical notes..."
              value={prescription}
              onChange={(e) => setPrescription(e.target.value)}
              rows={8}
            />
            <div className="absolute bottom-4 right-4 text-xs font-medium text-slate-400 bg-white/80 px-2 py-1 rounded-md backdrop-blur-sm border border-slate-100">
              {prescription.length} chars | Auto-saves
            </div>
          </div>
          
          <div className="mt-4">
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
        </CardContent>
      </Card>

      {/* PANEL C - Complete & Handoff */}
      <div className="sticky bottom-6 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-slate-200/50 flex justify-end">
        <Button
          onClick={handleComplete}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all"
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
