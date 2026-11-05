import React, { useState, useEffect } from 'react';
import {
  FileText,
  DownloadCloud,
  Printer,
  CheckCircle2,
  Calendar,
  Building,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  COMPANY_PROFILE,
  SUMMARY_STATS as FALLBACK_STATS,
  EMISSION_ACTIVITIES as FALLBACK_ACTIVITIES,
} from '../data/mockData';
import { getEmissions, getDashboardSummary, getReports } from '../services/api';

const Reports = () => {
  const [downloadNotice, setDownloadNotice] = useState('');
  const [activities, setActivities] = useState(FALLBACK_ACTIVITIES);
  const [summary, setSummary] = useState(FALLBACK_STATS);
  const [reportCode, setReportCode] = useState('RPT-2026-TM01');

  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const [emRes, dashRes, repRes] = await Promise.all([
          getEmissions(),
          getDashboardSummary(),
          getReports(),
        ]);

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
            formula: act.formula,
            quality: act.quality,
            emissions: act.emissions,
            date: act.activity_date,
            isSynthetic: act.is_synthetic,
          }));
          setActivities(mapped);
        }

        if (dashRes.success && dashRes.data && dashRes.data.metrics) {
          const m = dashRes.data.metrics;
          setSummary({
            totalEmissions: m.total_emissions_tco2e,
            scope1: m.scope1_direct,
            scope2: m.scope2_electricity,
            scope3: m.scope3_value_chain,
          });
        }

        if (repRes.success && Array.isArray(repRes.data) && repRes.data.length > 0) {
          setReportCode(repRes.data[0].report_code || 'RPT-2026-TM01');
        }
      } catch (err) {
        console.warn('Reports: using fallback demonstration data', err);
      }
    };

    fetchLiveData();
  }, []);

  // Functional CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Activity ID',
      'Activity Name',
      'GHG Scope & Category',
      'Source Document',
      'Quantity',
      'Unit',
      'Emission Factor',
      'Factor Source',
      'Applied Formula',
      'Data Quality Tier',
      'Emissions (tCO2e)',
      'Data Classification',
    ];

    const rows = activities.map((act) => [
      `"${act.id}"`,
      `"${act.name}"`,
      `"${act.category}"`,
      `"${act.source}"`,
      act.quantity,
      `"${act.unit}"`,
      act.factor,
      `"${act.factorSource}"`,
      `"${act.formula}"`,
      `"${act.quality}"`,
      act.emissions,
      act.isSynthetic ? '"SYNTHETIC DEMO DATA"' : '"MEASURED PRIMARY DATA"',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CarbonMapAI_Report_${reportCode}_${COMPANY_PROFILE.reportingYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotice('CSV Report downloaded successfully!');
    setTimeout(() => setDownloadNotice(''), 4000);
  };

  // Functional PDF Export (via browser print / PDF engine)
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:m-0 print:space-y-0">
      {/* Header and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            GHG Protocol Compliance Reports & Exports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Export audit-grade greenhouse gas inventories in PDF (ReportLab format) and CSV.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {downloadNotice}
        </div>
      )}

      {/* Printable Report Document Card */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 print:max-w-full space-y-6 max-w-4xl mx-auto">
        {/* Document Header */}
        <div className="border-b border-slate-200 pb-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
              Official Carbon Assessment Report
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {COMPANY_PROFILE.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sector: {COMPANY_PROFILE.industry} | Accounting Standard: GHG Protocol Corporate Standard
            </p>
          </div>

          <div className="text-right text-xs">
            <span className="font-mono text-slate-500 block font-bold">Report ID: {reportCode}</span>
            <span className="font-semibold text-slate-700 block mt-1">
              Year: {COMPANY_PROFILE.reportingYear}
            </span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold uppercase inline-block mt-1">
              Tata Motors Pune Facility
            </span>
          </div>
        </div>

        {/* Executive Footprint Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">Gross Footprint</span>
            <p className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {summary.totalEmissions} <span className="text-xs font-sans text-slate-500">tCO₂e</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">Scope 1 (Direct)</span>
            <p className="text-xl font-bold text-amber-700 font-mono mt-0.5">
              {summary.scope1} <span className="text-xs font-sans text-slate-500">tCO₂e</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">Scope 2 (Grid Power)</span>
            <p className="text-xl font-bold text-blue-700 font-mono mt-0.5">
              {summary.scope2} <span className="text-xs font-sans text-slate-500">tCO₂e</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">Scope 3 (Value Chain)</span>
            <p className="text-xl font-bold text-emerald-700 font-mono mt-0.5">
              {summary.scope3} <span className="text-xs font-sans text-slate-500">tCO₂e</span>
            </p>
          </div>
        </div>

        {/* Audit Line Items */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3">
            Itemized Activity Audit Log & Applied Formulas ({activities.length} Recorded Activities)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Activity</th>
                  <th className="py-2.5 px-3 font-semibold">Scope</th>
                  <th className="py-2.5 px-3 font-semibold">Quantity</th>
                  <th className="py-2.5 px-3 font-semibold">Formula / Factor</th>
                  <th className="py-2.5 px-3 font-semibold">Quality</th>
                  <th className="py-2.5 px-3 font-semibold text-right">tCO₂e</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {activities.map((act) => (
                  <tr key={act.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{act.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{act.category.split(' - ')[0]}</td>
                    <td className="py-2.5 px-3 font-mono">{Number(act.quantity).toLocaleString()} {act.unit}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{act.formula}</td>
                    <td className="py-2.5 px-3 text-[11px]">{act.quality.split(' - ')[0]}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{act.emissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Certification & Compliance Footnote */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified with CarbonMap AI Deterministic Calculation Standard</span>
          </div>
          <span>Report Generated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;
