const { setStateValue } = require('../lib/db');
const { verifyToken, getBearerToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  const payload = verifyToken(getBearerToken(req));
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { key, value } = req.body || {};
    if (!key) {
      res.status(400).json({ error: 'State key is required' });
      return;
    }

    await setStateValue(key, value);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'State update failed' });
  }
};
