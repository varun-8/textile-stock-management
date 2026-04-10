import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Key, 
  Users, 
  Monitor, 
  ShieldCheck, 
  Settings, 
  LogOut,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout, isSuperAdmin } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Licenses', path: '/licenses', icon: Key },
    { name: 'Clients', path: '/clients', icon: Users },
  ];

  if (isSuperAdmin) {
    navItems.push(
      { name: 'System Control', path: '/systems', icon: Monitor },
      { name: 'Audit Logs', path: '/audit', icon: ShieldCheck },
      { name: 'Team', path: '/team', icon: TrendingUp }
    );
  }

  navItems.push({ name: 'Profile', path: '/profile', icon: Settings });

  return (
    <aside className="sidebar glass">
      <div className="sidebar-header">
        <div className="logo-box accent-gradient">LT</div>
        <h1>LoomTrack Admin</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
            <ChevronRight className="arrow" size={14} />
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-pill glass">
          <div className="user-avatar">{user?.fullName?.[0]}</div>
          <div className="user-info">
            <div className="user-name">{user?.fullName}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button onClick={logout} className="logout-btn">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
