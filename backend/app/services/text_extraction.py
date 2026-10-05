#!/usr/bin/env python3
"""
Text extraction service for PDF, DOCX, and TXT files
"""

import os
import chardet
from pathlib import Path
from typing import Tuple, Optional


class TextExtractionService:
    """Service for extracting text from various document formats"""

    def __init__(self):
        # Import libraries only when needed to avoid import errors
        pass

    def extract_text_sync(
        self, file_path: str, doc_id: str
    ) -> Tuple[str, int, bool, Optional[str]]:
        """
        Extract text from a file synchronously.
        Returns: (text, word_count, success, error_message)
        """
        try:
            file_path_obj = Path(file_path)
            if not file_path_obj.exists():
                return "", 0, False, f"File not found: {file_path}"

            file_extension = file_path_obj.suffix.lower()

            # Route to appropriate extractor
            if file_extension == ".pdf":
                text = self._extract_pdf(file_path)
            elif file_extension in [".docx", ".doc"]:
                text = self._extract_docx(file_path)
            elif file_extension == ".txt":
                text = self._extract_txt(file_path)
            else:
                return "", 0, False, f"Unsupported file type: {file_extension}"

            if text is None:
                return "", 0, False, "Text extraction failed - no text returned"

            # Clean up the text
            text = self._clean_text(text)

            # Count words
            word_count = len(text.split()) if text.strip() else 0

            return text, word_count, True, None

        except Exception as e:
            return "", 0, False, f"Extraction failed: {str(e)}"

    def _extract_pdf(self, file_path: str) -> Optional[str]:
        """Extract text from PDF using pypdf"""
        try:
            from pypdf import PdfReader

            reader = PdfReader(file_path)
            text_parts = []

            for page in reader.pages:
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    # Replace null characters and control chars
                    cleaned_text = page_text.replace("\x00", "").replace("\r", "\n")
                    text_parts.append(cleaned_text)

            final_text = "\n".join(text_parts) if text_parts else ""
            return final_text

        except ImportError:
            # Try fallback library
            try:
                import PyPDF2

                with open(file_path, "rb") as file:
                    reader = PyPDF2.PdfReader(file)
                    text_parts = []

                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            # Replace null characters and control chars
                            cleaned_text = page_text.replace("\x00", "").replace(
                                "\r", "\n"
                            )
                            text_parts.append(cleaned_text)

                    final_text = "\n".join(text_parts) if text_parts else ""
                    return final_text

            except ImportError:
                raise ImportError("PyPDF2 or pypdf library not found")
        except Exception as e:
            raise Exception(f"PDF extraction failed: {str(e)}")

    def _extract_docx(self, file_path: str) -> Optional[str]:
        """Extract text from DOCX using python-docx"""
        try:
            from docx import Document

            document = Document(file_path)
            text_parts = []

            # Extract from paragraphs
            for paragraph in document.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)

            # Extract from tables
            for table in document.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            if paragraph.text.strip():
                                text_parts.append(paragraph.text)

            return "\n".join(text_parts) if text_parts else ""

        except ImportError:
            raise ImportError("python-docx library not found")
        except Exception as e:
            raise Exception(f"DOCX extraction failed: {str(e)}")

    def _extract_txt(self, file_path: str) -> Optional[str]:
        """Extract text from TXT files with encoding detection"""
        try:
            # Read file as bytes first
            with open(file_path, "rb") as f:
                raw_data = f.read()

            # Detect encoding
            detected = chardet.detect(raw_data)
            encoding = detected.get("encoding", "utf-8")

            # Decode with detected encoding, fallback to utf-8
            try:
                text = raw_data.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                text = raw_data.decode("utf-8", errors="replace")

            return text

        except Exception as e:
            raise Exception(f"TXT extraction failed: {str(e)}")

    def _clean_text(self, text: str) -> str:
        """Clean and normalize extracted text"""
        if not text:
            return ""

        # Remove excessive whitespace but preserve paragraph breaks
        import re

        # Replace multiple spaces with single space
        text = re.sub(r"[ \t]+", " ", text)

        # Clean up excessive newlines (more than 2 consecutive)
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Strip leading/trailing whitespace
        text = text.strip()

        return text
