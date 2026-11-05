# CarbonMap AI — Enterprise Carbon Accounting & GIS Spatial Intelligence

CarbonMap AI is an AI-assisted greenhouse gas (GHG) accounting and supply-chain spatial intelligence platform built to track, calculate, and report Scope 1, Scope 2, and Scope 3 emissions according to the GHG Protocol Corporate Standard.

Featuring a demonstration supply chain centered around **Tata Motors (Pune, Maharashtra, India)**, CarbonMap AI enables deterministic carbon accounting, automated invoice/receipt parsing (OCR + Gemini AI), interactive route-based freight emission calculation via OSRM, and one-click PDF & CSV audit-ready report generation.

---

## Key Features

1. **Deterministic Carbon Accounting Engine**
   - **Scope 1**: Direct stationary combustion (diesel generators, natural gas) and mobile combustion (fleet fuel).
   - **Scope 2**: Indirect emissions from purchased electricity using official Central Electricity Authority (CEA) India grid emission factors (0.716 kg CO₂e/kWh).
   - **Scope 3**: Upstream freight transport and purchased goods & services using vehicle-specific distance factors (LCVs, HCVs, electric freight).
   - *Rule*: AI extracts data from documents, but carbon calculations are always executed with audited, deterministic Python functions.

2. **Document Processing & AI Extraction**
   - High-precision OCR using Tesseract, `pdfplumber`, and `pypdf`.
   - Google Gemini AI structured extraction for electricity bills, diesel receipts, fuel invoices, and transport waybills.
   - Human-in-the-loop verification step before committing records to the emission ledger.

3. **GIS Routing & Spatial Intelligence**
   - Interactive React Leaflet map centered on the Indian automotive hub (Pune, Chakan, Pimpri-Chinchwad, Talegaon).
   - Road route generation and driving distances using Open Source Routing Machine (OSRM).
   - Supplier emission hotspot visualization and regional transport emission tracking.

4. **Audit-Ready Reporting**
   - Automated PDF GHG inventory report generation using ReportLab.
   - CSV raw emissions inventory export with complete audit trails (emission factor source, formula, calculation tier, verification status).

---

## Tech Stack

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, SQLite / PostgreSQL, ReportLab, Tesseract OCR, Google Gemini API
- **Frontend**: React 18, React Leaflet, Tailwind CSS, Webpack
- **Routing & Maps**: OpenStreetMap (CartoDB tiles), OSRM routing engine
- **Testing**: Pytest, httpx, unittest

---

## Project Structure

```
CarbonMapAI/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # FastAPI endpoints (health, emissions, documents, gis, reports, suppliers, dashboard)
│   │   ├── core/              # Config, database setup, emission factors (CEA India & GHG Protocol), seeding
│   │   ├── models/            # SQLAlchemy database models
│   │   ├── schemas/           # Pydantic schemas
│   │   └── services/          # OCR document parser & Gemini AI extractor
│   ├── tests/                 # Comprehensive Pytest suite and live verification scripts
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example           # Example backend configuration
│   └── .gitignore
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/        # Header, Sidebar, SyntheticBanner
│   │   ├── pages/             # Dashboard, Calculator, DocumentUpload, GisMap, Suppliers, Reports, Settings
│   │   ├── services/          # API client
│   │   └── data/              # Mock and demo data
│   ├── package.json
│   ├── webpack.config.js
│   └── tailwind.config.js
├── data/
│   └── bills/                 # Sample bills (electricity, diesel, fuel, transport waybill)
├── .gitignore
├── PROJECT_NOTES.md
└── README.md
```

---

## Getting Started

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY (optional, OCR works offline)

# Run FastAPI backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend API documentation will be available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The application will be accessible at `http://localhost:3000`.

---

## Running Tests

### Backend Unit & Integration Tests

```bash
cd backend
python -m pytest -v
```

### End-to-End Release Verification

```bash
cd backend
python tests/verify_release_e2e.py
```

### Frontend Production Build

```bash
cd frontend
npm run build
```

---

## Security & Data Integrity

- API keys and secrets must reside strictly in `backend/.env`, which is ignored by Git.
- Never commit credentials or live database files to source control.
- All demo data is explicitly labeled as synthetic in compliance with GHG verification standards.
