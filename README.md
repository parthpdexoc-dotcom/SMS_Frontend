# Shift Management System

A modern, responsive React + TypeScript application for managing shifts and employee schedules.

## Features

- 🎨 Modern, consistent UI design
- 📱 Fully responsive layout
- 🧩 Atomic Design Pattern (Atoms, Molecules, Organisms)
- ⚡ Built with Vite for fast development
- 🔷 TypeScript for type safety
- 🎯 Reusable component architecture

## Project Structure

```
src/
├── components/
│   ├── atoms/          # Basic UI components (Button, Input, Card, etc.)
│   ├── molecules/      # Composite components (FormField, StatCard, etc.)
│   └── organisms/      # Complex components (Dashboard, Navigation, etc.)
├── styles/            # Global styles and theme
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
└── App.tsx            # Main application component
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Component Architecture

This project follows the **Atomic Design Pattern**:

- **Atoms**: Basic building blocks (Button, Input, Icon, etc.)
- **Molecules**: Simple combinations of atoms (FormField, StatCard, etc.)
- **Organisms**: Complex components using molecules (Dashboard, Navigation, etc.)

Each component has its own folder with:
- Component file (`.tsx`)
- Styles file (`.css`)
- Index file for clean imports

## Best Practices

- ✅ No code duplication
- ✅ Consistent design system
- ✅ Responsive design
- ✅ TypeScript for type safety
- ✅ Clear and understandable code structure
- ✅ Reusable components

## Superuser Impersonation Flow

This app supports opening an employee impersonation session in a separate browser tab without affecting the superuser tab.

- **Token isolation**: auth token is stored in `sessionStorage` (tab-scoped), not `localStorage`.
- **Start impersonation**: superuser clicks `Login as Employee` in the employee list.
- **Backend call**: frontend calls `POST /api/auth/impersonate` (via `/auth/impersonate` in client code) with `{ employeeId }` using the current bearer token.
- **New tab bootstrap**: a blank tab is opened first, then navigated to `/employee-auto-login?token=...`.
- **Auto-login page** (`EmployeeAutoLoginPage`):
  - reads token from URL query
  - validates basic JWT structure
  - saves token to `sessionStorage`
  - marks impersonation mode in `sessionStorage`
  - removes token from URL using `history.replaceState`
  - redirects to employee dashboard route
- **Exit impersonation**: in impersonated employee tab, header logout label changes to `Exit impersonation`; logout clears tab token/session only.

### Key files

- `src/services/authService.ts`  
  Token helpers + impersonation API + new-tab handoff helper.
- `src/features/auth/pages/EmployeeAutoLoginPage.tsx`  
  Auto-login bootstrap route logic.
- `src/features/employee-administration/pages/EmployeeList/EmployeeList.tsx`  
  `Login as Employee` action integration.

