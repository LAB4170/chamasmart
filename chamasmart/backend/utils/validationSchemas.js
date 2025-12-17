const Joi = require("joi");

// Auth Schemas
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
        .min(8)
        .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
        .required()
        .messages({
            "string.pattern.base": "Password must contain only alphanumeric characters",
        }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string()
        .pattern(/^(?:\+254|0)?[17]\d{8}$/)
        .message("Invalid Kenyan phone number")
        .required(),
    nationalId: Joi.string().optional(),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

// Contribution Schemas
const contributionSchema = Joi.object({
    userId: Joi.string().guid({ version: "uuidv4" }).required(), // Assumes UUIDs
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string()
        .valid("CASH", "MPESA", "BANK_TRANSFER")
        .default("CASH"),
    receiptNumber: Joi.string().optional(),
    notes: Joi.string().max(500).optional(),
    contributionDate: Joi.date().iso().optional(),
});

module.exports = {
    registerSchema,
    loginSchema,
    contributionSchema,
};
