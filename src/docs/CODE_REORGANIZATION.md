# Code Reorganization - Domain-Driven Design

This document describes the reorganization of the Social Genius codebase to follow domain-driven design principles, providing a more maintainable and scalable architecture.

## Motivation

The original codebase had all components, services, and utilities in flat directories, making it difficult to understand relationships between files and components. The new structure organizes code by domain/feature, making it clearer which components and services are related.

## New Structure

We've moved all relevant code into a single `/src` directory with the following structure:

```
/src
  /components       # UI components organized by feature
    /auth           # Authentication-related components
    /business       # Business profile components
    /compliance     # Compliance check components
    /ui             # Reusable UI components
  /lib              # Utilities, hooks, and context providers
    /auth           # Auth-related utilities
    /hooks          # React hooks
    /providers      # Context providers
    /utilities      # General utilities
  /services         # Service-oriented code by domain
    /api            # API services
    /auth           # Authentication services
    /compliance     # Compliance services
    /database       # Database services
    /subscription   # Subscription services
  /types            # TypeScript type definitions
```

## Path Aliases

To make imports cleaner and more maintainable, we've set up path aliases in `tsconfig.json`:

```json
"paths": {
  "@/*": ["./*"],
  "@/app/*": ["./app/*"],
  "@/components/*": ["./src/components/*"],
  "@/lib/*": ["./src/lib/*"],
  "@/services/*": ["./src/services/*"],
  "@/utils/*": ["./src/lib/utilities/*"],
  "@/types/*": ["./src/types/*"]
}
```

This allows us to use imports like:
- `import { Button } from "@/components/ui/button"`
- `import { useAuth } from "@/lib/auth"`
- `import { PostgresService } from "@/services/database/postgres-service"`

## Migration Process

The migration was performed in these steps:

1. Create the new directory structure in `/src`
2. Move files to their appropriate domains, organizing by feature
3. Update import paths throughout the codebase to use the new structure
4. Update `tsconfig.json` with the new path aliases
5. Fix any broken references
6. Remove the old files

## Benefits

This reorganization provides several benefits:

1. **Better organization**: Code is grouped by domain/feature, making it easier to understand the codebase
2. **Improved developer experience**: Clean imports using path aliases make the code more readable
3. **Clearer relationships**: The relationship between components, services, and utilities is clearer
4. **Scalability**: New features can be added in their own domain without cluttering existing code
5. **Better separation of concerns**: Each domain has its own components, services, and utilities

## Migration Challenges

Some challenges we faced during migration:

1. Identifying which domains certain files belonged to
2. Updating all import paths throughout the codebase
3. Handling circular dependencies
4. Maintaining compatibility with the Next.js app router

## Future Improvements

Some future improvements that could build on this reorganization:

1. Add domain-specific index files for cleaner exports
2. Implement proper module boundaries with explicit public APIs
3. Add more comprehensive type definitions
4. Write integration tests that verify the correct relationships between domains