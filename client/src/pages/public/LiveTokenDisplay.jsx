import { useState, useEffect } from 'react';

// Mock initial queue data representing response from the FastAPI/Node engine
const initialQueue = [
  { tokenId: 'TKN-0042', priorityLevel: 1, urgencyText: 'Immediate Resuscitation', arrivalTime: '10:00 AM' },
  { tokenId: 'TKN-0891', priorityLevel: 3, urgencyText: 'Urgent', arrivalTime: '09:45 AM' },
  { tokenId: 'TKN-1024', priorityLevel: 5, urgencyText: 'Non-Urgent', arrivalTime: '09:30 AM' },
  { tokenId: 'TKN-2055', priorityLevel: 5, urgencyText: 'Non-Urgent', arrivalTime: '09:40 AM' },
];

/**
 * Public "Live Queue" Display for Lobby Monitor.
 * Extremely high contrast, elegant typography, with flashing alerts for emergencies.
 */
const LiveTokenDisplay = () => {
  const [queue, setQueue] = useState(initialQueue);
  const currentToken = queue[0];
  const upNext = queue.slice(1);

  // Simulate an emergency adding to the top of the queue
  useEffect(() => {
     const timer = setTimeout(() => {
         const emergencyToken = { 
             tokenId: 'TKN-9999', 
             priorityLevel: 2, 
             urgencyText: 'Emergent', 
             arrivalTime: '10:05 AM' 
         };
         // It automatically floats to the top (or sorted by priority)
         setQueue(prev => [emergencyToken, ...prev].sort((a,b) => a.priorityLevel - b.priorityLevel));
     }, 5000);
     return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-8 font-sans">
      
      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-end border-b border-slate-700 pb-6 mb-12">
          <div>
            <h1 className="text-4xl font-light text-slate-300 tracking-widest uppercase">Live Queue</h1>
            <p className="text-slate-500 mt-2">Waiting Room Terminal A</p>
          </div>
          <div className="text-right">
              <p className="text-5xl font-bold text-slate-100 tracking-wider">
                 {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
          </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Now Serving Panel */}
        <div className="flex flex-col items-center justify-center">
            <h2 className="text-2xl text-slate-400 font-medium mb-8 uppercase tracking-widest">Now Serving</h2>
            
            {currentToken ? (
                <div className={`w-full aspect-video rounded-3xl flex flex-col items-center justify-center border-2 shadow-2xl p-12 relative overflow-hidden transition-all duration-500 ${
                    currentToken.priorityLevel <= 2 
                    ? 'bg-red-900/20 border-red-500 shadow-red-500/20 animate-pulse' 
                    : 'bg-blue-900/20 border-blue-500/50 shadow-blue-500/10 backdrop-blur-md'
                }`}>
                    {currentToken.priorityLevel <= 2 && (
                        <div className="absolute top-6 right-6 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wider uppercase">
                            Priority Alert
                        </div>
                    )}
                    <span className="text-8xl font-black text-white tracking-tighter drop-shadow-lg mb-6">
                        {currentToken.tokenId}
                    </span>
                    <span className={`text-xl font-medium tracking-widest uppercase ${currentToken.priorityLevel <= 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                        Consultation Room 1
                    </span>
                </div>
            ) : (
                <div className="text-slate-500 text-2xl">Queue is Empty</div>
            )}
        </div>

        {/* Up Next List */}
        <div className="flex flex-col">
            <h2 className="text-2xl text-slate-400 font-medium mb-8 uppercase tracking-widest border-b border-slate-800 pb-4">Please Wait</h2>
            <div className="flex flex-col space-y-4">
                {upNext.map((item, idx) => (
                    <div 
                        key={item.tokenId} 
                        className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${
                            item.priorityLevel <= 2
                            ? 'bg-red-900/10 border-red-500/30 shadow-lg shadow-red-500/5 pulse-subtle'
                            : 'bg-white/5 border-white/5 backdrop-blur-md'
                        }`}
                    >
                        <div className="flex items-center space-x-6">
                            <span className="text-slate-500 font-mono text-xl w-8">{idx + 2}.</span>
                            <span className="text-3xl font-bold text-slate-200 tracking-wide">{item.tokenId}</span>
                        </div>
                        {item.priorityLevel <= 2 && (
                             <span className="text-red-400 text-sm font-semibold tracking-wide uppercase px-3 py-1 bg-red-500/10 rounded-full">
                                Emergency
                             </span>
                        )}
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default LiveTokenDisplay;
