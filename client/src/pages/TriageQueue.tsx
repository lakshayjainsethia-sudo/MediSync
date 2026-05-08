import { useState, useEffect } from 'react'
import { appointmentsApi } from '../utils/api'
import { Appointment } from '../types'
import { Calendar, User as UserIcon, AlertTriangle, Activity, ChevronDown, ChevronUp, Flag, X } from 'lucide-react'
import Card, { CardHeader, CardContent } from '../components/ui/Card'
import { format } from 'date-fns'
import { io } from 'socket.io-client'
import { toast } from 'react-toastify'


export default function TriageQueue() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAppointments()

    // Socket.io Integration
    const socket = io('http://localhost:5000', { withCredentials: true })
    
    socket.on('triage_alert_high', (data) => {
      toast.error(`EMERGENCY: High Priority Triage - ${data.patientName}`, { autoClose: false })
      fetchAppointments() // Refetch safely to get the full updated object into state
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const response = await appointmentsApi.getAll()
      // Filter out completed/cancelled, show only scheduled
      const active = response.data.filter((apt: Appointment) => apt.status === 'scheduled')
      
      active.sort((a: any, b: any) => {
        if (a.riskOverride && !b.riskOverride) return -1;
        if (!a.riskOverride && b.riskOverride) return 1;

        const scoreA = a.aiPriorityScore || 5;
        const scoreB = b.aiPriorityScore || 5;
        if (scoreA !== scoreB) return scoreB - scoreA; // Descending

        const dateA = new Date(`${a.date.split('T')[0]}T${a.startTime}`).getTime();
        const dateB = new Date(`${b.date.split('T')[0]}T${b.startTime}`).getTime();
        return dateA - dateB;
      });

      setAppointments(active)
    } catch (error) {
      console.error('Failed to fetch triage queue', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const handleRiskOverride = async (id: string, riskOverride: boolean, riskOverrideReason: string) => {
    // 1. Snapshot previous state
    const previousAppointments = [...appointments];
    
    // 2. Optimistic sort update
    setAppointments(prev => {
      const updated = prev.map(a => 
        a._id === id ? { ...a, riskOverride, riskOverrideReason } : a
      );
      updated.sort((a: any, b: any) => {
        if (a.riskOverride && !b.riskOverride) return -1;
        if (!a.riskOverride && b.riskOverride) return 1;
        const scoreA = a.aiPriorityScore || 5;
        const scoreB = b.aiPriorityScore || 5;
        if (scoreA !== scoreB) return scoreB - scoreA;
        const dateA = new Date(`${a.date.split('T')[0]}T${a.startTime}`).getTime();
        const dateB = new Date(`${b.date.split('T')[0]}T${b.startTime}`).getTime();
        return dateA - dateB;
      });
      return updated;
    });

    try {
      // 3. API Call
      await appointmentsApi.overrideRisk(id, {
        riskOverride,
        riskOverrideReason
      });
      toast.success(riskOverride ? 'Emergency Confirmed. Doctor Notified.' : 'Emergency Flag Removed');
    } catch (err) {
      // 4. Rollback on failure
      console.error('Risk override failed', err);
      toast.error('Network error. Reverting state...');
      setAppointments(previousAppointments);
    }
  };

  const highPriority = appointments.filter((a: any) => a.riskOverride || a.aiPriority === 'High' || a.priority === 1);
  const others = appointments.filter((a: any) => !a.riskOverride && a.aiPriority !== 'High' && a.priority !== 1);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary-600" />
              Smart Triage Queue
            </h1>
            <p className="text-slate-600 mt-1">AI-assisted priority monitoring and routing.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-red-200 shadow-md transform transition-all duration-300">
              <CardHeader 
                title={<span className="flex items-center text-red-700 font-bold tracking-wide"><AlertTriangle className="mr-2" /> High Priority / Emergency</span>} 
                className="bg-red-50 border-b border-red-100 rounded-t-lg"
              />
              <CardContent className="p-0">
                {highPriority.length === 0 ? (
                  <p className="p-6 text-slate-500 text-center flex flex-col items-center gap-2">
                     <span className="text-4xl">✅</span>
                     No high priority appointments flagged.
                  </p>
                ) : (
                  <div className="divide-y divide-red-100">
                    {highPriority.map(apt => <TriageCard key={apt._id} apt={apt} isHighPriority onOverride={handleRiskOverride} />)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Standard Queue" />
              <CardContent className="p-0">
                {others.length === 0 ? (
                  <p className="p-6 text-slate-500 text-center mx-auto">No other appointments.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {others.map(apt => <TriageCard key={apt._id} apt={apt} onOverride={handleRiskOverride} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Queue Stats" />
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="bg-red-50 p-4 rounded-lg flex justify-between items-center border border-red-100 shadow-sm transition hover:shadow-md">
                     <span className="text-red-700 font-medium">Flagged Urgent</span>
                     <span className="text-2xl font-bold text-red-700">{highPriority.length}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center border border-slate-100 transition hover:shadow-sm">
                     <span className="text-slate-700 font-medium">Standard Patient Load</span>
                     <span className="text-2xl font-bold text-slate-700">{others.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function TriageCard({ apt, isHighPriority = false, onOverride }: { apt: any, isHighPriority?: boolean, onOverride?: any }) {
  const patient = typeof apt.patient === 'object' ? apt.patient : null;
  const doctor = typeof apt.doctor === 'object' ? apt.doctor : null;
  const [expanded, setExpanded] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Confidence UI Logic
  const confidence = apt.aiConfidence || 50;
  let confColor = 'bg-gray-400';
  let txColor = 'text-gray-700';

  if (isHighPriority) {
     // For High Priority, higher confidence = more red/certain emergency
     if (confidence >= 80) { confColor = 'bg-red-600'; txColor = 'text-red-700'; }
     else if (confidence >= 50) { confColor = 'bg-orange-500'; txColor = 'text-orange-700'; }
     else { confColor = 'bg-yellow-400'; txColor = 'text-yellow-700'; }
  } else {
     // For Low Priority, higher confidence = greener/certain it's fine
     if (confidence >= 80) { confColor = 'bg-emerald-500'; txColor = 'text-emerald-700'; }
     else if (confidence >= 50) { confColor = 'bg-blue-400'; txColor = 'text-blue-700'; }
     else { confColor = 'bg-gray-400'; txColor = 'text-gray-700'; }
  }

  // Border style adjustment based on Override status
  const cardStyle = apt.riskOverride 
    ? 'bg-purple-50/20 hover:bg-purple-50/60 border-l-4 border-l-purple-600' 
    : isHighPriority 
      ? 'bg-red-50/20 hover:bg-red-50/60 border-l-4 border-l-red-600' 
      : 'hover:bg-slate-50 border-l-4 border-l-transparent';


  return (
    <div className={`p-5 transition flex flex-col gap-3 relative ${cardStyle}`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <UserIcon className={`h-5 w-5 ${isHighPriority ? 'text-red-600' : 'text-slate-400'}`} />
            <h3 className={`text-lg font-bold ${isHighPriority ? 'text-red-900' : 'text-slate-900'}`}>
              {patient?.name || 'Unknown Patient'}
            </h3>
            {apt.aiSuggestedDept && (
               <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                 Route: {apt.aiSuggestedDept}
               </span>
            )}
            <span 
              className={`px-2 py-0.5 rounded text-xs font-bold border cursor-help ${isHighPriority ? 'bg-red-100 border-red-200 text-red-800' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
              title={apt.triage_reason || 'AI assessed priority score based on symptoms.'}
            >
               Score: {apt.aiPriorityScore || 5}/10
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 ml-8 mb-3">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{format(new Date(apt.date), 'MMM dd')} at {apt.startTime}</span>
            </div>
          </div>

          <div className="ml-8 w-full max-w-sm flex items-center gap-2 mb-2">
             <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${confColor}`} style={{ width: `${confidence}%` }} title={`AI Confidence: ${confidence}%`} />
             </div>
          </div>
          
          {apt.symptoms && (
            <div className="mb-2 ml-8 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Symptoms:</span> 
              <span className="text-sm text-slate-600">
                {Array.isArray(apt.symptoms) ? apt.symptoms.join(', ') : apt.symptoms}
              </span>
            </div>
          )}

          {apt.aiRedFlags && apt.aiRedFlags.length > 0 && (
             <div className="ml-8 flex flex-wrap gap-2 mt-2">
               {apt.aiRedFlags.map((rf: string) => (
                  <span key={rf} className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-medium border border-red-200">
                    ⚠️ {rf}
                  </span>
               ))}
             </div>
          )}

        </div>
        
        <div className="text-right flex flex-col items-end gap-2 shrink-0 min-w-[140px]">
          <span className="text-sm text-slate-500 font-medium whitespace-nowrap bg-white px-3 py-1 rounded shadow-sm border border-slate-100">
             Dr. {doctor?.name || 'Unassigned'}
          </span>
          <div className="flex flex-col w-full gap-2 mt-2">
            {!apt.riskOverride && !showOverrideForm && (
              <button 
                onClick={() => setShowOverrideForm(true)}
                className="flex items-center justify-end gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 focus:outline-none"
              >
                <Flag className="h-3 w-3" /> Confirm Emergency
              </button>
            )}
            
            {apt.riskOverride && (
              <button 
                onClick={() => onOverride(apt._id, false, '')}
                className="flex items-center justify-end gap-1 text-xs font-medium text-slate-500 hover:text-red-600 focus:outline-none"
              >
                <X className="h-3 w-3" /> Remove Flag
              </button>
            )}

            <button 
               onClick={() => setExpanded(!expanded)}
               className={`flex items-center justify-end gap-1 text-sm font-medium ${txColor} hover:underline focus:outline-none`}
             >
               {expanded ? 'Hide Details' : 'Why?'}
               {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {showOverrideForm && !apt.riskOverride && (
        <div className="mt-2 bg-purple-50 p-3 rounded-lg border border-purple-200 w-full sm:w-1/2 ml-8">
          <p className="text-xs font-semibold text-purple-800 mb-2">Manual Risk Override Reason:</p>
          <textarea 
            className="w-full text-sm border-purple-300 rounded p-2 focus:ring-purple-500 focus:border-purple-500" 
            rows={2} 
            maxLength={150}
            placeholder="Reason for confirming emergency..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setShowOverrideForm(false)} className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded border border-slate-300 bg-white">Cancel</button>
            <button 
              onClick={() => {
                onOverride(apt._id, true, overrideReason);
                setShowOverrideForm(false);
              }} 
              disabled={!overrideReason.trim()}
              className="px-3 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
            >
              Confirm Emergency
            </button>
          </div>
        </div>
      )}
      
      {/* Expandable Details Section */}
      {expanded && (
         <div className="ml-8 mt-2 flex flex-col gap-3">
           {apt.riskOverride && (
             <div className="p-3 bg-white rounded-md border border-purple-200 shadow-inner text-sm text-slate-700 relative overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-600"></div>
               <p className="font-semibold mb-1 flex items-center gap-2 text-purple-900">
                  <Flag className="h-4 w-4" /> Manually Flagged
               </p>
               <p className="leading-relaxed italic text-slate-600">"{apt.riskOverrideReason}"</p>
               {apt.riskOverrideAt && (
                 <p className="text-xs text-slate-400 mt-2">Flagged at {new Date(apt.riskOverrideAt).toLocaleTimeString()}</p>
               )}
             </div>
           )}

           <div className={`p-3 bg-white rounded-md border border-slate-200 shadow-inner text-sm text-slate-700 relative overflow-hidden`}>
             <div className={`absolute left-0 top-0 bottom-0 w-1 ${confColor}`}></div>
             <p className="font-semibold mb-1 flex items-center gap-2">
                AI Diagnostic Context
             </p>
             <p className="leading-relaxed">
               {apt.aiReasoning || "No reasoning context was provided by the Engine."}
             </p>
           </div>
         </div>
      )}
    </div>
  )
}
