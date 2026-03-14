const Joi = require('joi');
const { body } = require("express-validator");

// Auth Schemas
const registerPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$'))
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'string.min': 'Password must be at least 8 characters long',
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phoneNumber: Joi.string()
    .pattern(/^(?:\+?254|0)?[17]\d{8}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Kenyan phone number',
    }),
  nationalId: Joi.string().optional(),
});

const mpesaPaymentSchema = Joi.object({
  chamaId: Joi.number().integer().required(),
  amount: Joi.number().positive().required(),
  phoneNumber: Joi.string().pattern(/^(?:254|\+254|0)?([71][0-9]{8})$/).required()
    .messages({
      'string.pattern.base': 'Please provide a valid Kenyan phone number (e.g., 0712345678 or 254712345678)'
    }),
  notes: Joi.string().max(200).allow('', null)
});

const loginPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// User Profile Schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().optional().allow(null, ''),
  phoneNumber: Joi.string()
    .pattern(/^(?:\+?254|0)?[17]\d{8}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid Kenyan phone number',
    }),
  nationalId: Joi.string().min(0).max(20).optional().allow(null, ''),
  profilePictureUrl: Joi.string().uri({ allowRelative: true }).optional().allow(null, ''),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$'))
    .required()
    .messages({
      'string.pattern.base':
        'New password must contain at least one uppercase letter, one lowercase letter, and one number',
      'string.min': 'New password must be at least 8 characters long',
    }),
});

// Chama Schemas
// Chama Schemas
const createChamaSchema = Joi.object({
  chamaName: Joi.string().min(3).max(100).required(),
  chamaType: Joi.string().valid('ROSCA', 'ASCA', 'TABLE_BANKING', 'WELFARE').required(),
  description: Joi.string().max(500).optional().allow('', null),
  contributionAmount: Joi.number().positive().required(),
  contributionFrequency: Joi.string()
    .valid('WEEKLY', 'BIWEEKLY', 'MONTHLY')
    .required(),
  meetingDay: Joi.string().required(),
  meetingTime: Joi.string().optional().allow(null, ''),
  visibility: Joi.string().valid('PUBLIC', 'PRIVATE').default('PRIVATE'),
  sharePrice: Joi.number().min(0).optional().allow(null, ""),
  paymentMethods: Joi.object({
    type: Joi.string().valid('PAYBILL', 'TILL', 'POCHI').optional(),
    businessNumber: Joi.string().optional().allow('', null),
    accountNumber: Joi.string().optional().allow('', null),
    tillNumber: Joi.string().optional().allow('', null),
    phoneNumber: Joi.string().optional().allow('', null),
  }).optional().default({}),
});

const updateChamaSchema = Joi.object({
  chamaName: Joi.string().min(3).max(100).optional(),
  chamaType: Joi.string().valid('ROSCA', 'ASCA', 'TABLE_BANKING', 'WELFARE').optional(),
  description: Joi.string().max(500).optional().allow(''),
  contributionAmount: Joi.number().positive().optional(),
  contributionFrequency: Joi.string()
    .valid('WEEKLY', 'MONTHLY', 'BI_WEEKLY')
    .optional(),
  meetingDay: Joi.string().optional(),
  meetingTime: Joi.string().optional().allow(null, ''),
  visibility: Joi.string().valid('PUBLIC', 'PRIVATE').optional(),
  constitution_config: Joi.object().optional(),
  paymentMethods: Joi.object({
    type: Joi.string().valid('PAYBILL', 'TILL', 'POCHI').optional(),
    businessNumber: Joi.string().optional().allow('', null),
    accountNumber: Joi.string().optional().allow('', null),
    tillNumber: Joi.string().optional().allow('', null),
    phoneNumber: Joi.string().optional().allow('', null),
  }).optional(),
});

// Contribution Schemas
const contributionSchema = Joi.object({
  userId: Joi.number().integer().required(),
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'OTHER').default('CASH'),
  receiptNumber: Joi.string().max(100).optional().allow('', null),
  paymentProof: Joi.string().max(512).optional().allow('', null),
  notes: Joi.string().max(500).optional().allow('', null),
  contributionDate: Joi.date().iso().optional(),
  status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED').default('PENDING'),
  verificationStatus: Joi.string().valid('PENDING', 'VERIFIED', 'REJECTED').default('PENDING'),
  meetingId: Joi.number().integer().optional().allow(null),
});

const bulkContributionSchema = Joi.object({
  contributions: Joi.array().items(contributionSchema).min(1).required(),
});

// Meeting Schemas
const createMeetingSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional().allow('', null),
  type: Joi.string().valid('PHYSICAL', 'VIRTUAL', 'HYBRID').default('PHYSICAL'),
  scheduledAt: Joi.date().iso().required(),
  location: Joi.string().max(200).optional().allow('', null),
  meetingLink: Joi.string().uri().optional().allow('', null),
  validUntil: Joi.date().iso().optional(),
});

// Loan Schemas
const applyLoanSchema = Joi.object({
  amount: Joi.number().positive().required(),
  type: Joi.string().max(100).required(),
  purpose: Joi.string().min(5).max(500).required(),
  repaymentPeriod: Joi.number().integer().min(1).max(60).required(),
  guarantors: Joi.array().items(
    Joi.object({
      userId: Joi.number().integer().required(),
      amount: Joi.number().positive().required()
    })
  ).min(0).default([]),
});

// Verification Schema
const verifyContributionSchema = [
  body("checkoutRequestId")
    .optional()
    .isString()
    .withMessage("Invalid checkout Request ID format"),
  body("status")
    .isIn(["COMPLETED", "FAILED"])
    .withMessage("Status must be COMPLETED or FAILED"),
  body("failureReason")
    .optional()
    .isString()
    .withMessage("Invalid failure reason format"),
];

// Invite Schemas
const generateInviteSchema = Joi.object({
  maxUses: Joi.number().integer().min(1).max(100)
    .default(1),
  expiresInDays: Joi.number().integer().min(1).max(30).default(7),
  expiresAt: Joi.date().iso().optional(),
  role: Joi.string()
    .valid('member', 'treasurer', 'chairperson')
    .default('member'),
});

const sendInviteSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('CHAIRPERSON', 'TREASURER', 'SECRETARY', 'MEMBER', 'chairperson', 'treasurer', 'secretary', 'member').optional(),
  message: Joi.string().max(500).optional(),
});

const joinWithInviteSchema = Joi.object({
  inviteCode: Joi.string().min(6).max(20).required(),
});

// Join Request Schemas
const requestToJoinSchema = Joi.object({
  message: Joi.string().min(10).max(2000).required(),
});

const respondToJoinRequestSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED', 'approved', 'rejected').required(),
  message: Joi.string().max(500).optional(),
});

// ROSCA Schemas
const createCycleSchema = Joi.object({
  chama_id: Joi.number().integer().required(),
  cycle_name: Joi.string().min(3).max(100).required(),
  contribution_amount: Joi.number().positive().required(),
  frequency: Joi.string().valid('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY').required(),
  start_date: Joi.date().iso().required(),
  roster_method: Joi.string().valid('RANDOM', 'TRUST', 'MANUAL').default('RANDOM'),
  manual_roster: Joi.array().items(Joi.number().integer()).when('roster_method', {
    is: 'MANUAL',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const processPayoutSchema = Joi.object({
  position: Joi.number().integer().positive().required(),
  payment_proof: Joi.string().max(512).optional().allow('', null),
  reference_id: Joi.string().max(100).optional().allow('', null),
});

const requestPositionSwapSchema = Joi.object({
  target_position: Joi.number().integer().positive().required(),
  reason: Joi.string().min(5).max(500).required(),
});

const respondToSwapRequestSchema = Joi.object({
  action: Joi.string().valid('APPROVED', 'REJECTED').required(),
  message: Joi.string().max(500).optional().allow('', null),
});

// ASCA Schemas
const buySharesSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'OTHER').default('CASH'),
});

const createProposalSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(10).max(2000).required(),
  type: Joi.string().valid('investment', 'policy', 'other').required(),
  votingDeadline: Joi.date().iso().greater('now').required(),
});

const castVoteSchema = Joi.object({
  vote: Joi.string().valid('for', 'against', 'abstain').required(),
  comment: Joi.string().max(500).optional(),
});

const createAssetSchema = Joi.object({
  name: Joi.string().min(3).max(200).required(),
  type: Joi.string()
    .valid('property', 'equipment', 'investment', 'other')
    .required(),
  value: Joi.number().positive().required(),
  description: Joi.string().max(1000).optional(),
});

const createAscaCycleSchema = Joi.object({
  cycle_name: Joi.string().min(3).max(100).required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().greater(Joi.ref('start_date')).required(),
  share_price: Joi.number().positive().required(),
  total_shares: Joi.number().integer().positive().optional(),
});

// Welfare Schemas
const makeWelfareContributionSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'OTHER').default('CASH'),
});

const submitClaimSchema = Joi.object({
  event_type_id: Joi.number().integer().optional().allow(null, ''),
  custom_event_name: Joi.string().max(100).optional().allow(null, ''),
  claim_amount: Joi.number().positive().required(),
  description: Joi.string().max(500).optional().allow(null, ''),
  date_of_occurrence: Joi.date().iso().required(),
});

const approveClaimSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  approverId: Joi.number().integer().optional(), // Can also come from req.user
  comments: Joi.string().max(500).optional().allow('', null),
  reviewer_notes: Joi.string().max(500).optional().allow('', null),
  approved_amount: Joi.number().positive().optional().allow(null),
});

const createEmergencyDriveSchema = Joi.object({
  beneficiary_id: Joi.number().integer().required(),
  description: Joi.string().min(5).max(500).required(),
  target_amount: Joi.number().positive().required(),
});

const contributeToEmergencyDriveSchema = Joi.object({
  amount: Joi.number().positive().required(),
});

const updateWelfareConfigSchema = Joi.object({
  config: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().optional(),
      event_type: Joi.string().max(100).required(),
      payout_amount: Joi.number().min(0).required(),
      is_active: Joi.boolean().default(true),
    })
  ).min(1).required(),
});

module.exports = {
  // Authentication
  registerPasswordSchema,
  loginPasswordSchema,

  // User Management
  updateProfileSchema,
  changePasswordSchema,

  // Chama Management
  createChamaSchema,
  updateChamaSchema,

  // Contributions
  contributionSchema,
  bulkContributionSchema,
  verifyContributionSchema,
  mpesaPaymentSchema,
  
  // Meetings
  createMeetingSchema,

  // Loans
  applyLoanSchema,

  // Invites
  generateInviteSchema,
  sendInviteSchema,
  joinWithInviteSchema,

  // Join Requests
  requestToJoinSchema,
  respondToJoinRequestSchema,

  // ROSCA
  createCycleSchema,
  processPayoutSchema,
  requestPositionSwapSchema,
  respondToSwapRequestSchema,

  // ASCA
  buySharesSchema,
  createProposalSchema,
  castVoteSchema,
  createAssetSchema,
  createAscaCycleSchema,

  // Welfare
  makeWelfareContributionSchema,
  submitClaimSchema,
  approveClaimSchema,
  createEmergencyDriveSchema,
  contributeToEmergencyDriveSchema,
  updateWelfareConfigSchema,
};
