/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - first_name
 *         - last_name
 *         - email
 *         - password
 *       properties:
 *         user_id:
 *           type: integer
 *           description: The auto-generated id of the user
 *         first_name:
 *           type: string
 *           description: First name of the user
 *         last_name:
 *           type: string
 *           description: Last name of the user
 *         email:
 *           type: string
 *           format: email
 *           description: Email address of the user
 *         phone_number:
 *           type: string
 *           description: Phone number of the user
 *         role:
 *           type: string
 *           enum: [MEMBER, CHAIRPERSON, TREASURER, SECRETARY, ADMIN]
 *           description: User role in the system
 *         is_active:
 *           type: boolean
 *           description: Whether the user account is active
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the user was created
 *     Chama:
 *       type: object
 *       required:
 *         - chama_name
 *         - chama_type
 *         - contribution_amount
 *       properties:
 *         chama_id:
 *           type: integer
 *           description: The auto-generated id of the chama
 *         chama_name:
 *           type: string
 *           description: Name of the chama group
 *         chama_type:
 *           type: string
 *           enum: [CHAMA, ROSCA, ASCA]
 *           description: Type of chama group
 *         description:
 *           type: string
 *           description: Description of the chama
 *         contribution_amount:
 *           type: number
 *           format: decimal
 *           description: Regular contribution amount
 *         contribution_frequency:
 *           type: string
 *           enum: [DAILY, WEEKLY, MONTHLY, QUARTERLY]
 *           description: How often contributions are made
 *         current_fund:
 *           type: number
 *           format: decimal
 *           description: Current total fund balance
 *         total_members:
 *           type: integer
 *           description: Number of members in the chama
 *         visibility:
 *           type: string
 *           enum: [PUBLIC, PRIVATE, INVITE_ONLY]
 *           description: Chama visibility settings
 *         is_active:
 *           type: boolean
 *           description: Whether the chama is active
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the chama was created
 *     Contribution:
 *       type: object
 *       required:
 *         - chama_id
 *         - amount
 *       properties:
 *         contribution_id:
 *           type: integer
 *           description: The auto-generated id of the contribution
 *         chama_id:
 *           type: integer
 *           description: ID of the chama
 *         user_id:
 *           type: integer
 *           description: ID of the user making contribution
 *         amount:
 *           type: number
 *           format: decimal
 *           description: Amount contributed
 *         contribution_date:
 *           type: string
 *           format: date-time
 *           description: When the contribution was made
 *         contribution_type:
 *           type: string
 *           enum: [REGULAR, WELFARE, LOAN_REPAYMENT, PENALTY]
 *           description: Type of contribution
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED]
 *           description: Status of the contribution
 *     Loan:
 *       type: object
 *       required:
 *         - chama_id
 *         - loan_amount
 *         - term_months
 *       properties:
 *         loan_id:
 *           type: integer
 *           description: The auto-generated id of the loan
 *         chama_id:
 *           type: integer
 *           description: ID of the chama
 *         borrower_id:
 *           type: integer
 *           description: ID of the borrower
 *         loan_amount:
 *           type: number
 *           format: decimal
 *           description: Amount requested for loan
 *         approved_amount:
 *           type: number
 *           format: decimal
 *           description: Amount approved for loan
 *         interest_rate:
 *           type: number
 *           format: decimal
 *           description: Interest rate for the loan
 *         term_months:
 *           type: integer
 *           description: Loan term in months
 *         purpose:
 *           type: string
 *           description: Purpose of the loan
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, DISBURSED, REJECTED, COMPLETED, DEFAULTED]
 *           description: Status of the loan
 *         total_repayable:
 *           type: number
 *           format: decimal
 *           description: Total amount to be repaid
 *         amount_paid:
 *           type: number
 *           format: decimal
 *           description: Amount already paid
 *         balance:
 *           type: number
 *           format: decimal
 *           description: Remaining balance
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the loan was created
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the request was successful
 *         message:
 *           type: string
 *           description: Response message
 *         data:
 *           type: object
 *           description: Response data
 *         error:
 *           type: string
 *           description: Error message if request failed
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *         errorCode:
 *           type: string
 *           description: Error code for troubleshooting
 *         details:
 *           type: array
 *           items:
 *             type: object
 *           description: Additional error details
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - last_name
 *               - email
 *               - password
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               phone_number:
 *                 type: string
 *                 example: +254712345678
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/chamas:
 *   get:
 *     summary: Get all public chamas
 *     tags: [Chamas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search chamas by name
 *     responses:
 *       200:
 *         description: Chamas retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     chamas:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Chama'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *   post:
 *     summary: Create a new chama
 *     tags: [Chamas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chama_name
 *               - chama_type
 *               - contribution_amount
 *             properties:
 *               chama_name:
 *                 type: string
 *                 example: Unity Investment Group
 *               chama_type:
 *                 type: string
 *                 enum: [CHAMA, ROSCA, ASCA]
 *                 example: CHAMA
 *               description:
 *                 type: string
 *                 example: A group for collective investment and savings
 *               contribution_amount:
 *                 type: number
 *                 format: decimal
 *                 example: 5000.00
 *               contribution_frequency:
 *                 type: string
 *                 enum: [DAILY, WEEKLY, MONTHLY, QUARTERLY]
 *                 example: MONTHLY
 *               meeting_day:
 *                 type: string
 *                 example: Saturday
 *               meeting_time:
 *                 type: string
 *                 example: 14:00
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, INVITE_ONLY]
 *                 example: PUBLIC
 *     responses:
 *       201:
 *         description: Chama created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/chamas/{id}:
 *   get:
 *     summary: Get chama by ID
 *     tags: [Chamas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chama ID
 *     responses:
 *       200:
 *         description: Chama retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Chama'
 *       404:
 *         description: Chama not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/contributions:
 *   post:
 *     summary: Make a contribution
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chama_id
 *               - amount
 *             properties:
 *               chama_id:
 *                 type: integer
 *                 example: 1
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 example: 5000.00
 *               contribution_type:
 *                 type: string
 *                 enum: [REGULAR, WELFARE, LOAN_REPAYMENT, PENALTY]
 *                 example: REGULAR
 *               reference:
 *                 type: string
 *                 example: Monthly contribution
 *     responses:
 *       201:
 *         description: Contribution made successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     summary: Get user contributions
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chama_id
 *         schema:
 *           type: integer
 *         description: Filter by chama ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Contributions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     contributions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Contribution'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_amount:
 *                           type: number
 *                           format: decimal
 *                         count:
 *                           type: integer
 */

/**
 * @swagger
 * /api/loans:
 *   post:
 *     summary: Apply for a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chama_id
 *               - loan_amount
 *               - term_months
 *               - purpose
 *             properties:
 *               chama_id:
 *                 type: integer
 *                 example: 1
 *               loan_amount:
 *                 type: number
 *                 format: decimal
 *                 example: 50000.00
 *               term_months:
 *                 type: integer
 *                 example: 6
 *               purpose:
 *                 type: string
 *                 example: Business expansion capital
 *               collateral_description:
 *                 type: string
 *                 example: Motor vehicle registration documents
 *     responses:
 *       201:
 *         description: Loan application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     summary: Get user loans
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DISBURSED, REJECTED, COMPLETED, DEFAULTED]
 *         description: Filter by loan status
 *     responses:
 *       200:
 *         description: Loans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Loan'
 */

/**
 * @swagger
 * /api/loans/{id}/approve:
 *   post:
 *     summary: Approve a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Loan ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approved_amount:
 *                 type: number
 *                 format: decimal
 *                 example: 45000.00
 *               notes:
 *                 type: string
 *                 example: Approved with reduced amount based on repayment capacity
 *     responses:
 *       200:
 *         description: Loan approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: Not authorized to approve loans
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Loan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 version:
 *                   type: string
 *                   description: API version
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     redis:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     memory:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: string
 *                         total:
 *                           type: string
 *                         percentage:
 *                           type: number
 */

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Get application metrics
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         per_second:
 *                           type: number
 *                         error_rate:
 *                           type: number
 *                     database:
 *                       type: object
 *                       properties:
 *                         connections:
 *                           type: integer
 *                         query_time_avg:
 *                           type: number
 *                         slow_queries:
 *                           type: integer
 *                     cache:
 *                       type: object
 *                       properties:
 *                         hit_rate:
 *                           type: number
 *                         miss_rate:
 *                           type: number
 *                         memory_usage:
 *                           type: string
 *                     system:
 *                       type: object
 *                       properties:
 *                         cpu_usage:
 *                           type: number
 *                         memory_usage:
 *                           type: number
 *                         disk_usage:
 *                           type: number
 */
