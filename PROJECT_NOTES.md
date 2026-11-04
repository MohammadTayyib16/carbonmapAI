# CarbonMap AI — Project Notes

## Project Overview
CarbonMap AI is an AI-assisted carbon footprint reporting tool designed for small businesses to track, calculate, and report greenhouse gas emissions accurately and transparently.

---

## Agreed Technology Stack
- **Frontend**: Node.js, React, Vite, and Tailwind CSS
- **Backend**: Python and FastAPI
- **Database**: PostgreSQL
- **OCR**: Tesseract
- **AI Extraction**: LLM API
- **Carbon Calculation**: Python functions
- **GIS Preparation**: QGIS
- **Web Map**: React Leaflet
- **Routing**: OSRM with saved GeoJSON routes
- **Geocoding**: Nominatim with manual coordinate selection
- **PDF Reports**: ReportLab
- **CSV Reports**: Python standard `csv` module

---

## Important Development Rules
1. **AI Role Limitation**: AI extracts information from documents and inputs, but **never** calculates emissions.
2. **Deterministic Calculations**: All emission calculations must be implemented and executed in Python functions.
3. **No Fabrication**: Never invent missing values or emission factors. If data is unavailable, flag it explicitly.
4. **Audit Trail & Transparency**: Every emission result must record and display its source, quantity, factor, formula, and data-quality label.
5. **Synthetic Data Labeling**: Clearly label all demonstration or mock data as synthetic.
6. **Secrets & Security**: Keep API keys, passwords, and sensitive settings inside the backend `.env` file. Never commit or expose secrets.
7. **Iterative Delivery**: Build one feature at a time and thoroughly test it before moving forward.
8. **Stack Consistency**: Do not change or swap any component of the agreed technology stack without explicit approval.
9. **Clear Communication**: Explain technical changes, trade-offs, and workflows in beginner-friendly language.
10. **Focused Scope**: Do not modify unrelated files or alter architectural scope unnecessarily.
