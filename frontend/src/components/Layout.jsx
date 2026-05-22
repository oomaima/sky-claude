import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Database, FolderClock, Settings, Settings2,
  LogOut, Search, Users, ChevronLeft, ChevronRight
} from 'lucide-react';

const SIDEBAR_BG = '#E2E8F0';

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);

  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const currentModel = new URLSearchParams(location.search).get('model');

  const handleLogout = () => { logout(); navigate('/login'); };

  // Returns Tailwind classes for a nav item given its active state
  const itemClass = (isActive) =>
    `flex items-center rounded-lg transition-all duration-150 cursor-pointer
     ${collapsed ? 'justify-center px-0 py-2.5 w-10 mx-auto' : 'space-x-3 px-3 py-2.5 w-full'}
     ${isActive
       ? 'text-slate-900 font-bold'
       : 'text-slate-500 font-normal hover:text-slate-800'
     }`;

  const modelItemClass = (modelName) => {
    const isActive = location.pathname === '/' && currentModel === modelName;
    return `flex items-center rounded-lg transition-all duration-150 cursor-pointer
      ${collapsed ? 'justify-center px-0 py-2.5 w-10 mx-auto' : 'space-x-3 px-3 py-2.5 w-full'}
      ${isActive
        ? 'text-slate-900 font-bold'
        : 'text-slate-500 font-normal hover:text-slate-800'
      }`;
  };

  const isGenerateActive = location.pathname === '/';

  // Abbreviated name for user avatar in collapsed state
  const initials = (user?.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50">

      {/* ── Sidebar ── */}
      <div
        className="flex flex-col border-r border-slate-300 shrink-0 transition-all duration-300"
        style={{ width: collapsed ? '64px' : '256px', backgroundColor: SIDEBAR_BG }}
      >
        {/* Header */}
        <div className={`flex items-center border-b border-slate-300 shrink-0 ${collapsed ? 'justify-center px-0 py-4 h-16' : 'justify-between px-5 h-16'}`}>
          {!collapsed && (
            <span className="text-xl tracking-tight select-none leading-none">
              <span className="font-light text-genviz-orange">sky</span>
              <span className="font-bold text-genviz-orange">Claude</span>
            </span>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-300/70 hover:text-slate-800 transition-colors shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Main nav */}
        <div className={`flex-1 overflow-y-auto py-4 space-y-6 ${collapsed ? 'px-0' : 'px-3'}`}>

          {/* Primary nav */}
          <div className="space-y-0.5">
            <Link
              to="/"
              className={itemClass(isGenerateActive)}
              title={collapsed ? 'Generate' : undefined}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Generate</span>}
            </Link>
            <NavLink
              to="/dashboards"
              className={({ isActive }) => itemClass(isActive)}
              title={collapsed ? 'Saved Dashboards' : undefined}
            >
              <FolderClock className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Saved Dashboards</span>}
            </NavLink>
          </div>

          {/* Semantic model section */}
          <div>
            {!collapsed && (
              <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Semantic Model
              </p>
            )}
            {collapsed && <div className="border-t border-slate-300 mx-3 mb-3" />}
            <div className="space-y-0.5">
              {['COMPETITORS'].map(model => (
                <Link
                  key={model}
                  to={`/?model=${model}`}
                  className={modelItemClass(model)}
                  title={collapsed ? model.charAt(0) + model.slice(1).toLowerCase() : undefined}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{model.charAt(0) + model.slice(1).toLowerCase()}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom admin links + user card */}
        <div className={`border-t border-slate-300 py-3 space-y-0.5 ${collapsed ? 'px-0' : 'px-3'}`}>
          {user?.role === 'SUPER_ADMIN' && (
            <NavLink to="/features" className={({ isActive }) => itemClass(isActive)} title={collapsed ? 'Application Features' : undefined}>
              <Settings2 className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Application Features</span>}
            </NavLink>
          )}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'DATA_ANALYST') && (
            <NavLink to="/prompts" className={({ isActive }) => itemClass(isActive)} title={collapsed ? 'System Prompts' : undefined}>
              <Settings className="w-4 h-4 shrink-0" />
              {!collapsed && <span>System Prompts</span>}
            </NavLink>
          )}
          {user?.role === 'SUPER_ADMIN' && (
            <NavLink to="/users" className={({ isActive }) => itemClass(isActive)} title={collapsed ? 'User Management' : undefined}>
              <Users className="w-4 h-4 shrink-0" />
              {!collapsed && <span>User Management</span>}
            </NavLink>
          )}
          {user?.role === 'SUPER_ADMIN' && (
            <NavLink to="/query-data" className={({ isActive }) => itemClass(isActive)} title={collapsed ? 'Query Data' : undefined}>
              <Search className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Query Data</span>}
            </NavLink>
          )}

          {/* User card */}
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 pt-3">
              <div className="w-8 h-8 rounded-full bg-slate-500 text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors" title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-3 bg-white border border-slate-300 rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.full_name || 'System User'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-slate-700 transition-colors shrink-0 ml-2">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
