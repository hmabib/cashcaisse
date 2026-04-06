const { getUserByEmail } = require('../../lib/db');
const { signToken, verifyPassword } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const publicUser = {
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    };

    res.status(200).json({
      token: signToken(publicUser),
      user: publicUser
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Login failed' });
  }
};
