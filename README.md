# Resort Sales Intelligence Assistant

A React Native mobile app paired with a Node.js backend for exploring resort sales data from an Excel workbook. The app supports secure login, business-question answering, and conversation history.

## What the app does

- Loads resort sales data from the Excel workbook into SQLite
- Answers business questions through a backend SQL-based assistant
- Shows a modern login screen and a home screen in the mobile app
- Supports secure backend authentication for approved users
- Keeps chat history in the app and backend for the current session

## Tech stack

- Frontend: React Native + Expo
- Backend: Node.js + Express
- Database: SQLite
- Data source: Excel (.xlsx)

## Project structure

```text
backend/
  src/
    assistant.js
    db.js
    server.js
  data/
    RayTech_Italy_Resort_Sales_Dataset.xlsx
    resort_sales.db
mobile/
  App.js
  components/
    LoginScreen.js
    HomeScreen.js
```

## Run locally

### Backend

```bash
cd backend
npm install
npm start
```

The API will run at http://localhost:3000.

### Mobile

```bash
cd mobile
npm install
npm start
```

## Demo login

Use one of these approved credentials:

- Email: admin@resort.com
- Password: Resort@2026

- Email: manager@resort.com
- Password: Manager@2026

## API endpoints

- GET /health
- POST /auth/login
- POST /api/question
- GET /history
- POST /history/clear

## Example questions

The assistant currently supports questions such as:

- Which sales representative generated the most revenue?
- Which resort has the highest lead-to-sale conversion rate?
- What are the most common reasons leads are lost?
- Which representatives have overdue follow-ups?
- How does this month compare with the previous month?
- How many bookings do we have?
- Show leads by source

## Notes

The Excel workbook is ingested into SQLite once and then queried by the backend rather than pasting the full dataset into prompts.