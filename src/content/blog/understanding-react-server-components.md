---
title: "Understanding React Server Components"
description: "Deep dive into React Server Components: how they work, when to use them, and best practices for Next.js applications"
pubDate: 2024-01-12
category: tech
tags: ["React", "Next.js", "Server Components", "Frontend"]
draft: false
---

React Server Components (RSC) represent a fundamental shift in how we build React applications. Let's explore what they are and how to use them effectively.

## What Are Server Components?

Server Components are React components that run exclusively on the server. Unlike traditional React components that execute in the browser, Server Components:

- Never ship JavaScript to the client
- Can directly access backend resources (databases, file systems)
- Reduce client-side bundle size
- Improve initial page load performance

## Server vs Client Components

### Server Components (Default in Next.js App Router)

```tsx
// app/users/page.tsx
// This is a Server Component by default

import { db } from '@/lib/database';

async function UsersPage() {
  // Direct database access - no API needed!
  const users = await db.user.findMany();

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default UsersPage;
```

### Client Components

```tsx
// components/Counter.tsx
'use client'; // This directive marks it as a Client Component

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

## When to Use Each

### Use Server Components When:

- Fetching data from databases or APIs
- Accessing backend resources directly
- Keeping sensitive information on the server (API keys, tokens)
- Rendering static or rarely-changing content
- Reducing JavaScript bundle size

### Use Client Components When:

- Using React hooks (useState, useEffect, useContext)
- Adding event listeners (onClick, onChange)
- Using browser-only APIs (localStorage, geolocation)
- Managing client-side state
- Using third-party libraries that require browser APIs

## Composition Patterns

### Pattern 1: Server Component with Client Children

```tsx
// app/dashboard/page.tsx (Server Component)
import { getUser } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { Notifications } from '@/components/Notifications';

async function DashboardPage() {
  const user = await getUser();

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      {/* Client Component for interactive features */}
      <Notifications userId={user.id} />
      {/* Server Component for static data */}
      <Dashboard data={user.dashboardData} />
    </div>
  );
}
```

### Pattern 2: Passing Server Data to Client Components

```tsx
// app/products/page.tsx
import { getProducts } from '@/lib/products';
import { ProductFilter } from '@/components/ProductFilter';

async function ProductsPage() {
  const products = await getProducts();

  // Pass fetched data as props to Client Component
  return <ProductFilter initialProducts={products} />;
}
```

```tsx
// components/ProductFilter.tsx
'use client';

import { useState } from 'react';
import type { Product } from '@/types';

interface Props {
  initialProducts: Product[];
}

export function ProductFilter({ initialProducts }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = initialProducts.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search products..."
      />
      <ul>
        {filtered.map(product => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Pattern 3: Children as Props

```tsx
// components/ClientWrapper.tsx
'use client';

import { ThemeProvider } from '@/lib/theme';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
```

```tsx
// app/layout.tsx
import { ClientWrapper } from '@/components/ClientWrapper';
import { Header } from '@/components/Header'; // Server Component

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClientWrapper>
          <Header /> {/* Server Component as child of Client Component */}
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
```

## Data Fetching Patterns

### Parallel Data Fetching

```tsx
async function Dashboard() {
  // Fetch in parallel for better performance
  const [user, posts, analytics] = await Promise.all([
    getUser(),
    getPosts(),
    getAnalytics(),
  ]);

  return (
    <div>
      <UserProfile user={user} />
      <PostList posts={posts} />
      <AnalyticsChart data={analytics} />
    </div>
  );
}
```

### Streaming with Suspense

```tsx
import { Suspense } from 'react';

async function SlowComponent() {
  const data = await fetchSlowData(); // Takes 3 seconds
  return <div>{data}</div>;
}

function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <FastComponent />

      <Suspense fallback={<LoadingSpinner />}>
        <SlowComponent />
      </Suspense>
    </div>
  );
}
```

## Common Mistakes

### Mistake 1: Importing Client Components in Server Components

```tsx
// This is FINE
// app/page.tsx (Server Component)
import { Counter } from '@/components/Counter'; // Client Component

function Page() {
  return <Counter />; // Client Component renders on client
}
```

### Mistake 2: Using Hooks in Server Components

```tsx
// DON'T DO THIS
// app/page.tsx (Server Component)
import { useState } from 'react'; // This will error

function Page() {
  const [count, setCount] = useState(0); // Error!
}
```

### Mistake 3: Passing Functions as Props

```tsx
// DON'T DO THIS
// app/page.tsx
async function Page() {
  const handleClick = () => console.log('clicked');

  // Error: Functions cannot be passed to Client Components
  return <Button onClick={handleClick} />;
}
```

**Solution**: Define the handler in the Client Component or use Server Actions.

## Best Practices

1. **Start with Server Components** - Only add 'use client' when necessary

2. **Keep Client Components Small** - Extract interactive parts into separate Client Components

3. **Push Client Boundaries Down** - Keep as much as possible on the server

4. **Use Suspense for Streaming** - Improve perceived performance

5. **Colocate Data Fetching** - Fetch data in the component that needs it

## Conclusion

React Server Components offer a powerful new paradigm for building React applications. By understanding when to use Server vs Client Components, you can build faster, more efficient applications with better user experience.

The key is to think about where each piece of your UI should run and let that guide your component architecture.
