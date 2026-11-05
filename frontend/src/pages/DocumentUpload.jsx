import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  Clock,
  Cpu,
  ArrowRight,
  ShieldAlert,
  Zap,
  Fuel,
  Truck,
  Receipt,
  FileCheck2,
  Sparkles,
  FileSearch,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Edit3,
  Save,
  X,
  CheckCheck,
} from 'lucide-react';
import { extractDocumentFile, getDocuments, reviewDocument } from '../services/api';

const DocumentUpload = ({ setActiveTab, onSendToCalculator }) => {
  const [selectedDocType, setSelectedDocType] = useState('electricity');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [activeExtractedDoc, setActiveExtractedDoc] = useState(null);
  const [docList, setDocList] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const fileInputRef = useRef(null);

  const docCategories = [
    { id: 'electricity', label: 'Electricity Bills', icon: Zap, hint: 'Grid power kWh bills' },
    { id: 'fuel', label: 'Fuel Receipts', icon: Fuel, hint: 'Diesel, petrol fleet receipts' },
    { id: 'transport', label: 'Transport Records', icon: Truck, hint: 'Consignment notes & waybills' },
    { id: 'invoices', label: 'Supplier Invoices', icon: Receipt, hint: 'Packaging, raw materials' },
  ];

  const currentCategory = docCategories.find((c) => c.id === selectedDocType) || docCategories[0];

  // Load existing documents from backend on initial mount
  const fetchDocumentHistory = async () => {
    try {
      const res = await getDocuments();
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((d) => {
          let parsedData = {};
          if (d.extracted_data_json) {
            try {
              parsedData = JSON.parse(d.extracted_data_json);
            } catch (e) {
              parsedData = {};
            }
          }
          return {
            id: d.doc_code || `DOC-${d.id}`,
            dbId: d.id,
            fileName: d.file_name,
            type: d.file_type,
            uploadDate: d.upload_date,
            fileSize: d.file_size,
            status: d.status,
            confidence: d.confidence,
            extractedData: parsedData,
            validationWarnings: [],
          };
        });
        setDocList(mapped);
      }
    } catch (e) {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    fetchDocumentHistory();
  }, []);

  /**
   * Category Tab Switching:
   * Resets active extracted document, clears file input and editing state
   */
  const handleCategorySwitch = (catId) => {
    setSelectedDocType(catId);
    setActiveExtractedDoc(null);
    setSelectedFile(null);
    setUploadError(null);
    setIsEditing(false);
    setUserConfirmed(false);
    setSaveSuccessMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Process Real File Upload via Backend Gemini AI + OCR Pipeline
   */
  const processUpload = async (file) => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds maximum allowed size of 25MB.');
      return;
    }

    setSelectedFile(file);
    setIsScanning(true);
    setScanStep(1);
    setUploadError(null);
    setIsEditing(false);
    setUserConfirmed(false);
    setSaveSuccessMsg(null);

    // Dynamic pipeline step animations
    const timer1 = setTimeout(() => setScanStep(2), 600);
    const timer2 = setTimeout(() => setScanStep(3), 1400);

    try {
      const res = await extractDocumentFile(file, selectedDocType);
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsScanning(false);
      setScanStep(0);

      if (res.success && res.data) {
        const item = res.data;
        const newDoc = {
          id: item.docCode || item.id,
          dbId: item.id,
          fileName: item.fileName,
          type: item.type,
          category: item.category,
          detectedCategory: item.detectedCategory,
          uploadDate: item.uploadDate,
          fileSize: item.fileSize,
          status: item.status,
          confidence: item.confidence,
          confidenceScore: item.confidenceScore,
          extractionMethod: item.extractionMethod,
          extractedData: item.extractedData || {},
          validationWarnings: item.validationWarnings || [],
          requiresConfirmation: item.requiresConfirmation || false,
        };
        setActiveExtractedDoc(newDoc);
        setEditFormData({ ...newDoc.extractedData });
        setDocList((prev) => [newDoc, ...prev]);
      } else {
        setUploadError(res.error || 'Failed to extract text from document. Please ensure the file is readable.');
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsScanning(false);
      setScanStep(0);
      setUploadError(err.message || 'Connection error while uploading document.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  // Begin inline editing
  const startEditing = () => {
    if (!activeExtractedDoc) return;
    setEditFormData({ ...activeExtractedDoc.extractedData });
    setIsEditing(true);
    setSaveSuccessMsg(null);
  };

  // Cancel inline editing
  const cancelEditing = () => {
    if (!activeExtractedDoc) return;
    setEditFormData({ ...activeExtractedDoc.extractedData });
    setIsEditing(false);
  };

  // Save inline edits to active document state and backend
  const saveEdits = async () => {
    if (!activeExtractedDoc) return;

    // Convert quantity to number if valid
    const cleanData = { ...editFormData };
    if (cleanData.quantity !== undefined && cleanData.quantity !== null && cleanData.quantity !== '') {
      const parsedNum = parseFloat(cleanData.quantity);
      cleanData.quantity = isNaN(parsedNum) ? null : parsedNum;
    }

    const updatedDoc = {
      ...activeExtractedDoc,
      status: 'Human Verified',
      extractedData: cleanData,
      validationWarnings: [], // Cleared once user manually verifies
      requiresConfirmation: false,
    };

    setActiveExtractedDoc(updatedDoc);
    setIsEditing(false);
    setUserConfirmed(true);
    setSaveSuccessMsg('Parameters verified and saved successfully.');

    // Save to backend if dbId exists
    if (activeExtractedDoc.dbId) {
      try {
        await reviewDocument(activeExtractedDoc.dbId, cleanData);
      } catch (e) {
        // Continue with local verified state
      }
    }

    // Update in history list
    setDocList((prev) =>
      prev.map((d) => (d.id === activeExtractedDoc.id ? updatedDoc : d))
    );
  };

  // Transfer to Emission Calculator
  const handleTransferToCalculator = () => {
    if (!activeExtractedDoc) return;

    // If warnings exist and user has not confirmed or edited, prompt confirmation
    if (
      activeExtractedDoc.validationWarnings &&
      activeExtractedDoc.validationWarnings.length > 0 &&
      !userConfirmed
    ) {
      setUploadError('Please review or confirm the validation warnings before transferring.');
      return;
    }

    const docData = activeExtractedDoc.extractedData || {};
    const transferDoc = {
      ...activeExtractedDoc,
      type: activeExtractedDoc.type || currentCategory.label,
      extractedData: {
        ...docData,
        provider:
          docData.provider && docData.provider !== 'Not detected'
            ? docData.provider
            : docData.carrier || docData.supplier || 'Extracted Document',
        quantity: typeof docData.quantity === 'number' ? docData.quantity : 0,
        unit: docData.unit && docData.unit !== 'Not detected' ? docData.unit : '',
      },
    };

    if (onSendToCalculator) {
      onSendToCalculator(transferDoc);
    }
    setActiveTab('calculator');
  };

  // Format confidence color
  const getConfidenceBadgeColor = (confidence) => {
    const num = parseInt(confidence, 10);
    if (isNaN(num)) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (num >= 85) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (num >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Architecture Note */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            AI Document Ingestion & Optical Character Recognition
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gemini AI structured extraction + Tesseract OCR pipeline with human review audit trail.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-medium">
          <ShieldAlert className="w-4 h-4 text-emerald-600" />
          <span>Rule 1 Enforced: AI extracts data only; emissions calculated deterministically in Python.</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {docCategories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedDocType === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategorySwitch(cat.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon
                  className={`w-5 h-5 ${
                    isSelected ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                )}
              </div>
              <p className="mt-2 text-xs font-bold text-slate-800">{cat.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{cat.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Main Upload Dropzone & Extracted Data Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Drop Area */}
        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-800">
                Upload New {currentCategory.label}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-600">
                {currentCategory.hint}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Supported formats: PDF, JPG, PNG, TIFF (Max: 25MB). Embedded text + OCR + Gemini AI processing.
            </p>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isScanning
                  ? 'border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/50'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Click to browse or drop {currentCategory.label} here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Processes actual file contents with zero data hallucination
              </p>
              {selectedFile && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedFile.name}</span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* AI Extraction Progress Animation */}
          {isScanning && (
            <div className="mt-6 p-4 rounded-xl bg-slate-900 text-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2 text-emerald-400">
                  <Sparkles className="w-4 h-4 animate-spin" /> Ingestion & OCR Pipeline
                </span>
                <span className="text-[11px] text-slate-400">Step {scanStep} of 3</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(scanStep / 3) * 100}%` }}
                ></div>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                <div className={scanStep >= 1 ? 'text-emerald-400' : 'text-slate-500'}>
                  ✓ 1. Inspecting file structure & embedded font layers
                </div>
                <div className={scanStep >= 2 ? 'text-emerald-400' : 'text-slate-500'}>
                  {scanStep >= 2 ? '✓' : '○'} 2. Digital text extraction / Tesseract OCR
                </div>
                <div className={scanStep >= 3 ? 'text-emerald-400' : 'text-slate-500'}>
                  {scanStep >= 3 ? '✓' : '○'} 3. Gemini AI schema extraction & Pydantic validation
                </div>
              </div>
            </div>
          )}

          {!isScanning && (
            <div className="mt-6 flex items-center justify-between p-3.5 bg-slate-50 rounded-lg text-xs text-slate-600">
              <span className="font-medium">Active Ingestion Mode:</span>
              <span className="font-semibold text-emerald-700 uppercase">
                {selectedDocType}
              </span>
            </div>
          )}
        </div>

        {/* AI Extracted Parameters Review Box */}
        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          {!activeExtractedDoc ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                <FileSearch className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                No Document Extracted Yet for {currentCategory.label}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Upload or drop an actual PDF or image on the left to extract structured emission parameters.
              </p>
              <div className="mt-5 w-full max-w-xs bg-slate-50/80 rounded-xl p-3.5 border border-dashed border-slate-200 text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Parameters extracted for {currentCategory.label}:
                </span>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  {selectedDocType === 'fuel' && (
                    <>
                      <li className="flex items-center gap-1.5">✓ Fuel Supplier & Bunk Name</li>
                      <li className="flex items-center gap-1.5">✓ Customer & Account ID</li>
                      <li className="flex items-center gap-1.5">✓ Fuel Type (Diesel, Petrol, etc.)</li>
                      <li className="flex items-center gap-1.5 font-semibold text-emerald-700">✓ Quantity & Unit (e.g. 30 litres)</li>
                      <li className="flex items-center gap-1.5">✓ Vehicle / Fleet Reg No.</li>
                    </>
                  )}
                  {selectedDocType === 'electricity' && (
                    <>
                      <li className="flex items-center gap-1.5">✓ Utility Provider / Grid Issuer</li>
                      <li className="flex items-center gap-1.5">✓ Customer & Account Number</li>
                      <li className="flex items-center gap-1.5 font-semibold text-emerald-700">✓ Active Energy Consumed (kWh)</li>
                      <li className="flex items-center gap-1.5">✓ Meter Number & Billing Period</li>
                    </>
                  )}
                  {selectedDocType === 'transport' && (
                    <>
                      <li className="flex items-center gap-1.5">✓ Freight Carrier / Haulier</li>
                      <li className="flex items-center gap-1.5">✓ Origin & Destination Hubs</li>
                      <li className="flex items-center gap-1.5 font-semibold text-emerald-700">✓ Transport Volume (tonne-km)</li>
                      <li className="flex items-center gap-1.5">✓ Consignment / Vehicle ID</li>
                    </>
                  )}
                  {selectedDocType === 'invoices' && (
                    <>
                      <li className="flex items-center gap-1.5">✓ Vendor / Supplier Name</li>
                      <li className="flex items-center gap-1.5">✓ Invoice Reference & Date</li>
                      <li className="flex items-center gap-1.5 font-semibold text-emerald-700">✓ Purchased Mass / Units (kg)</li>
                      <li className="flex items-center gap-1.5">✓ Material / Item Specification</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div>
              {/* Review Card Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      Extracted Parameters Review
                    </h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {activeExtractedDoc.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Source: <span className="font-mono text-slate-700">{activeExtractedDoc.fileName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2 py-0.5 rounded-md ${getConfidenceBadgeColor(activeExtractedDoc.confidence)}`}>
                    <CheckCircle className="w-3 h-3" />
                    Confidence: {activeExtractedDoc.confidence}
                  </span>
                </div>
              </div>

              {/* Extraction Pipeline Method Pill */}
              <div className="mb-3 text-[11px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-slate-600 flex items-center justify-between font-mono">
                <span>Method: {activeExtractedDoc.extractionMethod || 'OCR Pipeline'}</span>
                <span className="text-[10px] text-slate-400 font-sans">Human in the loop</span>
              </div>

              {/* Validation Warnings Callout */}
              {activeExtractedDoc.validationWarnings && activeExtractedDoc.validationWarnings.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Validation Notice</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {activeExtractedDoc.validationWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-700 mt-1">
                    Click <strong>Edit Parameters</strong> below to verify or correct any detected values.
                  </p>
                </div>
              )}

              {saveSuccessMsg && (
                <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* View / Edit Mode Split */}
              {isEditing ? (
                /* INLINE EDIT FORM */
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800">Edit Extracted Parameters</span>
                    <button
                      onClick={cancelEditing}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Supplier / Provider Name
                      </label>
                      <input
                        type="text"
                        value={editFormData.provider || editFormData.supplier || editFormData.carrier || ''}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            provider: e.target.value,
                            supplier: e.target.value,
                            carrier: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Activity Quantity
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editFormData.quantity ?? ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, quantity: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={editFormData.unit || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, unit: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {selectedDocType === 'fuel' ? 'Fuel Type' : selectedDocType === 'electricity' ? 'Billing Period' : 'Item / Activity'}
                      </label>
                      <input
                        type="text"
                        value={editFormData.fuelType || editFormData.period || editFormData.item || ''}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            fuelType: e.target.value,
                            period: e.target.value,
                            item: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Date
                      </label>
                      <input
                        type="text"
                        value={editFormData.date || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, date: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Identifier / Vehicle / Meter ID
                      </label>
                      <input
                        type="text"
                        value={
                          editFormData.vehicleNumber ||
                          editFormData.meterNumber ||
                          editFormData.accountNumber ||
                          editFormData.waybillNumber ||
                          ''
                        }
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            vehicleNumber: e.target.value,
                            meterNumber: e.target.value,
                            accountNumber: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEdits}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save & Verify</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* DISPLAY REVIEW MODE */
                <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 text-xs font-mono">
                  {selectedDocType === 'fuel' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Supplier / Station:</span>
                        <span className={activeExtractedDoc.extractedData?.provider === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.provider || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Customer & ID:</span>
                        <span className="font-semibold text-slate-800">
                          {activeExtractedDoc.extractedData?.customer !== 'Not detected' && activeExtractedDoc.extractedData?.customer
                            ? activeExtractedDoc.extractedData.customer
                            : ''}
                          {activeExtractedDoc.extractedData?.customerId !== 'Not detected' && activeExtractedDoc.extractedData?.customerId
                            ? ` (ID: ${activeExtractedDoc.extractedData.customerId})`
                            : ''}
                          {(!activeExtractedDoc.extractedData?.customer || activeExtractedDoc.extractedData.customer === 'Not detected') &&
                          (!activeExtractedDoc.extractedData?.customerId || activeExtractedDoc.extractedData.customerId === 'Not detected') ? (
                            <span className="text-slate-400 italic font-sans">Not detected</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Fuel Type:</span>
                        <span className={activeExtractedDoc.extractedData?.fuelType === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded'}>
                          {activeExtractedDoc.extractedData?.fuelType || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Extracted Quantity:</span>
                        {activeExtractedDoc.extractedData?.quantity !== null && activeExtractedDoc.extractedData?.quantity !== undefined ? (
                          <span className="font-bold text-emerald-700 text-sm">
                            {Number(activeExtractedDoc.extractedData.quantity).toLocaleString()}{' '}
                            {activeExtractedDoc.extractedData.unit || 'litres'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans">Not detected</span>
                        )}
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Vehicle / Fleet Reg:</span>
                        <span className={activeExtractedDoc.extractedData?.vehicleNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700 font-medium'}>
                          {activeExtractedDoc.extractedData?.vehicleNumber || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Receipt Ref:</span>
                        <span className={activeExtractedDoc.extractedData?.receiptNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.receiptNumber || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-sans">Date:</span>
                        <span className={activeExtractedDoc.extractedData?.date === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.date || 'Not detected'}
                        </span>
                      </div>
                    </>
                  )}

                  {selectedDocType === 'electricity' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Provider / Utility:</span>
                        <span className={activeExtractedDoc.extractedData?.provider === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.provider || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Customer Name:</span>
                        <span className={activeExtractedDoc.extractedData?.customer === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.customer || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Billing Period:</span>
                        <span className={activeExtractedDoc.extractedData?.period === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.period || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Active Energy:</span>
                        {activeExtractedDoc.extractedData?.quantity !== null && activeExtractedDoc.extractedData?.quantity !== undefined ? (
                          <span className="font-bold text-emerald-700 text-sm">
                            {Number(activeExtractedDoc.extractedData.quantity).toLocaleString()}{' '}
                            {activeExtractedDoc.extractedData.unit || 'kWh'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans">Not detected</span>
                        )}
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Account Number:</span>
                        <span className={activeExtractedDoc.extractedData?.accountNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.accountNumber || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-sans">Meter Number:</span>
                        <span className={activeExtractedDoc.extractedData?.meterNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.meterNumber || 'Not detected'}
                        </span>
                      </div>
                    </>
                  )}

                  {selectedDocType === 'transport' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Carrier / Haulier:</span>
                        <span className={activeExtractedDoc.extractedData?.carrier === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.carrier || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Origin / Destination:</span>
                        <span className="font-semibold text-slate-800">
                          {activeExtractedDoc.extractedData?.origin || 'Not detected'} → {activeExtractedDoc.extractedData?.destination || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Freight Volume:</span>
                        {activeExtractedDoc.extractedData?.quantity !== null && activeExtractedDoc.extractedData?.quantity !== undefined ? (
                          <span className="font-bold text-emerald-700 text-sm">
                            {Number(activeExtractedDoc.extractedData.quantity).toLocaleString()}{' '}
                            {activeExtractedDoc.extractedData.unit || 'tonne-km'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans">Not detected</span>
                        )}
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Vehicle / Reg No:</span>
                        <span className={activeExtractedDoc.extractedData?.vehicleNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.vehicleNumber || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-sans">Waybill Ref:</span>
                        <span className={activeExtractedDoc.extractedData?.waybillNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.waybillNumber || 'Not detected'}
                        </span>
                      </div>
                    </>
                  )}

                  {selectedDocType === 'invoices' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Supplier / Vendor:</span>
                        <span className={activeExtractedDoc.extractedData?.supplier === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.supplier || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Invoice ID:</span>
                        <span className={activeExtractedDoc.extractedData?.invoiceNumber === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.invoiceNumber || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Item / Material:</span>
                        <span className={activeExtractedDoc.extractedData?.item === 'Not detected' ? 'text-slate-400 italic font-sans' : 'font-semibold text-slate-800'}>
                          {activeExtractedDoc.extractedData?.item || 'Not detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-sans">Purchased Mass:</span>
                        {activeExtractedDoc.extractedData?.quantity !== null && activeExtractedDoc.extractedData?.quantity !== undefined ? (
                          <span className="font-bold text-emerald-700 text-sm">
                            {Number(activeExtractedDoc.extractedData.quantity).toLocaleString()}{' '}
                            {activeExtractedDoc.extractedData.unit || 'kg'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans">Not detected</span>
                        )}
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-sans">Invoice Date:</span>
                        <span className={activeExtractedDoc.extractedData?.date === 'Not detected' ? 'text-slate-400 italic font-sans' : 'text-slate-700'}>
                          {activeExtractedDoc.extractedData?.date || 'Not detected'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Confirmation Checkbox when warnings are present */}
              {activeExtractedDoc.validationWarnings &&
                activeExtractedDoc.validationWarnings.length > 0 &&
                !isEditing && (
                  <label className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userConfirmed}
                      onChange={(e) => setUserConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] text-slate-700">
                      I have reviewed and confirmed that the extracted parameters are accurate for GHG reporting.
                    </span>
                  </label>
                )}

              {/* Action Buttons: Edit Parameters + Transfer to Calculator */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                {!isEditing ? (
                  <button
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit Parameters</span>
                  </button>
                ) : (
                  <div></div>
                )}

                <button
                  onClick={handleTransferToCalculator}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  <span>Confirm & Transfer to Calculator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Document Ingestion Log ({docList.length} files)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auditable records extracted from uploaded files with human review tracking
            </p>
          </div>
          <button
            onClick={fetchDocumentHistory}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Document Name</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Extracted Value</th>
                <th className="py-3 px-4 font-semibold">Date Ingested</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Confidence</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No documents uploaded yet. Upload a file above to begin.
                  </td>
                </tr>
              ) : (
                docList.map((doc) => {
                  const isSelected = activeExtractedDoc?.id === doc.id;
                  const qty = doc.extractedData?.quantity;
                  const unit = doc.extractedData?.unit || '';
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => {
                        setActiveExtractedDoc(doc);
                        setIsEditing(false);
                        const t = (doc.type || '').toLowerCase();
                        if (t.includes('fuel')) setSelectedDocType('fuel');
                        else if (t.includes('transport')) setSelectedDocType('transport');
                        else if (t.includes('invoice')) setSelectedDocType('invoices');
                        else setSelectedDocType('electricity');
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-3 px-4 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{doc.fileName}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{doc.type}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {typeof qty === 'number' ? (
                          `${qty.toLocaleString()} ${unit}`
                        ) : (
                          <span className="text-slate-400 italic">Not detected</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{doc.uploadDate}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.status === 'Human Verified'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : doc.status === 'Needs Review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[11px] border ${getConfidenceBadgeColor(doc.confidence)}`}>
                          <CheckCircle className="w-3 h-3" />
                          {doc.confidence}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveExtractedDoc(doc);
                            setIsEditing(false);
                            const t = (doc.type || '').toLowerCase();
                            if (t.includes('fuel')) setSelectedDocType('fuel');
                            else if (t.includes('transport')) setSelectedDocType('transport');
                            else if (t.includes('invoice')) setSelectedDocType('invoices');
                            else setSelectedDocType('electricity');
                            handleTransferToCalculator();
                          }}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                        >
                          Calculate →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
