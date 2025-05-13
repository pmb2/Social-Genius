# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build`
- Development: `npm run dev` or `npm run dev:quiet`
- Lint: `npm run lint`
- Test compliance: `npm run test:compliance`
- Install browsers: `npm run install:browsers`
- Dependency check: `npm run check-deps`
- List screenshots: `node src/scripts/list-screenshots.js`
- View screenshot: `node src/scripts/view-screenshot.js [userId] [filename]`
- Test Google auth: `npm run test:google-auth`
- Test API auth: `npm run test:api-auth`
- Test screenshot capture: `npm run test:screenshot`
- Health check: `npm run health:check`
- Redis monitor: `npm run redis:monitor`
- Browser monitor: `npm run browser:monitor`

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

## Google Authentication Screenshot Capture

The project has an automated screenshot capture system for Google authentication to help with debugging. Screenshots are saved to:

```
src/api/browser-use/screenshots/{userId}/{timestamp-description}.png
```

Key points:
- Screenshots taken at multiple points during authentication
- Stored with descriptive filenames including timestamps
- Accessible via API endpoints or utility scripts
- Used for debugging authentication issues
- PNG validation to ensure screenshots are properly captured
- Trace IDs included for cross-component tracking
- Configurable capture points for authentication flow

Available utilities:
- `npm run test:screenshot` - Tests basic screenshot capability
- `npm run test:google-auth` - Tests direct authentication with screenshots
- `npm run test:api-auth` - Tests API-based authentication with screenshots
- `npm run health:check` - Complete system health check including screenshots
- `src/scripts/list-screenshots.js` - Lists all available screenshots
- `src/scripts/view-screenshot.js` - Displays a screenshot in the browser

Screenshot capture points:
- `login-start` - Beginning of authentication process
- `enter-email` - After entering email address
- `enter-password` - After entering password
- `before-submit` - Before submitting login form
- `after-login` - After successful login
- `challenge-detection` - When a security challenge is detected
- `business-profile` - When business profile page is loaded
- `login-complete` - At completion of authentication process
- `error-state` - When an error occurs during authentication