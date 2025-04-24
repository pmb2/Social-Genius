# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build`
- Development: `npm run dev` or `npm run dev:quiet`
- Lint: `npm run lint`
- Test compliance: `npm run test:compliance`
- Install browsers: `npm run install:browsers`
- Dependency check: `npm run check-deps`

## Code Style
- TypeScript with strict mode enabled
- Next.js app router structure
- Components use PascalCase and feature-based organization
- Utilities use camelCase with verb-noun format 
- React hooks prefix with "use" (useAuth, useModal)
- Files follow domain-driven organization
- Error handling: use try/catch with getErrorMessage utility
- Import structure: external libraries first, internal modules next
- Formatting: 2-space indentation, semicolons required
- Tailwind for styling with cn utility for conditional classes

## Component Patterns
- UI components in components/ui with proper React.forwardRef usage
- Props interfaces with PascalCase and descriptive naming
- Expose sensible defaults for variant/size props
- Server/client components appropriately marked