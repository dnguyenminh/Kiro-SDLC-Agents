#!/usr/bin/env bash
# Code Intelligence Indexer — Java compile & run wrapper (Linux/Mac)
# Usage: ./run.sh [project_root_path]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${1:-$(pwd)}"

echo "[Code-Index] Compiling Java indexer..."
mkdir -p "$SCRIPT_DIR/out"
javac -d "$SCRIPT_DIR/out" "$SCRIPT_DIR"/*.java
if [ $? -ne 0 ]; then
    echo "[Code-Index] ERROR: Compilation failed"
    exit 1
fi

echo "[Code-Index] Running indexer..."
java -cp "$SCRIPT_DIR/out" Main "$PROJECT_ROOT"
