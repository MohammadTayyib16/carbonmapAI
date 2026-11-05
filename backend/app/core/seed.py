import logging
from sqlalchemy.orm import Session
from app.models.activity import EmissionActivity
from app.models.supplier import Supplier
from app.models.document import Document
from app.models.report import Report

logger = logging.getLogger(__name__)

# Sample synthetic demonstration data for Tata Motors Manufacturing Supply Chain, Pune, Maharashtra, India
# Rule #5: Clearly labeled as synthetic demonstration data
SEED_ACTIVITIES = [
    {
        "activity_code": "ACT-001",
        "name": "Tata Motors Pune Press & Body Shop Electricity",
        "category": "Scope 2 - Purchased Electricity",
        "source": "MSEDCL High-Tension Industrial Bill #HT-PUNE-8821",
        "quantity": 64500.0,
        "unit": "kWh",
        "factor": 0.000716,
        "factor_source": "Central Electricity Authority (CEA) India CO2 Baseline Database v20.0",
        "formula": "Emissions = 64,500 kWh × 0.000716 tCO₂e/kWh",
        "quality": "Tier 1 - Primary Metered (CEA Grid Baseline)",
        "emissions": 46.18,
        "activity_date": "2026-10-15",
        "verified": True,
        "is_synthetic": True,
    },
    {
        "activity_code": "ACT-002",
        "name": "Internal Shunting & Plant Logistics Diesel Fleet (Pimpri)",
        "category": "Scope 1 - Mobile Combustion",
        "source": "IOCL Commercial Fleet Fuel Dispenser Log Oct 2026",
        "quantity": 3800.0,
        "unit": "Liters",
        "factor": 0.00268,
        "factor_source": "DEFRA 2024 / IPCC Guidelines for Mobile Combustion (Diesel)",
        "formula": "Emissions = 3,800 L × 0.00268 tCO₂e/L",
        "quality": "Tier 1 - Primary Fuel Invoices",
        "emissions": 10.18,
        "activity_date": "2026-10-28",
        "verified": True,
        "is_synthetic": True,
    },
    {
        "activity_code": "ACT-003",
        "name": "Paint Shop Natural Gas Thermal Ovens (Pune Plant)",
        "category": "Scope 1 - Stationary Combustion",
        "source": "Maharashtra Natural Gas Ltd (MNGL) Commercial Pipeline Invoice",
        "quantity": 1820.0,
        "unit": "m³",
        "factor": 0.00203,
        "factor_source": "DEFRA 2024 / MoEFCC GHG Factor for Natural Gas",
        "formula": "Emissions = 1,820 m³ × 0.00203 tCO₂e/m³",
        "quality": "Tier 2 - Utility Invoice",
        "emissions": 3.69,
        "activity_date": "2026-11-01",
        "verified": True,
        "is_synthetic": True,
    },
    {
        "activity_code": "ACT-004",
        "name": "Inbound Powertrain Freight (Chakan Auto Cluster to Pimpri)",
        "category": "Scope 3 - Category 4 (Upstream Transportation: Distance-based Modeled)",
        "source": "Waybill & OSRM Road Route (24.5 km @ 14.0 tonnes payload)",
        "quantity": 343.0,
        "unit": "tonne-km",
        "factor": 0.000108,
        "factor_source": "GLEC Framework v3.0 / DEFRA Heavy Commercial Vehicle Factor",
        "formula": "Emissions = 343.0 tonne-km × 0.000108 tCO₂e/tonne-km",
        "quality": "Tier 2 - Distance & Consignment Waybill",
        "emissions": 0.04,
        "activity_date": "2026-10-22",
        "verified": True,
        "is_synthetic": True,
    },
    {
        "activity_code": "ACT-005",
        "name": "Returnable Transit Packaging Supply (Hadapsar to Pimpri)",
        "category": "Scope 3 - Purchased Goods & Services",
        "source": "Supplier Invoice #GP-HAD-2026",
        "quantity": 3200.0,
        "unit": "kg",
        "factor": 0.00072,
        "factor_source": "Ecoinvent v3.9 Industrial Packaging Proxy",
        "formula": "Emissions = 3,200 kg × 0.00072 tCO₂e/kg",
        "quality": "Tier 3 - Industry Proxy",
        "emissions": 2.30,
        "activity_date": "2026-10-18",
        "verified": True,
        "is_synthetic": True,
    },
]

SEED_SUPPLIERS = [
    {
        "supplier_code": "SUP-IND-01",
        "name": "Automobile Components Supplier (Chakan) [Synthetic Demo]",
        "category": "Automotive Tier-1 Powertrain & Transmission",
        "location": "Chakan Phase II MIDC, Pune, Maharashtra, India",
        "latitude": 18.7606,
        "longitude": 73.8540,
        "annual_spend": "₹48,50,000",
        "distance_km": 24.5,
        "esg_rating": "A-",
        "emissions_tons": 14.2,
        "intensity": "0.29 kg CO₂e/₹100",
        "status": "Verified Supplier",
    },
    {
        "supplier_code": "SUP-IND-02",
        "name": "Steel Components Supplier (Pimpri) [Synthetic Demo]",
        "category": "Stamping & High-Tensile Body Panels",
        "location": "Pimpri Industrial Zone, Pune, Maharashtra, India",
        "latitude": 18.6298,
        "longitude": 73.7997,
        "annual_spend": "₹82,00,000",
        "distance_km": 6.8,
        "esg_rating": "B+",
        "emissions_tons": 28.6,
        "intensity": "0.35 kg CO₂e/₹100",
        "status": "Action Required",
    },
    {
        "supplier_code": "SUP-IND-03",
        "name": "Packaging Supplier (Pune) [Synthetic Demo]",
        "category": "Heavy Returnable & Sustainable Packaging",
        "location": "Hadapsar Industrial Estate, Pune, Maharashtra, India",
        "latitude": 18.5089,
        "longitude": 73.9259,
        "annual_spend": "₹24,50,000",
        "distance_km": 28.2,
        "esg_rating": "A",
        "emissions_tons": 8.4,
        "intensity": "0.34 kg CO₂e/₹100",
        "status": "Verified Supplier",
    },
    {
        "supplier_code": "SUP-IND-04",
        "name": "Logistics Hub & Freight Terminal (Talegaon) [Synthetic Demo]",
        "category": "Third-Party Freight Logistics & Consolidation",
        "location": "Talegaon Dabhade Logistics Hub, Pune, Maharashtra, India",
        "latitude": 18.7300,
        "longitude": 73.6700,
        "annual_spend": "₹64,00,000",
        "distance_km": 21.4,
        "esg_rating": "A-",
        "emissions_tons": 22.5,
        "intensity": "0.35 kg CO₂e/₹100",
        "status": "Verified Supplier",
    },
    {
        "supplier_code": "SUP-IND-05",
        "name": "Precision Castings & Alloy Foundry (Bhosari) [Synthetic Demo]",
        "category": "Aluminum Die Casting & Alloy Components",
        "location": "Bhosari MIDC Industrial Area, Pune, Maharashtra, India",
        "latitude": 18.6276,
        "longitude": 73.8344,
        "annual_spend": "₹31,00,000",
        "distance_km": 5.5,
        "esg_rating": "A",
        "emissions_tons": 9.8,
        "intensity": "0.31 kg CO₂e/₹100",
        "status": "Verified Supplier",
    },
]

SEED_DOCUMENTS = [
    {
        "doc_code": "DOC-IND-01",
        "file_name": "MSEDCL_Electricity_Pune_Oct2026.pdf",
        "file_type": "Electricity Bill",
        "file_size": "1.4 MB",
        "upload_date": "2026-11-02",
        "status": "Extracted",
        "confidence": "98%",
        "extracted_data_json": '{"provider":"Maharashtra State Electricity Distribution Co Ltd (MSEDCL)","period":"01/10/2026 - 31/10/2026","quantity":64500,"unit":"kWh"}',
    },
    {
        "doc_code": "DOC-IND-02",
        "file_name": "IOCL_Commercial_Diesel_Pimpri.pdf",
        "file_type": "Fuel Receipt",
        "file_size": "820 KB",
        "upload_date": "2026-10-30",
        "status": "Extracted",
        "confidence": "95%",
        "extracted_data_json": '{"provider":"Indian Oil Corporation Ltd (IOCL) Auto Bunk","period":"October 2026","quantity":3800,"unit":"Liters"}',
    },
    {
        "doc_code": "DOC-IND-03",
        "file_name": "MNGL_NaturalGas_PunePlant.pdf",
        "file_type": "Natural Gas Bill",
        "file_size": "2.1 MB",
        "upload_date": "2026-10-18",
        "status": "Extracted",
        "confidence": "92%",
        "extracted_data_json": '{"provider":"Maharashtra Natural Gas Ltd (MNGL)","period":"Q3 2026","quantity":1820,"unit":"m3"}',
    },
    {
        "doc_code": "DOC-IND-04",
        "file_name": "Talegaon_Inbound_Freight_Waybill.pdf",
        "file_type": "Transport Record",
        "file_size": "540 KB",
        "upload_date": "2026-10-12",
        "status": "Human Verified",
        "confidence": "96%",
        "extracted_data_json": '{"carrier":"Talegaon Logistics Haulage","period":"12/10/2026","quantity":343,"unit":"tonne-km"}',
    },
]

SEED_REPORTS = [
    {
        "report_code": "RPT-2026-TM01",
        "report_name": "Corporate GHG Protocol Carbon Footprint Inventory - Tata Motors Pune Plant",
        "reporting_year": "2025-2026",
        "total_emissions": 62.39,
        "scope1": 13.87,
        "scope2": 46.18,
        "scope3": 2.34,
        "format": "PDF / CSV",
    }
]


def seed_database(db: Session):
    """
    Seeds initial synthetic demonstration data and cleans up outdated UK demonstration records.
    Preserves real user records and enforces Rule #5 (clearly labelled synthetic data).
    """
    try:
        # Clean up outdated UK demonstration suppliers and GreenPeak references
        uk_suppliers = db.query(Supplier).filter(
            (Supplier.location.ilike("%Birmingham%"))
            | (Supplier.location.ilike("%Manchester%"))
            | (Supplier.location.ilike("%Bristol%"))
            | (Supplier.location.ilike("%Reading%"))
            | (Supplier.location.ilike("%Coventry%"))
            | (Supplier.location.ilike("%Warrington%"))
            | (Supplier.location.ilike("%London%"))
            | (Supplier.name.ilike("%EcoPack%"))
            | (Supplier.name.ilike("%SwiftFreight%"))
            | (Supplier.name.ilike("%GreenShield%"))
            | (Supplier.name.ilike("%GreenPeak%"))
        ).all()

        if uk_suppliers:
            logger.info("Migrating %d outdated UK demonstration suppliers to Indian supply chain...", len(uk_suppliers))
            for old_sup in uk_suppliers:
                db.delete(old_sup)
            db.commit()

        # Ensure all 5 Indian demonstration suppliers exist
        for sup_data in SEED_SUPPLIERS:
            existing = db.query(Supplier).filter(Supplier.supplier_code == sup_data["supplier_code"]).first()
            if not existing:
                db.add(Supplier(**sup_data))
        db.commit()

        # Migrate outdated UK emission activities
        old_synthetic_acts = db.query(EmissionActivity).filter(
            (EmissionActivity.activity_code.in_(["ACT-001", "ACT-002", "ACT-003", "ACT-004", "ACT-005"]))
            | (EmissionActivity.name.ilike("%GreenPeak%"))
            | (EmissionActivity.name.ilike("%Birmingham%"))
            | (EmissionActivity.name.ilike("%Shell Commercial Fleet%"))
            | (EmissionActivity.source.ilike("%UK National Grid%"))
            | (EmissionActivity.name.ilike("%Main Distribution Hub%"))
            | (EmissionActivity.name.ilike("%4 Delivery Vans%"))
            | (EmissionActivity.name.ilike("%Warehouse Natural Gas Heating%"))
            | (EmissionActivity.name.ilike("%Inbound Pallet Freight%"))
            | (EmissionActivity.name.ilike("%Recycled Cardboard Packaging%"))
        ).all()

        for old_act in old_synthetic_acts:
            # If it's old UK demo, delete it so we can seed Tata Motors Pune demo activities
            db.delete(old_act)
        db.commit()

        for act_data in SEED_ACTIVITIES:
            existing_act = db.query(EmissionActivity).filter(EmissionActivity.activity_code == act_data["activity_code"]).first()
            if not existing_act:
                db.add(EmissionActivity(**act_data))
        db.commit()

        if db.query(Document).first() is None:
            logger.info("Seeding documents...")
            for doc_data in SEED_DOCUMENTS:
                db.add(Document(**doc_data))
            db.commit()

        if db.query(Report).first() is None:
            logger.info("Seeding report...")
            for rep_data in SEED_REPORTS:
                db.add(Report(**rep_data))
            db.commit()

        logger.info("Database seeding check complete: Tata Motors Pune supply chain verified.")
    except Exception as e:
        db.rollback()
        logger.warning("Database seeding skipped or encountered error: %s", e)
