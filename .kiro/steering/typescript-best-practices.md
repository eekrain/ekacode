# TypeScript Best Practices

[Purpose: Enforce strict typing during spec generation to prevent tech debt]

## Philosophy

- **Avoid `any` at all costs** - It bypasses type safety and creates hidden bugs
- **Use `unknown` only when genuinely unknown** - Always narrow before use
- **Prefer explicit types** - Let TypeScript catch errors at compile time
- **Treat type errors as real errors** - Don't use `as` assertions to bypass

## Forbidden Patterns

### ❌ Never Use `any`

```typescript
// BAD - completely opt-out of type checking
function processData(data: any): any { ... }

// BAD - implicit any from untyped parameter
function processData(data) { ... }
```

**Why**: `any` defeats the purpose of TypeScript. It makes refactoring dangerous and hides bugs.

### ❌ Avoid `unknown` Unless Necessary

```typescript
// BAD - without narrowing, useless
function parse(input: unknown): void {
  console.log(input.value); // Error: Object is of type 'unknown'
}

// ACCEPTABLE - with proper narrowing
function parse(input: unknown): void {
  if (isUser(input)) {
    console.log(input.name); // OK - narrowed to User
  }
}
```

## Required Patterns

### ✅ Use Generics for Reusable Logic

```typescript
// GOOD - type-safe wrapper
function wrapInPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

// GOOD - generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### ✅ Use Type Guards for Narrowing

```typescript
// GOOD - type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as User).name === "string"
  );
}

// GOOD - usage with narrowing
function process(value: unknown): string {
  if (isUser(value)) {
    return value.name; // TypeScript knows it's User
  }
  return "anonymous";
}
```

### ✅ Use Discriminated Unions

```typescript
// GOOD - type-safe state handling
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function handle(result: Result<string>): void {
  if (result.ok) {
    console.log(result.value); // T is string
  } else {
    console.log(result.error); // string
  }
}
```

### ✅ Prefer Specific Types Over Primitives

```typescript
// GOOD - specific string types
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type StatusCode = 200 | 201 | 400 | 401 | 404 | 500;

// GOOD - object shape over generic objects
interface User {
  id: string;
  name: string;
  email: string;
}
```

### ✅ Use `satisfies` for Validation

```typescript
// GOOD - validates shape without widening
const config = {
  port: 3000,
  host: "localhost",
} satisfies Record<string, number | string>;
```

## Exception Cases (Use Sparingly)

When `any` or `unknown` may be justified:

| Case                              | Solution                           |
| --------------------------------- | ---------------------------------- |
| Third-party library without types | Create a `*.d.ts` declaration file |
| Dynamic data (JSON.parse)         | Use type guard after parsing       |
| Test mocks                        | Use `vi.fn()` or create mock type  |
| External API response             | Create response interface          |

```typescript
// ACCEPTABLE - external API with declared type
interface ApiResponse {
  data: User[];
  meta: { total: number };
}

const response = await fetchApi<User[]>("/users");
```

## Migration Strategy for Legacy Code

When encountering `any` in existing code:

1. **Don't add more** - Don't perpetuate the problem
2. **Add TODO comments** - Mark for later improvement
3. **Use incremental typing** - Start with interfaces, then narrow

```typescript
// TODO: Replace with proper type (any masks bugs)
function legacyParse(data: any): any {
  return data;
}
```

---

_Effective typing prevents bugs and makes refactoring safe. Treat type errors as real errors during spec generation._
