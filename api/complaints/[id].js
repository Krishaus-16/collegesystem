const { getComplaintsCollection } = require('../_lib/mongodb');

const statuses = ['Pending', 'In Progress', 'Resolved'];

function sendError(response, error) {
  const status = error.statusCode || 500;
  if (status === 500) console.error(error);
  return response.status(status).json({ error: status === 500 ? 'Server error while accessing complaints.' : error.message });
}

module.exports = async function handler(request, response) {
  try {
    const complaintId = String(request.query.id || '');
    if (!complaintId) return response.status(400).json({ error: 'A complaint ID is required.' });
    const collection = await getComplaintsCollection();
    const escapedId = complaintId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { id: { $regex: `^${escapedId}$`, $options: 'i' } };

    if (request.method === 'GET') {
      const complaint = await collection.findOne(filter, { projection: { _id: 0 } });
      return complaint ? response.status(200).json(complaint) : response.status(404).json({ error: 'Complaint not found.' });
    }

    if (request.method === 'PATCH') {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
      if (!statuses.includes(body.status)) {
        return response.status(400).json({ error: 'Status must be Pending, In Progress, or Resolved.' });
      }
      const updated = await collection.findOneAndUpdate(
        filter,
        { $set: { status: body.status } },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
      return updated ? response.status(200).json(updated) : response.status(404).json({ error: 'Complaint not found.' });
    }

    response.setHeader('Allow', 'GET, PATCH');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return sendError(response, error);
  }
};
