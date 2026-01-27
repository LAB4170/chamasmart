const Joi = require('joi');

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

const loginPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// User Profile Schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phoneNumber: Joi.string()
    .pattern(/^(?:\+?254|0)?[17]\d{8}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid Kenyan phone number',
    }),
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
const createChamaSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid('chama', 'rosca', 'asca').required(),
  maxMembers: Joi.number().integer().min(3).max(1000)
    .required(),
  contributionAmount: Joi.number().positive().required(),
  contributionFrequency: Joi.string()
    .valid('daily', 'weekly', 'monthly', 'yearly')
    .required(),
});

// Contribution Schemas
const contributionSchema = Joi.object({
  memberId: Joi.number().integer().required(),
  amount: Joi.number().positive().required(),
  type: Joi.string().valid('contribution', 'penalty', 'bonus').required(),
  description: Joi.string().max(200).optional(),
});

// Meeting Schemas
const createMeetingSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  meetingType: Joi.string().valid('regular', 'emergency', 'agm').required(),
  scheduledDate: Joi.date().iso().required(),
  location: Joi.string().max(200).required(),
  agenda: Joi.array().items(Joi.string().max(500)).optional(),
});

// Loan Schemas
const applyLoanSchema = Joi.object({
  amount: Joi.number().positive().required(),
  purpose: Joi.string().min(5).max(500).required(),
  repaymentPeriod: Joi.number().integer().min(1).max(60)
    .required(),
  guarantors: Joi.array().items(Joi.number().integer()).min(1).required(),
});

// Invite Schemas
const generateInviteSchema = Joi.object({
  maxUses: Joi.number().integer().min(1).max(100)
    .default(1),
  expiresAt: Joi.date().iso().greater('now').required(),
  role: Joi.string()
    .valid('member', 'treasurer', 'chairperson')
    .default('member'),
});

const sendInviteSchema = Joi.object({
  email: Joi.string().email().required(),
  message: Joi.string().max(500).optional(),
});

const joinWithInviteSchema = Joi.object({
  inviteCode: Joi.string().min(6).max(20).required(),
});

// Join Request Schemas
const requestToJoinSchema = Joi.object({
  message: Joi.string().min(10).max(500).required(),
});

const respondToJoinRequestSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  message: Joi.string().max(500).optional(),
});

// ROSCA Schemas
const createCycleSchema = Joi.object({
  contributionAmount: Joi.number().positive().required(),
  payoutOrder: Joi.array().items(Joi.number().integer()).required(),
  startDate: Joi.date().iso().required(),
});

const processPayoutSchema = Joi.object({
  memberId: Joi.number().integer().required(),
  amount: Joi.number().positive().required(),
  notes: Joi.string().max(500).optional(),
});

const requestPositionSwapSchema = Joi.object({
  currentPosition: Joi.number().integer().required(),
  requestedPosition: Joi.number().integer().required(),
  reason: Joi.string().min(5).max(500).required(),
});

const respondToSwapRequestSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  message: Joi.string().max(500).optional(),
});

// ASCA Schemas
const buySharesSchema = Joi.object({
  numberOfShares: Joi.number().integer().min(1).max(100)
    .required(),
  purchaseAmount: Joi.number().positive().required(),
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

module.exports = {
  // Auth
  registerPasswordSchema,
  loginPasswordSchema,

  // User Management
  updateProfileSchema,
  changePasswordSchema,

  // Chama Management
  createChamaSchema,

  // Contributions
  contributionSchema,

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
};
