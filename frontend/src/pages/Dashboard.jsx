import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  ArrowUpRight,
  Flame,
  Zap,
  Globe2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  MapPin,
  Server,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { SUMMARY_STATS as FALLBACK_STATS, MONTHLY_TREND, EMISSION_ACTIVITIES as FALLBACK_ACTIVITIES } from '../data/mockData';
import { getDashboardSummary, getEmissions } from '../services/api';

const Dashboard = ({ setActiveTab, backendStatus, onRefreshHealth }) => {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [activities, setActivities] = useState(FALLBACK_ACTIVITIES);
  const [companyName, setCompanyName] = useState('Tata Motors Ltd (Pune Manufacturing Supply Chain)');

  const maxMonthly = Math.max(...MONTHLY_TREND.map((d) => d.total));

  useEffect(() => {
    const fetchLiveDashboard = async () => {
      try {
        const [dashRes, emRes] = await Promise.all([
          getDashboardSummary(),
          getEmissions(),
        ]);

        if (dashRes.success && dashRes.data && dashRes.data.metrics) {
          const m = dashRes.data.metrics;
          setStats({
            totalEmissions: m.total_emissions_tco2e,
            changeMom: m.mom_change_percent || -3.8,
            scope1: m.scope1_direct,
            scope2: m.scope2_electricity,
            scope3: m.scope3_value_chain,
            dataQualityIndex: Math.round(m.verified_data_quality_percent || 91),
            activeSuppliers: m.active_suppliers_count || 5,
            processedBills: m.processed_bills_count || 24,
            pendingReview: 2,
          });
          if (dashRes.data.company) {
            setCompanyName(dashRes.data.company);
          }
        }

        if (emRes.success && Array.isArray(emRes.data) && emRes.data.length > 0) {
          const mapped = emRes.data.map((act) => ({
            id: act.activity_code || `ACT-${act.id}`,
            name: act.name,
            category: act.category,
            source: act.source,
            quantity: act.quantity,
            unit: act.unit,
            factor: act.factor,
            factorSource: act.factor_source || act.factorSource || 'Standard Factor',
            quality: act.quality,
            emissions: act.emissions,
          }));
          setActivities(mapped);
        }
      } catch (err) {
        console.warn('Dashboard: live fetch error, using fallback data', err);
      }
    };

    fetchLiveDashboard();
  }, [backendStatus?.connected]);

  const totalEm = stats.totalEmissions || 0.01;
  const scope1Pct = ((stats.scope1 / totalEm) * 100).toFixed(1);
  const scope2Pct = ((stats.scope2 / totalEm) * 100).toFixed(1);
  const scope3Pct = ((stats.scope3 / totalEm) * 100).toFixed(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Backend Integration Status Notification */}
      {backendStatus && !backendStatus.connected && !backendStatus.loading && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>
              <strong>Backend Offline:</strong> Unable to reach FastAPI at{' '}
              <code>http://127.0.0.1:8000</code>. Displaying local synthetic data.
            </span>
          </div>
          <button
            onClick={onRefreshHealth}
            className="inline-flex items-center space-x-1 px-3 py-1 bg-white border border-rose-300 hover:bg-rose-100 rounded-lg text-rose-700 font-semibold transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-rose-600" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top Banner Summary */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 -skew-x-12 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Carbon Accounting
              </div>

              {/* Dynamic API Indicator Badge */}
              {backendStatus?.connected && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-100 text-[11px] font-mono border border-emerald-400/30">
                  <Server className="w-3 h-3 text-emerald-300" />
                  <span>FastAPI v{backendStatus.data?.version || '0.1.0'}</span>
                  <span>·</span>
                  <span className="capitalize">{backendStatus.data?.database || 'ready'} DB</span>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold tracking-tight">
              {companyName}
            </h2>
            <p className="text-emerald-100/80 text-sm mt-1 max-w-xl">
              Audit-ready GHG Protocol inventory combining AI document extraction with verifiable
              Python calculation models.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white text-emerald-900 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Ingest Bills</span>
            </button>
            <button
              onClick={() => setActiveTab('gis-map')}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-700/60 text-white border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Route GIS Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scope Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Emissions Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Footprint
            </span>
            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingDown className="w-3.5 h-3.5 mr-1" />
              {Math.abs(stats.changeMom)}% MoM
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              {stats.totalEmissions}
            </span>
            <span className="text-xs font-semibold text-slate-500">tCO₂e</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Verified Data Quality</span>
            <span className="font-semibold text-emerald-600">{stats.dataQualityIndex}% Tier 1/2</span>
          </div>
        </div>

        {/* Scope 1 Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Scope 1 (Direct)
              </span>
            </div>
            <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">
              {scope1Pct}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
              {stats.scope1}
            </span>
            <span className="text-xs font-semibold text-slate-500">tCO₂e</span>
          </div>
          <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 truncate">
            Plant diesel fleet, natural gas thermal ovens
          </p>
        </div>

        {/* Scope 2 Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Scope 2 (Electricity)
              </span>
            </div>
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
              {scope2Pct}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
              {stats.scope2}
            </span>
            <span className="text-xs font-semibold text-slate-500">tCO₂e</span>
          </div>
          <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 truncate">
            Press & body shops grid power (MSEDCL)
          </p>
        </div>

        {/* Scope 3 Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Globe2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Scope 3 (Value Chain)
              </span>
            </div>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono">
              {scope3Pct}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
              {stats.scope3}
            </span>
            <span className="text-xs font-semibold text-slate-500">tCO₂e</span>
          </div>
          <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 truncate">
            Auto parts haulage, packaging, castings
          </p>
        </div>
      </div>

      {/* Trajectory & Scope Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Monthly Emission Trajectory (tCO₂e)
              </h3>
              <p className="text-xs text-slate-500">
                Tracking decarbonization progress over the past 6 months
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Scope 1
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Scope 2
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Scope 3
              </span>
            </div>
          </div>

          {/* Responsive SVG / CSS Stacked Bars */}
          <div className="h-56 flex items-end justify-between gap-4 pt-4 border-b border-slate-100 pb-2">
            {MONTHLY_TREND.map((item) => {
              const s1Height = (item.scope1 / maxMonthly) * 100;
              const s2Height = (item.scope2 / maxMonthly) * 100;
              const s3Height = (item.scope3 / maxMonthly) * 100;

              return (
                <div key={item.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[11px] font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.total}t
                  </div>
                  <div className="w-full max-w-[42px] flex flex-col-reverse rounded-t-md overflow-hidden bg-slate-100">
                    <div
                      style={{ height: `${s1Height}%` }}
                      className="bg-amber-500 transition-all hover:brightness-110"
                      title={`Scope 1: ${item.scope1} tCO2e`}
                    ></div>
                    <div
                      style={{ height: `${s2Height}%` }}
                      className="bg-blue-500 transition-all hover:brightness-110"
                      title={`Scope 2: ${item.scope2} tCO2e`}
                    ></div>
                    <div
                      style={{ height: `${s3Height}%` }}
                      className="bg-emerald-500 transition-all hover:brightness-110"
                      title={`Scope 3: ${item.scope3} tCO2e`}
                    ></div>
                  </div>
                  <span className="mt-2 text-xs font-semibold text-slate-500">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>Baseline Target: &lt; 25.0 tCO₂e/mo</span>
            <span className="text-emerald-600 font-semibold flex items-center">
              Target achieved in Nov (-17.0% from peak)
            </span>
          </div>
        </div>

        {/* Scope Distribution Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              GHG Scope Distribution
            </h3>
            <p className="text-xs text-slate-500">Share of total greenhouse gas footprint</p>

            {/* Custom Circular / Linear Breakdown Display */}
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Scope 2 (Electricity)
                  </span>
                  <span className="text-slate-900 font-mono">{stats.scope2} t ({scope2Pct}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${scope2Pct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Scope 3 (Value Chain)
                  </span>
                  <span className="text-slate-900 font-mono">{stats.scope3} t ({scope3Pct}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${scope3Pct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Scope 1 (Direct Fuel)
                  </span>
                  <span className="text-slate-900 font-mono">{stats.scope1} t ({scope1Pct}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${scope1Pct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3.5 bg-emerald-50/70 rounded-lg border border-emerald-100 text-xs text-emerald-900">
            <div className="font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Primary Decarbonization Driver
            </div>
            <p className="mt-1 text-emerald-800/80 leading-relaxed text-[11px]">
              Chakan to Pimpri logistics optimization & MSEDCL industrial grid metered accounting.
            </p>
          </div>
        </div>
      </div>

      {/* Verified Activity Table (Audit Trail) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Verified Emission Activities (Audit Trail)
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic calculations following GHG Protocol standards (No AI calculation)
            </p>
          </div>
          <button
            onClick={() => setActiveTab('calculator')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            Open Calculator <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Activity & Source</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Quantity</th>
                <th className="py-3 px-4 font-semibold">Emission Factor</th>
                <th className="py-3 px-4 font-semibold">Data Quality</th>
                <th className="py-3 px-4 font-semibold text-right">Result (tCO₂e)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.slice(0, 6).map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900">{act.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{act.source}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                      {act.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                    {Number(act.quantity).toLocaleString()} {act.unit}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="font-mono text-[11px]">{act.factor}</span>
                    <span className="block text-[10px] text-slate-400 truncate max-w-[200px]" title={act.factorSource}>{act.factorSource}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        act.quality?.includes('Tier 1')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : act.quality?.includes('Tier 2')
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {act.quality}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {Number(act.emissions).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-sans">tCO₂e</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
