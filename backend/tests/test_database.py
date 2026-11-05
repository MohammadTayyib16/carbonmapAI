import pytest
from fastapi import HTTPException
from app.core.database import SessionLocal, init_db
from app.models.activity import EmissionActivity
from app.models.supplier import Supplier
from app.models.document import Document
from app.models.report import Report
from app.schemas.supplier import SupplierCreate, SupplierUpdate
from app.schemas.activity import ActivityCreate, ActivityUpdate
from app.schemas.document import DocumentCreate, DocumentUpdate
from app.schemas.report import ReportCreate
from app.api.v1.endpoints.suppliers import (
    create_supplier,
    get_supplier,
    update_supplier,
    delete_supplier,
    list_suppliers,
)
from app.api.v1.endpoints.emissions import (
    create_emission_activity,
    get_emission_activity,
    update_emission_activity,
    delete_emission_activity,
    list_emission_activities,
)
from app.api.v1.endpoints.documents import (
    create_document_record,
    get_document,
    update_document_record,
    delete_document,
)
from app.api.v1.endpoints.reports import (
    create_report,
    get_report,
    delete_report,
)

@pytest.fixture(scope="module")
def db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_database_seeding(db_session):
    activities = db_session.query(EmissionActivity).all()
    assert len(activities) >= 5
    suppliers = db_session.query(Supplier).all()
    assert len(suppliers) >= 4
    docs = db_session.query(Document).all()
    assert len(docs) >= 4
    reports = db_session.query(Report).all()
    assert len(reports) >= 1

def test_supplier_crud_and_duplicate_prevention(db_session):
    # 1. Create
    sup_in = SupplierCreate(
        name="Test Unique Solar Vendor",
        category="Renewables",
        location="Sheffield",
        latitude=53.3811,
        longitude=-1.4701,
        annual_spend="£19,000",
        distance_km=210.0,
        esg_rating="A",
        emissions_tons=2.1,
        intensity="0.11 kg CO₂e/£",
        status="Verified Supplier",
    )
    created = create_supplier(sup_in, db=db_session)
    assert created.id is not None
    assert created.name == "Test Unique Solar Vendor"
    sup_id = created.id

    # 2. Duplicate Prevention
    with pytest.raises(HTTPException) as exc_info:
        create_supplier(sup_in, db=db_session)
    assert exc_info.value.status_code == 400
    assert "already exists" in exc_info.value.detail

    # 3. Read
    fetched = get_supplier(sup_id, db=db_session)
    assert fetched.name == "Test Unique Solar Vendor"

    # 4. Update
    up_in = SupplierUpdate(annual_spend="£25,000", distance_km=215.0)
    updated = update_supplier(sup_id, up_in, db=db_session)
    assert updated.annual_spend == "£25,000"
    assert updated.distance_km == 215.0

    # 5. Delete
    res = delete_supplier(sup_id, db=db_session)
    assert res["status"] == "deleted"

    # Verify gone
    with pytest.raises(HTTPException):
        get_supplier(sup_id, db=db_session)

def test_emission_activity_crud(db_session):
    # 1. Create
    act_in = ActivityCreate(
        name="Test Warehouse Solar Array Offset",
        category="Scope 2 - Purchased Electricity",
        source="Meter Read #TEST-99",
        quantity=5000.0,
        unit="kWh",
        factor=0.000412,
        factor_source="DEFRA 2024",
        formula="Emissions = 5,000 kWh × 0.000412 tCO₂e/kWh",
        quality="Tier 1 - Primary Metered",
        emissions=2.06,
        activity_date="2026-11-04",
        verified=True,
        is_synthetic=True,
    )
    created = create_emission_activity(act_in, db=db_session)
    assert created.id is not None
    act_id = created.id

    # 2. Read
    fetched = get_emission_activity(act_id, db=db_session)
    assert fetched.emissions == 2.06

    # 3. Update
    up_in = ActivityUpdate(quantity=6000.0, emissions=2.47)
    updated = update_emission_activity(act_id, up_in, db=db_session)
    assert updated.quantity == 6000.0
    assert updated.emissions == 2.47

    # 4. Delete
    res = delete_emission_activity(act_id, db=db_session)
    assert res["status"] == "deleted"

def test_document_crud(db_session):
    # 1. Create
    doc_in = DocumentCreate(
        file_name="Test_Utility_Invoice.pdf",
        file_type="Electricity Bill",
        file_size="950 KB",
        upload_date="2026-11-04",
        status="Extracted",
        confidence="99%",
        extracted_data_json='{"quantity": 1200}',
    )
    created = create_document_record(doc_in, db=db_session)
    doc_id = created.id

    # 2. Read
    fetched = get_document(doc_id, db=db_session)
    assert fetched.file_name == "Test_Utility_Invoice.pdf"

    # 3. Update
    up_in = DocumentUpdate(status="Verified")
    updated = update_document_record(doc_id, up_in, db=db_session)
    assert updated.status == "Verified"

    # 4. Delete
    res = delete_document(doc_id, db=db_session)
    assert res["status"] == "deleted"

def test_report_crud(db_session):
    # 1. Create
    rep_in = ReportCreate(
        report_name="Q4 Test Greenhouse Gas Report",
        reporting_year="2026",
    )
    created = create_report(rep_in, db=db_session)
    rep_id = created.id
    assert created.total_emissions > 0

    # 2. Read
    fetched = get_report(rep_id, db=db_session)
    assert fetched.report_name == "Q4 Test Greenhouse Gas Report"

    # 3. Delete
    res = delete_report(rep_id, db=db_session)
    assert res["status"] == "deleted"
