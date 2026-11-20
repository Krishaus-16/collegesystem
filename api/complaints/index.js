const crypto = require('node:crypto');
const { categories, getComplaintsCollection } = require('../_lib/mongodb');

const highPriorityWords = ['urgent', 'danger', 'emergency', 'injury', 'unsafe', 'sparking', 'fire', 'flood', 'broken', 'not working', 'leak', 'outage', 'cannot use', 'blocked', 'contaminated'];

function suggestedPriority(description) {
  const text = description.toLowerCase();
  if (highPriorityWords.some((word) => text.includes(word))) return 'High';
  return description.length > 180 ? 'Medium' : 'Low';
}

function sendError(response, error) {
  const status = error.statusCode || 500;
  if (status === 500) console.error(error);
  return response.status(status).json({ error: status === 500 ? 'Server error while accessing complaints.' : error.message });
}

module.exports = async function handler(request, response) {
  try {
    const collection = await getComplaintsCollection();
    if (request.method === 'GET') {
      const complaints = await collection.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return response.status(200).json(complaints);
    }

    if (request.method === 'POST') {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const department = typeof body.department === 'string' ? body.department.trim() : '';
      const category = typeof body.category === 'string' ? body.category.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!name || name.length > 70 || !department || department.length > 80 || !categories.includes(category) || description.length < 10 || description.length > 1200) {
        return response.status(400).json({ error: 'Provide a valid name, department, category, and description (10-1200 characters).' });
      }

      const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const complaint = {
          id: `CMP-${datePart}-${crypto.randomInt(1000, 10000)}`,
          name,
          department,
          category,
          description,
          priority: suggestedPriority(description),
          status: 'Pending',
          createdAt: new Date().toISOString()
        };
        try {
          await collection.insertOne(complaint);
          return response.status(201).json(complaint);
        } catch (error) {
          if (error.code !== 11000 || attempt === 4) throw error;
        }
      }
    }

    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return sendError(response, error);
  }
};
