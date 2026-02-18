/**
 * Application-wide Constants
 * Single source of truth for status codes, roles, etc.
 */

const MEMBER_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

const USER_ROLES = {
  CHAIRPERSON: 'CHAIRPERSON',
  SECRETARY: 'SECRETARY',
  TREASURER: 'TREASURER',
  MEMBER: 'MEMBER',
};

const OFFICIAL_ROLES = [
  USER_ROLES.CHAIRPERSON,
  USER_ROLES.SECRETARY,
  USER_ROLES.TREASURER,
];

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  NOT_MODIFIED: 304,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

const CACHE_KEYS = {
  USER: userId => `user:${userId}`,
  USER_PROFILE: userId => `user:${userId}:profile`,
  MEMBERSHIP: (userId, chamaId) => `membership:${userId}:${chamaId}`,
  CHAMA: chamaId => `chama:${chamaId}`,
  CHAMA_LIST: (userId, query) => `chamas:list:${userId}:${JSON.stringify(query)}`,
  TOKEN_BLACKLIST: token => `blacklist:${token}`,
};

const REDIS_PREFIXES = {
  RATE_LIMIT: 'rl:',
  CACHE: 'cache:',
  SESSION: 'session:',
  BLACKLIST: 'blacklist:',
  LOCK: 'lock:',
};

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

const FILE_TYPES = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  JPG: 'image/jpg',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.doc',
  '.docx',
];

module.exports = {
  MEMBER_STATUS,
  USER_ROLES,
  OFFICIAL_ROLES,
  HTTP_STATUS,
  CACHE_KEYS,
  REDIS_PREFIXES,
  ERROR_CODES,
  FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
};
