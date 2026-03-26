# O2C Graph Explorer

A **context graph system with an LLM-powered query interface** for SAP Order-to-Cash data. Users can visually explore interconnected business entities and ask natural language questions that are translated into SQL queries executed against a real database.

**Live Demo:** https://oc2-graph.vercel.app/ 
**Repository:** https://github.com/RoBWarrior/oc2-graph

---

## What It Does

- Ingests SAP O2C dataset (JSONL) and models it as a graph of interconnected entities
- Visualizes the graph with force-directed layout — nodes are clickable and expandable
- Provides a chat interface where users ask questions in natural language
- LLM translates questions → PostgreSQL SQL → executes against Supabase → returns natural language answers
- Guardrails reject off-topic queries (general knowledge, coding help, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Frontend (Vercel)                   │
│  React + Vite                                    │
│  react-force-graph-2d  — graph visualization    │
│  Chat panel — NL query interface                 │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (axios)
┌──────────────────▼──────────────────────────────┐
│              Backend (Render)                    │
│  Node.js + Express                               │
│  /api/graph  → nodes + edges from Supabase      │
│  /api/chat   → NL → Groq → SQL → Supabase → NL │
└──────────────────┬──────────────────────────────┘
                   │ Supabase JS SDK
┌──────────────────▼──────────────────────────────┐
│           Supabase (PostgreSQL)                  │
│  17 tables covering the full O2C flow           │
│  execute_sql() RPC for safe dynamic queries     │
└──────────────────┬──────────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────────┐
│         Groq API — llama-3.3-70b-versatile      │
│  Stage 1: classify + generate SQL               │
│  Stage 2: summarize results in natural language │
└─────────────────────────────────────────────────┘
```

---

## Graph Model

### Node Types

| Type | Source Table | Color |
|---|---|---|
| SalesOrder | sales_order_headers | Blue |
| Customer | business_partners | Orange |
| Product | products | Purple |
| Delivery | outbound_delivery_headers | Green |
| BillingDocument | billing_document_headers | Yellow |
| JournalEntry | journal_entry_items | Pink |
| Payment | payments | Teal |
| Plant | outbound_delivery_items.plant | Cyan |

### Edge Relationships (O2C Flow)

```
Customer ──placed──► SalesOrder ──contains──► Product
                         │
                   delivered via
                         │
                         ▼
                      Delivery ──ships from──► Plant
                         
SalesOrder ──billed as──► BillingDocument ──posted as──► JournalEntry ──cleared by──► Payment
```

---

## Database Choice: Supabase (PostgreSQL)

**Why Supabase over alternatives:**

| Option | Verdict |
|---|---|
| SQLite | Fails on Render (ephemeral filesystem resets on deploy) |
| Firebase/Firestore | NoSQL — cross-collection JOINs are painful, NL→SQL impossible |
| **Supabase (PostgreSQL)** | ✅ Free, persistent, real SQL JOINs, RPC for dynamic execution |

Supabase gives us a real PostgreSQL database which is critical for the NL→SQL pipeline. The LLM generates standard SQL that runs directly via a custom `execute_sql()` RPC function.

---

## LLM Prompting Strategy

Three-stage pipeline using **Groq (llama-3.3-70b-versatile)**:

### Stage 1 — Classification + SQL Generation
The system prompt includes:
- Full schema with all 17 table names and column names
- All key foreign key relationships
- Status code definitions
- Explicit rules for JOIN patterns (e.g. O2C flow traces)
- Instruction to return structured JSON only

Groq returns one of:
```json
{"type": "off_topic", "message": "..."}
```
or
```json
{"type": "query", "sql": "SELECT ...", "explanation": "..."}
```

### Stage 2 — SQL Execution
SQL is validated server-side (SELECT-only) then executed via Supabase RPC.

### Stage 3 — Natural Language Summarization
Raw results (up to 20 rows) are sent back to Groq with the original question for a human-readable summary.

**Why Groq over Gemini:**  
Google's Generative Language API times out from certain Indian ISPs. Groq's API is reliably accessible and significantly faster (sub-second responses).

---

## Guardrails

Four layers of protection:

1. **LLM-level** — System prompt explicitly instructs the model to return `{"type": "off_topic"}` for any non-O2C query (general knowledge, weather, coding help, creative writing)

2. **Server-level SQL validation** — Before execution, the backend checks:
   - Query must start with `SELECT`
   - Query must not contain `DROP`, `DELETE`, `INSERT`, `UPDATE`, `TRUNCATE`, or `ALTER`

3. **Database-level RPC** — The `execute_sql()` Supabase function enforces SELECT-only at the PostgreSQL level with `SECURITY DEFINER`

4. **Row limits** — All queries capped at 50 rows by default in the system prompt

---

## Project Structure

```
o2c-graph/
├── backend/
│   ├── index.js           # Express server, /api/graph, /api/chat
│   ├── seed.js            # Loads JSONL dataset into Supabase
│   ├── schema.sql         # Run in Supabase SQL Editor to create tables
│   ├── rpc_function.sql   # Creates execute_sql() RPC in Supabase
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main UI: graph + chat panel
│   │   └── main.jsx       # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── sessions/
│   └── claude_session.md  # AI coding session transcript
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free)
- A [Groq](https://console.groq.com) API key (free)

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com) (region: Southeast Asia)
2. Go to **SQL Editor** → run `backend/schema.sql` (creates all 17 tables)
3. Go to **SQL Editor** → run `backend/rpc_function.sql` (creates safe SQL executor)
4. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
PORT=3001
```

Seed the database (update `DATA_DIR` in `seed.js` to point to your dataset):
```bash
node seed.js
```

Start the server:
```bash
node index.js
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Fill in `.env`:
```
VITE_API_URL=http://localhost:3001
```

Start dev server:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Get Groq API Key

- Go to [console.groq.com](https://console.groq.com)
- Sign up → API Keys → Create new key (free, no credit card)

---

## Deployment

### Backend → Render
1. Push to GitHub
2. New Web Service → connect repo → root directory: `backend`
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add environment variables in Render dashboard

### Frontend → Vercel
1. New Project → connect repo → root directory: `frontend`
2. Add environment variable: `VITE_API_URL` = your Render backend URL
3. Deploy

---

## Example Queries

| Query | What it does |
|---|---|
| Which products are in the most billing documents? | Aggregates billing_document_items by material |
| Trace the full flow for billing document 90504298 | JOINs across SO → Delivery → Billing → Journal → Payment |
| Show sales orders delivered but not billed | LEFT JOIN with NULL check on billing side |
| Which customers have the highest total order value? | SUM on sales_order_headers grouped by sold_to_party |
| Show cancelled billing documents | Filters billing_document_is_cancelled = 'X' |
| What was the total payment amount in April 2025? | SUM on payments filtered by posting_date |

---

## AI Tools Used

This project was built using **Claude (claude.ai)** as the primary AI coding assistant.

Session logs are available in `/sessions/claude_session.md` — these include the full conversation covering architecture decisions, debugging, and iteration.