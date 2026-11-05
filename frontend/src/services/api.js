/**
 * CarbonMap AI — Central Reusable Frontend API Service
 * Handles communication with the FastAPI backend at http://127.0.0.1:8000
 */

export const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Helper to execute fetch requests with timeouts and standard error handling
 */
async function apiRequest(endpoint, options = {}, timeoutMs = 5000) {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || `HTTP ${response.status}: ${response.statusText}`;
      return { success: false, error: errorMsg, status: response.status };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbort = error.name === 'AbortError';
    return {
      success: false,
      error: isAbort ? 'Connection timed out (5s limit)' : error.message,
      isTimeout: isAbort,
    };
  }
}

/**
 * Health check endpoint: GET /api/health
 */
export async function checkBackendHealth() {
  return await apiRequest('/api/health');
}

/**
 * Dashboard summary endpoint: GET /api/v1/dashboard/summary
 */
export async function getDashboardSummary() {
  return await apiRequest('/api/v1/dashboard/summary');
}

/**
 * Suppliers CRUD API
 */
export async function getSuppliers() {
  return await apiRequest('/api/v1/suppliers');
}

export async function createSupplier(supplierData) {
  return await apiRequest('/api/v1/suppliers', {
    method: 'POST',
    body: JSON.stringify(supplierData),
  });
}

export async function updateSupplier(id, supplierData) {
  return await apiRequest(`/api/v1/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(supplierData),
  });
}

export async function deleteSupplier(id) {
  return await apiRequest(`/api/v1/suppliers/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Emission Activities CRUD API
 */
export async function getEmissions() {
  return await apiRequest('/api/v1/emissions');
}

export async function createEmission(emissionData) {
  return await apiRequest('/api/v1/emissions', {
    method: 'POST',
    body: JSON.stringify(emissionData),
  });
}

export async function updateEmission(id, emissionData) {
  return await apiRequest(`/api/v1/emissions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(emissionData),
  });
}

export async function deleteEmission(id) {
  return await apiRequest(`/api/v1/emissions/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Documents CRUD & Extraction API
 */
export async function getDocuments() {
  return await apiRequest('/api/v1/documents');
}

export async function createDocument(docData) {
  return await apiRequest('/api/v1/documents', {
    method: 'POST',
    body: JSON.stringify(docData),
  });
}

export async function reviewDocument(docId, reviewedData) {
  return await apiRequest(`/api/v1/documents/${docId}/review`, {
    method: 'PUT',
    body: JSON.stringify(reviewedData),
  });
}

export async function extractDocumentFile(file, docType = 'electricity') {
  const url = `${API_BASE_URL}/api/v1/documents/extract`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s for OCR/parsing

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, error: data?.detail || `HTTP ${response.status}: ${response.statusText}` };
    }
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbort = error.name === 'AbortError';
    return {
      success: false,
      error: isAbort ? 'Extraction request timed out' : error.message,
    };
  }
}

/**
 * Reports CRUD API
 */
export async function getReports() {
  return await apiRequest('/api/v1/reports');
}

export async function createReport(reportData) {
  return await apiRequest('/api/v1/reports', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
}

/**
 * GIS & Spatial Routing API
 */
export async function getGisLocations() {
  return await apiRequest('/api/v1/gis/locations');
}

export async function calculateGisRoute(routePayload) {
  return await apiRequest('/api/v1/gis/route', {
    method: 'POST',
    body: JSON.stringify(routePayload),
  });
}

export async function getVehicleFactors() {
  return await apiRequest('/api/v1/gis/factors');
}

export async function geocodeLocation(query) {
  return await apiRequest(`/api/v1/gis/geocode?q=${encodeURIComponent(query)}`);
}

export async function getManufacturerProfile() {
  return await apiRequest('/api/v1/gis/manufacturer');
}

export default {
  API_BASE_URL,
  checkBackendHealth,
  getDashboardSummary,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getEmissions,
  createEmission,
  updateEmission,
  deleteEmission,
  getDocuments,
  createDocument,
  reviewDocument,
  extractDocumentFile,
  getReports,
  createReport,
  getGisLocations,
  calculateGisRoute,
  getVehicleFactors,
  geocodeLocation,
  getManufacturerProfile,
};
