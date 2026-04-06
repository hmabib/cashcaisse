const { ensureDatabase } = require('../lib/db');

module.exports = async function handler(req, res) {
  try {
    await ensureDatabase();
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};
