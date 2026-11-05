import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Truck,
  Building2,
  Navigation,
  Layers,
  Info,
  Route,
  Zap,
  Search,
  Plus,
  Edit,
  Flame,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  ArrowRight,
  ShieldCheck,
  Factory,
  Warehouse,
  Compass,
  Save,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import {
  getGisLocations,
  calculateGisRoute,
  getVehicleFactors,
  geocodeLocation,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createEmission,
  getManufacturerProfile,
} from '../services/api';

// Custom SVG DivIcons for Leaflet
const createCustomIcon = (color, type = 'supplier', isHotspot = false) => {
  const size = type === 'hq' ? 36 : type === 'hotspot' || isHotspot ? 32 : 28;
  const halo = isHotspot ? 'box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.4), 0 4px 6px -1px rgba(0, 0, 0, 0.2);' : 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);';

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="
        background-color: ${isHotspot ? '#dc2626' : color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid white;
        ${halo}
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: transform 0.2s ease;
      ">
        <div style="
          width: ${size === 36 ? '12px' : '8px'};
          height: ${size === 36 ? '12px' : '8px'};
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const hqIcon = createCustomIcon('#059669', 'hq'); // Emerald
const factoryIcon = createCustomIcon('#7c3aed', 'factory'); // Violet
const warehouseIcon = createCustomIcon('#d97706', 'warehouse'); // Amber
const supplierIcon = createCustomIcon('#2563eb', 'supplier'); // Blue
const hotspotIcon = createCustomIcon('#dc2626', 'hotspot', true); // Red Pulse

// Helper map component to dynamically fly to target point
function FlyToPoint({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2) {
      map.flyTo(center, 9, { duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

// Map click event listener for coordinate picking
function MapCoordinatePicker({ active, onCoordSelected }) {
  useMapEvents({
    click(e) {
      if (active) {
        onCoordSelected(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

const GisMap = () => {
  const [locationsData, setLocationsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Routing State
  const [originId, setOriginId] = useState('FAC-01');
  const [destId, setDestId] = useState('');
  const [vehicleType, setVehicleType] = useState('hgv_diesel');
  const [cargoTonnes, setCargoTonnes] = useState('');
  const [returnTrip, setReturnTrip] = useState(false);
  const [activeRoute, setActiveRoute] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [showRoutes, setShowRoutes] = useState(true);

  // Inspection & Hotspot State
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [activeTab, setActiveTab] = useState('routing'); // 'routing', 'hotspots', 'manage'
  const [flyTarget, setFlyTarget] = useState(null);

  // Add / Edit Location Modal State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [formSupplier, setFormSupplier] = useState({
    id: null,
    db_id: null,
    name: '',
    category: 'Packaging Materials',
    location: '',
    latitude: 18.6445,
    longitude: 73.8123,
    annual_spend: '₹40,00,000',
    distance_km: 25.0,
    emissions_tons: 8.5,
  });
  const [formNotice, setFormNotice] = useState(null);

  // Scope 3 Logging Notice
  const [scope3Notice, setScope3Notice] = useState(null);
  const [isSavingScope3, setIsSavingScope3] = useState(false);

  // Initial Data Fetch
  const loadGisData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGisLocations();
      if (res.success && res.data) {
        setLocationsData(res.data);
        if (res.data.suppliers && res.data.suppliers.length > 0) {
          const firstSup = res.data.suppliers[0];
          setDestId(firstSup.id);
          setSelectedPoint(firstSup);
        }
      } else {
        setError(res.error || 'Failed to load GIS spatial locations');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to GIS backend service');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierDbId, supplierName) => {
    if (!window.confirm(`Are you sure you want to remove "${supplierName}" from the spatial GIS database?`)) {
      return;
    }
    try {
      const res = await deleteSupplier(supplierDbId);
      if (res.success) {
        setFormNotice('Supplier location removed.');
        loadGisData();
      } else {
        alert(res.error || 'Failed to remove supplier location');
      }
    } catch (err) {
      alert(`Error removing supplier: ${err.message}`);
    }
  };

  useEffect(() => {
    loadGisData();
  }, []);

  // Compute Road Route using OSRM endpoint
  const handleCalculateRoute = async () => {
    if (!locationsData) return;

    // Resolve Origin coordinates
    let originNode = locationsData.primary_facility;
    if (originId.startsWith('FAC-02') || originId.startsWith('FAC-03')) {
      originNode = locationsData.secondary_facilities.find((f) => f.id === originId) || originNode;
    } else if (originId.startsWith('SUP')) {
      originNode = locationsData.suppliers.find((s) => s.id === originId) || originNode;
    }

    // Resolve Destination coordinates
    const destNode = locationsData.suppliers.find((s) => s.id === destId);
    if (!destNode) {
      setRouteError('Please select a valid destination supplier');
      return;
    }

    setIsRouting(true);
    setRouteError(null);
    setScope3Notice(null);

    try {
      const payload = {
        origin_lat: originNode.latitude,
        origin_lng: originNode.longitude,
        origin_name: originNode.name,
        destination_lat: destNode.latitude,
        destination_lng: destNode.longitude,
        destination_name: destNode.name,
        vehicle_type: vehicleType,
        cargo_tonnes: cargoTonnes ? parseFloat(cargoTonnes) : null,
        return_trip: returnTrip,
      };

      const res = await calculateGisRoute(payload);
      if (res.success && res.data) {
        setActiveRoute(res.data);
        setSelectedPoint(destNode);
      } else {
        setRouteError(res.error || 'Routing computation failed');
      }
    } catch (err) {
      setRouteError(err.message || 'Routing network request error');
    } finally {
      setIsRouting(false);
    }
  };

  // Trigger route calculation automatically on origin/destination switch
  useEffect(() => {
    if (locationsData && destId) {
      handleCalculateRoute();
    }
  }, [originId, destId, vehicleType, returnTrip]);

  // Handle Geocoding Search
  const handleGeocodeSearch = async () => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    setIsGeocoding(true);
    setGeocodeResults([]);
    try {
      const res = await geocodeLocation(searchQuery);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setGeocodeResults(res.data);
      } else {
        setFormNotice('No matching coordinates found. Try an Indian city or area (e.g. Chakan, Talegaon, Hadapsar, Pune).');
      }
    } catch (e) {
      setFormNotice('Geocoding service unavailable.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const applyGeocodeResult = (item) => {
    setFormSupplier((prev) => ({
      ...prev,
      location: item.display_name.split(',').slice(0, 3).join(','),
      latitude: parseFloat(item.latitude.toFixed(4)),
      longitude: parseFloat(item.longitude.toFixed(4)),
    }));
    setGeocodeResults([]);
    setFlyTarget([item.latitude, item.longitude]);
  };

  // Map Click coordinate selection callback
  const handleMapCoordSelected = (lat, lng) => {
    setFormSupplier((prev) => ({
      ...prev,
      latitude: parseFloat(lat.toFixed(4)),
      longitude: parseFloat(lng.toFixed(4)),
    }));
    setIsPickingOnMap(false);
    setFormNotice(`Selected Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  // Save / Update Supplier Location
  const handleSaveSupplierLocation = async (e) => {
    e.preventDefault();
    setFormNotice(null);

    const payload = {
      name: formSupplier.name,
      category: formSupplier.category,
      location: formSupplier.location,
      latitude: formSupplier.latitude,
      longitude: formSupplier.longitude,
      annual_spend: formSupplier.annual_spend,
      distance_km: formSupplier.distance_km || 150.0,
      emissions_tons: formSupplier.emissions_tons || 12.0,
      intensity: '0.28 kg CO₂e/₹100',
      status: 'Verified Supplier',
    };

    try {
      if (formSupplier.db_id) {
        const res = await updateSupplier(formSupplier.db_id, payload);
        if (res.success) {
          setFormNotice('Supplier location updated successfully in database.');
          loadGisData();
          setShowLocationModal(false);
        } else {
          setFormNotice(res.error || 'Failed to update supplier');
        }
      } else {
        const res = await createSupplier(payload);
        if (res.success) {
          setFormNotice('New supplier location saved to database.');
          loadGisData();
          setShowLocationModal(false);
        } else {
          setFormNotice(res.error || 'Failed to save supplier');
        }
      }
    } catch (err) {
      setFormNotice(err.message || 'Error saving location');
    }
  };

  // Save Route as Scope 3 Emission Activity in SQLite Database
  const handleLogRouteToScope3 = async () => {
    if (!activeRoute) return;

    setIsSavingScope3(true);
    setScope3Notice(null);

    const em = activeRoute.emissions;
    const actData = {
      name: `Inbound Logistics: ${activeRoute.origin.name} → ${activeRoute.destination.name}`,
      category: 'Scope 3 - Category 4 (Upstream Transportation: Distance-based Estimate)',
      source: `OSRM Route (${activeRoute.distance_km} km via ${em.vehicle_label})`,
      quantity: em.quantity,
      unit: em.unit,
      factor: em.factor,
      factor_source: em.factor_source,
      formula: em.formula,
      quality: em.quality_tier,
      emissions: em.emissions_tco2e,
      activity_date: new Date().toISOString().split('T')[0],
      verified: true,
      is_synthetic: false,
    };

    try {
      const res = await createEmission(actData);
      if (res.success) {
        setScope3Notice(
          `Logged ${em.emissions_tco2e} tCO₂e to persistent database! (Double-Counting Guard: Direct fuel records must not be duplicated in Scope 1).`
        );
      } else {
        setScope3Notice(`Failed to save activity: ${res.error}`);
      }
    } catch (e) {
      setScope3Notice(`Error saving activity: ${e.message}`);
    } finally {
      setIsSavingScope3(false);
    }
  };

  const centerPosition = [18.6445, 73.8123]; // Tata Motors Pimpri Plant, Pune, Maharashtra

  // Convert GeoJSON route coordinates [[lng, lat], ...] to Leaflet [[lat, lng], ...]
  const polylinePositions =
    activeRoute && activeRoute.geometry
      ? activeRoute.geometry.map(([lng, lat]) => [lat, lng])
      : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-600" />
            GIS Spatial Intelligence & Supply Chain Routing
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tata Motors Pune Manufacturing Hub (Pimpri & Chakan Clusters) with OSRM road corridor trajectories & country-cited carbon factors.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRoutes(!showRoutes)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showRoutes
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>{showRoutes ? 'Hide Road Polyline' : 'Show Road Polyline'}</span>
          </button>

          <button
            onClick={() => {
              setFormSupplier({
                id: null,
                db_id: null,
                name: '',
                category: 'Packaging Materials',
                location: '',
                latitude: 18.6445,
                longitude: 73.8123,
                annual_spend: '₹35,00,000',
                distance_km: 25.0,
                emissions_tons: 8.5,
              });
              setFormNotice(null);
              setShowLocationModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier Location</span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-700">Loading spatial layers and database nodes...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadGisData}
            className="px-2.5 py-1 bg-white border border-rose-300 rounded text-[11px] font-bold text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {locationsData && (
        <>
          {/* Manufacturer Profile Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white p-4 rounded-2xl shadow-sm border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Factory className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-white">{locationsData.primary_facility.name}</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                    {locationsData.primary_facility.code || 'MFG-TM-PUNE'}
                  </span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-semibold">
                    Verified Public Facility
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{locationsData.primary_facility.location}</span>
                  <span className="font-mono text-emerald-400 text-[11px]">
                    ({locationsData.primary_facility.latitude.toFixed(4)}, {locationsData.primary_facility.longitude.toFixed(4)})
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-4">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Direct Scope 1</span>
                <span className="font-mono font-bold text-slate-100">{locationsData.primary_facility.scope1_emissions} tCO₂e</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Grid Scope 2</span>
                <span className="font-mono font-bold text-emerald-400">{locationsData.primary_facility.scope2_emissions} tCO₂e</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Tier-1 Suppliers</span>
                <span className="font-mono font-bold text-blue-400">{locationsData.suppliers.length} Linked</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Map Canvas */}
          <div className="lg:col-span-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Map Action Banner */}
            {isPickingOnMap && (
              <div className="mb-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 flex items-center justify-between animate-pulse">
                <span>Click anywhere on the map to set location coordinates!</span>
                <button
                  onClick={() => setIsPickingOnMap(false)}
                  className="text-amber-900 font-bold hover:underline text-[11px]"
                >
                  Cancel Picker
                </button>
              </div>
            )}

            <div className="h-[530px] rounded-xl overflow-hidden relative">
              <MapContainer
                center={centerPosition}
                zoom={10}
                scrollWheelZoom={true}
                className="w-full h-full rounded-xl z-0"
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {flyTarget && <FlyToPoint center={flyTarget} />}
                <MapCoordinatePicker active={isPickingOnMap} onCoordSelected={handleMapCoordSelected} />

                {/* Primary HQ Facility Marker */}
                <Marker
                  position={[locationsData.primary_facility.latitude, locationsData.primary_facility.longitude]}
                  icon={hqIcon}
                  eventHandlers={{
                    click: () => setSelectedPoint(locationsData.primary_facility),
                  }}
                >
                  <Popup>
                    <div className="p-1 text-xs font-sans">
                      <span className="font-bold text-emerald-800 block text-sm">
                        {locationsData.primary_facility.name}
                      </span>
                      <span className="text-slate-500 block text-[11px] mb-1">
                        {locationsData.primary_facility.location}
                      </span>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold mb-1">
                        Tata Motors Primary Plant [Verified Public]
                      </span>
                      <div className="mt-1 border-t pt-1 font-mono text-[11px] text-slate-700">
                        <div>Scope 1 Direct: <strong>{locationsData.primary_facility.scope1_emissions} t</strong></div>
                        <div>Scope 2 Grid: <strong>{locationsData.primary_facility.scope2_emissions} t</strong></div>
                      </div>
                    </div>
                  </Popup>
                </Marker>

                {/* Secondary Facilities (Factories & Warehouses) */}
                {locationsData.secondary_facilities.map((fac) => (
                  <Marker
                    key={fac.id}
                    position={[fac.latitude, fac.longitude]}
                    icon={fac.type === 'Factory' ? factoryIcon : warehouseIcon}
                    eventHandlers={{
                      click: () => setSelectedPoint(fac),
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-xs font-sans">
                        <strong className="text-slate-900 block text-sm">{fac.name}</strong>
                        <span className="text-slate-500 block text-[11px]">{fac.location}</span>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 font-bold my-1">
                          {fac.type} ({fac.category})
                        </span>
                        <div className="mt-1 border-t pt-1 font-mono text-[11px] text-slate-700">
                          <div>Direct Scope 1: <strong>{fac.scope1_emissions} t</strong></div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Supplier Markers with Hotspot Halo Indicators */}
                {locationsData.suppliers.map((sup) => {
                  const isHotspot = sup.is_hotspot || sup.emissions_tons >= 20.0;
                  const isSelected = selectedPoint && selectedPoint.id === sup.id;

                  return (
                    <Marker
                      key={sup.id}
                      position={[sup.latitude, sup.longitude]}
                      icon={isHotspot ? hotspotIcon : supplierIcon}
                      eventHandlers={{
                        click: () => {
                          setSelectedPoint(sup);
                          setDestId(sup.id);
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 text-xs font-sans min-w-[180px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <strong className="text-slate-900 text-sm block">{sup.name}</strong>
                            {isHotspot && (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-bold rounded">
                                Hotspot
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 block text-[11px] mb-1">{sup.location}</span>
                          <div className="space-y-0.5 border-t border-slate-100 pt-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Scope 3 Allocated:</span>
                              <strong className="text-rose-700 font-mono">{sup.emissions_tons} tCO₂e</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Procurement:</span>
                              <span className="font-mono text-slate-700">{sup.annual_spend}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">ESG Grade:</span>
                              <span className="font-bold text-emerald-700">{sup.esg_rating}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => {
                                setFormSupplier({
                                  id: sup.id,
                                  db_id: sup.db_id,
                                  name: sup.name,
                                  category: sup.category,
                                  location: sup.location,
                                  latitude: sup.latitude,
                                  longitude: sup.longitude,
                                  annual_spend: sup.annual_spend,
                                  distance_km: sup.distance_km,
                                  emissions_tons: sup.emissions_tons,
                                });
                                setFormNotice(null);
                                setShowLocationModal(true);
                              }}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                            >
                              Edit Coordinates
                            </button>
                            {sup.db_id && (
                              <button
                                onClick={() => handleDeleteSupplier(sup.db_id, sup.name)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-bold border border-rose-200"
                                title="Delete location"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Real Road Polyline from OSRM GeoJSON */}
                {showRoutes && polylinePositions.length > 0 && (
                  <Polyline
                    positions={polylinePositions}
                    color="#059669"
                    weight={4}
                    opacity={0.85}
                  />
                )}
              </MapContainer>

              {/* Map Floating Legend */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-slate-200/80 shadow-md text-[11px] space-y-1.5 z-[1000]">
                <div className="font-bold text-slate-800 text-xs mb-1">Spatial Layer Legend</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white"></span>
                  <span className="text-slate-700">Tata Motors Plant (Pimpri)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-600 border border-white"></span>
                  <span className="text-slate-700">Factory / Assembly</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-600 border border-white"></span>
                  <span className="text-slate-700">Warehouse Depot</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 border border-white"></span>
                  <span className="text-slate-700">Standard Supplier</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-600 border border-white ring-2 ring-rose-300"></span>
                  <span className="text-rose-700 font-semibold">Emission Hotspot (&ge;20t)</span>
                </div>
              </div>
            </div>

            {/* Bottom Mini Metrics Strip */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Spatial Nodes</span>
                <span className="font-bold text-slate-800 font-mono text-sm">{locationsData.total_nodes}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Live Suppliers</span>
                <span className="font-bold text-blue-700 font-mono text-sm">{locationsData.suppliers.length}</span>
              </div>
              <div className="p-2 bg-rose-50/60 rounded-lg border border-rose-100">
                <span className="text-[10px] text-rose-600 block uppercase font-bold">Active Hotspots</span>
                <span className="font-bold text-rose-700 font-mono text-sm">{locationsData.hotspots.length}</span>
              </div>
              <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block uppercase font-bold">OSRM Routing</span>
                <span className="font-bold text-emerald-800 text-xs">Operational</span>
              </div>
            </div>
          </div>

          {/* Right Telemetry & Controls Panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* Tab Navigation */}
            <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('routing')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'routing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                OSRM Routing
              </button>
              <button
                onClick={() => setActiveTab('hotspots')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'hotspots' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Hotspots ({locationsData.hotspots.length})
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'manage' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Regions
              </button>
            </div>

            {/* TAB 1: OSRM ROUTE CONFIG & CARBON TELEMETRY */}
            {activeTab === 'routing' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-emerald-600" />
                    Corridor Parameterization
                  </span>
                  {activeRoute && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold font-mono">
                      {activeRoute.engine.includes('OSRM') ? 'OSRM Live' : 'Detour Fallback'}
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Origin Facility
                    </label>
                    <select
                      value={originId}
                      onChange={(e) => setOriginId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value={locationsData.primary_facility.id}>
                        {locationsData.primary_facility.name} (Pune Plant)
                      </option>
                      {locationsData.secondary_facilities.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name} ({fac.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Destination Supplier
                    </label>
                    <select
                      value={destId}
                      onChange={(e) => setDestId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    >
                      {locationsData.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.location})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Vehicle Fleet Type (Emission Factors)
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="hgv_diesel">Heavy Commercial Vehicle (&gt;16t Diesel) - 0.852 kg/km [DEFRA 2024 proxy]</option>
                      <option value="rigid_diesel">Medium Commercial Vehicle (Rigid 7.5-17t) - 0.584 kg/km [DEFRA 2024 proxy]</option>
                      <option value="van_diesel">Light Commercial Vehicle (LCV / Van) - 0.261 kg/km [DEFRA 2024 proxy]</option>
                      <option value="van_electric">Electric Delivery Vehicle (EV Grid) - 0.052 kg/km [India CEA Baseline v20]</option>
                      <option value="truck_hybrid">CNG / Hybrid Freight Truck - 0.410 kg/km [DEFRA 2024 proxy]</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Cargo Tonnes (Optional)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 8.5"
                        value={cargoTonnes}
                        onChange={(e) => setCargoTonnes(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex items-end pb-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={returnTrip}
                          onChange={(e) => setReturnTrip(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Round Trip (2x)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Calculation Telemetry Display */}
                {activeRoute && (
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Route Distance</span>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {activeRoute.distance_km} <span className="text-xs font-normal">km</span>
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Est: ~{Math.floor(activeRoute.duration_min / 60)}h {Math.round(activeRoute.duration_min % 60)}m
                        </span>
                      </div>

                      <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                        <span className="text-[10px] text-emerald-800 block uppercase font-bold">Leg Emissions</span>
                        <span className="text-lg font-black text-emerald-700 font-mono">
                          {activeRoute.emissions.emissions_tco2e} <span className="text-xs font-normal">tCO₂e</span>
                        </span>
                        <span className="text-[10px] text-emerald-600 font-mono block mt-0.5">
                          ({activeRoute.emissions.emissions_kg.toLocaleString()} kg)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-[11px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Formula:</span>
                        <span className="text-slate-800 font-bold">{activeRoute.emissions.formula}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Source:</span>
                        <span className="text-slate-600 text-[10px] truncate max-w-[200px]" title={activeRoute.emissions.factor_source}>
                          {activeRoute.emissions.factor_source}
                        </span>
                      </div>
                      {activeRoute.emissions.proxy_note && (
                        <div className="flex justify-between text-[10px] text-amber-700 font-sans pt-1 border-t border-slate-100">
                          <span className="font-semibold">Factor Origin:</span>
                          <span className="text-right truncate max-w-[220px]" title={activeRoute.emissions.proxy_note}>
                            {activeRoute.emissions.proxy_note}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Double Counting Guard Banner */}
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{activeRoute.emissions.double_counting_warning}</span>
                    </div>

                    {/* Log to Database Action */}
                    <button
                      onClick={handleLogRouteToScope3}
                      disabled={isSavingScope3}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                      {isSavingScope3 ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Logging to Database...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save as Scope 3 Activity Record</span>
                        </>
                      )}
                    </button>

                    {scope3Notice && (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px] flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{scope3Notice}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SUPPLIER EMISSION HOTSPOTS */}
            {activeTab === 'hotspots' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-600" />
                    Top Emission Hotspots
                  </span>
                  <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-bold">
                    &ge; 10 tCO₂e
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">
                  Suppliers generating the largest Scope 3 upstream transport and purchased intensity footprints:
                </p>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {locationsData.hotspots.map((sup, idx) => (
                    <div
                      key={sup.id}
                      onClick={() => {
                        setSelectedPoint(sup);
                        setDestId(sup.id);
                        setFlyTarget([sup.latitude, sup.longitude]);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedPoint && selectedPoint.id === sup.id
                          ? 'border-rose-400 bg-rose-50/50'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">
                          #{idx + 1} {sup.name}
                        </span>
                        <span className="font-mono font-bold text-rose-700">
                          {sup.emissions_tons} tCO₂e
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{sup.location}</span>
                        <span>Spend: {sup.annual_spend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: REGIONAL DISTRIBUTION */}
            {activeTab === 'manage' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Regional Spatial Footprint
                  </span>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(locationsData.regional_distribution).map(([region, data]) => (
                    <div key={region} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-800">{region}</span>
                        <span className="text-slate-500 text-[11px]">{data.count} nodes</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Regional Footprint:</span>
                        <span className="font-mono font-bold text-emerald-800">
                          {data.emissions.toFixed(1)} tCO₂e
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

      {/* ADD / EDIT LOCATION MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                {formSupplier.db_id ? 'Edit Supplier Coordinates' : 'Register Supplier Spatial Location'}
              </h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Address Search with Nominatim OpenStreetMap */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Geocode Address (Nominatim OSM)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Indian city or area (e.g. Chakan, Talegaon, Hadapsar, Pune)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGeocodeSearch()}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleGeocodeSearch}
                  disabled={isGeocoding}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                >
                  {isGeocoding ? '...' : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>

              {geocodeResults.length > 0 && (
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-y-auto text-[11px]">
                  {geocodeResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => applyGeocodeResult(r)}
                      className="p-2 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer"
                    >
                      <span className="font-semibold text-slate-800 block truncate">{r.display_name}</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSupplierLocation} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  value={formSupplier.name}
                  onChange={(e) => setFormSupplier({ ...formSupplier, name: e.target.value })}
                  placeholder="e.g. Precision Castings & Foundry [Synthetic Demo]"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Location Label</label>
                <input
                  type="text"
                  required
                  value={formSupplier.location}
                  onChange={(e) => setFormSupplier({ ...formSupplier, location: e.target.value })}
                  placeholder="e.g. Chakan Phase II MIDC, Pune, India"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formSupplier.latitude}
                    onChange={(e) => setFormSupplier({ ...formSupplier, latitude: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formSupplier.longitude}
                    onChange={(e) => setFormSupplier({ ...formSupplier, longitude: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] flex items-center justify-between">
                <span>Or pick coordinates directly on map:</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsPickingOnMap(true);
                    setShowLocationModal(false);
                  }}
                  className="px-2 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded font-bold hover:bg-emerald-100"
                >
                  Click on Map
                </button>
              </div>

              {formNotice && (
                <div className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-700 text-[11px]">
                  {formNotice}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm"
                >
                  Save Spatial Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GisMap;
