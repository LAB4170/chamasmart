module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ["airbnb-base"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    // Relaxed rules for existing codebase
    "no-console": "off", // Allow console for logging
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }], // Allow unused variables starting with _
    "consistent-return": "off", // Turn off for flexibility
    "prefer-const": "warn", // Warn instead of error
    "no-var": "error", // Disallow var, use let/const
    "object-shorthand": "warn", // Warn instead of error
    "prefer-template": "off", // Turn off for existing code
    "template-curly-spacing": "off", // Turn off
    "arrow-spacing": "warn", // Warn instead of error
    "comma-dangle": "off", // Turn off for flexibility
    "max-len": "off", // Turn off line length checks
    indent: "off", // Turn off indentation checks
    quotes: "off", // Turn off quote style checks
    semi: "off", // Turn off semicolon checks
    "no-trailing-spaces": "off", // Turn off trailing space checks
    "eol-last": "off", // Turn off newline checks
    "comma-spacing": "off", // Turn off comma spacing
    "key-spacing": "off", // Turn off key spacing
    "space-infix-ops": "off", // Turn off operator spacing
    "space-before-blocks": "off", // Turn off block spacing
    "brace-style": "off", // Turn off brace style
    curly: "off", // Turn off curly braces requirement
    "no-multiple-empty-lines": "off", // Turn off empty line limits
    "padded-blocks": "off", // Turn off block padding
    "space-before-function-paren": "off", // Turn off function spacing
    "func-names": "off", // Turn off function naming
    "prefer-arrow-callback": "off", // Turn off arrow callback preference
    "arrow-parens": "off", // Turn off arrow function parentheses
    "no-param-reassign": "off", // Turn off parameter reassignment
    "no-shadow": "off", // Turn off shadow checking
    "no-underscore-dangle": "off", // Allow underscore dangle
    "class-methods-use-this": "off", // Turn off this usage requirement
    "import/prefer-default-export": "off", // Turn off default export preference
    "import/no-unresolved": "off", // Turn off unresolved imports
    "import/extensions": "off", // Turn off file extension requirements
    "no-restricted-syntax": "off", // Turn off syntax restrictions
    // Security rules (keep these)
    "no-eval": "error", // Disallow eval
    "no-implied-eval": "error", // Disallow implied eval
    "no-new-func": "error", // Disallow new Function
    "no-script-url": "error", // Disallow script URLs
    // Performance rules (relaxed)
    "no-loop-func": "warn", // Warn instead of error
    "no-inner-declarations": "off", // Turn off inner declarations
    // Error handling rules (relaxed)
    "prefer-promise-reject-errors": "off", // Turn off promise reject errors
    "no-throw-literal": "off", // Turn off throw literal
    // Async/await rules (relaxed)
    "prefer-async-await": "off", // Turn off for existing code
    "no-await-in-loop": "off", // Turn off await in loop
    // Additional relaxed rules
    "no-plusplus": "off", // Allow ++ operators
    radix: "off", // Turn off radix requirement
    "no-return-await": "off", // Allow return await
    "no-promise-executor-return": "off", // Turn off promise executor return
    "no-restricted-globals": "off", // Turn off restricted globals
    "prefer-destructuring": "off", // Turn off destructuring preference
    "prefer-regex-literals": "off", // Turn off regex literal preference
    "implicit-arrow-linebreak": "off", // Turn off arrow linebreak
    "semi-style": "off", // Turn off semicolon style
    "import/order": "off", // Turn off import order
    "require-await": "off", // Turn off await requirement
    "max-classes-per-file": "off", // Turn off class limit
    "import/no-extraneous-dependencies": "off", // Turn off extraneous dependencies
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.spec.js"],
      env: {
        jest: true,
      },
      rules: {
        "no-unused-expressions": "off", // Allow expect statements
        "max-len": "off", // Allow longer lines in tests
        "no-magic-numbers": "off", // Allow magic numbers in tests
      },
    },
    {
      files: ["migrations/**/*.js", "scripts/**/*.js"],
      rules: {
        "no-console": "off", // Allow console in migration scripts
        "no-unused-vars": "off", // Allow unused vars in scripts
      },
    },
    {
      files: ["server.js"],
      rules: {
        "no-console": "off", // Allow console in main server file
      },
    },
  ],
};
