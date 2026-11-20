# CampusCare

A responsive college complaint management app with a Node.js REST API and MongoDB persistence. It includes a student submission and tracking portal, an admin dashboard with filters and status updates, and deterministic local rules for category and priority suggestions. No paid AI API is required.

## Run locally

1. Open a terminal in this folder.
2. Install a MongoDB server locally, or create a MongoDB Atlas cluster and obtain its connection string.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. The defaults connect to local MongoDB at `mongodb://127.0.0.1:27017`.
4. With Node.js installed, install dependencies and start the web server and API:

   ```powershell
   npm install
   npm start
   ```

5. Open `http://localhost:5173` in your browser.

Run the app through the server so its API is available to the browser.

## Features

- Student portal form with required-field validation and automatic unique complaint IDs.
- Recent submissions and complaint lookup by ID.
- Local keyword-based category suggestions in the browser and priority scoring on the server; no external AI service is used.
- Admin overview with total, pending, in-progress, and resolved counts.
- Category and status filters, plus editable status selectors.
- Complaint data is stored in MongoDB in the database and collection configured by `MONGODB_DB` and `MONGODB_COLLECTION`.
- Responsive layout for desktop and mobile.

## Project files

- `index.html` - page structure and forms
- `styles.css` - responsive visual design
- `app.js` - frontend validation, local category suggestions, and API interactions
- `server.js` - static file server and MongoDB-backed REST API
- `.env.example` - MongoDB connection configuration template

## Data note

On first startup, the API creates a unique index on complaint IDs and inserts sample records if the MongoDB collection is empty. If a legacy `data/complaints.json` exists, its records are imported instead. Never commit your `.env` file or expose Atlas credentials. The app does not include authentication or role-based authorization, so do not expose it publicly or use it for sensitive records without adding those controls. Set `PORT` to change the web server port.

## API

- `GET /api/complaints` - list all complaints
- `GET /api/complaints/:id` - find one complaint by ID
- `POST /api/complaints` - create a complaint (the server assigns its ID and priority)
- `PATCH /api/complaints/:id` - update its status
- `GET /api/health` - API health check
