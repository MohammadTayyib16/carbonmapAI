import React from 'react';
import {
  Bell,
  Calendar,
  DownloadCloud,
  Sparkles,
  Server,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { COMPANY_PROFILE } from '../data/mockData';

const Header = ({ activeTab, onExportClick, backendStatus, onRefreshHealth }) => {
  const titles = {
    dashboard: 'Executive Carbon Dashboard',
    upload: 'AI Document Ingestion & OCR',
    calculator: 'Deterministic Emission Calculator',
    suppliers: 'Supply Chain & Scope 3 Partners',
    'gis-map': 'Interactive GIS & Route Carbon Map',
    reports: 'Compliance Reports & Data Exports',
    settings: 'System & Emission Factor Settings',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">
      <div className="flex items-center space-x-3">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          {titles[activeTab] || 'CarbonMap AI'}
        </h1>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          {COMPANY_PROFILE.reportingYear}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        {/* Backend FastAPI Connection Status Pill */}
        {backendStatus && (
          <div className="flex items-center">
            {backendStatus.loading && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span className="hidden sm:inline">Connecting API...</span>
              </div>
            )}

            {!backendStatus.loading && backendStatus.connected && (
              <div
                title={`FastAPI Live on http://127.0.0.1:8000 (Database: ${backendStatus.data?.database || 'ready'})`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>FastAPI Connected</span>
                <span className="text-[10px] text-emerald-600 font-mono hidden md:inline">
                  (:8000)
                </span>
              </div>
            )}

            {!backendStatus.loading && !backendStatus.connected && (
              <button
                onClick={onRefreshHealth}
                title={`Connection error: ${backendStatus.error}. Click to retry.`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>API Offline</span>
                <RotateCcw className="w-3 h-3 text-rose-600 ml-0.5" />
              </button>
            )}
          </div>
        )}

        <div className="hidden md:flex items-center text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Reporting Period: Q3-Q4 2026</span>
        </div>

        <button
          onClick={onExportClick}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export Report</span>
        </button>

        <div className="relative">
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
