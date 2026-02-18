const pool = require('../config/db');

// GET /api/asca/:chamaId/assets
const listAssets = async (req, res, next) => {
  try {
    const { chamaId } = req.params;

    const result = await pool.query(
      `SELECT id, name, purchase_price, purchase_date, current_valuation, document_url, created_at
       FROM assets
       WHERE chama_id = $1
       ORDER BY created_at DESC`,
      [chamaId],
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/asca/:chamaId/assets
const createAsset = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const {
      name, purchase_price, purchase_date, current_valuation, document_url,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Asset name is required' });
    }

    const result = await pool.query(
      `INSERT INTO assets (chama_id, name, purchase_price, purchase_date, current_valuation, document_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        chamaId,
        name,
        purchase_price || null,
        purchase_date || null,
        current_valuation || null,
        document_url || null,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAssets,
  createAsset,
};
