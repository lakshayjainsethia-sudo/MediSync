import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

/**
 * Main application layout.
 * Enforces the "Warm Gray" background (#F9FAFB) and coordinates the Sidebar and main content area.
 */
const MainLayout = () => {
  return (
    <div className="flex h-screen bg-[#F9FAFB] font-sans antialiased text-slate-800">
      {/* Sidebar Component */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">
        
        {/* Optional Topbar can go here, using glassmorphism */}
        <header className="h-16 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm flex items-center justify-between px-8 z-10 sticky top-0">
           <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Dashboard Overview</h2>
           <div className="flex items-center space-x-4">
               {/* Search, Notifications, Profile Dropdown */}
               <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
           </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB] p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
