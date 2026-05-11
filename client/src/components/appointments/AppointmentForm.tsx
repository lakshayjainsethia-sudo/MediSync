import { useState, useEffect } from 'react'
import { X, Sparkles, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import api, { appointmentsApi, doctorsApi } from '../../utils/api'
import { User, TimeSlot } from '../../types'
import Button from '../ui/Button'

interface AppointmentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  patientId?: string; // If left empty, assumes backend uses req.user.id
}

export default function AppointmentForm({ onSuccess, onCancel, patientId }: AppointmentFormProps) {
  const [doctors, setDoctors] = useState<User[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null)
  
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [symptomInput, setSymptomInput] = useState('')
  const [symptomSuggestions, setSymptomSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  
  // AI Recommendations
  const [recommendedSlots, setRecommendedSlots] = useState<string[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  
  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    try {
      const response = await doctorsApi.getAll()
      setDoctors(response.data)
    } catch (error) {
      console.error('Failed to fetch doctors', error)
      toast.error('Failed to load doctors.')
    }
  }

  // Feature 1: AI Symptom Autocomplete (400ms Debounce)
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (symptomInput.trim().length >= 2) {
        setLoadingSuggestions(true)
        try {
          // Assuming we added /api/ai/symptom-suggest to the generic Axios instance
          const res = await api.get(`/ai/symptom-suggest?q=${encodeURIComponent(symptomInput)}`)
          // Filter out symptoms already selected
          const filtered = (res.data || []).filter((s: string) => !symptoms.includes(s))
          setSymptomSuggestions(filtered.slice(0, 6))
        } catch (e) {
          console.error("AI Symptom Suggestion Failed", e)
        } finally {
          setLoadingSuggestions(false)
        }
      } else {
        setSymptomSuggestions([])
      }
    }, 400)
    
    return () => clearTimeout(handler)
  }, [symptomInput, symptoms])

  const handleAddSymptom = (symptom: string) => {
    if (!symptoms.includes(symptom)) {
      setSymptoms([...symptoms, symptom])
    }
    setSymptomInput('')
    setSymptomSuggestions([])
  }

  const removeSymptom = (index: number) => {
    setSymptoms(symptoms.filter((_, i) => i !== index))
  }

  const handleSymptomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && symptomInput.trim()) {
      e.preventDefault()
      handleAddSymptom(symptomInput.trim())
    }
  }

  const handleDateChange = async (doctorId: string, date: string) => {
    setSelectedDate(date)
    setSelectedSlot('')
    try {
      const response = await appointmentsApi.getAvailableSlots(doctorId, date)
      setAvailableSlots(response.data)
    } catch (error) {
      console.error('Failed to fetch slots:', error)
    }
  }

  // Feature 3: Smart Appointment Slot Recommender
  const handleGetRecommendations = async () => {
     if (!selectedDoctor) return toast.warning('Select a doctor first.')
     if (symptoms.length === 0) return toast.warning('Symptoms are required to triage priority.')
     
     setLoadingRecommendations(true)
     setRecommendedSlots([])
     
     try {
       // Estimate Priority quickly to pass to recommender (Normally done server-side post-submit, but we need it here)
       // This hits /api/ai/recommend-slot logic
       const res = await api.post('/ai/recommend-slot', {
         doctorId: selectedDoctor._id,
         symptoms: symptoms.join(', '),
         aiPriority: symptoms.includes("Chest Pain") ? "High" : "Medium" // Basic frontend heuristic to trigger High
       })
       
       setRecommendedSlots(res.data || [])
     } catch (e) {
       console.error("Failed to fetch recommendations", e)
       toast.error("Could not generate AI slots.")
     } finally {
       setLoadingRecommendations(false)
     }
  }

  const applyRecommendedSlot = (isoTime: string) => {
     const dateObj = new Date(isoTime);
     const dateStr = dateObj.toISOString().split('T')[0];
     

     
     // Simple 12 hour formatting for display matching backend API assumption
     const hour12 = dateObj.getHours() % 12 || 12;
     const ampm = dateObj.getHours() >= 12 ? 'PM' : 'AM';
     const startDisplay = `${hour12}:00 ${ampm}`;
     
     // End Time bounds (1 hour later)
     const endHourObj = new Date(dateObj.getTime() + 60 * 60 * 1000);
     const endHour12 = endHourObj.getHours() % 12 || 12;
     const endAmpm = endHourObj.getHours() >= 12 ? 'PM' : 'AM';
     const endDisplay = `${endHour12}:00 ${endAmpm}`;

     handleDateChange(selectedDoctor!._id, dateStr);
     setSelectedSlot(`${startDisplay} - ${endDisplay}`);
     toast.success("AI Slot selected.");
  }


  const handleBookAppointment = async () => {
    if (!selectedDoctor || !selectedDate || (!selectedSlot && recommendedSlots.length === 0)) {
      toast.error('Please fill in doctor, date, and a time slot.')
      return
    }

    setLoading(true)
    try {
      // Parse slot logic (Handling both manual standard slots and generic times)
      let finalStart = '';
      let finalEnd = '';
      
      if (selectedSlot) {
         // Expects format "9:00 AM - 10:00 AM" if picked manually from grid
         const slot = availableSlots.find(s => `${s.time} - ${s.endTime}` === selectedSlot);
         if (slot) {
           finalStart = slot.startTime || slot.time.split(' ')[0];
           finalEnd = slot.endTime24 || slot.endTime.split(' ')[0];
         } else {
           // Fallback if applied from AI recommendation without hitting grid logic
           const [start, end] = selectedSlot.split(' - ');
           // Convert "2:00 PM" to "14:00"
           const formatTo24 = (timeStr: string) => {
              const [time, period] = timeStr.trim().split(' ');
               const [hour, minutes] = time.split(':');
               let h = hour;
               if (period === 'PM' && h !== '12') h = String(parseInt(h, 10) + 12);
               if (period === 'AM' && h === '12') h = '00';
               return `${h.padStart(2, '0')}:${minutes}`;
           }
           finalStart = formatTo24(start);
           finalEnd = formatTo24(end);
         }
      }

      await appointmentsApi.create({
        doctor: selectedDoctor._id,
        patient: patientId, // API might ignore this if using req.user.id depending on auth layer edits
        date: selectedDate,
        startTime: finalStart,
        endTime: finalEnd,
        symptoms: symptoms,
        notes
      })
      toast.success('Appointment booked successfully!')
      onSuccess()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to book appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* LEFT COLUMN: Doctor & Symptoms */}
         <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
              <select
                value={selectedDoctor?._id || ''}
                onChange={(e) => {
                  const doc = doctors.find(d => d._id === e.target.value)
                  setSelectedDoctor(doc || null)
                  setSelectedDate('')
                  setSelectedSlot('')
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Choose a doctor...</option>
                {doctors.map(doc => (
                  <option key={doc._id} value={doc._id}>
                    Dr. {doc.name} {doc.specialization && `- ${doc.specialization}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Smart Symptom Autocomplete */}
            <div className="relative">
               <label className="block text-sm font-medium text-gray-700 mb-1">Intelligent Symptoms</label>
               <div className="border border-gray-300 rounded-lg p-2 min-h-[42px] bg-white flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-primary-500">
                  {symptoms.map((sym, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-primary-100 text-primary-800 px-2 py-1 rounded-md text-sm">
                      {sym}
                      <button onClick={() => removeSymptom(i)} className="text-primary-600 hover:text-red-600 outline-none">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input 
                     type="text"
                     value={symptomInput}
                     onChange={(e) => setSymptomInput(e.target.value)}
                     onKeyDown={handleSymptomKeyDown}
                     placeholder={symptoms.length === 0 ? "Type symptoms (e.g. Headache) and press Enter..." : "Add another..."}
                     className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
                  />
                  {loadingSuggestions && <span className="absolute right-3 opacity-50"><Sparkles className="h-4 w-4 animate-pulse text-indigo-500" /></span>}
               </div>

               {/* Suggestions Dropdown */}
               {symptomSuggestions.length > 0 && (
                 <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    {symptomSuggestions.map((suggestion, i) => (
                       <button
                         key={i}
                         onClick={() => handleAddSymptom(suggestion)}
                         className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 hover:text-primary-600 transition flex items-center gap-2"
                       >
                         <Sparkles className="h-3 w-3 text-indigo-400" /> {suggestion}
                       </button>
                    ))}
                 </div>
               )}
               <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Used to flag emergencies via AI Triage.</p>
            </div>
         </div>

         {/* RIGHT COLUMN: Time Slots & Recs */}
         <div className="space-y-4">
            {selectedDoctor && (
              <>
                 <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div className="flex justify-between items-center mb-3">
                       <label className="block text-sm font-semibold text-indigo-900">AI Scheduling Assistant</label>
                       <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleGetRecommendations}
                          disabled={loadingRecommendations || symptoms.length === 0}
                          className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                       >
                          {loadingRecommendations ? <span className="animate-pulse">Analyzing...</span> : <span className="flex items-center gap-1"><Sparkles className="h-4 w-4" /> Get AI Recommendations</span>}
                       </Button>
                    </div>

                    {recommendedSlots.length > 0 && (
                       <div className="grid gap-2 mb-4">
                         {recommendedSlots.map((isoStr, i) => {
                            const d = new Date(isoStr);
                            const recName = `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                            return (
                              <button 
                                key={i}
                                onClick={() => applyRecommendedSlot(isoStr)}
                                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:from-indigo-600 hover:to-purple-700 transition shadow-sm"
                              >
                                 <Sparkles className="h-4 w-4" /> Recommended: {recName}
                              </button>
                            )
                         })}
                       </div>
                    )}

                    <div className="border-t border-indigo-100 pt-3">
                       <label className="block text-sm font-medium text-gray-700 mb-2">Or pick manually:</label>
                       <input
                         type="date"
                         min={new Date().toISOString().split('T')[0]}
                         value={selectedDate}
                         onChange={(e) => handleDateChange(selectedDoctor._id, e.target.value)}
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 mb-3 bg-white"
                       />
                       
                       {availableSlots.length > 0 && (
                         <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1">
                           {availableSlots.map((slot, index) => {
                             const slotKey = `${slot.time} - ${slot.endTime}`;
                             return (
                               <button
                                 key={index}
                                 onClick={() => setSelectedSlot(slotKey)}
                                 disabled={!slot.available}
                                 className={`px-2 py-1.5 text-xs text-center rounded-lg border transition ${
                                   selectedSlot === slotKey
                                     ? 'bg-primary-600 text-white border-primary-600'
                                     : slot.available
                                     ? 'border-gray-300 hover:border-primary-500 hover:bg-primary-50 bg-white'
                                     : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                 }`}
                               >
                                 {slot.time}
                               </button>
                             )
                           })}
                         </div>
                       )}
                    </div>
                 </div>
              </>
            )}
         </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          placeholder="Optional notes for the doctor..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleBookAppointment} disabled={loading || !selectedDoctor || (!selectedDate && recommendedSlots.length === 0) || (!selectedSlot && recommendedSlots.length === 0) || symptoms.length === 0}>
           {loading ? 'Booking...' : (
             <span className="flex items-center gap-2 text-white">Book Smart Appointment <Clock className="h-4 w-4" /></span>
           )}
        </Button>
      </div>
    </div>
  )
}
