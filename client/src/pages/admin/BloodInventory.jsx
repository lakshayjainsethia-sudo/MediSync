import { useState } from 'react';
import { BeakerIcon, ClockIcon } from '@heroicons/react/24/outline';

const mockBloodData = [
  { group: 'A+', units: 45, status: 'normal' },
  { group: 'A-', units: 12, status: 'normal' },
  { group: 'B+', units: 30, status: 'normal' },
  { group: 'B-', units: 4, status: 'critical' },
  { group: 'AB+', units: 18, status: 'normal' },
  { group: 'AB-', units: 2, status: 'critical' },
  { group: 'O+', units: 50, status: 'normal' },
  { group: 'O-', units: 8, status: 'low' },
];

const mockTimeline = [
  { id: 1, donor: 'John Doe', group: 'O-', date: '2023-10-15', nextEligible: '2024-01-15', status: 'eligible' },
  { id: 2, donor: 'Jane Smith', group: 'A+', date: '2023-12-01', nextEligible: '2024-03-01', status: 'waiting' },
  { id: 3, donor: 'Mike Johnson', group: 'B-', date: '2024-01-10', nextEligible: '2024-04-10', status: 'waiting' },
];

/**
 * Blood Inventory Dashboard.
 * Classy styling with Refined Sapphire and Glassmorphic cards.
 */
const BloodInventory = () => {
  const [bloodStock] = useState(mockBloodData);
  const [donorTimeline] = useState(mockTimeline);

  return (
    <div className="space-y-8">
      
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Blood Inventory</h2>
        <p className="text-slate-500 mt-1">Real-time stock monitoring and donor eligibility tracking.</p>
      </div>

      {/* Stock Overview (Stylized Blood Bags) */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 p-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <BeakerIcon className="w-5 h-5 mr-2 text-rose-500" /> Availability Status
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {bloodStock.map((item) => (
            <div 
                key={item.group} 
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 ${
                    item.status === 'critical' 
                        ? 'bg-rose-50 border-rose-200 shadow-lg shadow-rose-100/50' 
                        : item.status === 'low'
                        ? 'bg-orange-50 border-orange-200 shadow-sm'
                        : 'bg-slate-50 border-slate-100 shadow-sm hover:shadow-md'
                }`}
            >
                {/* Visual Indicator Background */}
                <div className={`absolute bottom-0 left-0 w-full rounded-b-xl opacity-20 transition-all duration-1000 ${
                    item.status === 'critical' ? 'bg-rose-500 animate-pulse h-1/4' : 'bg-emerald-500 h-1/2 group-hover:h-3/4'
                }`} />

                {item.status === 'critical' && (
                    <span className="absolute top-2 right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                )}

                <span className={`text-4xl font-black mb-2 ${
                    item.status === 'critical' ? 'text-rose-600' : 'text-[#1E3A8A]'
                }`}>
                    {item.group}
                </span>
                
                <div className="flex flex-col items-center z-10">
                    <span className="text-3xl font-bold text-slate-700">{item.units}</span>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Units</span>
                </div>
            </div>
          ))}
        </div>
      </div>

      {/* Donor Eligibility Timeline */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 p-8">
         <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2 text-[#1E3A8A]" /> Donor Eligibility Timeline
        </h3>
        
        <div className="relative border-l border-slate-200 ml-3 space-y-8 pb-4">
            {donorTimeline.map((donor) => (
                <div key={donor.id} className="relative pl-8">
                    {/* Timeline Node */}
                    <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${
                        donor.status === 'eligible' ? 'bg-emerald-500' : 'bg-amber-400'
                    }`} />
                    
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="text-md font-bold text-slate-800">{donor.donor}</h4>
                                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                                    {donor.group}
                                </span>
                            </div>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                donor.status === 'eligible' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {donor.status === 'eligible' ? 'Eligible Now' : 'Pending'}
                            </span>
                        </div>
                        
                        <div className="flex items-center text-sm text-slate-500 mt-4 space-x-6">
                            <div>
                                <span className="block text-xs uppercase tracking-wider text-slate-400">Last Donation</span>
                                {new Date(donor.date).toLocaleDateString()}
                            </div>
                            <div>
                                <span className="block text-xs uppercase tracking-wider text-slate-400">Next Eligible</span>
                                <span className={donor.status === 'eligible' ? 'text-emerald-600 font-medium' : ''}>
                                    {new Date(donor.nextEligible).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
};

export default BloodInventory;
