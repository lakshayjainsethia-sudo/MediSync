import { useState, useEffect } from 'react';

// A simple base64 sound string for a notification "ding"
const DING_SOUND = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'; // using a placeholder to avoid huge strings, we will use Web Audio API instead for a synthetic ding

interface Token {
  id: string;
  number: string;
  priority: number;
  department: string;
  isNew?: boolean;
}

export default function Lobby() {
  const [tokens, setTokens] = useState<Token[]>([
    { id: '1', number: 'A-102', priority: 5, department: 'General Practice' },
    { id: '2', number: 'B-405', priority: 3, department: 'Cardiology' },
  ]);

  const [nowServing, setNowServing] = useState<Token | null>(null);

  const playDing = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'bell' as any || 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 1.5);
    } catch (e) {
      console.log('Audio playback failed', e);
    }
  };

  useEffect(() => {
    // Simulate incoming emergency tokens every 15 seconds
    const interval = setInterval(() => {
      const isEmergency = Math.random() > 0.5;
      const newToken: Token = {
        id: Date.now().toString(),
        number: `${isEmergency ? 'E' : 'T'}-${Math.floor(Math.random() * 1000)}`,
        priority: isEmergency ? 1 : 5,
        department: isEmergency ? 'Emergency Room' : 'Orthopedics',
        isNew: true
      };
      
      if (newToken.priority <= 2) {
        playDing();
      }
      
      setNowServing(newToken);
      
      setTokens(prev => {
        const withNew = [newToken, ...prev].slice(0, 10);
        // Strict Sort by Priority (lowest number first, e.g. 1 > 5) then by ID (time)
        return withNew.sort((a, b) => {
           if (a.priority !== b.priority) return a.priority - b.priority;
           return parseInt(b.id) - parseInt(a.id);
        });
      });
      
      setTimeout(() => {
        setTokens(current => current.map(t => t.id === newToken.id ? { ...t, isNew: false } : t));
      }, 3000);

    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-8 h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-12 border-b border-slate-700 pb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold">M</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-md">Medisync <span className="text-blue-500">Live</span></h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-300">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-slate-400 font-medium">Wait times are currently normal</p>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Now Serving (Large) */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            {nowServing ? (
              <div className={`p-12 rounded-3xl border-2 transition-all duration-500 transform ${
                nowServing.isNew ? 'scale-105 shadow-[0_0_50px_rgba(239,68,68,0.3)]' : 'scale-100 shadow-2xl'
              } ${
                nowServing.priority <= 2 
                  ? 'bg-red-950/80 border-red-500' 
                  : 'bg-slate-800/80 border-blue-500/30'
              } backdrop-blur-xl relative overflow-hidden`}
              >
                {nowServing.priority <= 2 && (
                  <div className="absolute top-0 right-0 left-0 h-1 bg-red-500 animate-pulse"></div>
                )}
                <h2 className="text-3xl font-bold text-slate-400 mb-4 uppercase tracking-wider">Now Serving</h2>
                <div className={`text-[10rem] leading-none font-black ${
                  nowServing.priority <= 2 ? 'text-red-400' : 'text-white'
                } drop-shadow-lg mb-6`}>
                  {nowServing.number}
                </div>
                <div className="flex items-center space-x-6">
                  <div className="px-6 py-2 bg-slate-900/50 rounded-lg text-2xl font-semibold text-slate-200">
                    {nowServing.department}
                  </div>
                  {nowServing.priority <= 2 && (
                    <div className="px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-2xl font-bold uppercase tracking-widest animate-pulse">
                      Urgent
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <p className="text-3xl font-medium">Waiting for next token...</p>
              </div>
            )}
          </div>

          {/* Up Next List */}
          <div className="flex flex-col bg-slate-800/40 rounded-3xl p-8 border border-slate-700/50 backdrop-blur-md h-full max-h-[70vh] overflow-hidden">
            <h3 className="text-2xl font-bold text-slate-300 mb-8 flex items-center shrink-0">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
              Upcoming Queue
            </h3>
            <div className="space-y-4 flex-1 overflow-auto pr-2 custom-scrollbar">
              {tokens.filter(t => t.id !== nowServing?.id).length === 0 ? (
                 <div className="text-slate-500 text-center mt-10">Queue is empty</div>
              ) : (
                tokens.filter(t => t.id !== nowServing?.id).map((token) => (
                  <div 
                    key={token.id} 
                    className={`p-6 rounded-2xl border ${
                      token.priority <= 2 
                        ? 'bg-red-950/40 border-red-900/60 shadow-[0_0_15px_rgba(220,38,38,0.1)]' 
                        : 'bg-slate-800/80 border-slate-700'
                    } flex justify-between items-center transition-all`}
                  >
                    <div>
                      <div className={`text-4xl font-bold ${
                        token.priority <= 2 ? 'text-red-400' : 'text-white'
                      }`}>
                        {token.number}
                      </div>
                      <div className="text-slate-400 font-medium mt-1 text-lg">
                        {token.department}
                      </div>
                    </div>
                    {token.priority <= 2 && (
                       <div className="bg-red-500/20 text-red-500 px-3 py-1 rounded font-bold uppercase text-sm border border-red-500/30">
                         Priority
                       </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
