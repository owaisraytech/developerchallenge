const { query } = require("./db");

function normalizeQuestion(question) {
  return question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

async function answerQuestion(question) {
  const normalized = normalizeQuestion(question);

  if (normalized.includes("most revenue") || (normalized.includes("revenue") && normalized.includes("representative"))) {
    const rows = await query(`
      SELECT r.name AS representative_name, SUM(d.amount) AS revenue
      FROM deals d
      JOIN representatives r ON d.representativeId = r.id
      GROUP BY r.id
      ORDER BY revenue DESC
      LIMIT 3
    `);

    const top = rows[0];
    return {
      type: "repRevenue",
      answer: `The top revenue generator is ${top.representative_name} with ${formatCurrency(top.revenue)} in closed deals.`,
      supportingFigures: rows.map((row) => ({ label: row.representative_name, value: formatCurrency(row.revenue) })),
      records: rows,
    };
  }

  if (normalized.includes("conversion rate") || normalized.includes("lead to sale") || normalized.includes("lead-to-sale")) {
    const rows = await query(`
      SELECT res.name AS resort_name,
             COUNT(l.id) AS total_leads,
             SUM(CASE WHEN l.status = 'Converted' THEN 1 ELSE 0 END) AS conversions,
             ROUND(100.0 * SUM(CASE WHEN l.status = 'Converted' THEN 1 ELSE 0 END) / COUNT(l.id), 1) AS conversion_rate
      FROM resorts res
      LEFT JOIN leads l ON l.resortId = res.id
      GROUP BY res.id
      ORDER BY conversion_rate DESC, total_leads DESC
      LIMIT 3
    `);

    const top = rows[0];
    return {
      type: "conversionRate",
      answer: `${top.resort_name} has the highest lead-to-sale conversion rate at ${top.conversion_rate}% with ${top.conversions} conversions out of ${top.total_leads} leads.`,
      supportingFigures: rows.map((row) => ({ label: row.resort_name, value: `${row.conversion_rate}% (${row.conversions}/${row.total_leads})` })),
      records: rows,
    };
  }

  if (normalized.includes("lost") && normalized.includes("reason")) {
    const rows = await query(`
      SELECT lossReason AS reason, COUNT(*) AS count
      FROM leads
      WHERE status = 'Lost' AND lossReason IS NOT NULL AND lossReason != ''
      GROUP BY lossReason
      ORDER BY count DESC
      LIMIT 5
    `);

    return {
      type: "lostReasons",
      answer: `The most common loss reasons are ${rows.map((row) => `${row.reason} (${row.count})`).join(", ")}.`,
      supportingFigures: rows.map((row) => ({ label: row.reason, value: `${row.count} lost leads` })),
      records: rows,
    };
  }

  if (normalized.includes("overdue") && normalized.includes("follow")) {
    const rows = await query(`
      SELECT l.id AS lead_id,
             r.name AS representative_name,
             res.name AS resort_name,
             l.followUpDate,
             l.status
      FROM leads l
      JOIN representatives r ON l.representativeId = r.id
      JOIN resorts res ON l.resortId = res.id
      WHERE l.followUpDate < ? AND l.status NOT IN ('Converted', 'Lost')
      ORDER BY l.followUpDate ASC
      LIMIT 5
    `, [new Date().toISOString().slice(0, 10)]);

    return {
      type: "overdueFollowUps",
      answer: `There are ${rows.length} overdue follow-ups waiting for action.`,
      supportingFigures: rows.map((row) => ({ label: row.representative_name, value: `${row.resort_name} • ${row.followUpDate}` })),
      records: rows,
    };
  }

  if (normalized.includes("this month") || normalized.includes("previous month") || normalized.includes("monthly")) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentStart = new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10);
    const currentEnd = new Date(currentYear, currentMonth + 1, 1).toISOString().slice(0, 10);
    const previousStart = new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10);
    const previousEnd = currentStart;

    const currentMonthRows = await query(`SELECT SUM(amount) AS revenue FROM deals WHERE closedDate >= ? AND closedDate < ?`, [currentStart, currentEnd]);
    const previousMonthRows = await query(`SELECT SUM(amount) AS revenue FROM deals WHERE closedDate >= ? AND closedDate < ?`, [previousStart, previousEnd]);

    const currentRevenue = Number(currentMonthRows[0].revenue || 0);
    const previousRevenue = Number(previousMonthRows[0].revenue || 0);
    const delta = currentRevenue - previousRevenue;

    return {
      type: "monthlyComparison",
      answer: `This month generated ${formatCurrency(currentRevenue)}, compared with ${formatCurrency(previousRevenue)} last month. The change is ${delta >= 0 ? "up" : "down"} by ${formatCurrency(Math.abs(delta))}.`,
      supportingFigures: [
        { label: "This month", value: formatCurrency(currentRevenue) },
        { label: "Previous month", value: formatCurrency(previousRevenue) },
        { label: "Difference", value: `${delta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))}` },
      ],
      records: [
        { label: "Current month", revenue: currentRevenue },
        { label: "Previous month", revenue: previousRevenue },
      ],
    };
  }

  // Bookings / Sales related questions
  if (normalized.includes("booking") || normalized.includes("bookings") || (normalized.includes("sales") && normalized.includes("count"))) {
    // total bookings and revenue
    const totalRows = await query(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue FROM deals`);
    const count = Number(totalRows[0].count || 0);
    const revenue = Number(totalRows[0].revenue || 0);

    return {
      type: "bookingsSummary",
      answer: `There are ${count} bookings with total revenue of ${formatCurrency(revenue)}.`,
      supportingFigures: [
        { label: "Total bookings", value: String(count) },
        { label: "Total revenue", value: formatCurrency(revenue) },
      ],
      records: [{ bookings: count, revenue }],
    };
  }

  if ((normalized.includes("booking") || normalized.includes("bookings")) && normalized.includes("resort")) {
    // bookings by resort
    const rows = await query(`
      SELECT res.name AS resort_name, COUNT(d.id) AS bookings, COALESCE(SUM(d.amount),0) AS revenue
      FROM deals d
      JOIN resorts res ON d.resortId = res.id
      GROUP BY res.id
      ORDER BY bookings DESC
      LIMIT 5
    `);

    return {
      type: "bookingsByResort",
      answer: `${rows[0]?.resort_name || 'N/A'} has the most bookings (${rows[0]?.bookings || 0}).`,
      supportingFigures: rows.map((r) => ({ label: r.resort_name, value: `${r.bookings} bookings • ${formatCurrency(r.revenue)}` })),
      records: rows,
    };
  }

  // Leads / bookings by status
  if (normalized.includes("status") && (normalized.includes("lead") || normalized.includes("leads") || normalized.includes("booking") || normalized.includes("bookings"))) {
    const rows = await query(`SELECT status, COUNT(*) AS count FROM leads GROUP BY status ORDER BY count DESC`);

    return {
      type: "leadsByStatus",
      answer: `Lead counts by status: ${rows.map((r) => `${r.status} (${r.count})`).join(", ")}.`,
      supportingFigures: rows.map((r) => ({ label: r.status, value: `${r.count}` })),
      records: rows,
    };
  }

  // Leads by source
  if (normalized.includes("source") || (normalized.includes("leads") && normalized.includes("source")) || normalized.includes("by source")) {
    const rows = await query(`SELECT source, COUNT(*) AS count FROM leads WHERE source IS NOT NULL AND source != '' GROUP BY source ORDER BY count DESC LIMIT 5`);

    return {
      type: "leadsBySource",
      answer: `Top lead sources: ${rows.map((r) => `${r.source} (${r.count})`).join(", ")}.`,
      supportingFigures: rows.map((r) => ({ label: r.source, value: `${r.count} leads` })),
      records: rows,
    };
  }

  return {
    type: "fallback",
    answer: "I can help with revenue leaders, conversion rates, lost-reason analysis, overdue follow-ups, and month-over-month trends.",
    supportingFigures: [],
    records: [],
  };
}

module.exports = {
  answerQuestion,
};
