import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  ShieldAlert,
  Database,
  Globe,
  Save,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { COMPANY_PROFILE } from '../data/mockData';

const Settings = () => {
  const [profile, setProfile] = useState({
    name: COMPANY_PROFILE.name,
    industry: COMPANY_PROFILE.industry,
    region: COMPANY_PROFILE.region,
    reportingYear: COMPANY_PROFILE.reportingYear,
    factorDatabase: 'Central Electricity Authority (CEA) India 2024 & DEFRA 2024',
  });
  const [savedStatus, setSavedStatus] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          Organization & System Settings
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure business metadata, baseline emission factor databases, and security parameters.
        </p>
      </div>

      {savedStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings updated successfully!
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            Company & Reporting Boundaries
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Defines the operational boundary under GHG Protocol Scope 1, 2, and 3.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Company Legal Name:</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Sector / Industry:</label>
              <input
                type="text"
                value={profile.industry}
                onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Regional Grid Location:</label>
              <input
                type="text"
                value={profile.region}
                onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Active Reporting Year:</label>
              <input
                type="text"
                value={profile.reportingYear}
                onChange={(e) => setProfile({ ...profile, reportingYear: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Emission Factors Database */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            Default Emission Factor Library
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Factors used to convert activity units (kWh, liters, m³) into CO₂ equivalent.
          </p>

          <select
            value={profile.factorDatabase}
            onChange={(e) => setProfile({ ...profile, factorDatabase: e.target.value })}
            className="w-full sm:w-96 px-3 py-2 text-xs border rounded-lg border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option>Central Electricity Authority (CEA) India 2024 & DEFRA 2024</option>
            <option>Central Electricity Authority (CEA) India 2024</option>
            <option>DEFRA 2024 (UK Government GHG Standards)</option>
            <option>US EPA GHG Emission Factors Hub 2024</option>
            <option>European Environment Agency (EEA) Standard 2024</option>
          </select>
        </div>

        {/* Security / Backend Secrets Indicator */}
        <div className="pt-6 border-t border-slate-200">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-slate-800 font-bold">
              <Key className="w-4 h-4 text-emerald-600" />
              <span>API Credentials & LLM Secret Management</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              In accordance with security rule #6, OCR LLM API keys and PostgreSQL database credentials
              are managed strictly inside the <code>backend/.env</code> file. No secrets are stored in the client.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
