@echo off
echo Starting PocketBase Server...
start "PocketBase" cmd /c ".\pocketbase\pocketbase.exe serve --dir=".\pocketbase_data" --dev"

echo Starting Next.js Dev Server...
start "Next.js" cmd /k "npm run dev"

echo Both servers have been started!
