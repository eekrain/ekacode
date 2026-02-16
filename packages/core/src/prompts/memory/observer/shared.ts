/**
 * Shared Observer Prompt Blocks
 *
 * Reusable building blocks used by default and mode-specific observer prompts.
 */

export const OBSERVER_EXTRACTION_INSTRUCTIONS = `
CRITICAL: DISTINGUISH USER REQUESTS FROM QUESTIONS

When the user ASKS you to DO something (implement, fix, create, refactor):
- "Implement login with Zod" → 🟡 (14:30) User requested implementation of login with Zod
- "Fix the auth bug" → 🟡 (14:31) User requested fix for auth bug
- "Create a new component" → 🟡 (14:32) User requested new component creation

When the user TELLS you something about their CODEBASE or PREFERENCES:
- "We use TypeScript" → 🔴 (14:33) User stated codebase uses TypeScript
- "I prefer Jest over Vitest" → 🔴 (14:34) User stated preference for Jest over Vitest
- "The API is in /server" → 🔴 (14:35) User stated API is located in /server directory

When the user ASKS a QUESTION:
- "How do I implement X?" → 🟡 (15:00) User asked how to implement X
- "Can you explain Y?" → 🟡 (15:01) User asked about Y

IMPORTANT: REQUESTS (imperative) are different from QUESTIONS. Requests get 🟡, Questions get 🟡.

---

PROJECT CONTEXT - Always capture:
- What the user is working on (feature, bug, refactor)
- The specific file paths, function names, class names mentioned
- Any constraints or requirements stated
- Technology choices (frameworks, libraries, patterns)
- Code style preferences

TECHNICAL DETAILS - Preserve EXACT names:
- File paths: "auth.ts", "src/utils/helper.ts", "/server/routes/api.ts"
- Function names: "authenticateUser", "calculateTotal", "handleSubmit"
- Class names: "LoginForm", "UserService", "ApiClient"
- Variable names: "userId", "isAuthenticated", "errorMessage"
- Schema names: "LoginSchema", "UserModel", "ProductType"
- API endpoints: "/api/auth/login", "GET /users/:id"
- Database tables: "users", "sessions", "refresh_tokens"

CODE STATE CHANGES:
When the user indicates code is changing:
- "We're migrating from JavaScript to TypeScript" → "User is migrating codebase from JavaScript to TypeScript"
- "Switched from Redux to Zustand" → "User switched state management from Redux to Zustand"
- "Removed the legacy auth system" → "User removed legacy auth system (no longer using it)"

TEMPORAL ANCHORING:
Each observation has TWO timestamps:
1. BEGINNING: The time the statement was made (from message timestamp) - ALWAYS include
2. END: The time being REFERENCED - ONLY when there's a relative time reference

FORMAT:
- With time reference: (TIME) [observation]. (meaning/estimated DATE)
- Without time reference: (TIME) [observation].

ONLY add "(meaning DATE)" at the END when you can provide an ACTUAL DATE:
- Past: "last week", "yesterday", "a few days ago", "last sprint"
- Future: "this sprint", "next week", "by Friday"

DO NOT add end dates for:
- Present-moment statements with no time reference
- Vague references like "recently", "soon"

---

PRESERVE CODE DETAILS:

1. FUNCTION/METHOD SIGNATURES - Include full signatures:
   BAD: Assistant created a validate function
   GOOD: Assistant created validateEmail(email: string): boolean function in utils/validation.ts

2. IMPORT STATEMENTS - Note key imports:
   BAD: Assistant added authentication
   GOOD: Assistant added 'jwt' and 'bcrypt' imports for authentication

3. DATABASE SCHEMAS - Include field names and types:
   BAD: Created user schema
   GOOD: Created UserSchema with id (string), email (string), passwordHash (string), createdAt (timestamp)

4. API ROUTES - Include method and path:
   BAD: Created login endpoint
   GOOD: Created POST /api/auth/login endpoint returning { token, user }

5. CONFIG VALUES - Include exact values:
   BAD: Set timeout value
   GOOD: Set REQUEST_TIMEOUT to 30000ms (30 seconds)

6. ERROR HANDLING - Note error types:
   BAD: Added error handling
   GOOD: Added try/catch for AuthenticationError and ValidationError

7. DEPENDENCY CHANGES - Note package names and versions:
   BAD: Added auth library
   GOOD: Added @auth0/auth0-spa-js version 2.1.0 for authentication

8. FILE STRUCTURE - Note directory hierarchy:
   BAD: Created utils folder
   GOOD: Created src/utils/ with auth.ts, validation.ts, helpers.ts

9. TEST CASES - Note what's being tested:
   BAD: Added tests
   GOOD: Added unit tests for UserService.validate() covering valid/invalid emails

10. ENVIRONMENT VARIABLES - Note key env vars:
    BAD: Set up environment
    GOOD: Set DATABASE_URL, JWT_SECRET, and REDIS_URL environment variables

---

PRESERVING ASSISTANT-GENERATED CODE:

When you (the assistant) provide code, schemas, or technical content:
- Preserve the exact file path where code should go
- Note the function/class names defined
- Include key imports or dependencies required
- Record any configuration or setup steps

1. CODE SNIPPETS - If assistant writes code:
   BAD: Assistant wrote authentication code
   GOOD: Assistant wrote authenticateUser() in src/auth/index.ts using bcrypt.compare()

2. SCHEMAS - If assistant defines schemas:
   BAD: Assistant created validation schema
   GOOD: Assistant created LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })

3. REFACTORINGS - If assistant refactors:
   BAD: Assistant refactored the auth module
   GOOD: Assistant refactored auth/login.ts to use async/await, moved validation to auth/validators.ts

4. DEBUGGING - If assistant finds/fixes bugs:
   BAD: Assistant fixed a bug
   GOOD: Assistant fixed bug in src/api/users.ts:45 - missing null check on user.id causing crash

5. QUERIES - If assistant runs database queries:
   BAD: Assistant ran a query
   GOOD: Assistant ran SELECT * FROM users WHERE email = ? to find user by email

6. CONFIGURATION - If assistant sets up config:
   BAD: Assistant configured ESLint
   GOOD: Assistant configured ESLint with extends: ['airbnb', 'prettier'], rules: { 'no-unused-vars': 'error' }

7. GIT OPERATIONS - Note what was done:
   BAD: Assistant committed changes
   GOOD: Assistant committed "feat: add JWT authentication" with files: src/auth/, tests/auth/

8. FAILURES - Record when assistant attempts but fails:
   BAD: Assistant tried to fix the bug
   GOOD: Assistant attempted fix for Auth.ts but build failed with TypeScript error
   GOOD: Assistant tried to install bcrypt but npm install failed with EACCES error

---

CONVERSATION CONTEXT FOR CODING:

- What feature/bug the user is working on
- What files were modified or created
- What errors were encountered and how they were resolved
- What tests were added or modified
- What dependencies were installed
- What environment setup was done
- What the user learned or understood
- Any blockers or questions the user has
- Code review feedback received
- Performance optimizations made
- Security considerations addressed
`;

export const OBSERVER_OUTPUT_FORMAT = `
Use priority levels:
- 🔴 High: user preferences, technology choices, critical context, blockers, completed major features
- 🟡 Medium: implementation details, file changes, current work, questions, test results
- 🟢 Low: minor details, minor file changes, lint warnings, minor observations

Group observations by date, then list each with 24-hour time.
Group related observations (like file changes in same feature) by indenting.

<observations>
Date: Dec 4, 2025
* 🔴 (09:15) User stated codebase uses TypeScript, prefers Jest for testing
* 🔴 (09:16) User stated main API is in /server directory, frontend in /client
* 🟡 (09:20) User asked how to implement JWT authentication
* 🟡 (10:30) User working on login feature - targeting completion by end of sprint
* 🟡 (10:45) Assistant created LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) }) in src/schemas/auth.ts
* 🟡 (11:00) Assistant implemented authenticateUser(email, password) function in src/auth/index.ts using bcrypt.compare()
* 🔴 (11:15) User stated they need OAuth2 support later (not priority now)
* 🟡 (14:00) Assistant debugging auth issue
  * -> ran git status, found 3 modified files
  * -> viewed src/auth/index.ts:45-60, found missing null check on user object
  * -> applied fix, tests now pass
* 🟡 (14:30) Assistant created POST /api/auth/login endpoint returning { token, user }
* 🟡 (14:45) User asked about refresh token implementation
* 🔴 (15:00) User stated preference: use HTTP-only cookies, not localStorage for tokens
* 🟡 (15:15) Assistant installed @auth0/auth0-spa-js version 2.1.0
</observations>

<current-task>
Primary: Implementing JWT authentication with refresh tokens
Secondary: Waiting for user to confirm OAuth2 scope requirements
</current-task>

<suggested-response>
The JWT authentication is working. I've implemented:
1. LoginSchema with email/password validation
2. authenticateUser() using bcrypt
3. POST /api/auth/login endpoint

Should I now implement the refresh token flow, or do you want to review the current implementation first?
</suggested-response>
`;

export const OBSERVER_GUIDELINES = `
- Be specific enough for the assistant to find and continue the work
- Good: "User is implementing login with JWT in src/auth/index.ts"
- Bad: "User is working on auth" (too vague)

ADD 1 to 5 observations per exchange - capture the key changes.

USE TERSE LANGUAGE to save tokens but PRESERVE CRITICAL DETAILS:
- File paths (src/auth/login.ts)
- Function names (authenticateUser)
- Schema definitions (LoginSchema = z.object({...}))
- API endpoints (POST /api/auth/login)
- Error messages (AuthenticationError)
- Test results (all 42 tests passing)

WHAT TO OBSERVE:
- Files modified or created (with paths)
- Functions/classes defined (with names and signatures)
- Schema definitions (with field names and types)
- API endpoints added (with method and path)
- Dependencies installed (package names)
- Errors encountered and how they were resolved
- Tests added/modified (with test file paths)
- Configuration changes
- Git operations (commits, branches)
- Code review feedback

WHEN ASSISTANT RUNS TOOLS:
- Note what tool was called (ReadFile, WriteFile, Bash, etc.)
- Note the target (file path, command, query)
- Note the result (success/failure, key output)

WHEN OBSERVING CODE:
- Include line numbers for key locations
- Note the language/framework used
- Include key imports or dependencies

START EACH OBSERVATION with priority emoji (🔴, 🟡, 🟢).

DO NOT add repetitive observations already captured in previous observations.

If the user provides a detailed technical requirement, observe all important details - the assistant needs to reference them later.

Remember: These observations are the assistant's ONLY memory of what was done. Make them count.
`;
