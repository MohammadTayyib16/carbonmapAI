import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SyntheticBanner from './components/SyntheticBanner';
import Dashboard from './pages/Dashboard';
import DocumentUpload from './pages/DocumentUpload';
import Calculator from './pages/Calculator';
import Suppliers from './pages/Suppliers';
import GisMap from './pages/GisMap';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { checkBackendHealth } from './services/api';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [calculatorPrefill, setCalculatorPrefill] = useState(null);
  const [backendStatus, setBackendStatus] = useState({
    loading: true,
    connected: false,
    data: null,
    error: null,
    checkedAt: null,
  });

  const checkStatus = async () => {
    setBackendStatus((prev) => ({ ...prev, loading: true }));
    const res = await checkBackendHealth();
    if (res.success) {
      setBackendStatus({
        loading: false,
        connected: true,
        data: res.data,
        error: null,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } else {
      setBackendStatus({
        loading: false,
        connected: false,
        data: null,
        error: res.error,
        checkedAt: new Date().toLocaleTimeString(),
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSendToCalculator = (extractedDoc) => {
    setCalculatorPrefill(extractedDoc);
    setActiveTab('calculator');
  };

  const handleExportClick = () => {
    setActiveTab('reports');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans antialiased">
      {/* Top Prototype Notice Banner */}
      <SyntheticBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Main Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header */}
          <Header
            activeTab={activeTab}
            onExportClick={handleExportClick}
            backendStatus={backendStatus}
            onRefreshHealth={checkStatus}
          />

          {/* Dynamic Page Body */}
          <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activeTab === 'dashboard' && (
              <Dashboard
                setActiveTab={setActiveTab}
                backendStatus={backendStatus}
                onRefreshHealth={checkStatus}
              />
            )}
            {activeTab === 'upload' && (
              <DocumentUpload
                setActiveTab={setActiveTab}
                onSendToCalculator={handleSendToCalculator}
              />
            )}
            {activeTab === 'calculator' && (
              <Calculator initialData={calculatorPrefill} />
            )}
            {activeTab === 'suppliers' && (
              <Suppliers />
            )}
            {activeTab === 'gis-map' && (
              <GisMap />
            )}
            {activeTab === 'reports' && (
              <Reports />
            )}
            {activeTab === 'settings' && (
              <Settings />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
