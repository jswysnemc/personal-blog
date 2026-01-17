---
title: "Getting Started with TypeScript in 2024"
description: "A comprehensive guide to TypeScript fundamentals, type system, and best practices for modern web development"
pubDate: 2024-01-10
category: tech
tags: ["TypeScript", "JavaScript", "Web Development", "Programming"]
draft: false
---

TypeScript has become the de facto standard for large-scale JavaScript applications. In this guide, we'll explore why TypeScript matters and how to get started.

## Why TypeScript?

TypeScript adds static typing to JavaScript, catching errors at compile time rather than runtime. This leads to:

- **Better IDE support** - Intelligent code completion and refactoring
- **Fewer bugs** - Catch type errors before they reach production
- **Improved documentation** - Types serve as inline documentation
- **Easier refactoring** - Confidence when making changes

## Setting Up a TypeScript Project

```bash
# Initialize a new project
mkdir my-ts-project && cd my-ts-project
npm init -y

# Install TypeScript
npm install typescript --save-dev

# Initialize TypeScript configuration
npx tsc --init
```

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## Basic Types

### Primitive Types

```typescript
// String, number, boolean
let name: string = "Alice";
let age: number = 25;
let isActive: boolean = true;

// Arrays
let numbers: number[] = [1, 2, 3];
let names: Array<string> = ["Alice", "Bob"];

// Tuple
let tuple: [string, number] = ["hello", 42];
```

### Object Types

```typescript
// Interface
interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: Date; // Optional property
  readonly role: string; // Cannot be modified
}

// Type alias
type Point = {
  x: number;
  y: number;
};
```

### Union and Intersection Types

```typescript
// Union - can be one of several types
type Status = "pending" | "approved" | "rejected";

// Intersection - combines multiple types
type Employee = User & {
  department: string;
  salary: number;
};
```

## Generics

Generics allow you to write reusable, type-safe code:

```typescript
// Generic function
function identity<T>(arg: T): T {
  return arg;
}

// Generic interface
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Usage
const userResponse: ApiResponse<User> = {
  data: { id: 1, name: "Alice", email: "alice@example.com", role: "admin" },
  status: 200,
  message: "Success"
};
```

## Utility Types

TypeScript provides built-in utility types for common transformations:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial - all properties optional
type PartialUser = Partial<User>;

// Pick - select specific properties
type UserCredentials = Pick<User, "email" | "password">;

// Omit - exclude specific properties
type PublicUser = Omit<User, "password">;

// Required - all properties required
type RequiredUser = Required<User>;

// Readonly - all properties readonly
type ImmutableUser = Readonly<User>;
```

## Type Guards

Type guards help narrow down types at runtime:

```typescript
// typeof guard
function processValue(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value * 2;
}

// Custom type guard
interface Dog {
  bark(): void;
}

interface Cat {
  meow(): void;
}

function isDog(animal: Dog | Cat): animal is Dog {
  return (animal as Dog).bark !== undefined;
}
```

## Best Practices

### 1. Enable Strict Mode

Always use `"strict": true` in your tsconfig.json. This enables all strict type-checking options.

### 2. Avoid `any`

The `any` type bypasses type checking. Use `unknown` instead when the type is truly unknown:

```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  if (typeof data === "string") {
    // Now TypeScript knows it's a string
  }
}
```

### 3. Use Type Inference

Let TypeScript infer types when possible:

```typescript
// Unnecessary - type is inferred
const name: string = "Alice";

// Better
const name = "Alice"; // TypeScript infers string
```

### 4. Prefer Interfaces for Objects

Use interfaces for object types and type aliases for unions, intersections, and primitives:

```typescript
// Use interface for objects
interface User {
  name: string;
}

// Use type for unions/intersections
type Status = "active" | "inactive";
type AdminUser = User & { permissions: string[] };
```

## Conclusion

TypeScript is a powerful tool that improves code quality and developer experience. Start with the basics, enable strict mode, and gradually adopt more advanced features as you become comfortable.

Happy coding!
