@echo off
REM Code Intelligence Indexer — Java compile & run wrapper (Windows)
REM Usage: run.bat [project_root_path]

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%~1
if "%PROJECT_ROOT%"=="" set PROJECT_ROOT=%CD%

echo [Code-Index] Compiling Java indexer...
javac -d "%SCRIPT_DIR%out" "%SCRIPT_DIR%*.java"
if %ERRORLEVEL% neq 0 (
    echo [Code-Index] ERROR: Compilation failed
    exit /b 1
)

echo [Code-Index] Running indexer...
java -cp "%SCRIPT_DIR%out" Main "%PROJECT_ROOT%"
