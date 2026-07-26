const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const databasePath = path.join(__dirname, "..", "data", "resort_sales.db");

function connect() {
  return new sqlite3.Database(databasePath);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve(this);
      }
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
}

function findWorkbookPath() {
  const dataDir = path.join(__dirname, "..", "data");
  const workbookFile = fs
    .readdirSync(dataDir)
    .find((file) => /RayTech_Italy/i.test(file) && /\.(xlsx|xls)$/i.test(file));

  if (!workbookFile) {
    throw new Error("No RayTech Excel workbook found in the backend data folder.");
  }

  return path.join(dataDir, workbookFile);
}

function normalizeDate(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  return text.split(" ")[0];
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return "";
}

function normalizeLeadStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (["won", "converted", "closed", "confirmed", "booked"].includes(normalized)) {
    return "Converted";
  }

  if (["lost", "cancelled", "rejected", "no response", "timing", "price", "budget"].includes(normalized)) {
    return "Lost";
  }

  return "Open";
}

function readSheetRows(sheetName) {
  const workbook = XLSX.readFile(findWorkbookPath());
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

async function initializeDatabase() {
  const db = connect();

  await new Promise((resolve, reject) => {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS representatives (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          region TEXT,
          managerEmail TEXT
        );

        CREATE TABLE IF NOT EXISTS resorts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          city TEXT,
          region TEXT
        );

        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          resortId TEXT NOT NULL,
          representativeId TEXT NOT NULL,
          source TEXT,
          status TEXT,
          leadDate TEXT,
          followUpDate TEXT,
          lossReason TEXT
        );

        CREATE TABLE IF NOT EXISTS deals (
          id TEXT PRIMARY KEY,
          leadId TEXT NOT NULL,
          resortId TEXT NOT NULL,
          representativeId TEXT NOT NULL,
          amount REAL NOT NULL,
          closedDate TEXT NOT NULL
        );
      `,
      (error) => (error ? reject(error) : resolve())
    );
  });

  await run(db, "DELETE FROM deals");
  await run(db, "DELETE FROM leads");
  await run(db, "DELETE FROM resorts");
  await run(db, "DELETE FROM representatives");

  const resortRows = readSheetRows("Resorts");
  const resortLookup = new Map();

  for (const row of resortRows) {
    const id = String(getValue(row, ["resort_id", "id"]) || "").trim();
    const name = String(getValue(row, ["resort_name", "name"]) || "").trim();
    const city = String(getValue(row, ["city"]) || "").trim();
    const region = String(getValue(row, ["country", "region"]) || "").trim();

    if (!id || !name) {
      continue;
    }

    resortLookup.set(id, { city, region });
    await run(
      db,
      "INSERT INTO resorts (id, name, city, region) VALUES (?, ?, ?, ?)",
      [id, name, city, region]
    );
  }

  const representativeRows = readSheetRows("Sales Reps");
  for (const row of representativeRows) {
    const id = String(getValue(row, ["rep_id", "id"]) || "").trim();
    const name = String(getValue(row, ["rep_name", "name"]) || "").trim();
    const homeResortId = String(getValue(row, ["home_resort_id", "resort_id"]) || "").trim();
    const resortInfo = resortLookup.get(homeResortId) || {};
    const region = resortInfo.city || resortInfo.region || "";

    if (!id || !name) {
      continue;
    }

    await run(
      db,
      "INSERT INTO representatives (id, name, region, managerEmail) VALUES (?, ?, ?, ?)",
      [id, name, region, ""]
    );
  }

  const leadRows = readSheetRows("Leads");
  for (const row of leadRows) {
    const id = String(getValue(row, ["lead_id", "id"]) || "").trim();
    const resortId = String(getValue(row, ["resort_id"]) || "").trim();
    const representativeId = String(getValue(row, ["rep_id"]) || "").trim();
    const source = String(getValue(row, ["source"]) || "").trim();
    const leadDate = normalizeDate(getValue(row, ["created_at", "leadDate"]) || "");
    const followUpDate = normalizeDate(getValue(row, ["next_followup_date", "followUpDate"]) || "");
    const status = normalizeLeadStatus(getValue(row, ["status"]) || "");
    const lossReason = String(getValue(row, ["loss_reason"]) || "").trim();

    if (!id) {
      continue;
    }

    await run(
      db,
      "INSERT INTO leads (id, resortId, representativeId, source, status, leadDate, followUpDate, lossReason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, resortId, representativeId, source, status, leadDate, followUpDate, lossReason]
    );
  }

  const dealRows = readSheetRows("Sales");
  for (const row of dealRows) {
    const id = String(getValue(row, ["sale_id", "id"]) || "").trim();
    const leadId = String(getValue(row, ["lead_id"]) || "").trim();
    const resortId = String(getValue(row, ["resort_id"]) || "").trim();
    const representativeId = String(getValue(row, ["rep_id"]) || "").trim();
    const amount = Number(getValue(row, ["net_value_usd", "amount", "gross_value_usd"]) || 0);
    const closedDate = normalizeDate(getValue(row, ["closed_date", "closedDate"]) || "");

    if (!id) {
      continue;
    }

    await run(
      db,
      "INSERT INTO deals (id, leadId, resortId, representativeId, amount, closedDate) VALUES (?, ?, ?, ?, ?, ?)",
      [id, leadId, resortId, representativeId, amount, closedDate]
    );
  }

  await new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
}

async function query(sql, params = []) {
  const db = connect();
  const rows = await all(db, sql, params);
  await new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
  return rows;
}

module.exports = {
  initializeDatabase,
  query,
};
