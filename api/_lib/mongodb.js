const { MongoClient } = require('mongodb');

const globalForMongo = globalThis;
const categories = ['Classroom', 'Wi-Fi', 'Drinking water', 'Laboratory equipment', 'Washroom', 'Hostel maintenance', 'Other'];

function demoComplaints() {
  const now = Date.now();
  return [
    { id: 'CMP-20261118-0041', name: 'Aarav Mehta', department: 'Engineering', category: 'Wi-Fi', description: 'Wi-Fi connection keeps dropping in the engineering block, especially on the second floor.', priority: 'High', status: 'In Progress', createdAt: new Date(now - 30 * 60 * 60 * 1000).toISOString() },
    { id: 'CMP-20261119-0042', name: 'Sana Iqbal', department: 'Science', category: 'Laboratory equipment', description: 'The microscope in lab 3 has a damaged focus knob and cannot be used for class.', priority: 'High', status: 'Pending', createdAt: new Date(now - 13 * 60 * 60 * 1000).toISOString() },
    { id: 'CMP-20261119-0043', name: 'Rohan Das', department: 'Business', category: 'Drinking water', description: 'Water dispenser near the library is empty and the refill button is not working.', priority: 'Medium', status: 'Resolved', createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString() },
    { id: 'CMP-20261120-0044', name: 'Nisha Patel', department: 'Computer Science', category: 'Washroom', description: 'The washroom sink on the ground floor is leaking and water is pooling by the door.', priority: 'Medium', status: 'Pending', createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() }
  ];
}

async function getComplaintsCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured in the Vercel project environment variables.');

  if (!globalForMongo.campusCareMongoPromise) {
    const client = new MongoClient(uri);
    globalForMongo.campusCareMongoClient = client;
    globalForMongo.campusCareMongoPromise = client.connect().catch((error) => {
      globalForMongo.campusCareMongoPromise = null;
      throw error;
    });
  }

  await globalForMongo.campusCareMongoPromise;
  const database = globalForMongo.campusCareMongoClient.db(process.env.MONGODB_DB || 'campuscare');
  const collection = database.collection(process.env.MONGODB_COLLECTION || 'complaints');
  await collection.createIndex({ id: 1 }, { unique: true });

  if (await collection.estimatedDocumentCount() === 0) {
    await Promise.all(demoComplaints().map((complaint) => collection.updateOne(
      { id: complaint.id },
      { $setOnInsert: complaint },
      { upsert: true }
    )));
  }

  return collection;
}

module.exports = { categories, getComplaintsCollection };
