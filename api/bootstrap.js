const { getAllState } = require('../lib/db');
const { verifyToken, getBearerToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = verifyToken(getBearerToken(req));
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const state = await getAllState();
    res.status(200).json({
      user: {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role
      },
      state
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Bootstrap failed' });
  }
};
