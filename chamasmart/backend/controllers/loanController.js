const pool = require("../config/db");
const { isValidAmount } = require("../utils/validators");

// @desc    Apply for a loan
// @route   POST /api/loans/:chamaId/apply
// @access  Private
const applyForLoan = async (req, res) => {
    try {
        const { chamaId } = req.params;
        const { amount, purpose, repaymentDate } = req.body;
        const userId = req.user.user_id;

        if (!amount || !repaymentDate) {
            return res.status(400).json({
                success: false,
                message: "Amount and repayment date are required",
            });
        }

        if (!isValidAmount(amount)) {
            return res.status(400).json({
                success: false,
                message: "Invalid loan amount",
            });
        }

        // Check if user is a member
        const memberCheck = await pool.query(
            "SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
            [chamaId, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chama",
            });
        }

        // Check for pending loans
        const pendingLoan = await pool.query(
            "SELECT * FROM loans WHERE chama_id = $1 AND borrower_id = $2 AND status IN ('PENDING', 'ACTIVE', 'DEFAULTED')",
            [chamaId, userId]
        );

        if (pendingLoan.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "You already have an active or pending loan",
            });
        }

        // Calculate interest (Default 10% for now, ideally fetched from chama settings)
        const interestRate = 10;
        const totalRepayable = parseFloat(amount) * (1 + interestRate / 100);

        const result = await pool.query(
            `INSERT INTO loans (chama_id, borrower_id, loan_amount, interest_rate, total_repayable, due_date, purpose, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING *`,
            [chamaId, userId, amount, interestRate, totalRepayable, repaymentDate, purpose]
        );

        res.status(201).json({
            success: true,
            message: "Loan application submitted successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Apply loan error:", error);
        res.status(500).json({
            success: false,
            message: "Error applying for loan",
        });
    }
};

// @desc    Get all loans for a chama
// @route   GET /api/loans/:chamaId
// @access  Private
const getChamaLoans = async (req, res) => {
    try {
        const { chamaId } = req.params;

        const result = await pool.query(
            `SELECT l.*, u.first_name || ' ' || u.last_name as borrower_name
       FROM loans l
       JOIN users u ON l.borrower_id = u.user_id
       WHERE l.chama_id = $1
       ORDER BY l.created_at DESC`,
            [chamaId]
        );

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get loans error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching loans",
        });
    }
};

// @desc    Approve/Reject loan
// @route   PUT /api/loans/:loanId/approve
// @access  Private (Officials Only)
const respondToLoan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { loanId } = req.params;
        const { status } = req.body; // 'ACTIVE' (Approved) or 'REJECTED' (Not in schema but logically needed, effectively deleted or status updated)

        if (!['ACTIVE', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const loanResult = await client.query("SELECT * FROM loans WHERE loan_id = $1", [loanId]);
        if (loanResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Loan not found" });
        }
        const loan = loanResult.rows[0];

        if (loan.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: "Loan is not pending" });
        }

        if (status === 'REJECTED') {
            await client.query("DELETE FROM loans WHERE loan_id = $1", [loanId]); // Simple rejection for now
            return res.json({ success: true, message: "Loan rejected" });
        }

        // Approve (ACTIVE)
        await client.query('BEGIN');

        // Check chama funds
        const chamaRes = await client.query("SELECT current_fund FROM chamas WHERE chama_id = $1", [loan.chama_id]);
        if (chamaRes.rows[0].current_fund < parseFloat(loan.loan_amount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Insufficient chama funds" });
        }

        // Deduct from chama funds
        await client.query(
            "UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2",
            [loan.loan_amount, loan.chama_id]
        );

        // Update loan status
        const updatedLoan = await client.query(
            "UPDATE loans SET status = 'ACTIVE', approved_by = $1 WHERE loan_id = $2 RETURNING *",
            [req.user.user_id, loanId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: "Loan approved successfully",
            data: updatedLoan.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Respond loan error:", error);
        res.status(500).json({ success: false, message: "Error processing loan" });
    } finally {
        client.release();
    }
};

// @desc    Repay loan
// @route   POST /api/loans/:loanId/repay
// @access  Private
const repayLoan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { loanId } = req.params;
        const { amount } = req.body;

        if (!isValidAmount(amount)) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        const loanRes = await client.query("SELECT * FROM loans WHERE loan_id = $1", [loanId]);
        if (loanRes.rows.length === 0) return res.status(404).json({ success: false, message: "Loan not found" });
        const loan = loanRes.rows[0];

        await client.query('BEGIN');

        // Record repayment
        await client.query(
            `INSERT INTO loan_repayments (loan_id, amount, recorded_by) VALUES ($1, $2, $3)`,
            [loanId, amount, req.user.user_id]
        );

        // Update loan amount paid
        const newAmountPaid = parseFloat(loan.amount_paid) + parseFloat(amount);
        let status = loan.status;
        if (newAmountPaid >= parseFloat(loan.total_repayable)) {
            status = 'PAID';
        }

        await client.query(
            "UPDATE loans SET amount_paid = $1, status = $2 WHERE loan_id = $3",
            [newAmountPaid, status, loanId]
        );

        // Add back to Chama funds
        await client.query(
            "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
            [amount, loan.chama_id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: "Repayment recorded successfully",
            loanStatus: status
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Repay loan error:", error);
        res.status(500).json({ success: false, message: "Error recording repayment" });
    } finally {
        client.release();
    }
};

module.exports = {
    applyForLoan,
    getChamaLoans,
    respondToLoan,
    repayLoan
};
