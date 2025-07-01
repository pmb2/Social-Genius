@echo off
echo === Social Genius Package.json Fix ===
echo.

REM Taking backup of package.json
echo Taking backup of package.json...
copy package.json package.json.backup

REM Update package.json to fix ES Modules issue
echo Updating package.json to fix ES Modules issue...
powershell -Command "(Get-Content package.json) -replace '\"type\": \"module\",', '' | Set-Content package.json"

REM Add pg-native mock to package.json
echo Adding pg-native mock to dependencies...
powershell -Command "(Get-Content package.json) -replace '\"dependencies\": {', '\"dependencies\": {\n    \"pg-native\": \"npm:pg-native-mock@1.0.0\",' | Set-Content package.json"

REM Create fix-db.js script
echo Creating fix-db.js script...
echo // Database initialization script > fix-db.js
echo const { Pool } = require('pg'); >> fix-db.js
echo. >> fix-db.js
echo // Disable pg-native >> fix-db.js
echo process.env.NODE_PG_FORCE_NATIVE = '0'; >> fix-db.js
echo. >> fix-db.js
echo async function main() { >> fix-db.js
echo   try { >> fix-db.js
echo     console.log('Testing database connection...'); >> fix-db.js
echo     const pool = new Pool({ >> fix-db.js
echo       connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/socialgenius', >> fix-db.js
echo       ssl: false, >> fix-db.js
echo       native: false >> fix-db.js
echo     }); >> fix-db.js
echo. >> fix-db.js
echo     const client = await pool.connect(); >> fix-db.js
echo     console.log('Connected to database!'); >> fix-db.js
echo     client.release(); >> fix-db.js
echo     await pool.end(); >> fix-db.js
echo   } catch (err) { >> fix-db.js
echo     console.error('Database connection error:', err); >> fix-db.js
echo     process.exit(1); >> fix-db.js
echo   } >> fix-db.js
echo } >> fix-db.js
echo. >> fix-db.js
echo main(); >> fix-db.js

echo Package.json fixed! Now run the following command to restart your application:
echo.
echo docker-compose -f docker-compose.dev.yml down
echo docker-compose -f docker-compose.dev.yml up -d --build
echo.
echo Or simply run the run-app.bat script.

pause