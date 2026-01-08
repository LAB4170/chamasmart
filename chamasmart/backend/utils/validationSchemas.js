const Joi = require("joi");

// Auth Schemas
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
        .min(8)
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
        .required()
        .messages({
            "string.pattern.base":
                "Password must contain at least one uppercase letter, one lowercase letter, and one number",
            "string.min": "Password must be at least 8 characters long",
        }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string()
        .pattern(/^(?:\+?254|0)?[17]\d{8}$/)
        .required()
        .messages({
            "string.pattern.base": "Invalid Kenyan phone number",
        }),
    nationalId: Joi.string().optional(),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

// Chama Schemas
const createChamaSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500),
    chamaType: Joi.string().valid("MERRY_GO_ROUND", "TABLE_BANKING").required(),
    contributionAmount: Joi.number().positive().required(),
    contributionFrequency: Joi.string()
        .valid("daily", "weekly", "monthly")
        .required(),
    startDate: Joi.date().iso().greater("now").required(),
});

// Contribution Schemas
const contributionSchema = Joi.object({
    userId: Joi.string().guid({ version: "uuidv4" }).required(), // Assumes UUIDs
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string()
        .valid("CASH", "MPESA", "BANK_TRANSFER")
        .default("CASH"),
    transactionId: Joi.string().when("paymentMethod", {
        is: "MPESA",
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
    }),
    receiptNumber: Joi.string().optional(),
    notes: Joi.string().max(500).optional(),
    contributionDate: Joi.date().iso().optional(),
});

// Loan Schemas
const applyLoanSchema = Joi.object({
    amount: Joi.number().positive().required(),
    purpose: Joi.string().min(5).max(200).required(),
    termMonths: Joi.number().integer().min(1).max(60).required(),
    guarantors: Joi.array()
        .items(
            Joi.object({
                userId: Joi.string().required(),
                amount: Joi.number().positive().required(),
            })
        )
        .optional(),
});

module.exports = {
    registerSchema,
    loginSchema,
    createChamaSchema,
    contributionSchema,
    applyLoanSchema,
};
