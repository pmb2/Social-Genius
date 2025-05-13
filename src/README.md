# Social Genius - Source Code Organization

This directory contains the reorganized source code for the Social-Genius project, following domain-driven design principles.

## Directory Structure

- `/components/` - UI components organized by domain/feature
  - `/auth/` - Authentication components (login forms, etc.)
  - `/business/` - Business profile components
  - `/compliance/` - Compliance checking components
  - `/layout/` - Layout components (headers, footers)
  - `/notifications/` - Notification components
  - `/subscription/` - Subscription related components
  - `/ui/` - Reusable UI components (buttons, inputs, etc.)
  - `/user/` - User profile components

- `/lib/` - Utilities, hooks, and providers
  - `/auth/` - Authentication context and utilities
  - `/hooks/` - Custom React hooks
  - `/providers/` - Context providers
  - `/ui/` - UI utilities
  - `/utilities/` - General utilities

- `/services/` - Services for interacting with external systems
  - `/api/` - API services
  - `/auth/` - Authentication services
  - `/compliance/` - Compliance checking services
  - `/database/` - Database services
  - `/subscription/` - Subscription services

- `/types/` - TypeScript type definitions

## Path Aliases

The project uses path aliases to make imports cleaner:

- `@/components/*` → `./src/components/*`
- `@/lib/*` → `./src/lib/*`
- `@/services/*` → `./src/services/*`
- `@/utils/*` → `./src/lib/utilities/*`
- `@/types/*` → `./src/types/*`

## Principles

1. **Domain-driven organization**: Code is organized by feature/domain rather than technical concerns
2. **Single responsibility**: Each file should have a single responsibility
3. **Explicit dependencies**: Dependencies are explicitly imported rather than implicitly provided
4. **Strong typing**: TypeScript interfaces and types are used throughout
5. **Testable code**: Code is written to be testable with clear boundaries

## Migration Details

This reorganization was performed to improve code maintainability and follow domain-driven design principles. The original files from `/components/`, `/lib/`, and `/services/` directories were moved to their new locations while preserving functionality.

Import paths throughout the codebase have been updated to use the new structure and path aliases.