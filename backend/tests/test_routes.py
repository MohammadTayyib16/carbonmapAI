import pytest
from app.core.database import SessionLocal, init_db
from app.api.v1.endpoints.dashboard import get_dashboard_summary
from app.api.v1.endpoints.emissions import list_emission_activities
from app.api.v1.endpoints.suppliers import list_suppliers
from app.api.v1.endpoints.documents import list_documents
from app.api.v1.endpoints.reports import list_reports

@pytest.fixture(scope="module")
def db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_dashboard_summary_unit(db_session):
    data = get_dashboard_summary(db=db_session)
    assert data["status"] == "success"
    assert data["is_synthetic"] is True
    assert data["metrics"]["total_emissions_tco2e"] > 0
    assert data["metrics"]["scope1_direct"] > 0
    assert data["metrics"]["scope2_electricity"] > 0
    assert data["metrics"]["scope3_value_chain"] > 0

def test_list_emissions_unit(db_session):
    activities = list_emission_activities(db=db_session)
    assert len(activities) > 0
    # Rule 4: Source, quantity, factor, formula, quality
    act = activities[0]
    assert hasattr(act, "source")
    assert hasattr(act, "quantity")
    assert hasattr(act, "factor")
    assert hasattr(act, "formula")
    assert hasattr(act, "quality")

def test_list_suppliers_unit(db_session):
    suppliers = list_suppliers(db=db_session)
    assert len(suppliers) > 0
    assert hasattr(suppliers[0], "distance_km")
    assert hasattr(suppliers[0], "esg_rating")

def test_list_documents_unit(db_session):
    docs = list_documents(db=db_session)
    assert len(docs) > 0
    assert hasattr(docs[0], "file_name")

def test_list_reports_unit(db_session):
    reports = list_reports(db=db_session)
    assert len(reports) > 0
    assert reports[0].total_emissions > 0
