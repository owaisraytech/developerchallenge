# Multi-Tenant Scaling Architecture

This document explains how the Resort Sales Intelligence Assistant scales to support multiple resort companies with isolated data.

## Current Single-Company Model

```
RayTech (Italy resorts)
    ↓
Excel Workbook (RayTech_Italy_Resort_Sales_Dataset.xlsx)
    ↓
SQLite Database (resort_sales.db)
    ↓
Express API (http://localhost:3000)
    ↓
React Native Mobile App
```

**Limitation**: One Excel file → one database → one company.

## Multi-Company Scaling Patterns

### Pattern 1: Shared Database with Row-Level Security (RLS)

**Best for**: 10–100 companies with moderate data volumes.

```
┌─────────────────────────────────────────────────┐
│       PostgreSQL Database (Shared)              │
│                                                 │
│  ┌────────────────────────────────────────┐   │
│  │ resorts       (company_id, name, ...)  │   │
│  │ representatives (company_id, name, ..) │   │
│  │ leads         (company_id, lead_id, ..)│   │
│  │ deals         (company_id, amount, ...)│   │
│  └────────────────────────────────────────┘   │
│                                                 │
│  Row-Level Security Policy:                     │
│  CREATE POLICY company_isolation                │
│  ON resorts                                      │
│  USING (company_id = current_setting(...))     │
└─────────────────────────────────────────────────┘
        ↑
    Express API (with auth middleware)
        ↑
   Mobile App
   (sends JWT token → company_id extracted)
```

**Implementation**:

1. Add `company_id` column to all tables:
```sql
ALTER TABLE resorts ADD COLUMN company_id TEXT NOT NULL;
ALTER TABLE representatives ADD COLUMN company_id TEXT NOT NULL;
ALTER TABLE leads ADD COLUMN company_id TEXT NOT NULL;
ALTER TABLE deals ADD COLUMN company_id TEXT NOT NULL;

CREATE INDEX idx_resorts_company ON resorts(company_id);
CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_deals_company ON deals(company_id);
```

2. Update queries to filter by company:
```javascript
// In db.js
async function query(sql, params = [], companyId) {
  // Ensure all queries include company filter
  const filtered = sql.replace(
    /FROM (\w+)/g,
    `FROM $1 WHERE company_id = '${companyId}'`
  );
  // Execute filtered query
}
```

3. Add auth middleware in Express:
```javascript
// In server.js
const authenticateCompany = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, SECRET);
  req.companyId = decoded.companyId; // Extract from JWT
  next();
};

app.post('/api/question', authenticateCompany, async (req, res) => {
  const result = await answerQuestion(req.body.question, req.companyId);
  res.json(result);
});
```

**Pros**:
- Single database ✅
- Easy to maintain queries
- Fast cross-company analytics possible
- Row-level security adds safety layer

**Cons**:
- Requires careful RLS policy design
- One database outage affects all companies
- Disk/CPU shared (noisy neighbor problem)

---

### Pattern 2: Separate Database per Company

**Best for**: 5–50 companies, strong isolation requirements.

```
Company A               Company B               Company C
    ↓                       ↓                       ↓
SQLite: company_a.db   SQLite: company_b.db   SQLite: company_c.db
    ↑                       ↑                       ↑
    └─────────────┬─────────┴─────────┬────────────┘
                  │                   │
              Express API (with routing logic)
                  ↑
             Mobile App
```

**Implementation**:

```javascript
// In db.js
const dbConnections = {
  'raytech-italy': './data/raytech_italy.db',
  'costa-resorts': './data/costa_resorts.db',
  'alpine-hotels': './data/alpine_hotels.db',
};

function getDatabase(companyId) {
  const dbPath = dbConnections[companyId];
  if (!dbPath) throw new Error(`Company ${companyId} not found`);
  return new sqlite3.Database(dbPath);
}

async function query(sql, params = [], companyId) {
  const db = getDatabase(companyId);
  // Execute query on company-specific database
  const rows = await all(db, sql, params);
  db.close();
  return rows;
}
```

**Ingestion**:

```javascript
// Load each company's Excel file separately
async function ingestCompanyData(companyId, excelPath) {
  const db = getDatabase(companyId);
  
  // Clear existing data
  await run(db, "DELETE FROM deals");
  await run(db, "DELETE FROM leads");
  // ... etc
  
  // Read Excel and ingest
  const resortRows = readSheetRows(excelPath, "Resorts");
  for (const row of resortRows) {
    await run(db, "INSERT INTO resorts (...) VALUES (...)", [...]);
  }
  
  db.close();
}
```

**Pros**:
- Complete data isolation ✅
- Company A's database failure doesn't affect Company B
- Easy to scale: just add new database file
- Simple backup/restore per company

**Cons**:
- Query duplication (same logic in each company DB)
- No cross-company analytics
- Storage overhead (multiple databases)
- Harder to maintain schema migrations

---

### Pattern 3: Hybrid (PostgreSQL Multi-Schema) — Recommended for Production

**Best for**: 50+ companies, enterprise-scale requirements.

```
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Cluster (Multi-Schema)              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ schema: raytech_italy │ schema: costa_resorts │  ...    │
│  │                      │                        │           │
│  │ resorts (no co_id)   │ resorts (no co_id)    │           │
│  │ representatives      │ representatives       │           │
│  │ leads                │ leads                 │           │
│  │ deals                │ deals                 │           │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  Search path: SET search_path TO schema_name;              │
│  Row-Level Security (additional safety layer)              │
└─────────────────────────────────────────────────────────────┘
        ↑
    Express API (with schema routing)
        ↑
   Mobile App (JWT → company → schema)
```

**Implementation**:

```javascript
// In db.js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getSchemaConnection(companyId) {
  const schemaMap = {
    'raytech-italy': 'raytech_italy',
    'costa-resorts': 'costa_resorts',
    'alpine-hotels': 'alpine_hotels',
  };
  
  const schema = schemaMap[companyId];
  const client = await pool.connect();
  
  // Route all queries to correct schema
  await client.query(`SET search_path TO ${schema}`);
  
  return client;
}

async function query(sql, params = [], companyId) {
  const client = await getSchemaConnection(companyId);
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}
```

**Ingestion**:

```javascript
async function setupCompanySchema(companyId, excelPath) {
  const schemaName = `${companyId}_schema`;
  const client = await pool.connect();
  
  try {
    // Create schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);
    
    // Create tables (same DDL for each schema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS resorts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT,
        region TEXT
      );
      -- ... other tables
    `);
    
    // Ingest data from Excel
    const resortRows = readSheetRows(excelPath, "Resorts");
    for (const row of resortRows) {
      await client.query(
        "INSERT INTO resorts (id, name, city, region) VALUES ($1, $2, $3, $4)",
        [row.resort_id, row.resort_name, row.city, row.region]
      );
    }
  } finally {
    client.release();
  }
}
```

**Pros**:
- Single Postgres instance (cost-efficient)
- Complete schema isolation (like separate DBs)
- Shared infrastructure (easier backup, monitoring)
- Easy horizontal scaling (read replicas)
- Cross-company analytics possible (select across schemas)

**Cons**:
- More complex setup
- Postgres knowledge required
- Schema migrations must be scripted

---

## Deployment Architecture

### Single Company (Current)

```
Developer Machine / Server
    ↓
Node.js (Express) + SQLite
    ↓
React Native App
```

### Multi-Company Production

```
┌─────────────────────────────────────────────────┐
│           Load Balancer (nginx/HAProxy)         │
│  Distributes requests to backend instances      │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┬────────────┬────────────┐
    │                 │            │            │
┌───┴───┐          ┌──┴──┐    ┌───┴──┐    ┌────┴───┐
│ Node  │          │Node │    │ Node │    │  Node  │
│ 1     │          │  2  │    │  3   │    │   4    │
└───┬───┘          └──┬──┘    └───┬──┘    └────┬───┘
    │                 │            │            │
    └─────────────────┴────┬───────┴────────────┘
                          │
                   ┌──────┴──────┐
                   │  PostgreSQL │
                   │   Cluster   │
                   │(multi-schema)
                   └─────────────┘
                          ↑
                 (Master-Replica Setup)
```

## Switching Companies at Runtime

The mobile app sends a JWT token with company context:

```javascript
// Mobile (App.js)
const token = await getToken(); // { companyId: 'raytech-italy', ... }

const sendQuestion = async (question) => {
  const response = await fetch(`${API_BASE_URL}/api/question`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
  
  const data = await response.json();
  setHistory([...history, data.entry]);
};
```

Backend extracts company from token:

```javascript
// Backend (server.js)
const authenticateCompany = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  req.companyId = decoded.companyId;
  req.userId = decoded.userId;
  
  next();
};

app.post('/api/question', authenticateCompany, async (req, res) => {
  const result = await answerQuestion(
    req.body.question,
    req.companyId  // Pass company context to queries
  );
  res.json({ entry: result, history: getHistory(req.companyId) });
});
```

## Data Migration & Onboarding

When a new resort company (e.g., "Alpine Hotels") joins:

1. **Prepare their Excel file** (`alpine_hotels_sales.xlsx`)
2. **Run ingestion script**:
```bash
node scripts/ingest.js --company=alpine-hotels --file=/path/to/alpine_hotels_sales.xlsx
```

3. **Create company record** in auth system:
```json
{
  "companyId": "alpine-hotels",
  "companyName": "Alpine Hotels",
  "adminEmail": "admin@alpinehotels.it",
  "schema": "alpine_hotels",  // if using multi-schema
  "database": "./data/alpine_hotels.db"  // if using separate DB
}
```

4. **Users at Alpine Hotels** log in with credentials → receive JWT with `companyId: 'alpine-hotels'` → all their queries see only their data

## Security Considerations

1. **Always validate company context** — don't trust client input
2. **Row-Level Security** — database-level enforcement (defense in depth)
3. **Schema isolation** — separate namespace per company (filesystem-level)
4. **Encrypted connections** — TLS between app ↔ API ↔ database
5. **Audit logging** — log all data access per company
6. **Rate limiting** — per-company rate limits to prevent abuse

## Monitoring & Observability

```javascript
// Log all queries with company context
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log({
      timestamp: new Date().toISOString(),
      companyId: req.companyId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});
```

## Recommendation

**For the Resort Sales Intelligence Assistant:**

- **MVP (1–3 companies)**: Use Pattern 2 (Separate SQLite per company) — simple, easy to deploy
- **Growth (10+ companies)**: Migrate to Pattern 3 (PostgreSQL Multi-Schema) — best balance of scale and simplicity
- **Enterprise (100+ companies)**: Use Pattern 1 (Shared Database + RLS) with read replicas for analytics
