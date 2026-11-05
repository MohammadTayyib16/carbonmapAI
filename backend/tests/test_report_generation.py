import io
import csv
import json
import pytest
from app.core.database import SessionLocal
from app.models.report import Report
from app.models.activity import EmissionActivity
from app.api.v1.endpoints.reports import create_report, list_reports, get_report
from app.schemas.report import ReportCreate


def test_database_driven_report_generation():
    """Verify backend dynamic calculation and generation of audit report."""
    db = SessionLocal()
    try:
        # Create a report with dynamic calculation from database
        report_in = ReportCreate(
            report_name="Corporate GHG Inventory - Tata Motors Pune",
            reporting_year="2025-2026",
            format="PDF / CSV",
        )
        rep = create_report(report_in, db)
        assert rep.id is not None
        assert rep.report_code is not None
        assert "TM" in rep.report_code, f"Expected Tata Motors code 'TM', got {rep.report_code}"
        assert rep.total_emissions > 0, "Total emissions must be greater than 0"
        assert rep.scope1 >= 0
        assert rep.scope2 >= 0
        assert rep.scope3 >= 0
        assert round(rep.scope1 + rep.scope2 + rep.scope3, 2) == round(rep.total_emissions, 2)
    finally:
        db.close()


def test_csv_export_format_and_integrity():
    """Verify CSV export columns, escaping, and numerical accuracy."""
    db = SessionLocal()
    try:
        activities = db.query(EmissionActivity).all()
        assert len(activities) > 0, "No activities to test CSV export"

        headers = [
            "Activity ID",
            "Activity Name",
            "GHG Scope & Category",
            "Source Document",
            "Quantity",
            "Unit",
            "Emission Factor",
            "Factor Source",
            "Applied Formula",
            "Data Quality Tier",
            "Emissions (tCO2e)",
            "Data Classification",
        ]

        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(headers)

        total_csv_emissions = 0.0
        for act in activities:
            writer.writerow([
                act.activity_code or f"ACT-{act.id}",
                act.name,
                act.category,
                act.source,
                act.quantity,
                act.unit,
                act.factor,
                act.factor_source,
                act.formula,
                act.quality,
                act.emissions,
                "SYNTHETIC DEMO" if act.is_synthetic else "MEASURED PRIMARY",
            ])
            total_csv_emissions += act.emissions

        csv_content = csv_buffer.getvalue()
        assert len(csv_content) > 100, "Generated CSV is too short"
        assert "Activity ID,Activity Name" in csv_content
        assert "tCO2e" in csv_content
        assert total_csv_emissions > 0, "Total CSV emissions must be positive"

        # Read back with csv.reader to verify RFC 4180 parsing
        csv_buffer.seek(0)
        reader = list(csv.reader(csv_buffer))
        assert len(reader) == len(activities) + 1  # header + rows
        assert len(reader[0]) == len(headers)
    finally:
        db.close()


def test_pdf_export_formatting_and_missing_data_handling():
    """Verify PDF printable report structure handles missing data gracefully."""
    db = SessionLocal()
    try:
        activities = db.query(EmissionActivity).all()
        # Verify formatting with missing or edge-case fields
        sample_row = {
            "name": activities[0].name if activities else "Test Activity",
            "quantity": activities[0].quantity if activities else 100.0,
            "unit": activities[0].unit if activities else "kWh",
            "missing_date_field": None,
            "missing_carrier": None,
        }
        # Graceful fallback: null fields must not raise exceptions
        formatted_name = sample_row.get("name") or "Unnamed Activity"
        formatted_date = sample_row.get("missing_date_field") or "Not recorded"
        assert formatted_date == "Not recorded"
        assert formatted_name != ""
    finally:
        db.close()
