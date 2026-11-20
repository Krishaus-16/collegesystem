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

## Deploy to Vercel

1. Push this repository to GitHub and import `Krishaus-16/collegesystem` from the Vercel dashboard.
2. Keep the project root as the Root Directory. Vercel serves the static frontend and deploys the handlers in `api/` as serverless functions; no custom build command or output directory is needed.
3. In the Vercel project settings, add these environment variables for Production (and Preview if needed):
   - `MONGODB_URI` - a current MongoDB Atlas connection string. Rotate any password that has been shared or exposed, and enter the replacement directly in Vercel settings.
   - `MONGODB_DB` - `collegesystem` (or your chosen database)
   - `MONGODB_COLLECTION` - `complaints`
4. In Atlas Network Access, allow connections from your deployment. For production, use an appropriate fixed-egress/network setup rather than opening database access broadly.
5. Redeploy after adding environment variables, then verify `https://<your-vercel-domain>/api/health` returns `status: ok`.

Do not upload `.env` to GitHub or Vercel. The Vercel deployment uses the same REST endpoints as the local app, implemented as serverless functions under `api/`.

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
- `api/` - Vercel serverless API handlers and shared MongoDB connection
- `vercel.json` - Vercel static-site configuration
- `.env.example` - MongoDB connection configuration template

## Data note

On first startup, the API creates a unique index on complaint IDs and inserts sample records if the MongoDB collection is empty. If a legacy `data/complaints.json` exists, its records are imported instead. Never commit your `.env` file or expose Atlas credentials. The app does not include authentication or role-based authorization, so do not expose it publicly or use it for sensitive records without adding those controls. Set `PORT` to change the web server port.

## API

- `GET /api/complaints` - list all complaints
- `GET /api/complaints/:id` - find one complaint by ID
- `POST /api/complaints` - create a complaint (the server assigns its ID and priority)
- `PATCH /api/complaints/:id` - update its status
- `GET /api/health` - API health check
