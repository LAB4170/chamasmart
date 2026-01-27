// Email validation
const isValidEmail = email => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation (Kenyan mobile format)
const isValidPhone = phone => {
  // Accepts: +254712345678, 0712345678, 712345678, +254112345678, 0112345678, 112345678
  const phoneRegex = /^(?:\+?254|0)?[17]\d{8}$/;
  return phoneRegex.test(phone);
};

// Normalize phone number to international format
const normalizePhone = phone => {
  // Remove all spaces and dashes
  phone = phone.replace(/[\s-]/g, '');

  // Convert to +254 format
  if (phone.startsWith('0')) {
    return `+254${phone.substring(1)}`;
  } if (phone.startsWith('254')) {
    return `+${phone}`;
  } if (phone.startsWith('+254')) {
    return phone;
  } if (phone.startsWith('7')) {
    return `+254${phone}`;
  }

  return phone;
};

// Password strength validation
const isStrongPassword = password =>
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  (
    password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
  )
;

// Amount validation (positive number)
const isValidAmount = amount => !isNaN(amount) && parseFloat(amount) > 0;

// Chama type validation
const isValidChamaType = type => {
  const validTypes = ['ROSCA', 'ASCA', 'TABLE_BANKING', 'WELFARE'];
  return validTypes.includes(type);
};

// Contribution frequency validation
const isValidFrequency = frequency => {
  const validFrequencies = ['WEEKLY', 'MONTHLY', 'BI_WEEKLY'];
  return validFrequencies.includes(frequency);
};

// Role validation
const isValidRole = role => {
  const validRoles = ['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'MEMBER'];
  return validRoles.includes(role);
};

// Payment method validation
const isValidPaymentMethod = method => {
  const validMethods = ['CASH', 'MPESA', 'BANK_TRANSFER'];
  return validMethods.includes(method);
};

module.exports = {
  isValidEmail,
  isValidPhone,
  normalizePhone,
  isStrongPassword,
  isValidAmount,
  isValidChamaType,
  isValidFrequency,
  isValidRole,
  isValidPaymentMethod,
};
