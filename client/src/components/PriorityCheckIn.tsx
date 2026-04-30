import React, { useState } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';

export default function PriorityCheckIn() {
  const [vitals, setVitals] = useState({
    spO2: '',
    heartRate: '',
    systolicBP: '120',
    diastolicBP: '80',
    respiratoryRate: '16',
    painLevel: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVitals({ ...vitals, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await api.post('/intelligence/triage', {
        spO2: parseInt(vitals.spO2),
        heartRate: parseInt(vitals.heartRate),
        systolicBP: parseInt(vitals.systolicBP),
        diastolicBP: parseInt(vitals.diastolicBP),
        respiratoryRate: parseInt(vitals.respiratoryRate),
        painLevel: parseInt(vitals.painLevel),
      });

      setResult(response);
      toast.success('Check-in complete. Priority level calculated.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit triage data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto glass-card p-8 border border-white/50 font-sans mt-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center justify-center">
        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 text-lg">+</span>
        Priority Check-in
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">SpO2 (%)</label>
            <input 
              type="number" 
              name="spO2"
              value={vitals.spO2} 
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white/50"
              placeholder="e.g. 98"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Heart Rate (bpm)</label>
            <input 
              type="number" 
              name="heartRate"
              value={vitals.heartRate} 
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white/50"
              placeholder="e.g. 75"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1">Pain Level (1-10)</label>
          <input 
            type="number" 
            name="painLevel"
            value={vitals.painLevel} 
            onChange={handleChange}
            required
            min="1" max="10"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white/50"
            placeholder="e.g. 5"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-[#1e293b] text-white font-bold py-3 rounded-xl shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:transform-none"
        >
          {loading ? 'Processing...' : 'Submit Triage Vitals'}
        </button>
      </form>

      {result && (
        <div className={`mt-6 p-4 rounded-xl border ${result.priorityLevel <= 2 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <h3 className="font-bold text-lg mb-1">ESI Level: {result.priorityLevel} - {result.urgencyText}</h3>
          <p className="text-sm font-medium">{result.recommendedAction}</p>
        </div>
      )}
    </div>
  );
}
