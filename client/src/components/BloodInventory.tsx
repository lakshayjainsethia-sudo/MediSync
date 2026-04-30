import React, { useState, useEffect } from 'react';
import { api } from '../api/axios';

interface BloodUnit {
  unitId: string;
  type: string;
  expiresInDays: number;
  warning?: string;
}

export default function BloodInventory() {
  const [bloodUnits, setBloodUnits] = useState<BloodUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data fetching, real implementation would call FastAPI
  useEffect(() => {
    const fetchBloodInventory = async () => {
      // Simulating an API call to the blood bank service
      setTimeout(() => {
        setBloodUnits([
          { unitId: "BLD-894", type: "O-", expiresInDays: 4, warning: "Expiring soon" },
          { unitId: "BLD-895", type: "O+", expiresInDays: 12 },
          { unitId: "BLD-896", type: "O-", expiresInDays: 2 },
          { unitId: "BLD-897", type: "A+", expiresInDays: 20 },
        ]);
        setLoading(false);
      }, 1000);
    };

    fetchBloodInventory();
  }, []);

  const bloodQuantities = bloodUnits.reduce((acc, unit) => {
    acc[unit.type] = (acc[unit.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  return (
    <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-100 font-sans">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 drop-shadow-sm">Classy Blood Inventory</h2>
      
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-200 h-24 rounded-xl"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {types.map((type) => {
            const qty = bloodQuantities[type] || 0;
            const isLowStock = qty < 5;
            
            return (
              <div 
                key={type} 
                className={`relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 backdrop-blur-md bg-white/70 border ${
                  isLowStock ? 'border-red-200 shadow-red-100' : 'border-slate-200 shadow-slate-100'
                } shadow-xl hover:-translate-y-1 hover:shadow-2xl`}
              >
                {/* Visual Blood Bag representation */}
                <div className={`w-12 h-16 rounded-b-xl rounded-t-sm mb-3 flex items-end justify-center overflow-hidden border-2 relative ${
                  isLowStock ? 'border-red-400' : 'border-rose-300'
                } ${isLowStock ? 'animate-pulse' : ''}`}>
                  <div className={`w-full bg-rose-500 transition-all duration-1000 ${
                    qty === 0 ? 'h-0' : qty < 3 ? 'h-1/3' : qty < 5 ? 'h-2/3' : 'h-full'
                  }`}></div>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`font-bold text-lg ${qty > 0 ? 'text-white drop-shadow-md' : 'text-slate-400'}`}>
                      {type}
                    </span>
                  </div>
                </div>
                
                <p className="text-slate-600 font-medium text-sm">
                  {qty} Units
                </p>
                {isLowStock && (
                  <span className="absolute top-2 right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
