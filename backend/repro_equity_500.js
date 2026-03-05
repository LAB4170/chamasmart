// repro_equity_500.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Ensure chama is ASCA or Table Banking and active
const getAscaChama = async chamaId => {
  const result = await pool.query(
    'SELECT chama_id, chama_type, current_fund, share_price FROM chamas WHERE chama_id = $1 AND is_active = true',
    [chamaId],
  );

  if (result.rows.length === 0) {
    const error = new Error('Chama not found');
    error.statusCode = 404;
    throw error;
  }

  const chama = result.rows[0];
  const allowedTypes = ['ASCA', 'TABLE_BANKING'];
  
  if (!allowedTypes.includes(chama.chama_type)) {
    const error = new Error(`This operation is only available for ${allowedTypes.join(' or ')} chamas`);
    error.statusCode = 400;
    throw error;
  }

  return chama;
};

async function getMyEquitySim(chamaId, userId) {
  try {
    console.log('1. Validating Chama...');
    await getAscaChama(chamaId);

    console.log('2. Fetching User Aggregates...');
    const userAgg = await pool.query(
      `SELECT 
         COALESCE(SUM(amount), 0) AS total_amount,
         COALESCE(SUM(number_of_shares), 0) AS total_shares
       FROM asca_share_contributions
       WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );
    console.log('UserAgg:', userAgg.rows[0]);

    console.log('3. Fetching Chama Totals...');
    const [chamaRow, sharesAgg, assetsAgg] = await Promise.all([
      pool.query(
        'SELECT current_fund, share_price FROM chamas WHERE chama_id = $1',
        [chamaId],
      ),
      pool.query(
        `SELECT COALESCE(SUM(number_of_shares), 0) AS total_shares
         FROM asca_share_contributions
         WHERE chama_id = $1`,
        [chamaId],
      ),
      pool.query(
        `SELECT COALESCE(SUM(current_valuation), 0) AS total_assets
         FROM assets
         WHERE chama_id = $1`,
        [chamaId],
      ),
    ]);

    console.log('ChamaRow:', chamaRow.rows[0]);
    console.log('SharesAgg:', sharesAgg.rows[0]);
    console.log('AssetsAgg:', assetsAgg.rows[0]);

    const currentFund = parseFloat(chamaRow.rows[0].current_fund || 0);
    const configuredSharePrice = parseFloat(chamaRow.rows[0].share_price || 0);
    const totalSharesChama = parseFloat(sharesAgg.rows[0].total_shares || 0);
    const assetsValue = parseFloat(assetsAgg.rows[0].total_assets || 0);

    const totalAssets = currentFund + assetsValue;

    let currentSharePrice;
    if (totalSharesChama > 0) {
      currentSharePrice = totalAssets / totalSharesChama;
    } else {
      currentSharePrice = configuredSharePrice || 0;
    }

    const { total_shares } = userAgg.rows[0];
    const estimatedValue = parseFloat(total_shares || 0) * currentSharePrice;

    console.log('Result:', {
        totalAmount: parseFloat(userAgg.rows[0].total_amount || 0),
        totalShares: parseFloat(total_shares || 0),
        currentSharePrice,
        estimatedValue,
        totalAssets,
    });

  } catch (err) {
    console.error('FAILED:', err.message);
    console.error(err.stack);
  }
}

const chamaId = 19;
const userId = 1; // Pick any user
getMyEquitySim(chamaId, userId).then(() => process.exit());
