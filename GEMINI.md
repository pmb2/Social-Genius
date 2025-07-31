# Gemini Model Workflow Instructions

This document outlines the operational workflow for the Gemini model when assisting with software engineering tasks. The process emphasizes thorough research, meticulous planning, continuous documentation, and post-completion knowledge transfer, enhanced by powerful MCP server integrations.

## Core Workflow Phases:

### Phase 1: Research and Planning (Pre-Execution)

Before initiating any code modifications or significant actions, the Gemini model will engage in a comprehensive research and planning phase. This phase is critical for ensuring a deep understanding of the request and the existing codebase.

1.  **Clarification and Questioning:**
    *   The model will ask clarifying questions to the user when the request is ambiguous, incomplete, or requires further detail. This ensures alignment with user expectations.
    *   Questions will be concise, targeted, and aimed at gathering essential information for effective planning.

2.  **Codebase Investigation:**
    *   The model will extensively use tools like `search_file_content`, `glob`, `read_file`, and `read_many_files` to understand the relevant code files, functions, tests, and configuration.
    *   Special attention will be paid to existing project conventions, coding styles, architectural patterns, and library/framework usage.
    *   The model will analyze surrounding code to understand the local context (imports, function/class definitions) to ensure any future changes are idiomatic.

3.  **Detailed Note-Taking and Checklist Creation (`tasks.md`):**
    *   Based on the research, the model will create or update a `tasks.md` file in the project root.
    *   This file will contain:
        *   A clear summary of the problem or request.
        *   Detailed findings from the codebase investigation.
        *   A step-by-step plan for addressing the request, broken down into granular, actionable tasks.
        *   Any identified dependencies or prerequisites.
        *   Notes on potential risks or considerations.
    *   This `tasks.md` file will serve as the primary working document and will be continuously updated throughout the execution phases.

### Phase 2: Execution and Continuous Updates

Once the planning phase is complete and the user has implicitly or explicitly approved the plan (by allowing tool calls), the model will proceed with implementation.

1.  **Task-Driven Execution:**
    *   The model will execute tasks as outlined in `tasks.md`, utilizing available tools (`replace`, `write_file`, `run_shell_command`, etc.).
    *   Strict adherence to project conventions (formatting, naming, style) will be maintained.
    *   For critical `run_shell_command` operations that modify the file system or system state, a brief explanation of the command's purpose and potential impact will be provided to the user.

2.  **Real-time `tasks.md` Updates:**
    *   As tasks are completed or new insights emerge during execution, the `tasks.md` file will be immediately updated to reflect progress, new findings, or any adjustments to the plan.
    *   This ensures `tasks.md` always represents the most current state of the work.

3.  **Self-Verification and Debugging:**
    *   The model will incorporate self-verification steps, such as running tests, linting, or build commands, to ensure the correctness and quality of changes.
    *   If errors occur, the model will use debugging techniques (e.g., examining logs, running specific commands) to diagnose and resolve issues, updating `tasks.md` with debugging steps and resolutions.

### Phase 3: Post-Completion Documentation and Archiving

Upon successful completion of all tasks outlined in `tasks.md` and verification of the solution, the model will perform final documentation and archiving steps.

0. **Commit changes**
    * Commit all changes to git with an applicable commit message. Ensure, it commits properly.

1.  **`tasks.md` Archiving:**
    *   The final `tasks.md` file, containing the complete history of the task, will be saved as a backup.
    *   The backup file will be renamed appropriately (e.g., `tasks_YYYYMMDD_feature-name.md`) and stored in a designated archive location (e.g., a `backups` or `archive` directory if one exists, otherwise the project root).

2.  **User/Developer Documentation Generation:**
    *   The model will generate one or more user-facing or developer-focused documentation files based on the completed `tasks.md` and the implemented solution.
    *   These documents will explain the changes, how to use new features, or how to understand the refactored code.
    *   The documents will be saved to the `docs` folder within the project (e.g., `docs/new-feature-guide.md`, `docs/api-settings-integration.md`).
    *   The content and format of these documents will be tailored to the intended audience (e.g., clear, concise instructions for users; technical details and architectural decisions for developers).

## MCP Server Integration and Usage Guidelines

The Gemini CLI is configured with powerful MCP servers that significantly extend its capabilities for Node.js and web application development. Understanding when and how to utilize these tools is crucial for optimal development workflows.

### Available MCP Server Commands

Use `/mcp` to view all configured MCP servers and their status[1][2]. Use `/mcp desc` to see detailed descriptions of available tools and their capabilities[2].

## Tier 1: Essential Development Tools

### Microsoft Playwright MCP Server
**When to use:** Browser automation, QA testing, UI debugging, web scraping, and automated testing workflows[3][4].

**Key capabilities:**
- **Structured browser interactions** via accessibility tree (faster than screenshot-based approaches)[3]
- **Console log monitoring** and network request tracking for debugging web applications
- **Real-time error detection** during UI testing and development
- **Automated test generation** through AI exploration of applications

**Usage scenarios:**
- "Navigate to localhost:3000 and test the login functionality"
- "Take a screenshot of the current page and check for any console errors"
- "Crawl the application and identify any broken links or UI issues"
- "Generate automated tests for the user registration flow"

**Best practices:**
- Use for **comprehensive QA testing** when you need to verify application behavior across different browsers
- Leverage for **debugging frontend issues** by monitoring console logs and network requests
- Ideal for **automated regression testing** and **UI validation**

### Official Redis MCP Server
**When to use:** Caching operations, session management, real-time data storage, and performance optimization[5][6].

**Key capabilities:**
- **Natural language Redis operations**: Store, retrieve, and manage data using conversational commands
- **Complete Redis support**: strings, hashes, lists, sets, sorted sets, streams, pub/sub
- **Vector operations** for AI/ML workflows and semantic search
- **Session and cache management** for web applications

**Usage scenarios:**
- "Store the user session data in Redis with a 30-minute expiration"
- "Cache the API response for the product catalog"
- "Set up a Redis stream for real-time notifications"
- "Store and search vector embeddings for similarity matching"

**Best practices:**
- Use for **session management** in web applications to maintain user state
- Implement **caching strategies** to improve application performance
- Leverage for **real-time features** like notifications, chat, or live updates
- Utilize **pub/sub** for inter-service communication in microservice architectures

### Server Watch MCP
**When to use:** Development process monitoring, real-time log analysis, error tracking, and build process observation[7].

**Key capabilities:**
- **Real-time log capture** from any running command (stdout and stderr)
- **Circular buffer storage** maintaining the last 5,000 log entries
- **Intelligent log searching** with case-insensitive pattern matching
- **Error alerting** and development server monitoring

**Usage scenarios:**
- "Monitor my npm run dev command and alert me to any errors"
- "Search the development server logs for database connection issues"
- "Show me the last 50 log entries from the build process"
- "Watch for specific error patterns in the application logs"

**Best practices:**
- **Wrap development commands** (e.g., `server-watch-mcp npm run dev`) for continuous monitoring
- Use for **debugging production issues** by monitoring application logs
- **Search logs intelligently** using natural language queries
- **Track build and deployment processes** to identify bottlenecks

### GitHub MCP Server
**When to use:** Repository management, code collaboration, issue tracking, and automated workflows[2][8].

**Key capabilities:**
- **Repository operations**: Create, clone, manage repositories and branches
- **Issue and PR management**: Create, update, and track issues and pull requests
- **Code review automation**: Analyze code changes and provide feedback
- **Workflow automation**: Trigger actions and manage CI/CD processes

**Usage scenarios:**
- "Create a new issue for the bug we just discovered"
- "Review the latest pull request and provide feedback"
- "Check the status of the CI/CD pipeline for the current branch"
- "Create a new branch for the feature we're implementing"

**Best practices:**
- Use for **automated code review** and **quality assurance**
- **Track issues and bugs** systematically throughout development
- **Integrate with CI/CD workflows** for seamless deployment
- **Collaborate effectively** on code changes and reviews

## Tier 2: Advanced Professional Tools

### PostgreSQL MCP Pro
**When to use:** Database optimization, performance monitoring, schema analysis, and advanced database operations[9][10].

**Key capabilities:**
- **Advanced performance monitoring** with query optimization recommendations
- **Database health analysis** including connection utilization and buffer cache monitoring
- **Schema management** with intelligent recommendations
- **Index tuning** using industrial-strength algorithms

**Usage scenarios:**
- "Analyze the database performance and suggest optimization strategies"
- "Review the current schema and recommend improvements"
- "Monitor database connections and identify potential bottlenecks"
- "Optimize slow-running queries and suggest better indexes"

**Best practices:**
- Use for **production database optimization** and performance tuning
- **Monitor database health** proactively to prevent issues
- **Analyze query performance** to identify optimization opportunities
- **Manage schema changes** safely and efficiently

### MCP Debugger
**When to use:** Complex debugging scenarios, step-through debugging, variable inspection, and advanced troubleshooting[11][12].

**Key capabilities:**
- **Debug Adapter Protocol (DAP)** integration for comprehensive debugging
- **Breakpoint management** with conditional and logging breakpoints
- **Variable inspection** across multiple scopes and call stacks
- **Multi-language support** (Python, Node.js, and other DAP-compatible debuggers)

**Usage scenarios:**
- "Set a breakpoint in the authentication function and inspect the user object"
- "Debug the API endpoint that's returning incorrect data"
- "Step through the algorithm and identify where the logic error occurs"
- "Inspect the call stack when the application crashes"

**Best practices:**
- Use for **complex debugging scenarios** where standard logging isn't sufficient
- **Set strategic breakpoints** to understand program flow
- **Inspect variables and state** at critical execution points
- **Analyze call stacks** to understand error propagation

### Vibetest-use MCP
**When to use:** Comprehensive QA testing, multi-agent testing scenarios, automated bug discovery, and large-scale application testing.

**Key capabilities:**
- **Multi-agent testing** with configurable agent counts (3, 5, 10+ agents)
- **Comprehensive bug detection** including UI errors, broken links, and accessibility issues
- **Scalable testing** across complex applications
- **Automated reporting** of discovered issues and problems

**Usage scenarios:**
- "Deploy 5 testing agents to crawl the entire application and find bugs"
- "Test the checkout process with multiple concurrent users"
- "Perform accessibility testing across all application pages"
- "Generate a comprehensive bug report for the QA team"

**Best practices:**
- Use for **large-scale testing** of complex applications
- **Deploy multiple agents** for comprehensive coverage
- **Focus on critical user journeys** and business processes
- **Integrate with CI/CD** for automated testing pipelines

### MCPfinder
**When to use:** Discovering new MCP capabilities, staying updated with the ecosystem, and dynamically expanding toolsets.

**Key capabilities:**
- **Search across 547+ MCP servers** in the registry
- **Automatic installation and configuration** management
- **On-demand capability discovery** when users request unavailable features
- **Registry integration** for staying current with ecosystem developments

**Usage scenarios:**
- "Find MCP servers for database management"
- "Search for tools that can help with API testing"
- "Discover new servers for machine learning workflows"
- "Install and configure the latest development tools"

**Best practices:**
- Use to **stay current** with the rapidly evolving MCP ecosystem
- **Discover specialized tools** for specific development needs
- **Expand capabilities** dynamically based on project requirements
- **Explore new integrations** and workflow improvements

## Additional Development Enhancement Tools

### Browser MCP
**When to use:** Production-like testing scenarios, maintaining authenticated sessions, and avoiding bot detection[13].

**Usage scenarios:**
- "Test the application with a real browser session to avoid CAPTCHAs"
- "Maintain logged-in state while testing different features"
- "Perform stealth testing without triggering anti-bot measures"

### MCP Node
**When to use:** Node.js development workflows, TDD cycles, and NPM package management.

**Usage scenarios:**
- "Set up a complete TDD workflow for the new feature"
- "Manage NPM dependencies and check for vulnerabilities"
- "Automate the testing and iteration cycle"

### Console Logs MCP
**When to use:** Frontend debugging, browser error monitoring, and JavaScript troubleshooting.

**Usage scenarios:**
- "Monitor browser console for JavaScript errors during testing"
- "Capture and analyze client-side performance metrics"
- "Debug frontend issues with detailed console output"

## MCP Usage Best Practices

### Tool Selection Strategy
- **Start with fewer tools** rather than overwhelming the context with too many options[14]
- **Choose tools specific to your current task** rather than enabling all available servers
- **Use `/mcp desc`** to understand tool capabilities before making requests[2]

### Naming and Communication
- Use **snake_case** or **dash-separated** names when referencing tools[15]
- Provide **clear, descriptive requests** that specify the desired outcome
- **Be specific about context** and requirements when using MCP tools

### Error Handling and Debugging
- **Monitor MCP server logs** for connection and execution issues[11][12]
- **Use Server Watch MCP** to monitor development processes and catch errors early
- **Check `/mcp` status** regularly to ensure all servers are connected properly

### Performance Optimization
- **Leverage caching** (Redis MCP) for frequently accessed data
- **Monitor database performance** (PostgreSQL MCP Pro) proactively
- **Use browser automation** (Playwright MCP) efficiently to avoid resource waste

### Security Considerations
- **Use environment variables** for sensitive configuration (API keys, passwords)
- **Implement proper access controls** for database and external service connections
- **Monitor tool usage** and log all significant operations for audit trails

### Integration Workflows
1. **Development Phase**: Use Server Watch MCP, MCP Node, and debugging tools
2. **Testing Phase**: Leverage Playwright MCP, Vibetest-use MCP, and Browser MCP
3. **Database Operations**: Utilize Redis MCP and PostgreSQL MCP Pro
4. **Deployment and Monitoring**: Integrate with GitHub MCP and logging tools

This structured approach ensures transparency, maintainability, and knowledge transfer throughout the software development lifecycle while leveraging the full power of the MCP ecosystem for enhanced productivity and code quality.

**Note**: Be thorough in your investigations and make clean solutions that work with the existing code and do not break anything. Always leverage the appropriate MCP servers based on the task requirements, and remember that the MCP ecosystem provides ready-made solutions for most development scenarios, eliminating the need for custom implementations in the majority of cases.
