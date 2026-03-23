"""
Core smurfing detection logic (Python port of smurfingDetector.ts + temporalAnalysis.ts).
"""

import math
from collections import defaultdict

FAN_OUT_THRESHOLD = 5
FAN_IN_THRESHOLD = 5
PEELING_VALUE_DECREASE = 0.15
TIME_CLUSTER_THRESHOLD = 60
SUSPICIOUS_RHYTHM_VARIANCE = 0.10
HIGHLY_SUSPICIOUS_RHYTHM_VARIANCE = 0.05
BURST_THRESHOLD = 30
BURST_MIN_COUNT = 3


def parse_csv_rows(rows: list[dict]) -> list[dict]:
    """Convert raw CSV dict rows into typed transaction dicts."""
    transactions = []
    for r in rows:
        try:
            tx = {
                "Record": int(r.get("Record", 0)),
                "TxHash": r.get("TxHash", ""),
                "Block": int(r.get("Block", 0)),
                "From": r.get("From", "").lower().strip(),
                "To": r.get("To", "").lower().strip(),
                "Value_ETH": float(r.get("Value_ETH", 0)),
                "TxFee": float(r.get("TxFee", 0)),
                "Age_seconds": int(r.get("Age_seconds", 0)),
                "From_is_address": str(r.get("From_is_address", "")).lower() == "true",
                "To_is_address": str(r.get("To_is_address", "")).lower() == "true",
                "From_entity_type": r.get("From_entity_type", "unknown"),
                "To_entity_type": r.get("To_entity_type", "unknown"),
                "Fee_to_Value": float(r.get("Fee_to_Value", 0)),
                "Value_Wei": r.get("Value_Wei", "0"),
                "From_tx_count": int(r.get("From_tx_count", 0)),
                "To_tx_count": int(r.get("To_tx_count", 0)),
            }
            transactions.append(tx)
        except (ValueError, TypeError):
            continue
    return transactions


def _empty_wallet(address: str, entity_type: str) -> dict:
    return {
        "id": address,
        "address": address,
        "totalSent": 0.0,
        "totalReceived": 0.0,
        "outgoingCount": 0,
        "incomingCount": 0,
        "suspicionScore": 0,
        "suspicionReasons": [],
        "transactionRhythm": "normal",
        "rhythmDescription": "Insufficient data",
        "entityType": entity_type or "unknown",
        "avgTimeBetweenTx": 0.0,
        "participatesInFanOut": False,
        "participatesInFanIn": False,
        "isPeelingSource": False,
        "txCount": 0,
        "temporalAttentionScore": 0,
    }


def analyze_all(transactions: list[dict]) -> dict[str, dict]:
    """Run full analysis, return wallet_address → wallet dict."""
    wallets: dict[str, dict] = {}
    tx_by_wallet: dict[str, list[dict]] = defaultdict(list)
    outgoing_edges: dict[str, set] = defaultdict(set)
    incoming_edges: dict[str, set] = defaultdict(set)

    for tx in transactions:
        fr, to = tx["From"], tx["To"]
        outgoing_edges[fr].add(to)
        incoming_edges[to].add(fr)
        tx_by_wallet[fr].append(tx)

        if fr not in wallets:
            wallets[fr] = _empty_wallet(fr, tx["From_entity_type"])
        if to not in wallets:
            wallets[to] = _empty_wallet(to, tx["To_entity_type"])

        wallets[fr]["totalSent"] += tx["Value_ETH"]
        wallets[fr]["outgoingCount"] += 1
        wallets[fr]["txCount"] = max(wallets[fr]["txCount"], tx["From_tx_count"])

        wallets[to]["totalReceived"] += tx["Value_ETH"]
        wallets[to]["incomingCount"] += 1
        wallets[to]["txCount"] = max(wallets[to]["txCount"], tx["To_tx_count"])

    # Scoring pass
    for address, wallet in wallets.items():
        reasons = []
        score = 0

        out_count = len(outgoing_edges.get(address, set()))
        in_count = len(incoming_edges.get(address, set()))

        if out_count >= FAN_OUT_THRESHOLD:
            wallet["participatesInFanOut"] = True
            reasons.append(f"Sends to {out_count} unique wallets (fan-out)")
            score += min(30, out_count * 3)

        if in_count >= FAN_IN_THRESHOLD:
            wallet["participatesInFanIn"] = True
            reasons.append(f"Receives from {in_count} unique wallets (fan-in)")
            score += min(30, in_count * 3)

        w_txs = tx_by_wallet.get(address, [])

        # Peeling chain
        if len(w_txs) >= 3:
            values = sorted([t["Value_ETH"] for t in w_txs], reverse=True)
            peeling = 0
            for i in range(1, len(values)):
                if values[i - 1] > 0:
                    dec = (values[i - 1] - values[i]) / values[i - 1]
                    if 0 < dec < PEELING_VALUE_DECREASE:
                        peeling += 1
            if peeling >= 2:
                wallet["isPeelingSource"] = True
                reasons.append(f"{peeling} transactions show peeling chain pattern")
                score += min(25, peeling * 5)

        # Time clustering
        times = sorted([t["Age_seconds"] for t in w_txs])
        cluster_count = 0
        for i in range(1, len(times)):
            if abs(times[i] - times[i - 1]) < TIME_CLUSTER_THRESHOLD:
                cluster_count += 1
        if cluster_count >= 3:
            reasons.append(f"{cluster_count} transactions clustered within {TIME_CLUSTER_THRESHOLD}s")
            score += min(20, cluster_count * 4)

        # High fee
        high_fee = sum(1 for t in w_txs if t["Fee_to_Value"] > 0.01)
        if high_fee >= 2:
            reasons.append(f"{high_fee} txns with high fee-to-value ratio")
            score += min(15, high_fee * 3)

        if wallet["txCount"] > 100:
            score += min(10, wallet["txCount"] // 50)

        # Rhythm
        if len(times) >= 3:
            gaps = [abs(times[i] - times[i - 1]) for i in range(1, len(times))]
            avg_gap = sum(gaps) / len(gaps) if gaps else 0
            variance = sum((g - avg_gap) ** 2 for g in gaps) / len(gaps) if gaps else 0
            cv = math.sqrt(variance) / avg_gap if avg_gap > 0 else 1
            wallet["avgTimeBetweenTx"] = avg_gap
            if cv < HIGHLY_SUSPICIOUS_RHYTHM_VARIANCE and avg_gap < 300:
                wallet["transactionRhythm"] = "highly_suspicious"
                wallet["rhythmDescription"] = f"Highly regular (CV: {cv*100:.1f}%, gap: {avg_gap:.0f}s)"
                reasons.append("Highly suspicious automated pattern")
                score += 20
            elif cv < SUSPICIOUS_RHYTHM_VARIANCE and avg_gap < 600:
                wallet["transactionRhythm"] = "suspicious"
                wallet["rhythmDescription"] = f"Suspiciously regular (CV: {cv*100:.1f}%, gap: {avg_gap:.0f}s)"
                reasons.append("Unusually regular timing")
                score += 10
            else:
                wallet["transactionRhythm"] = "normal"
                wallet["rhythmDescription"] = "Normal activity"

        # Temporal attention
        wallet["temporalAttentionScore"] = _temporal_attention(address, transactions)

        wallet["suspicionScore"] = min(100, score)
        wallet["suspicionReasons"] = reasons

    return wallets


def _temporal_attention(address: str, transactions: list[dict]) -> int:
    w_txs = [t for t in transactions if t["From"] == address or t["To"] == address]
    if len(w_txs) < 2:
        return 0
    times = sorted([t["Age_seconds"] for t in w_txs], reverse=True)
    score = 0

    # Burst detection
    burst_count = 0
    run = 1
    for i in range(1, len(times)):
        if abs(times[i] - times[i - 1]) <= BURST_THRESHOLD:
            run += 1
        else:
            if run >= BURST_MIN_COUNT:
                burst_count += 1
            run = 1
    if run >= BURST_MIN_COUNT:
        burst_count += 1
    score += min(30, burst_count * 10)

    # Periodicity
    if len(times) >= 3:
        gaps = [abs(times[i] - times[i - 1]) for i in range(1, len(times))]
        avg = sum(gaps) / len(gaps) if gaps else 0
        if avg > 0:
            var = sum((g - avg) ** 2 for g in gaps) / len(gaps)
            cv = math.sqrt(var) / avg
            if cv < 0.05:
                score += 25
            elif cv < 0.1:
                score += 15
            elif cv < 0.15:
                score += 8

    # Rapid sequences
    rapid = sum(1 for i in range(1, len(times)) if abs(times[i] - times[i - 1]) <= 5)
    score += min(20, rapid * 5)

    return min(100, score)


def get_top_suspicious(wallets: dict[str, dict], n: int = 10) -> list[dict]:
    return sorted(wallets.values(), key=lambda w: w["suspicionScore"], reverse=True)[:n]


def expand_subgraph_from_seeds(
    transactions: list[dict],
    wallets: dict[str, dict],
    seeds: list[str],
    k_hops: int = 2,
    min_value: float = 0,
    direction: str = "bidirectional",
) -> dict:
    """K-hop BFS expansion from seed addresses."""
    filtered = [t for t in transactions if t["Value_ETH"] >= min_value]

    fwd: dict[str, set] = defaultdict(set)
    bwd: dict[str, set] = defaultdict(set)
    edge_txs: dict[str, list[dict]] = defaultdict(list)

    for tx in filtered:
        fwd[tx["From"]].add(tx["To"])
        bwd[tx["To"]].add(tx["From"])
        edge_txs[f"{tx['From']}->{tx['To']}"].append(tx)

    visited: dict[str, int] = {}
    queue: list[tuple[str, int]] = []
    links = []
    seed_set = {s.lower() for s in seeds}

    for s in seed_set:
        visited[s] = 0
        queue.append((s, 0))

    while queue:
        addr, dist = queue.pop(0)
        if dist >= k_hops:
            continue

        neighbours: list[tuple[str, str]] = []
        if direction in ("forward", "bidirectional"):
            for n in fwd.get(addr, set()):
                neighbours.append((n, "forward"))
        if direction in ("backward", "bidirectional"):
            for n in bwd.get(addr, set()):
                neighbours.append((n, "backward"))

        for nbr, d in neighbours:
            new_dist = dist + 1
            if nbr not in visited or visited[nbr] > new_dist:
                visited[nbr] = new_dist
                queue.append((nbr, new_dist))

            ek = f"{addr}->{nbr}" if d == "forward" else f"{nbr}->{addr}"
            txs = edge_txs.get(ek, [])
            if txs:
                total_val = sum(t["Value_ETH"] for t in txs)
                links.append({
                    "source": addr if d == "forward" else nbr,
                    "target": nbr if d == "forward" else addr,
                    "value": total_val,
                    "txCount": len(txs),
                    "direction": d,
                })

    nodes = []
    for addr, dist in visited.items():
        w = wallets.get(addr, _empty_wallet(addr, "unknown"))
        nodes.append({
            "address": addr,
            "hopDistance": dist,
            "isSeed": addr in seed_set,
            "suspicionScore": w.get("suspicionScore", 0),
            "totalSent": w.get("totalSent", 0),
            "totalReceived": w.get("totalReceived", 0),
        })

    return {"nodes": nodes, "links": links, "seedCount": len(seed_set)}
