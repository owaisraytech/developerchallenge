const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { initializeDatabase } = require("./db");
const { answerQuestion } = require("./assistant");

const app = express();
app.use(cors());
app.use(express.json());

const conversationHistory = [];
const approvedUsers = [
  { email: "admin@resort.com", password: "Resort@2026" },
  { email: "manager@resort.com", password: "Manager@2026" },
];

async function bootstrap() {
  await initializeDatabase();
  console.log("Database ready");
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/history", (_req, res) => {
  res.json({ history: conversationHistory });
});

app.post("/auth/login", (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  const password = req.body?.password;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const isAuthorized = approvedUsers.some(
    (user) => user.email === email && user.password === password
  );

  if (!isAuthorized) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  return res.json({
    success: true,
    message: "Login successful",
    user: { email },
  });
});

app.post("/history/clear", (_req, res) => {
  conversationHistory.length = 0;
  res.json({ history: [] });
});

app.post("/api/question", async (req, res) => {
  const question = req.body?.question?.trim();

  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  const result = await answerQuestion(question);
  const entry = {
    id: uuidv4(),
    question,
    answer: result.answer,
    supportingFigures: result.supportingFigures,
    records: result.records,
    timestamp: new Date().toISOString(),
  };

  conversationHistory.push(entry);

  return res.json({ entry });
});

app.listen(3000, () => {
  console.log("API listening on http://localhost:3000");
});
