#!/usr/bin/env python3
"""
Test database connection and text extraction with real sample files
"""
import os
print("Testing database and text extraction with real samples...")

# Import database components
from app.core.config import SessionLocal, engine, Base
from app.models.database import Document
from app.services.text_extraction import TextExtractionService

# Ensure tables exist first
print("Creating tables if they don't exist...")
Base.metadata.create_all(bind=engine)
print("Tables ready.")

def test_database_with_real_samples():
    db = SessionLocal()

    try:
        # Initialize text extraction service
        text_extractor = TextExtractionService()

        # Test with actual sample files
        sample_dir = os.path.join(os.path.dirname(__file__), 'tests', 'samples')
        sample_pdf = os.path.join(sample_dir, 'sample.pdf')

        if os.path.exists(sample_pdf):
            print(f"📄 Testing with real sample: {sample_pdf}")

            # Extract text from the real PDF file
            text, word_count, success, error = text_extractor.extract_text_sync(sample_pdf, "test-sample-pdf")

            if success:
                print("Text extraction successful!")                
                print(f"   - Words extracted: {word_count}")
                print(f"   - Text preview: {text[:100]}...")

                # Query the document back from database to confirm storage
                document = db.query(Document).filter(Document.id == "test-sample-pdf").first()
                if document:
                    print("✅ Database storage working!")
                    print(f"   - Filename: {document.filename}")
                    print(f"   - Word count in DB: {document.word_count}")
                    print(f"   - Status: {document.extraction_status}")
                else:
                    print("Database query failed")

                return True
            else:
                print(f"Text extraction failed: {error}")
                return False
        else:
            print("Sample PDF file not found")
            return False

    finally:
        db.close()

if __name__ == "__main__":
    success = test_database_with_real_samples()
    if success:
        print("\nDatabase + Text Extraction test PASSED!")
    else:
        print("\n Test failed - check logs above")
