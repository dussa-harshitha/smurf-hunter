# The Smurfing Hunter

Advanced blockchain AML analysis platform for detecting smurfing and money laundering patterns in Ethereum transactions.

## Architecture

```
├── backend/               # FastAPI Python backend
│   ├── main.py           # API routes (transactions, wallets, flags, subgraph)
│   ├── detector.py       # Core detection algorithms
│   └── requirements.txt
├── src/                   # React + TypeScript frontend
│   ├── pages/Index.tsx   # Main app page
│   ├── components/       # UI components
│   ├── lib/              # Frontend analysis utilities
│   │   ├── smurfingDetector.ts    # Graph + suspicion scoring
│   │   ├── temporalAnalysis.ts    # Temporal pattern detection
│   │   ├── subgraphExpansion.ts   # K-hop BFS expansion
│   │   └── csvParser.ts           # CSV ingestion
│   └── types/transaction.ts       # Shared type definitions
├── public/data/           # Bundled dataset
└── start.sh              # One-command startup
```

## Features

### Overview Mode
- **Force-directed transaction graph** — nodes colored by suspicion score, edges animated with temporal flow
- **Temporal heatmap** — activity distribution across time buckets, color-coded by average risk
- **Timeline scrubber** — play/pause animation that reveals transaction history chronologically
- **Top suspicious wallets** — ranked list with click-to-inspect

### Forensic Anchor Mode
- **Seed-driven subgraph expansion** — select suspicious wallets as seeds, expand K hops
- **Bidirectional BFS** — trace money forward, backward, or both
- **Inverse topology mapping** — see all wallets connected to each seed
- **Configurable filters** — min value, entity type, time range, hop depth

### Detection Algorithms
- Fan-out / fan-in detection
- Peeling chain identification
- Time clustering analysis
- Transaction rhythm scoring (coefficient of variation)
- Temporal attention scoring (bursts, periodicity, rapid sequences)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions?limit=2000` | Parsed transactions |
| GET | `/api/wallets` | All analyzed wallets |
| GET | `/api/wallets/top?n=10` | Top suspicious wallets |
| GET | `/api/wallets/{address}` | Single wallet details |
| POST | `/api/flag` | Flag a wallet `{address, flag}` |
| GET | `/api/flags` | All persisted flags |
| POST | `/api/subgraph` | K-hop expansion `{seeds, k_hops, min_value, direction}` |
| POST | `/api/upload` | Upload new CSV dataset |
| GET | `/api/stats` | Summary statistics |

## Quick Start

```bash
# Install and run both services
./start.sh

# Or run separately:

# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --port 8000 --reload

# Frontend
npm install && npm run dev
```

Frontend runs on `http://localhost:8080`, backend on `http://localhost:8000`.
The Vite dev server proxies `/api/*` requests to the backend automatically.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, react-force-graph-2d
- **Backend:** FastAPI, Python 3.11+, uvicorn
- **Detection:** Custom graph algorithms, temporal analysis, BFS subgraph expansion
![def1f9a8-effd-4e6d-b279-25434c126560](https://github.com/user-attachments/assets/520e4770-65c2-4239-bdf2-1292cb74ae87)
