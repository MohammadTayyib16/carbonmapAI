import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Calculator,
  Truck,
  MapPin,
  FileText,
  Settings,
  Leaf,
  ShieldCheck,
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Documents', icon: UploadCloud, badge: 'OCR AI' },
    { id: 'calculator', label: 'Emission Calculator', icon: Calculator },
    { id: 'suppliers', label: 'Suppliers (Scope 3)', icon: Truck },
    { id: 'gis-map', label: 'GIS Routing Map', icon: MapPin },
    { id: 'reports', label: 'Reports & Export', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 h-full border-r border-slate-800 print:hidden">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white tracking-tight text-base flex items-center gap-1.5">
              CarbonMap <span className="text-emerald-400 font-extrabold">AI</span>
            </span>
            <span className="text-[10px] block text-slate-400 font-mono tracking-wider uppercase">
              Prototype v0.1
            </span>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    isActive
                      ? 'bg-emerald-700 text-emerald-100'
                      : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Audit & Compliance Trust Tag */}
      <div className="p-4 m-3 rounded-xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-start space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-200">GHG Protocol Aligned</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Deterministic calculations with verifiable formula audit trails.
            </p>
          </div>
        </div>
      </div>

      {/* User profile footer */}
      <div className="p-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-xs">
            TM
          </div>
          <div className="truncate">
            <p className="text-xs font-medium text-white truncate">Tata Motors Ltd (Pune)</p>
            <p className="text-[10px] text-emerald-400">Pimpri & Chakan Supply Chain</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
