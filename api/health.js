const { getComplaintsCollection } = require('./_lib/mongodb');

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const collection = await getComplaintsCollection();
    await collection.estimatedDocumentCount();
    return response.status(200).json({ status: 'ok', database: process.env.MONGODB_DB || 'campuscare' });
  } catch (error) {
    console.error(error);
    return response.status(503).json({ status: 'unavailable', error: 'MongoDB connection is not configured or available.' });
  }
};
