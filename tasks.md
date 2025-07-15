## tasks.md

### 🎯 Objective:

- We need to update tab our Brand Alignment tab in our business profile modal and we will be adding functionality from our old app (found C:\Users\TBA\Documents\github\Social-Genius\old )adding all of it’s postcard post generation functionality, included but not limited to the functionality listed below). We are going to use the groq model and tool calling that we have set up but we need to add this tool calling functionality into our Brand Alignment chat by incorporating our prompts from our old app (found C:\Users\TBA\Documents\github\Social-Genius\old\prompts)


### Functionalities required:

- Everything within the Home_chatContainer.
- Complete chat interface dashboard with the postcard generation for each of the socials
- UI to be cleanly transferred and sized up correctly to fit seamlessly

- Ask clarify questions as we go if needed.

---

### ✅ Integration Checklist:

This checklist details the steps to integrate the postcard generation functionality into the Brand Alignment tab.

**Phase 1: Understanding and Setup**

1.  **Review Current Project Structure:**
    *   **Objective:** Understand how the existing "Brand Alignment" tab is structured and rendered.
    *   **Files to Examine:**
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/app/(protected)/dashboard/page.tsx`: Entry point for the dashboard.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/src/components/business/profile/dashboard.tsx`: Likely renders the `BusinessProfileModal`.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/src/components/business/profile/modal.tsx`: Contains the `BrandAlignmentTab` component.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/src/components/business/brand-alignment-tab.tsx`: The target component for integrating the new functionality.

2.  **Analyze Old Application's Core Logic:**
    *   **Objective:** Identify and understand the key components and logic for postcard generation in the old app.
    *   **Files to Examine:**
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/old/pages/index.js`: Contains the `Home_chatContainer` with chat interface, post generation logic (`handleGeneratePosts`), file upload (`handleFileUpload`), and settings.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/old/components/groqService.js`: Contains `getGroqChatCompletion` for interacting with the Groq model.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/old/prompts/pre-prompt.js`: Defines the initial context/instructions for the AI.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/old/prompts/prompt-template.js`: Constructs the dynamic prompt based on user input and settings.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/old/components/PostCard.js`: Renders individual generated posts.
        *   * [ ] `/mnt/c/Users/TBA/Documents/github/Social-Genius/old/styles/Home.module.css`: Contains styling for the chat interface.

**Phase 2: Migration and Integration**

3.  **Migrate Groq Service:**
    *   **Action:** * [x] Copy `old/components/groqService.js` to `src/services/groq-service.ts`.
    *   **Notes:**
        *   * [x] Rename to `.ts` and adapt to TypeScript syntax (add types, `export` statements).
        *   * [x] Ensure `getGroqChatCompletion` is correctly exported and callable.

4.  **Migrate Prompts:**
    *   **Action:** * [x] Copy `old/prompts/pre-prompt.js` to `src/prompts/pre-prompt.ts`.
    *   **Action:** * [x] Copy `old/prompts/prompt-template.js` to `src/prompts/prompt-template.ts`.
    *   **Notes:**
        *   * [x] Rename to `.ts` and adapt to TypeScript.
        *   * [x] Ensure `prePrompt` and `promptTemplate` are correctly exported.

5.  **Integrate Post Generation UI into `BrandAlignmentTab`:**
    *   **Action:** * [x] Modify `/mnt/c/Users/TBA/Documents/github/Social-Genius/src/components/business/brand-alignment-tab.tsx`.
    *   **Notes:**
        *   * [x] Port the chat input, settings, and platform selection UI elements from `old/pages/index.js`.
        *   * [x] Utilize existing UI components from the current project's `src/components/ui` directory (e.g., `Button`, `Input`, `Select`, `RadioGroup`, `Checkbox`) to maintain design consistency.
        *   * [x] Implement state management (`useState`, `useEffect`) for `messages`, `posts`, `settings`, `userInput`, `uploadedContent`, `loading`, `error`, `showSettings`, `dragging`, etc., similar to `old/pages/index.js`.

6.  **Port Post Generation Logic:**
    *   **Action:** * [x] Integrate the functions `handleGeneratePosts`, `handleFileUpload`, `handleDragOver`, `handleDrop`, `handleDragLeave`, `handleUploadClick`, `toggleSettings`, `handleSettingChange`, `handlePlatformToggle` from `old/pages/index.js` into `src/components/business/brand-alignment-tab.tsx`.
    *   **Notes:**
        *   * [x] Ensure all function dependencies (e.g., `getGroqChatCompletion`, `prePrompt`, `promptTemplate`, `axios` for file upload) are correctly imported and used.
        *   * [x] Verify the file upload API endpoint (`/api/upload`). If it doesn't exist in the new project, it needs to be created (check `app/api` directory for existing patterns).

7.  **Migrate and Integrate `PostCard` Component:**
    *   **Action:** * [x] Copy `old/components/PostCard.js` to `src/components/PostCard.tsx`.
    *   **Notes:**
        *   * [x] Rename to `.tsx` and adapt to TypeScript.
        *   * [x] Integrate `PostCard` into `src/components/business/brand-alignment-tab.tsx` to display the `generatedPosts`.

8.  **Migrate Styling:**
    *   **Action:** * [x] Review `old/styles/Home.module.css`.
    *   **Notes:**
        *   * [x] Extract relevant CSS rules for the chat interface, settings, and postcard display.
        *   * [x] Translate these styles into Tailwind CSS classes directly within the JSX of `brand-alignment-tab.tsx` and `PostCard.tsx`, or add them to the global CSS if they are truly global styles. Avoid creating new CSS modules unless absolutely necessary.

**Phase 3: Testing and Refinement**

9.  **Thorough Testing:**
    *   **Action:** * [ ] Manually test the postcard generation functionality within the "Brand Alignment" tab.
    *   **Notes:**
        *   * [ ] Test with various topics, tones, lengths, hashtags, and CTAs.
        *   * [ ] Test file upload functionality.
        *   * [ ] Verify that generated posts are displayed correctly.
        *   * [ ] Check for any console errors or warnings.

10. **UI/UX Refinement:**
    *   **Action:** * [ ] Adjust the layout and appearance to seamlessly integrate with the existing business profile modal's design.
    *   **Notes:**
        *   * [ ] Ensure responsiveness and proper sizing across different screen sizes.
        *   * [ ] Address any remaining accessibility warnings.

11. **Code Review and Cleanup:**
    *   **Action:** * [ ] Review the integrated code for adherence to project conventions, code quality, and efficiency.
    *   **Notes:**
        *   * [ ] Remove any unused imports or dead code.
        *   * [ ] Add comments only where necessary to explain complex logic.
        *   * [ ] Ensure all types are correctly defined and used.