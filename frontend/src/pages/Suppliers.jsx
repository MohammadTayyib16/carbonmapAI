import React, { useState, useEffect } from 'react';
import {
  Truck,
  Building2,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Award,
  Filter,
  Trash2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { SUPPLIERS as FALLBACK_SUPPLIERS } from '../data/mockData';
import { getSuppliers, createSupplier, deleteSupplier } from '../services/api';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState(FALLBACK_SUPPLIERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    category: 'Logistics',
    location: '',
    lat: 18.6445,
    lng: 73.8123,
    annualSpend: '₹40,00,000',
    distanceKm: 25.0,
    esgRating: 'A-',
    emissionsTons: 8.5,
    intensity: '0.30 kg CO₂e/₹100',
    status: 'Verified Supplier',
  });

  const loadSuppliersFromBackend = async () => {
    const res = await getSuppliers();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const mapped = res.data.map((s) => ({
        id: s.supplier_code || `SUP-0${s.id}`,
        dbId: s.id,
        name: s.name,
        category: s.category,
        location: s.location,
        lat: s.latitude,
        lng: s.longitude,
        annualSpend: s.annual_spend,
        distanceKm: s.distance_km,
        esgRating: s.esg_rating,
        emissionsTons: s.emissions_tons,
        intensity: s.intensity,
        status: s.status,
      }));
      setSuppliers(mapped);
    }
  };

  useEffect(() => {
    loadSuppliersFromBackend();
  }, []);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    setFormError(null);
    setIsSubmitting(true);

    const payload = {
      name: newSupplier.name.trim(),
      category: newSupplier.category,
      location: newSupplier.location.trim(),
      latitude: Number(newSupplier.lat) || 18.6445,
      longitude: Number(newSupplier.lng) || 73.8123,
      annual_spend: newSupplier.annualSpend.trim(),
      distance_km: Number(newSupplier.distanceKm) || 25.0,
      esg_rating: newSupplier.esgRating || 'A-',
      emissions_tons: Number(newSupplier.emissionsTons) || 5.0,
      intensity: newSupplier.intensity || '0.30 kg CO₂e/₹100',
      status: newSupplier.status || 'Verified Supplier',
    };

    const res = await createSupplier(payload);
    setIsSubmitting(false);

    if (res.success) {
      setShowAddModal(false);
      setNotice(`Supplier "${payload.name}" saved successfully to database!`);
      setTimeout(() => setNotice(null), 4000);

      // Refresh list from DB
      await loadSuppliersFromBackend();

      // Reset form
      setNewSupplier({
        name: '',
        category: 'Logistics',
        location: '',
        lat: 18.6445,
        lng: 73.8123,
        annualSpend: '₹40,00,000',
        distanceKm: 25.0,
        esgRating: 'A-',
        emissionsTons: 8.5,
        intensity: '0.30 kg CO₂e/₹100',
        status: 'Verified Supplier',
      });
    } else {
      // Show backend error (e.g. duplicate name)
      setFormError(res.error || 'Failed to save supplier. Please check fields.');
    }
  };

  const handleDelete = async (sup) => {
    if (!window.confirm(`Delete supplier "${sup.name}"?`)) return;

    if (sup.dbId) {
      const res = await deleteSupplier(sup.dbId);
      if (res.success) {
        setNotice(`Deleted supplier "${sup.name}".`);
        setTimeout(() => setNotice(null), 3000);
        await loadSuppliersFromBackend();
        return;
      }
    }

    // Local fallback
    setSuppliers(suppliers.filter((s) => s.id !== sup.id));
    setNotice(`Deleted supplier "${sup.name}".`);
    setTimeout(() => setNotice(null), 3000);
  };

  const totalSupplierEmissions = suppliers
    .reduce((acc, curr) => acc + (Number(curr.emissionsTons) || 0), 0)
    .toFixed(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Supply Chain & Scope 3 Vendor Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tracking upstream freight, purchased goods, and vendor decarbonization commitments.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setFormError(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Scope 3 Supplier Total</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {totalSupplierEmissions} <span className="text-xs font-sans text-slate-400">tCO₂e</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            Across {suppliers.length} active primary suppliers
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Average Vendor ESG Grade</span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 font-mono">
            A- <span className="text-xs font-sans text-slate-400">High Compliance</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            3 verified net-zero transition plans
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Logistics Distance Tracked</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {suppliers.reduce((acc, curr) => acc + (Number(curr.distanceKm) || 0), 0)}{' '}
            <span className="text-xs font-sans text-slate-400">km total</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Integrated with OSRM GIS Routing
          </span>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search supplier, category, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="text-xs text-slate-500">
            Showing {filteredSuppliers.length} suppliers (Database synced)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Supplier Name</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold">Distance (km)</th>
                <th className="py-3 px-4 font-semibold">Annual Spend</th>
                <th className="py-3 px-4 font-semibold">ESG Rating</th>
                <th className="py-3 px-4 font-semibold text-right">Scope 3 (tCO₂e)</th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-900 block">{sup.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{sup.id}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{sup.category}</td>
                  <td className="py-3.5 px-4 text-slate-700">{sup.location}</td>
                  <td className="py-3.5 px-4 font-mono">{sup.distanceKm} km</td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                    {sup.annualSpend}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        sup.esgRating.startsWith('A')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <Award className="w-3 h-3" />
                      Grade {sup.esgRating}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {Number(sup.emissionsTons).toFixed(1)} t
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleDelete(sup)}
                      title={`Delete ${sup.name}`}
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

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Add Scope 3 Supplier
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter vendor details and logistics distance. Saves directly to the database.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Supplier Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Automobile Precision Parts Ltd"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category:</label>
                  <select
                    value={newSupplier.category}
                    onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 bg-white"
                  >
                    <option>Logistics</option>
                    <option>Packaging Materials</option>
                    <option>Raw Components</option>
                    <option>Facility Services</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Location / Hub:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chakan Phase II MIDC, Pune"
                    value={newSupplier.location}
                    onChange={(e) => setNewSupplier({ ...newSupplier, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Distance (km):</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newSupplier.distanceKm}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, distanceKm: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Annual Spend:</label>
                  <input
                    type="text"
                    value={newSupplier.annualSpend}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, annualSpend: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
