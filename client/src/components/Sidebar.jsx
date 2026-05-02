import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  HomeIcon, 
  UsersIcon, 
  CalendarIcon, 
  CurrencyDollarIcon,
  DocumentTextIcon,
  QueueListIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

/**
 * Redesigned Dynamic Sidebar.
 * Uses Deep Navy (#0F172A) and subtle Glassmorphism aesthetics.
 */
const Sidebar = () => {
  const { user, logout } = useAuth();

  const roleKey = user?.role ? user.role.toLowerCase() : 'admin';

  const navItems = {
    admin: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: HomeIcon },
      { name: 'Blood Bank', path: '/admin/blood-inventory', icon: HeartIcon },
      { name: 'Live Queue', path: '/live-queue', icon: QueueListIcon },
      { name: 'Manage Users', path: '/admin/users', icon: UsersIcon },
      { name: 'Billing', path: '/billing', icon: CurrencyDollarIcon },
    ],
    receptionist: [
      { name: 'Dashboard', path: '/receptionist/dashboard', icon: HomeIcon },
      { name: 'Appointments', path: '/appointments', icon: CalendarIcon },
      { name: 'Triage Queue', path: '/triage', icon: QueueListIcon },
      { name: 'Billing', path: '/billing', icon: CurrencyDollarIcon },
    ],
    doctor: [
      { name: 'Clinical Dashboard', path: '/doctor/dashboard', icon: HomeIcon },
      { name: 'Live Queue', path: '/live-queue', icon: QueueListIcon }
    ],
    // Add Patient arrays as needed...
  };

  const linksToRender = navItems[roleKey] || navItems.admin;

  return (
    // Deep Navy base with a slight glassmorphism effect
    <div className="flex flex-col w-64 h-full bg-[#0F172A] text-slate-300 shadow-2xl z-20 overflow-y-auto border-r border-slate-800">
      
      {/* Brand Header */}
      <div className="flex items-center justify-center p-6 border-b border-slate-800/50 backdrop-blur-md bg-white/5">
        <h1 className="text-2xl font-bold tracking-widest text-white">
          <span className="text-emerald-400">Medi</span>sync
        </h1>
      </div>
      
      {/* Navigation Links */}
      <div className="flex flex-col flex-1 p-4 mt-2 space-y-1">
        {linksToRender.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-xl transition-all duration-300 ease-out group ${
                isActive 
                  ? 'bg-blue-600/20 text-white border border-blue-500/30' 
                  : 'hover:bg-white/5 hover:text-white border border-transparent'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3 opacity-70 group-hover:opacity-100 transition-opacity" />
            <span className="font-medium text-sm tracking-wide">{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* User Footer with Glassmorphic touch */}
      <div className="p-4 m-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role || 'Admin'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-all duration-200"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
