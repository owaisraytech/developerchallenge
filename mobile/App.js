import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import LoginScreen from "./components/LoginScreen";
import HomeScreen from "./components/HomeScreen";

const API_BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
const HISTORY_LIMIT = 10;
const sampleQuestions = [
  "Which sales representative generated the most revenue?",
  "Which resort has the highest lead-to-sale conversion rate?",
  "What are the most common reasons leads are lost?",
  "Which representatives have overdue follow-ups?",
  "How does this month compare with the previous month?",
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyTruncated, setHistoryTruncated] = useState(false);

  const limitHistory = (items) => {
    const limited = items.slice(-HISTORY_LIMIT);
    setHistoryTruncated(items.length > HISTORY_LIMIT);
    return limited;
  };

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    fetch(`${API_BASE_URL}/history`)
      .then((response) => response.json())
      .then((data) => setHistory(limitHistory(data.history || [])))
      .catch(() => setHistory([]));
  }, [isLoggedIn]);

  const clearHistory = async () => {
    try {
      await fetch(`${API_BASE_URL}/history/clear`, { method: "POST" });
    } catch (error) {
      console.error("Unable to clear history on server", error);
    }

    setHistory([]);
    setHistoryTruncated(false);
  };

  const sendQuestion = async (value) => {
    const nextQuestion = value || question;
    if (!nextQuestion.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion }),
      });
      const data = await response.json();
      if (data.entry) {
        setHistory((prevHistory) => limitHistory([...prevHistory, data.entry]));
      }
      setQuestion("");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({
          email: data.error || "Access denied.",
          password: data.error || "Access denied.",
        });
        return;
      }

      setIsLoggedIn(true);
      setErrors({});
    } catch (error) {
      setErrors({
        email: "Unable to reach the server.",
        password: "Unable to reach the server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
    setErrors({});
  };

  if (!isLoggedIn) {
    return (
      <LoginScreen
        email={email}
        password={password}
        errors={errors}
        isSubmitting={isSubmitting}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <HomeScreen
      email={email.trim().toLowerCase()}
      question={question}
      history={history}
      loading={loading}
      historyTruncated={historyTruncated}
      onLogout={handleLogout}
      onClearHistory={clearHistory}
      onQuestionChange={setQuestion}
      onSendQuestion={sendQuestion}
      sampleQuestions={sampleQuestions}
    />
  );
}

