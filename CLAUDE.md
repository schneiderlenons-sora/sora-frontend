# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Getting Started

**Development Server:**
```bash
npm run dev
# Opens on http://localhost:3000
```

**Build & Lint:**
```bash
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint
```

## Project Overview

**Sora** is a Next.js financial assistant application that helps users manage their finances through WhatsApp integration. The app uses Supabase for authentication and backend services, with a React 19 + Tailwind CSS frontend.

### Key Features
- User authentication (signup/login) via Supabase
- Financial transactions tracking (income/expenses)
- Bank account (wallet) management
- Budget limits (general and per-category)
- Group expense sharing
- Investment portfolio (premium/black plan users)
- Reports and analytics with charts (Recharts)

### Technology Stack
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Framework**: React 19.2.4 + Tailwind CSS 4
- **Database/Auth**: Supabase (ssr client)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS + tailwindcss-animate
- **Theme**: next-themes for dark mode support

### Language
The application is in **Portuguese (Brazil)**. All user-facing text, error messages, and documentation references use Portuguese.

## Architecture

### Directory Structure
```
app/               # Next.js App Router pages (route segments)
├── layout.tsx     # Root layout with AuthProvider
├── page.tsx       # Landing page
├── login/         # Login page
├── signup/        # Signup page
├── dashboard/     # Main dashboard with charts and transactions
├── contas-bancarias/     # Bank accounts (wallets) management
├── relatorios/    # Reports/analytics page
├── vincular-whatsapp/    # WhatsApp linking page

components/       # Reusable UI components
├── layout/       # Layout components (DashboardLayout, Sidebar)
└── dashboard/    # Dashboard-specific components (NovaTransacaoModal)

contexts/         # React Context providers
├── AuthContext.tsx       # Authentication and user profile context

lib/             # Utility functions and API client
├── api.ts        # Centralized API client with typed endpoints
└── supabase.ts   # Supabase client initialization

public/          # Static assets (logos, images, videos)
```

### Authentication & Authorization

**AuthContext** ([contexts/AuthContext.tsx](contexts/AuthContext.tsx)) manages:
- Supabase authentication (signup/signin/signout)
- User profile loading (from `users` table)
- Plan tier detection (`isBlack`, `isPremium`)
- Active group tracking
- Profile refresh on demand

**Key Types:**
```typescript
interface Perfil {
  id: string;
  phone: string | null;
  name: string;
  plano: 'inativo' | 'basico' | 'premium' | 'black';
  grupo_ativo: { id: string; nome: string } | null;
}
```

**Supabase Table Relations:**
- `users` table has FK `users_grupo_ativo_fkey` pointing to `grupos`
- User profiles are auto-created by Supabase trigger on signup
- Phone field is set during WhatsApp linking (`vincular-whatsapp` flow)

### API Client

[lib/api.ts](lib/api.ts) provides a centralized typed API layer:
```typescript
const api = {
  user: { get, updatePlan },
  transacoes: { listar, resumo, criar, editar, deletar },
  wallets: { listar, salvar, deletar },
  categorias: { listar, criar, editar, deletar },
  limites: { listar, setGeral, setCategoria, deletar },
  grupos: { listar, convidar, aceitar, trocar },
  investimentos: { listar, distribuicao, patrimonio, ... },
}
```

All API calls:
- Use centralized `req<T>()` function with error handling
- Expect JSON responses
- Pass `x-api-token` header from `NEXT_PUBLIC_API_TOKEN` env var
- Use `NEXT_PUBLIC_API_URL` as base (default: `http://localhost:3000`)

### Important Next.js 16 Notes

This version has breaking changes from older Next.js versions. **Read `node_modules/next/dist/docs/` before writing new code.** Key differences:
- Modern App Router structure (no Pages directory)
- Server Components by default (use `'use client'` for client-side)
- Metadata API for SEO (not `<Head>` tag)
- TypeScript path alias `@/*` resolves to project root

## Common Tasks

### Adding a New Page
1. Create `app/new-feature/page.tsx`
2. Mark as `'use client'` if using hooks or interactivity
3. Import `useAuth()` for protected routes
4. Add sidebar/nav link in `components/layout/Sidebar.tsx`

### Adding an API Endpoint
1. Create method in [lib/api.ts](lib/api.ts) under appropriate `api.category`
2. Use `req<ReturnType>()` wrapper
3. Handle errors in the component with try/catch
4. Call from client component via `useAuth().phone` for user context

### Working with Data
- **Categories**: Format with emoji prefix (e.g., `"📚 Educação"`)
- **Dates**: ISO string format `YYYY-MM-DD` for API, local manipulation in components
- **Currency**: Use `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` for display
- **Phone**: Stored in `perfil.phone`, required for most API calls

### Charts & Visualization
- Uses **Recharts** for all charts (LineChart, AreaChart, BarChart, PieChart)
- Brand color: `#61D17B` (Sora green)
- Dashboard palette: CORES array with 8 colors for multi-series data

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_TOKEN=<your-backend-token>
```

Public env vars (prefixed with `NEXT_PUBLIC_`) are accessible in browser. Backend token should be rotated regularly.

## Code Style & Conventions

- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS utility classes (no CSS files)
- **Type Safety**: Full TypeScript, explicit types for props and API responses
- **Error Handling**: User-friendly Portuguese error messages
- **Formatting**: Code is linted with ESLint (run `npm run lint`)

## Testing

No test suite currently configured. Manual testing in dev server is standard.

## Deployment

Built with Vercel in mind (uses `next/font`, metadata API, etc.). Build command: `npm run build`
