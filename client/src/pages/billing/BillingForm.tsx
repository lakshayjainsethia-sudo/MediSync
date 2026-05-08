import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Send, Sparkles, CheckSquare, Square, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

export default function BillingForm({ onBack }: { onBack: () => void }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [selectedApt, setSelectedApt] = useState<any>(null);
  
  const [lineItems, setLineItems] = useState<any[]>([
    { description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedAiIndexes, setSelectedAiIndexes] = useState<number[]>([]);

  // AI Audit State
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<any>(null);

  useEffect(() => {
    // Fetch recent scheduled and completed appointments
    axios.get('http://localhost:5000/api/v1/appointments', { withCredentials: true })
      .then(res => setAppointments(res.data))
      .catch(err => console.error("Could not fetch appointments", err));
  }, []);

  useEffect(() => {
    if (selectedAptId) {
      const apt = appointments.find(a => a._id === selectedAptId);
      setSelectedApt(apt);
    } else {
      setSelectedApt(null);
    }
  }, [selectedAptId, appointments]);

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    setLineItems(updated);
  };

  const addLineItem = (desc = '', price = 0) => {
    setLineItems([...lineItems, { description: desc, quantity: 1, unitPrice: price, total: price }]);
  };

  const removeLineItem = (index: number) => {
    const updated = [...lineItems];
    updated.splice(index, 1);
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalAmount = subtotal - discount + (subtotal * (tax / 100));

  const handleSave = async (status: string) => {
    if (!selectedApt) return toast.error("Please select an appointment");
    if (lineItems.length === 0 || !lineItems[0].description) return toast.error("Please add at least one line item");

    try {
      setSaving(true);
      await axios.post('http://localhost:5000/api/v1/billing', {
        appointment: selectedAptId,
        lineItems,
        discount,
        tax,
        paymentMethod,
        notes,
        status // Draft or Unpaid
      }, { withCredentials: true });

      toast.success(`Bill successfully saved as ${status}`);
      onBack();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to generate bill');
    } finally {
      setSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!selectedApt) return toast.error('Select an appointment first to provide AI context.');

    setAiLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/v1/ai/billing-suggest', {
        symptoms: selectedApt.symptoms,
        aiSuggestedDept: selectedApt.aiSuggestedDept,
        aiPriority: selectedApt.aiPriority,
        doctorSpecialisation: selectedApt.doctor?.specialization
      }, { withCredentials: true });

      const data = res.data;
      // Front-end validation safety check
      if (!Array.isArray(data) || data.length === 0 || typeof data[0].description !== 'string') {
        throw new Error('Invalid AI Output Schema');
      }

      setAiSuggestions(data);
      setSelectedAiIndexes(data.map((_, i) => i)); // select all by default
      setShowAiModal(true);
    } catch (err) {
      console.error('AI suggest error', err);
      toast.error('AI Assistant could not generate suggestions right now.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestions = () => {
    const itemsToAdd = selectedAiIndexes.map(idx => {
      const item = aiSuggestions[idx];
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice
      };
    });

    if (lineItems.length === 1 && lineItems[0].description === '' && lineItems[0].total === 0) {
      setLineItems(itemsToAdd); // replace empty first row
    } else {
      setLineItems([...lineItems, ...itemsToAdd]);
    }
    
    setShowAiModal(false);
  };

  const toggleAiItem = (idx: number) => {
    if (selectedAiIndexes.includes(idx)) {
      setSelectedAiIndexes(selectedAiIndexes.filter(i => i !== idx));
    } else {
      setSelectedAiIndexes([...selectedAiIndexes, idx]);
    }
  };

  const handleAiAudit = async () => {
    if (!selectedApt) return toast.error('Select an appointment first to provide AI context.');
    if (lineItems.length === 0 || !lineItems[0].description) return toast.error('Add at least one item before auditing.');

    setAuditLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/v1/ai/billing-audit', {
        treatmentSummary: selectedApt.symptoms,
        items: lineItems,
        patientHistory: 'Standard patient record',
        totalBillSize: totalAmount
      }, { withCredentials: true });

      setAuditReport(res.data);
    } catch (err) {
      console.error('Audit Error', err);
      toast.error('AI Auditor encountered an error.');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-emerald-500 pl-3">Generate New Bill</h2>
        <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium text-sm">Cancel & Return</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Patient Details</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Appointment</label>
              <select 
                value={selectedAptId} 
                onChange={e => setSelectedAptId(e.target.value)}
                className="w-full border-gray-300 border text-sm rounded-lg p-2.5 focus:ring-emerald-500 outline-none shadow-sm"
              >
                <option value="">-- Choose an appointment --</option>
                {appointments.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.patient?.name} - {format(new Date(a.date), 'MMM dd')} - Dr. {a.doctor?.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedApt && (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm mt-4">
                <div><span className="text-slate-500">Patient:</span> <span className="font-semibold text-slate-800">{selectedApt.patient?.name}</span></div>
                <div><span className="text-slate-500">Doctor:</span> <span className="font-semibold text-slate-800">Dr. {selectedApt.doctor?.name}</span></div>
                <div><span className="text-slate-500">Date:</span> <span className="font-semibold text-slate-800">{format(new Date(selectedApt.date), 'dd MMM yyyy')}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="font-semibold text-slate-800 uppercase text-xs tracking-wider">{selectedApt.status}</span></div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative z-0">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
               <h3 className="text-lg font-bold text-gray-800">Line Items</h3>
               {selectedApt && (
                 <button 
                   onClick={handleAiSuggest}
                   disabled={aiLoading}
                   className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition"
                 >
                   {aiLoading ? <Sparkles size={14} className="animate-spin" /> : <Sparkles size={14} />}
                   {aiLoading ? 'Analyzing...' : 'AI Suggest Items'}
                 </button>
               )}
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => addLineItem('Consultation Fee', 500)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium border border-gray-300 transition">+ Consultation</button>
              <button type="button" onClick={() => addLineItem('Medicine / Pharmacy', 0)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium border border-gray-300 transition">+ Medicine</button>
              <button type="button" onClick={() => addLineItem('Lab Test', 0)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium border border-gray-300 transition">+ Lab Test</button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="w-full sm:flex-1">
                    <input 
                      type="text" placeholder="Description" 
                      value={item.description}
                      onChange={e => updateLineItem(idx, 'description', e.target.value)}
                      className="w-full text-sm border border-gray-300 p-2 rounded focus:ring-emerald-500 outline-none" 
                    />
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input 
                      type="number" placeholder="Qty" min="1"
                      value={item.quantity}
                      onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))}
                      className="w-20 text-sm border border-gray-300 p-2 rounded focus:ring-emerald-500 outline-none" 
                    />
                    <div className="flex items-center relative flex-1 sm:flex-none">
                      <span className="absolute left-2 text-gray-400 text-sm">₹</span>
                      <input 
                        type="number" placeholder="Price" min="0"
                        value={item.unitPrice}
                        onChange={e => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                        className="w-24 pl-6 text-sm border border-gray-300 p-2 rounded focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                    <div className="w-24 text-right font-bold text-gray-800 tabular-nums">
                      ₹{item.total.toLocaleString('en-IN')}
                    </div>
                    <button type="button" onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => addLineItem()} className="mt-4 flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
               <Plus size={16} /> Add Blank Item 
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Summary</h3>
             
             <div className="space-y-4 text-sm mt-4">
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                
                <div className="flex justify-between items-center text-gray-600 font-medium">
                  <span>Discount (₹)</span>
                  <input 
                    type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                    className="w-20 text-right border-b border-gray-300 focus:border-emerald-500 outline-none py-1"
                  />
                </div>

                <div className="flex justify-between items-center text-gray-600 font-medium pb-4 border-b border-gray-100">
                  <span>Tax (%)</span>
                  <input 
                    type="number" min="0" value={tax} onChange={e => setTax(Number(e.target.value))}
                    className="w-20 text-right border-b border-gray-300 focus:border-emerald-500 outline-none py-1"
                  />
                </div>

                <div className="flex justify-between items-center text-xl font-black text-gray-900 pt-2">
                  <span>TOTAL</span>
                  <span className="text-emerald-600">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
             </div>

             <div className="mt-6">
               <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
               <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
                 {['Cash', 'Card', 'UPI', 'Insurance'].map(m => (
                   <button 
                     key={m} type="button" onClick={() => setPaymentMethod(m)}
                     className={`flex-1 text-xs py-2 font-semibold transition rounded-md ${paymentMethod === m ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                   >
                     {m}
                   </button>
                 ))}
               </div>
             </div>

             <div className="mt-6">
               <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
               <textarea 
                 value={notes} onChange={e => setNotes(e.target.value)}
                 className="w-full text-sm border-gray-300 border p-2 rounded-lg focus:ring-emerald-500 outline-none" rows={2} placeholder="Optional notes..."
               />
             </div>

             <div className="mt-6 space-y-3">
               <button 
                 onClick={() => handleSave('Unpaid')} disabled={saving}
                 className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-bold shadow-sm transition disabled:opacity-50"
               >
                 <Send size={18} /> {saving ? 'Saving...' : 'Generate & Mark Unpaid'}
               </button>
               <button 
                 onClick={() => handleSave('Draft')} disabled={saving}
                 className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 p-3 rounded-lg font-semibold transition disabled:opacity-50"
               >
                 <Save size={18} /> Save as Draft
               </button>
               <button 
                 onClick={handleAiAudit} disabled={auditLoading || saving}
                 className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 p-3 rounded-lg font-semibold transition disabled:opacity-50"
               >
                 {auditLoading ? <Sparkles size={18} className="animate-spin" /> : <Sparkles size={18} />}
                 {auditLoading ? 'Auditing...' : 'Run AI Revenue Audit'}
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* AI Suggestions Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-purple-100">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
               <h3 className="font-bold flex items-center gap-2"><Sparkles size={18} /> AI Billing Suggestions</h3>
               <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1 rounded transition"><X size={18}/></button>
            </div>
            
            <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-start gap-2 text-xs text-purple-800">
              <span className="text-xl">💡</span>
              <p className="leading-snug">AI suggestions are estimates based on the patient's triage data. Please verify descriptions and prices before finalizing the invoice.</p>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 space-y-2 select-none">
               {aiSuggestions.map((item, idx) => {
                 const isSelected = selectedAiIndexes.includes(idx);
                 return (
                   <div 
                     key={idx} 
                     onClick={() => toggleAiItem(idx)}
                     className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${isSelected ? 'border-purple-500 bg-purple-50/50' : 'border-gray-200 hover:border-purple-300'}`}
                   >
                     <div className={isSelected ? 'text-purple-600' : 'text-gray-400'}>
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                     </div>
                     <div className="flex-1">
                       <p className="text-sm font-bold text-gray-800">{item.description}</p>
                       <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                     </div>
                     <div className="px-3 py-1 bg-white border border-gray-100 rounded shadow-sm text-sm font-bold text-gray-800">
                       ₹{item.unitPrice}
                     </div>
                   </div>
                 );
               })}
            </div>
            
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button 
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
              >Cancel</button>
              <button 
                onClick={applyAiSuggestions}
                disabled={selectedAiIndexes.length === 0}
                className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-md disabled:opacity-50 transition"
              >
                Add {selectedAiIndexes.length} Items to Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Audit Report Modal */}
      {auditReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-indigo-100">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
               <h3 className="font-bold flex items-center gap-2"><Sparkles size={18} /> Revenue Audit Report</h3>
               <button onClick={() => setAuditReport(null)} className="hover:bg-white/20 p-1 rounded transition"><X size={18}/></button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <h4 className="text-sm font-bold text-blue-900 mb-1">Billing Summary</h4>
                <p className="text-xs text-blue-800 leading-relaxed">{auditReport.billingSummary}</p>
              </div>

              {auditReport.flaggedItems && auditReport.flaggedItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-red-700 mb-2 border-b border-gray-100 pb-1">⚠️ Potential Revenue Leakage</h4>
                  <ul className="space-y-1">
                    {auditReport.flaggedItems.map((item: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-700 bg-red-50 px-2 py-1.5 rounded">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {auditReport.suggestedAdditions && auditReport.suggestedAdditions.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-emerald-700 mb-2 border-b border-gray-100 pb-1">💡 Suggested Additions / Discounts</h4>
                  <ul className="space-y-1">
                    {auditReport.suggestedAdditions.map((item: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-700 bg-emerald-50 px-2 py-1.5 rounded">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-2xl">
              <button 
                onClick={() => setAuditReport(null)}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
