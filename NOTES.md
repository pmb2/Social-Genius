- in new modal: add API key fields to the settings and if API keys are missing provide a hyperlink of all the missing API's that brings the user to the settings page where the API keys are stored.
for example: when it says:  "Some required API keys are missing: GROQ_API_KEY, DATABASE_URL, EXA_API_KEY. Please add them to your .env file to enable full functionality.

You can still use this interface, but some features might not work properly." have GROQ_API_KEY, DATABASE_URL, EXA_API_KEY be hyperlinks that lead to their respective fields in the settings. and ensure once users add their api keys and save the settings that everything is updated.

- Edit Business Profile: ensure we are not assigning default values for fields that have not been modified and ensure our save button works correctly and updates the details in both the app and database.
- Delete business button not working properly
- 