# --- KAN-23 schemas (add these) ---
from pydantic import BaseModel
from typing import Literal

SummaryFormat = Literal["short", "bullets", "academic"]
DecisionValue = Literal["pending", "approved", "rejected"]


class GenerateRequest(BaseModel):
    document_id: str
    format: SummaryFormat = "short"


class GenerateResponse(BaseModel):
    document_id: str
    format: SummaryFormat
    summary: str
    decision: DecisionValue = "pending"


class DecisionRequest(BaseModel):
    document_id: str
    decision: DecisionValue


class DecisionResponse(BaseModel):
    document_id: str
    decision: DecisionValue
