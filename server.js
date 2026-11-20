const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const root = __dirname;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const databaseName = process.env.MONGODB_DB || 'campuscare';
const collectionName = process.env.MONGODB_COLLECTION || 'complaints';
const categories = ['Classroom', 'Wi-Fi', 'Drinking water', 'Laboratory equipment', 'Washroom', 'Hostel maintenance', 'Other'];
const statuses = ['Pending', 'In Progress', 'Resolved'];
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
let mongoClient = new MongoClient(mongoUri);
let complaintsCollection;
let mongoConnected = false;

function demoComplaints() {
  const now = Date.now();
  return [
    { id: 'CMP-20261118-0041', name: 'Aarav Mehta', department: 'Engineering', category: 'Wi-Fi', description: 'Wi-Fi connection keeps dropping in the engineering block, especially on the second floor.', priority: 'High', status: 'In Progress', createdAt: new Date(now - 30 * 60 * 60 * 1000).toISOString() },
    { id: 'CMP-20261119-0042', name: 'Sana Iqbal', department: 'Science', category: 'Laboratory equipment', description: 'The microscope in lab 3 has a damaged focus knob and cannot be used for class.', priority: 'High', status: 'Pending', createdAt: new Date(now - 13 * 60 * 60 * 1000).toISOString() },
    { id: 'CMP-20261119-0043', name: 'Rohan Das', department: 'Business', category: 'Drinking water', description: 'Water dispenser near the library is empty and the refill button is not working.', priority: 'Medium', status: 'Resolved', createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString() },
    { id: 'CMP-20261120-0044', name: 'Nisha Patel', department: 'Computer Science', category: 'Washroom', description: 'The washroom sink on the ground floor is leaking and water is pooling by the door.', priority: 'Medium', status: 'Pending', createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() }
  ];
}

async function connectToMongo() {
  try {
    await mongoClient.connect();
  } catch (error) {
    if (process.platform !== 'win32' || !mongoUri.startsWith('mongodb+srv://') || error.code !== 'ECONNREFUSED') throw error;
    await mongoClient.close().catch(() => {});
    const seedListUri = resolveAtlasSeedListUri();
    mongoClient = new MongoClient(seedListUri);
    await mongoClient.connect();
    console.warn('Atlas SRV lookup used the Windows DNS fallback.');
  }
  const database = mongoClient.db(databaseName);
  complaintsCollection = database.collection(collectionName);
  await complaintsCollection.createIndex({ id: 1 }, { unique: true });
  if (await complaintsCollection.estimatedDocumentCount() === 0) {
    let initialData = demoComplaints();
    try {
      const legacyData = JSON.parse(await fs.readFile(path.join(root, 'data', 'complaints.json'), 'utf8'));
      if (Array.isArray(legacyData) && legacyData.length) initialData = legacyData;
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    await complaintsCollection.insertMany(initialData);
  }
  mongoConnected = true;
}

function resolveAtlasSeedListUri() {
  const parsedUri = new URL(mongoUri);
  const script = [
    '$hostName = $env:ATLAS_DNS_HOST',
    '$srvRecords = @(Resolve-DnsName -Name ("_mongodb._tcp." + $hostName) -Type SRV -ErrorAction Stop | Where-Object { $_.Type -eq "SRV" } | ForEach-Object { [pscustomobject]@{ host = $_.NameTarget.TrimEnd("."); port = $_.Port } })',
    '$txtRecords = @(Resolve-DnsName -Name $hostName -Type TXT -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "TXT" } | ForEach-Object { $_.Strings -join "" })',
    '[pscustomobject]@{ srv = $srvRecords; txt = $txtRecords } | ConvertTo-Json -Compress -Depth 4'
  ].join('; ');
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ATLAS_DNS_HOST: parsedUri.hostname }
  });
  const dnsRecords = JSON.parse(output.trim());
  const srvRecords = Array.isArray(dnsRecords.srv) ? dnsRecords.srv : [dnsRecords.srv].filter(Boolean);
  const txtRecords = Array.isArray(dnsRecords.txt) ? dnsRecords.txt : [dnsRecords.txt].filter(Boolean);
  if (!srvRecords.length) throw new Error('Windows DNS returned no MongoDB Atlas SRV records.');

  const rawAuthority = mongoUri.slice(mongoUri.indexOf('//') + 2).split(/[/?#]/, 1)[0];
  const userInfo = rawAuthority.includes('@') ? `${rawAuthority.slice(0, rawAuthority.lastIndexOf('@'))}@` : '';
  const options = new URLSearchParams();
  for (const record of txtRecords) {
    for (const [key, value] of new URLSearchParams(record)) {
      if (!options.has(key)) options.set(key, value);
    }
  }
  for (const [key, value] of parsedUri.searchParams) options.set(key, value);
  if (!options.has('tls') && !options.has('ssl')) options.set('tls', 'true');
  const hosts = srvRecords.map((record) => `${record.host}:${record.port}`).join(',');
  const suffix = `${parsedUri.pathname}${options.size ? `?${options.toString()}` : ''}`;
  return `mongodb://${userInfo}${hosts}${suffix}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function suggestedPriority(description) {
  const text = description.toLowerCase();
  const highPriorityWords = ['urgent', 'danger', 'emergency', 'injury', 'unsafe', 'sparking', 'fire', 'flood', 'broken', 'not working', 'leak', 'outage', 'cannot use', 'blocked', 'contaminated'];
  if (highPriorityWords.some((word) => text.includes(word))) return 'High';
  return description.length > 180 ? 'Medium' : 'Low';
}

async function handleApi(request, response, url) {
  const complaintPath = url.pathname.match(/^\/api\/complaints(?:\/([^/]+))?$/);
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return sendJson(response, mongoConnected ? 200 : 503, { status: mongoConnected ? 'ok' : 'unavailable', database: mongoConnected ? databaseName : undefined });
  }
  if (!complaintPath) return sendJson(response, 404, { error: 'API route not found.' });

  const id = complaintPath[1] ? decodeURIComponent(complaintPath[1]) : null;
  if (request.method === 'GET' && !id) {
    const complaints = await complaintsCollection.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
    return sendJson(response, 200, complaints);
  }
  if (request.method === 'GET' && id) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const complaint = await complaintsCollection.findOne({ id: { $regex: `^${escapedId}$`, $options: 'i' } }, { projection: { _id: 0 } });
    return complaint ? sendJson(response, 200, complaint) : sendJson(response, 404, { error: 'Complaint not found.' });
  }
  if (request.method === 'POST' && !id) {
    const body = await readBody(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const department = typeof body.department === 'string' ? body.department.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!name || name.length > 70 || !department || department.length > 80 || !categories.includes(category) || description.length < 10 || description.length > 1200) {
      return sendJson(response, 400, { error: 'Provide a valid name, department, category, and description (10-1200 characters).' });
    }
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    let created;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      created = { id: `CMP-${datePart}-${crypto.randomInt(1000, 10000)}`, name, department, category, description, priority: suggestedPriority(description), status: 'Pending', createdAt: new Date().toISOString() };
      try {
        await complaintsCollection.insertOne(created);
        break;
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
      }
    }
    return sendJson(response, 201, created);
  }
  if (request.method === 'PATCH' && id) {
    const body = await readBody(request);
    if (!statuses.includes(body.status)) return sendJson(response, 400, { error: 'Status must be Pending, In Progress, or Resolved.' });
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const updated = await complaintsCollection.findOneAndUpdate(
      { id: { $regex: `^${escapedId}$`, $options: 'i' } },
      { $set: { status: body.status } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    return updated ? sendJson(response, 200, updated) : sendJson(response, 404, { error: 'Complaint not found.' });
  }
  response.setHeader('Allow', id ? 'GET, PATCH' : 'GET, POST');
  return sendJson(response, 405, { error: 'Method not allowed.' });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      return response.end('Method not allowed');
    }
    const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const filePath = path.resolve(root, relativePath);
    const relativeToRoot = path.relative(root, filePath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      response.writeHead(403);
      return response.end('Forbidden');
    }
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    return request.method === 'HEAD' ? response.end() : response.end(content);
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    const statusCode = error.statusCode || (error.code === 'ENOENT' ? 404 : 500);
    if (statusCode === 500) console.error(error);
    return sendJson(response, statusCode, { error: statusCode === 404 ? 'File not found.' : error.message || 'Internal server error.' });
  }
});

const port = Number(process.env.PORT) || 5173;
function listenOnAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (candidate, attemptsLeft) => {
      const onListening = () => {
        server.off('error', onError);
        resolve(server.address().port);
      };
      const onError = (error) => {
        server.off('listening', onListening);
        if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryPort(candidate + 1, attemptsLeft - 1);
        } else {
          reject(error);
        }
      };
      server.once('listening', onListening);
      server.once('error', onError);
      server.listen(candidate);
    };
    tryPort(startPort, 50);
  });
}

async function startServer() {
  try {
    await connectToMongo();
    const activePort = await listenOnAvailablePort(port);
    console.log(`CampusCare API is running at http://localhost:${activePort} (MongoDB: ${databaseName})`);
    if (activePort !== port) console.warn(`Port ${port} was already in use; using ${activePort} instead.`);
  } catch (error) {
    console.error(`Could not connect to MongoDB at the configured URI: ${error.message}`);
    console.error('Set MONGODB_URI in your environment or .env file, and ensure MongoDB is reachable.');
    await mongoClient.close().catch(() => {});
    process.exitCode = 1;
  }
}

startServer();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    await mongoClient.close();
    process.exit(0);
  });
}
