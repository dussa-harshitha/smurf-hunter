"""
Smurfing Hunter — FastAPI Backend
Serves transaction data, runs detection algorithms, and persists flags.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import csv
import io
import os
import json

from detector import (
    parse_csv_rows,
    analyze_all,
    get_top_suspicious,
    expand_subgraph_from_seeds,
)

app = FastAPI(title="Smurfing Hunter API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ──────────────────────────────────────────────────────
_transactions: list[dict] = []
_wallets: dict[str, dict] = {}
_flags: dict[str, str] = {}          # address → flag
FLAGS_FILE = "flags.json"


def _load_flags():
    global _flags
    if os.path.exists(FLAGS_FILE):
        with open(FLAGS_FILE) as f:
            _flags = json.load(f)


def _save_flags():
    with open(FLAGS_FILE, "w") as f:
        json.dump(_flags, f)


def _load_default_dataset():
    """Load bundled CSV on startup."""
    csv_path = os.path.join(os.path.dirname(__file__), "..", "public", "data", "dataset_small.csv")
    if not os.path.exists(csv_path):
        return
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    global _transactions, _wallets
    _transactions = parse_csv_rows(rows)
    _wallets = analyze_all(_transactions)


@app.on_event("startup")
def startup():
    _load_flags()
    _load_default_dataset()


# ── Routes ────────────────────────────────────────────────────────────────

@app.get("/api/transactions")
def get_transactions(limit: int = 2000):
    """Return parsed transactions."""
    txns = _transactions[:limit]
    return {"transactions": txns, "total": len(_transactions)}


@app.get("/api/wallets")
def get_wallets():
    """Return analyzed wallets."""
    return {"wallets": list(_wallets.values()), "total": len(_wallets)}


@app.get("/api/wallets/top")
def get_top(n: int = 10):
    """Top-N suspicious wallets."""
    top = get_top_suspicious(_wallets, n)
    return {"wallets": top}


@app.get("/api/wallets/{address}")
def get_wallet(address: str):
    w = _wallets.get(address.lower())
    if not w:
        raise HTTPException(404, "Wallet not found")
    return w


class FlagRequest(BaseModel):
    address: str
    flag: str  # confirmed_laundering | suspicious | cleared


@app.post("/api/flag")
def flag_wallet(req: FlagRequest):
    addr = req.address.lower()
    _flags[addr] = req.flag
    if addr in _wallets:
        _wallets[addr]["flaggedAs"] = req.flag
        _wallets[addr]["isManuallyFlagged"] = True
    _save_flags()
    return {"status": "ok", "address": addr, "flag": req.flag}


@app.get("/api/flags")
def get_flags():
    return _flags


class SubgraphRequest(BaseModel):
    seeds: list[str]
    k_hops: int = 2
    min_value: float = 0
    direction: str = "bidirectional"


@app.post("/api/subgraph")
def subgraph(req: SubgraphRequest):
    """Compute k-hop subgraph expansion from seed addresses."""
    result = expand_subgraph_from_seeds(
        _transactions, _wallets,
        seeds=req.seeds, k_hops=req.k_hops,
        min_value=req.min_value, direction=req.direction,
    )
    return result


@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a new CSV dataset and re-run analysis."""
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    global _transactions, _wallets
    _transactions = parse_csv_rows(rows)
    _wallets = analyze_all(_transactions)
    return {
        "status": "ok",
        "transactions": len(_transactions),
        "wallets": len(_wallets),
    }


@app.get("/api/stats")
def get_stats():
    high_risk = sum(1 for w in _wallets.values() if w.get("suspicionScore", 0) >= 60)
    return {
        "totalTx": len(_transactions),
        "totalWallets": len(_wallets),
        "highRiskCount": high_risk,
    }
