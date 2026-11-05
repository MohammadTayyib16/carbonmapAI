import React, { useState, useEffect } from 'react';
import {
  Calculator as CalcIcon,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  FileCheck,
  Scale,
  Sparkles,
  Trash2,
  Loader2,
} from 'lucide-react';
import { EMISSION_ACTIVITIES as FALLBACK_ACTIVITIES } from '../data/mockData';
import { getEmissions, createEmission, deleteEmission } from '../services/api';

const FACTOR_LIBRARIES = {
  electricity: {
    category: 'Scope 2 - Purchased Electricity',
    unit: 'kWh',
    factor: 0.000716,
    factorSource: 'Central Electricity Authority (CEA) India CO2 Baseline Database v20.0',
    formulaTemplate: (q) => `${q.toLocaleString()} kWh × 0.000716 tCO₂e/kWh`,
  },
  diesel: {
    category: 'Scope 1 - Mobile Fleet Combustion',
    unit: 'Liters',
    factor: 0.00268,
    factorSource: 'DEFRA GHG Conversion Factors 2024',
    formulaTemplate: (q) => `${q.toLocaleString()} L × 0.00268 tCO₂e/L`,
  },
  gas: {
    category: 'Scope 1 - Stationary Combustion (Natural Gas)',
    unit: 'm³',
    factor: 0.00203,
    factorSource: 'DEFRA Natural Gas Factor 2024',
    formulaTemplate: (q) => `${q.toLocaleString()} m³ × 0.00203 tCO₂e/m³`,
  },
  freight: {
    category: 'Scope 3 - Upstream Freight Logistics',
    unit: 'tonne-km',
    factor: 0.000108,
    factorSource: 'GLEC Framework Heavy Goods Vehicle (Euro 6)',
    formulaTemplate: (q) => `${q.toLocaleString()} tonne-km × 0.000108 tCO₂e/tonne-km`,
  },
  packaging: {
    category: 'Scope 3 - Purchased Packaging Materials',
    unit: 'kg',
    factor: 0.00072,
    factorSource: 'Ecoinvent v3.9 Database (Cardboard)',
    formulaTemplate: (q) => `${q.toLocaleString()} kg × 0.00072 tCO₂e/kg`,
  },
};

const Calculator = ({ initialData }) => {
  const [activityType, setActivityType] = useState('electricity');
  const [activityName, setActivityName] = useState('Tata Motors Press Shop Electricity (Pune)');
  const [quantity, setQuantity] = useState(12500);
  const [sourceDoc, setSourceDoc] = useState('MSEDCL Industrial Meter Bill #HT-PUNE-8812');
  const [qualityTier, setQualityTier] = useState('Tier 1 - Primary Metered (CEA India)');
  const [activities, setActivities] = useState(FALLBACK_ACTIVITIES);
  const [scopeFilter, setScopeFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadActivitiesFromBackend = async () => {
    const res = await getEmissions();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const mapped = res.data.map((act) => ({
        id: act.activity_code || `ACT-${act.id}`,
        dbId: act.id,
        name: act.name,
        category: act.category,
        source: act.source,
        quantity: act.quantity,
        unit: act.unit,
        factor: act.factor,
        factorSource: act.factor_source || act.factorSource,
        formula: act.formula,
        quality: act.quality,
        emissions: act.emissions,
        date: act.activity_date || act.date,
        verified: act.verified,
      }));
      setActivities(mapped);
    }
  };

  useEffect(() => {
    loadActivitiesFromBackend();
  }, []);

  useEffect(() => {
    if (initialData && initialData.extractedData) {
      const data = initialData.extractedData;
      setActivityName(`${data.provider || 'Ingested Activity'} (${initialData.type || 'Extracted'})`);
      setQuantity(data.quantity || 1000);
      setSourceDoc(`Doc ${initialData.id || ''}: ${initialData.fileName || 'Uploaded Bill'}`);

      // Map document type to calculator activity
      const typeStr = (initialData.type || '').toLowerCase();
      if (typeStr.includes('electric')) {
        setActivityType('electricity');
        setQualityTier('Tier 1 - Primary Metered');
      } else if (typeStr.includes('fuel') || typeStr.includes('diesel')) {
        setActivityType('diesel');
        setQualityTier('Tier 1 - Primary Metered');
      } else if (typeStr.includes('gas')) {
        setActivityType('gas');
        setQualityTier('Tier 2 - Utility Invoice');
      } else if (typeStr.includes('transport') || typeStr.includes('freight')) {
        setActivityType('freight');
        setQualityTier('Tier 2 - Utility Invoice');
      } else if (typeStr.includes('invoice') || typeStr.includes('pack')) {
        setActivityType('packaging');
        setQualityTier('Tier 3 - Industry Proxy');
      }
    }
  }, [initialData]);

  const activeFactor = FACTOR_LIBRARIES[activityType];
  const calculatedEmissions = Number((quantity * activeFactor.factor).toFixed(4));
  const formulaString = `Emissions = ${activeFactor.formulaTemplate(quantity)}`;

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!quantity || quantity <= 0) return;

    setIsSubmitting(true);
    const newActivityPayload = {
      name: activityName.trim() || `${activeFactor.category} record`,
      category: activeFactor.category,
      source: sourceDoc.trim() || 'Manual Entry / Uploaded Record',
      quantity: Number(quantity),
      unit: activeFactor.unit,
      factor: activeFactor.factor,
      factor_source: activeFactor.factorSource,
      formula: formulaString,
      quality: qualityTier,
      emissions: calculatedEmissions,
      activity_date: new Date().toISOString().split('T')[0],
      verified: true,
      is_synthetic: false,
    };

    const res = await createEmission(newActivityPayload);
    setIsSubmitting(false);

    if (res.success) {
      setNotice(`Recorded "${newActivityPayload.name}" and persisted to database!`);
      setTimeout(() => setNotice(null), 4000);
      await loadActivitiesFromBackend();
    } else {
      // Local fallback
      const localItem = {
        ...newActivityPayload,
        id: `ACT-${Math.floor(100 + Math.random() * 900)}`,
        factorSource: newActivityPayload.factor_source,
        date: newActivityPayload.activity_date,
      };
      setActivities([localItem, ...activities]);
      setNotice(`Recorded calculation (${res.error || 'Saved locally'}).`);
      setTimeout(() => setNotice(null), 4000);
    }

    setActivityName('');
    setQuantity(1000);
    setSourceDoc('');
  };

  const handleDelete = async (act) => {
    if (!window.confirm(`Delete activity "${act.name}" from inventory?`)) return;

    if (act.dbId) {
      const res = await deleteEmission(act.dbId);
      if (res.success) {
        setNotice(`Deleted "${act.name}" from database.`);
        setTimeout(() => setNotice(null), 3000);
        await loadActivitiesFromBackend();
        return;
      }
    }

    setActivities(activities.filter((a) => a.id !== act.id));
    setNotice(`Deleted "${act.name}".`);
    setTimeout(() => setNotice(null), 3000);
  };

  const filteredActivities = activities.filter((act) => {
    if (scopeFilter === 'all') return true;
    if (scopeFilter === 'scope1') return act.category.includes('Scope 1');
    if (scopeFilter === 'scope2') return act.category.includes('Scope 2');
    if (scopeFilter === 'scope3') return act.category.includes('Scope 3');
    return true;
  });

  const totalCalculated = activities
    .reduce((acc, curr) => acc + (Number(curr.emissions) || 0), 0)
    .toFixed(2);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Deterministic Emission Calculation Engine
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Compliant with GHG Protocol Corporate Standard. Calculations are strictly deterministic formulas.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Rule 4: Every calculation displays Source, Quantity, Factor & Quality Tier</span>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CalcIcon className="w-4 h-4 text-emerald-600" />
            Emission Activity Parameters
          </h3>

          <form onSubmit={handleAddActivity} className="space-y-4 text-xs">
            {/* Emission Source Category */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Activity Category & Factor Library:
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="electricity">Purchased Electricity (Scope 2) — 0.000716 tCO₂e/kWh [CEA India Baseline]</option>
                <option value="diesel">Fleet Diesel Combustion (Scope 1) — 0.00268 tCO₂e/L</option>
                <option value="gas">Natural Gas Heating (Scope 1) — 0.00203 tCO₂e/m³</option>
                <option value="freight">Heavy Road Freight (Scope 3) — 0.000108 tCO₂e/tonne-km</option>
                <option value="packaging">Packaging Materials (Scope 3) — 0.00072 tCO₂e/kg</option>
              </select>
            </div>

            {/* Activity Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Activity Label / Location:
              </label>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="e.g. Pune Press Shop Electricity (MSEDCL)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Quantity and Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantity ({activeFactor.unit}):
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data Quality Tier:
                </label>
                <select
                  value={qualityTier}
                  onChange={(e) => setQualityTier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Tier 1 - Primary Metered">Tier 1 - Primary Metered (Best)</option>
                  <option value="Tier 2 - Utility Invoice">Tier 2 - Utility / Supplier Invoice</option>
                  <option value="Tier 3 - Industry Proxy">Tier 3 - Industry Average / Proxy</option>
                </select>
              </div>
            </div>

            {/* Source Reference Document */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Source Document Reference:
              </label>
              <input
                type="text"
                value={sourceDoc}
                onChange={(e) => setSourceDoc(e.target.value)}
                placeholder="e.g. Invoice #OCT-2026-881 from OCR Ingestion"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Record & Add to Inventory</span>
            </button>
          </form>
        </div>

        {/* Right Audit Formula Inspector Card */}
        <div className="lg:col-span-5 bg-slate-900 text-slate-200 p-6 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Deterministic Formula Audit
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                GHG Protocol
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Calculation Formula:</span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-emerald-300 text-xs">
                  {formulaString}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Applied Emission Factor:</span>
                <p className="font-mono text-white text-sm font-semibold">
                  {activeFactor.factor} <span className="text-xs text-slate-400">tCO₂e / {activeFactor.unit}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Source: {activeFactor.factorSource}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <div>
                  <span className="text-[11px] text-slate-400 block">Calculated Result:</span>
                  <div className="text-2xl font-black text-white font-mono mt-1">
                    {calculatedEmissions} <span className="text-xs font-normal text-slate-400">tCO₂e</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Data Tier:</span>
                  <span className="text-xs font-semibold text-emerald-400">{qualityTier.split(' - ')[0]}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <span className="text-emerald-400 font-semibold">Verification Guarantee:</span> All mathematical computations are executed via standard arithmetic functions without LLM extrapolation.
          </div>
        </div>
      </div>

      {/* Inventory Table with Scope Filter Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Active Calculation Inventory ({filteredActivities.length} items)
            </h3>
            <p className="text-xs text-slate-500">
              Current calculated total: <span className="font-bold text-slate-800">{totalCalculated} tCO₂e</span>
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
            {['all', 'scope1', 'scope2', 'scope3'].map((scope) => (
              <button
                key={scope}
                onClick={() => setScopeFilter(scope)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                  scopeFilter === scope
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Activity</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Quantity</th>
                <th className="py-3 px-4 font-semibold">Formula Audit</th>
                <th className="py-3 px-4 font-semibold">Quality Tier</th>
                <th className="py-3 px-4 font-semibold text-right">Result</th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActivities.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-medium text-slate-800">{act.name}</td>
                  <td className="py-3 px-4 text-slate-600">{act.category}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">
                    {Number(act.quantity).toLocaleString()} {act.unit}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {act.formula}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {act.quality}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                    {Number(act.emissions).toFixed(2)} t
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDelete(act)}
                      title={`Delete ${act.name}`}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

export default Calculator;
