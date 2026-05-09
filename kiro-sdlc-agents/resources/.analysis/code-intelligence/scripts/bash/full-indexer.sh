#!/usr/bin/env bash
# ===========================================================================
# Code Intelligence System — Full Indexer (Bash Edition)
#
# Zero external dependencies — uses only bash 4+, find, grep, sha256sum/shasum.
# Produces the same output as Node.js/Python/PowerShell versions:
#   - .analysis/code-intelligence/project-structure.md
#   - .analysis/code-intelligence/modules/{module}.md
#   - .analysis/code-intelligence/index-metadata.json
#   - .analysis/code-intelligence/kb-payloads.json
#
# Usage:
#   ./full-indexer.sh [project_root_path]
#   bash full-indexer.sh /path/to/project
# ===========================================================================

set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
OUTPUT_DIR="$ROOT_DIR/.analysis/code-intelligence"
CONFIG_FILE="$OUTPUT_DIR/index-config.json"
START_TIME=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m'

# ===========================================================================
# Configuration (hardcoded defaults — config file parsing is limited in bash)
# ===========================================================================

EXCLUDED_DIRS="build|dist|out|target|\.gradle|\.git|\.analysis|node_modules|\.idea|\.kiro|\.vscode|__pycache__|\.mypy_cache|vendor|bin|obj"
INCLUDED_EXTS="kt|java|ts|tsx|js|jsx|py|go|rs|cs|gradle\.kts|gradle|yml|yaml|properties|xml|json|sql|toml|cfg|ini"
EXCLUDED_PATTERNS=".*\.generated\..*|.*\.min\..*|.*\.map$|.*\.lock$|.*\.sum$"

# ===========================================================================
# Utility Functions
# ===========================================================================

log_info() { echo -e "[Code-Index] INFO: $1"; }
log_error() { echo -e "[Code-Index] ERROR: $1" >&2; }

# Cross-platform SHA256
compute_hash() {
    if command -v sha256sum &>/dev/null; then
        sha256sum "$1" | cut -d' ' -f1
    elif command -v shasum &>/dev/null; then
        shasum -a 256 "$1" | cut -d' ' -f1
    else
        echo "no-hash"
    fi
}

# Map file extension to language
get_language() {
    local file="$1"
    local basename=$(basename "$file")
    local lower="${basename,,}"
    
    # Compound extensions first
    [[ "$lower" == *.gradle.kts ]] && echo "gradle" && return
    
    local ext="${lower##*.}"
    case "$ext" in
        kt) echo "kotlin" ;; java) echo "java" ;; ts|tsx) echo "typescript" ;;
        js|jsx) echo "javascript" ;; py) echo "python" ;; go) echo "go" ;;
        rs) echo "rust" ;; cs) echo "csharp" ;; gradle) echo "gradle" ;;
        yml|yaml) echo "yaml" ;; xml) echo "xml" ;; sql) echo "sql" ;;
        json) echo "json" ;; properties) echo "properties" ;;
        toml|cfg|ini) echo "config" ;; *) echo "unknown" ;;
    esac
}

# ===========================================================================
# Project Detector
# ===========================================================================

detect_project() {
    local project_type="generic"
    local build_file="none"
    local primary_language="unknown"
    local framework=""
    
    # Check build files in priority order
    if [[ -f "$ROOT_DIR/build.gradle.kts" ]]; then project_type="gradle-kotlin"; build_file="build.gradle.kts"
    elif [[ -f "$ROOT_DIR/build.gradle" ]]; then project_type="gradle-java"; build_file="build.gradle"
    elif [[ -f "$ROOT_DIR/pom.xml" ]]; then project_type="maven-java"; build_file="pom.xml"
    elif [[ -f "$ROOT_DIR/package.json" ]]; then project_type="npm"; build_file="package.json"
    elif [[ -f "$ROOT_DIR/Cargo.toml" ]]; then project_type="cargo-rust"; build_file="Cargo.toml"
    elif [[ -f "$ROOT_DIR/go.mod" ]]; then project_type="go-module"; build_file="go.mod"
    elif [[ -f "$ROOT_DIR/pyproject.toml" ]]; then project_type="python"; build_file="pyproject.toml"
    elif [[ -f "$ROOT_DIR/setup.py" ]]; then project_type="python"; build_file="setup.py"
    fi
    
    # Check .sln
    if [[ "$project_type" == "generic" ]]; then
        local sln=$(find "$ROOT_DIR" -maxdepth 1 -name "*.sln" | head -1)
        if [[ -n "$sln" ]]; then project_type="dotnet"; build_file=$(basename "$sln"); fi
    fi
    
    # Refine npm
    if [[ "$project_type" == "npm" ]]; then
        if [[ -f "$ROOT_DIR/tsconfig.json" ]]; then project_type="npm-typescript"
        else project_type="npm-javascript"; fi
    fi
    
    # Language from project type
    case "$project_type" in
        gradle-kotlin) primary_language="kotlin" ;;
        gradle-java|maven-java) primary_language="java" ;;
        npm-typescript) primary_language="typescript" ;;
        npm-javascript) primary_language="javascript" ;;
        cargo-rust) primary_language="rust" ;;
        go-module) primary_language="go" ;;
        python) primary_language="python" ;;
        dotnet) primary_language="csharp" ;;
    esac
    
    # Framework detection
    if [[ -f "$ROOT_DIR/$build_file" && "$build_file" != "none" ]]; then
        local content=$(cat "$ROOT_DIR/$build_file" 2>/dev/null || echo "")
        case "$project_type" in
            gradle-*)
                [[ "$content" == *"spring-boot-starter"* ]] && framework="Spring Boot"
                [[ "$content" == *"io.ktor"* || "$content" == *"ktor-"* ]] && framework="Ktor"
                ;;
            maven-java)
                [[ "$content" == *"spring-boot-starter"* ]] && framework="Spring Boot"
                ;;
            npm-*)
                [[ "$content" == *'"react"'* ]] && framework="React"
                [[ "$content" == *'"next"'* ]] && framework="Next.js"
                [[ "$content" == *'"@angular/core"'* ]] && framework="Angular"
                [[ "$content" == *'"vue"'* ]] && framework="Vue.js"
                [[ "$content" == *'"express"'* ]] && framework="Express.js"
                [[ "$content" == *'"@nestjs/core"'* ]] && framework="NestJS"
                ;;
            python)
                [[ "$content" == *"django"* ]] && framework="Django"
                [[ "$content" == *"fastapi"* ]] && framework="FastAPI"
                [[ "$content" == *"flask"* ]] && framework="Flask"
                ;;
        esac
    fi
    
    log_info "Project detected — type=$project_type, language=$primary_language, framework=$framework, buildFile=$build_file"
    
    # Export as global vars
    PROJECT_TYPE="$project_type"
    BUILD_FILE="$build_file"
    PRIMARY_LANGUAGE="$primary_language"
    FRAMEWORK="$framework"
}

# ===========================================================================
# Module Discovery (simplified — handles root module + gradle/maven)
# ===========================================================================

discover_modules() {
    MODULES=()
    MODULE_PATHS=()
    MODULE_SRC_DIRS=()
    
    case "$PROJECT_TYPE" in
        gradle-*)
            for sf in "settings.gradle.kts" "settings.gradle"; do
                if [[ -f "$ROOT_DIR/$sf" ]]; then
                    while IFS= read -r name; do
                        local mod_path="${name#:}"
                        mod_path="${mod_path//:///}"
                        if [[ -d "$ROOT_DIR/$mod_path" ]]; then
                            MODULES+=("${mod_path//\//-}")
                            MODULE_PATHS+=("$mod_path")
                            # Detect src dirs
                            local src_dirs=""
                            for sd in "src/main/kotlin" "src/main/java" "src/test/kotlin" "src/test/java"; do
                                [[ -d "$ROOT_DIR/$mod_path/$sd" ]] && src_dirs="$src_dirs $mod_path/$sd"
                            done
                            [[ -z "$src_dirs" ]] && src_dirs="$mod_path"
                            MODULE_SRC_DIRS+=("$src_dirs")
                        fi
                    done < <(grep -oP '["'"'"']\K[^"'"'"']+' "$ROOT_DIR/$sf" | grep -v "^$" | sort -u)
                    break
                fi
            done
            ;;
        maven-java)
            if [[ -f "$ROOT_DIR/pom.xml" ]]; then
                while IFS= read -r name; do
                    if [[ -d "$ROOT_DIR/$name" ]]; then
                        MODULES+=("$name")
                        MODULE_PATHS+=("$name")
                        local src_dirs=""
                        for sd in "src/main/kotlin" "src/main/java"; do
                            [[ -d "$ROOT_DIR/$name/$sd" ]] && src_dirs="$src_dirs $name/$sd"
                        done
                        [[ -z "$src_dirs" ]] && src_dirs="$name"
                        MODULE_SRC_DIRS+=("$src_dirs")
                    fi
                done < <(grep -oP '<module>\s*\K[^<]+' "$ROOT_DIR/pom.xml")
            fi
            ;;
    esac
    
    # Fallback: single root module
    if [[ ${#MODULES[@]} -eq 0 ]]; then
        MODULES=("root")
        MODULE_PATHS=(".")
        if [[ -d "$ROOT_DIR/src" ]]; then MODULE_SRC_DIRS=("src")
        elif [[ -d "$ROOT_DIR/lib" ]]; then MODULE_SRC_DIRS=("lib")
        else MODULE_SRC_DIRS=("."); fi
    fi
    
    log_info "Module discovery — found ${#MODULES[@]} module(s) for $PROJECT_TYPE"
}

# ===========================================================================
# File Scanner & Parser
# ===========================================================================

scan_and_parse_module() {
    local mod_idx=$1
    local mod_name="${MODULES[$mod_idx]}"
    local src_dirs="${MODULE_SRC_DIRS[$mod_idx]}"
    
    local mod_classes=0
    local mod_functions=0
    local mod_files=0
    local classes_list=""
    local functions_list=""
    
    for src_dir in $src_dirs; do
        local abs_dir="$ROOT_DIR/$src_dir"
        [[ ! -d "$abs_dir" ]] && continue
        
        while IFS= read -r -d '' file; do
            local rel_path="${file#$ROOT_DIR/}"
            local basename=$(basename "$file")
            
            # Check excluded patterns
            if echo "$basename" | grep -qE "$EXCLUDED_PATTERNS"; then continue; fi
            
            local lang=$(get_language "$file")
            ((TOTAL_FILES++)) || true
            ((mod_files++)) || true
            
            # Simple parsing — extract class/function names
            case "$lang" in
                kotlin|java)
                    local cls=$(grep -oP '(?:class|interface|object|enum)\s+\K\w+' "$file" 2>/dev/null | head -20)
                    local fns=$(grep -oP 'fun\s+\K\w+' "$file" 2>/dev/null | head -20)
                    [[ -z "$fns" ]] && fns=$(grep -oP '(?:public|private|protected)\s+\w+\s+\K\w+(?=\s*\()' "$file" 2>/dev/null | head -20)
                    ;;
                python)
                    local cls=$(grep -oP '^class\s+\K\w+' "$file" 2>/dev/null | head -20)
                    local fns=$(grep -oP '^def\s+\K\w+' "$file" 2>/dev/null | head -20)
                    ;;
                typescript|javascript)
                    local cls=$(grep -oP 'class\s+\K\w+' "$file" 2>/dev/null | head -20)
                    local fns=$(grep -oP '(?:function|export\s+function|async\s+function)\s+\K\w+' "$file" 2>/dev/null | head -20)
                    ;;
                go)
                    local cls=$(grep -oP 'type\s+\K\w+(?=\s+struct)' "$file" 2>/dev/null | head -20)
                    local fns=$(grep -oP 'func\s+\K\w+' "$file" 2>/dev/null | head -20)
                    ;;
                rust)
                    local cls=$(grep -oP '(?:pub\s+)?(?:struct|enum)\s+\K\w+' "$file" 2>/dev/null | head -20)
                    local fns=$(grep -oP '(?:pub\s+)?fn\s+\K\w+' "$file" 2>/dev/null | head -20)
                    ;;
                csharp)
                    local cls=$(grep -oP '(?:class|interface)\s+\K\w+' "$file" 2>/dev/null | head -20)
                    local fns=$(grep -oP '(?:public|private|protected)\s+\w+\s+\K\w+(?=\s*\()' "$file" 2>/dev/null | head -20)
                    ;;
                *) local cls=""; local fns="" ;;
            esac
            
            local cls_count=$(echo "$cls" | grep -c . 2>/dev/null || echo 0)
            local fn_count=$(echo "$fns" | grep -c . 2>/dev/null || echo 0)
            ((mod_classes += cls_count)) || true
            ((mod_functions += fn_count)) || true
            ((TOTAL_CLASSES += cls_count)) || true
            ((TOTAL_FUNCTIONS += fn_count)) || true
            
            # Collect class names for module analysis
            [[ -n "$cls" ]] && classes_list="$classes_list $cls"
            [[ -n "$fns" ]] && functions_list="$functions_list $fns"
            
        done < <(find "$abs_dir" -type f \( -name "*.kt" -o -name "*.java" -o -name "*.ts" -o -name "*.tsx" \
            -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" \
            -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.xml" -o -name "*.sql" \
            -o -name "*.properties" -o -name "*.toml" -o -name "*.gradle.kts" -o -name "*.gradle" \) \
            -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/build/*" \
            -not -path "*/dist/*" -not -path "*/target/*" -not -path "*/.gradle/*" \
            -not -path "*/.analysis/*" -not -path "*/.kiro/*" -print0 2>/dev/null)
    done
    
    # Detect purpose
    local purpose="Application module"
    if echo "$mod_name $classes_list" | grep -qi "controller\|api"; then purpose="API layer"
    elif echo "$mod_name $classes_list" | grep -qi "service"; then purpose="Business logic"
    elif echo "$mod_name $classes_list" | grep -qi "repository\|dao"; then purpose="Data access"
    elif echo "$mod_name $classes_list" | grep -qi "config"; then purpose="Configuration"
    elif echo "$mod_name $classes_list" | grep -qi "shared\|common"; then purpose="Shared utilities"
    elif echo "$mod_name $classes_list" | grep -qi "model\|domain"; then purpose="Domain model"
    fi
    
    # Store results for this module
    eval "MOD_${mod_idx}_FILES=$mod_files"
    eval "MOD_${mod_idx}_CLASSES=$mod_classes"
    eval "MOD_${mod_idx}_FUNCTIONS=$mod_functions"
    eval "MOD_${mod_idx}_PURPOSE='$purpose'"
    eval "MOD_${mod_idx}_CLASSLIST='$(echo $classes_list | tr ' ' '\n' | sort -u | head -30 | tr '\n' '|')'"
}

# ===========================================================================
# Output Generation
# ===========================================================================

generate_project_structure() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local outfile="$OUTPUT_DIR/project-structure.md"
    
    cat > "$outfile" << EOF
# Project Structure — $(basename "$ROOT_DIR")

**Last Updated:** $timestamp
**Project Type:** $PROJECT_TYPE

## Modules

| Module | Purpose | Language | Framework | Source Files |
|--------|---------|----------|-----------|-------------|
EOF
    
    for i in "${!MODULES[@]}"; do
        local files=$(eval "echo \$MOD_${i}_FILES")
        local purpose=$(eval "echo \$MOD_${i}_PURPOSE")
        local fw="${FRAMEWORK:-—}"
        echo "| ${MODULES[$i]} | $purpose | $PRIMARY_LANGUAGE | $fw | $files |" >> "$outfile"
    done
}

generate_module_analyses() {
    local modules_dir="$OUTPUT_DIR/modules"
    mkdir -p "$modules_dir"
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    for i in "${!MODULES[@]}"; do
        local mod_name="${MODULES[$i]}"
        local files=$(eval "echo \$MOD_${i}_FILES")
        local classes=$(eval "echo \$MOD_${i}_CLASSES")
        local functions=$(eval "echo \$MOD_${i}_FUNCTIONS")
        local purpose=$(eval "echo \$MOD_${i}_PURPOSE")
        local class_list=$(eval "echo \$MOD_${i}_CLASSLIST")
        local fw="${FRAMEWORK:-—}"
        
        local outfile="$modules_dir/$mod_name.md"
        cat > "$outfile" << EOF
# Module Analysis — $mod_name

**Last Updated:** $timestamp
**Language:** $PRIMARY_LANGUAGE | **Framework:** $fw

## Summary

- **Purpose:** $purpose
- **Source Files:** $files
- **Classes:** $classes
- **Functions:** $functions

## Key Classes

EOF
        # Write class list
        IFS='|' read -ra CLS_ARR <<< "$class_list"
        for cls in "${CLS_ARR[@]}"; do
            [[ -n "$cls" ]] && echo "- $cls" >> "$outfile"
        done
    done
}

generate_metadata() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    cat > "$OUTPUT_DIR/index-metadata.json" << EOF
{
  "version": "1.0",
  "lastFullIndexTimestamp": "$timestamp",
  "projectName": "$(basename "$ROOT_DIR")",
  "projectType": "$PROJECT_TYPE",
  "totalFiles": $TOTAL_FILES
}
EOF
}

generate_kb_payloads() {
    local outfile="$OUTPUT_DIR/kb-payloads.json"
    echo "[" > "$outfile"
    local first=true
    
    for i in "${!MODULES[@]}"; do
        local mod_name="${MODULES[$i]}"
        local files=$(eval "echo \$MOD_${i}_FILES")
        local classes=$(eval "echo \$MOD_${i}_CLASSES")
        local functions=$(eval "echo \$MOD_${i}_FUNCTIONS")
        local purpose=$(eval "echo \$MOD_${i}_PURPOSE")
        
        [[ "$first" != "true" ]] && echo "," >> "$outfile"
        first=false
        
        cat >> "$outfile" << EOF
  {
    "title": "Code Index — $mod_name",
    "content": "Module: $mod_name\nLanguage: $PRIMARY_LANGUAGE\nPurpose: $purpose\nFiles: $files\nClasses: $classes\nFunctions: $functions",
    "tags": "code-index, $mod_name, $PRIMARY_LANGUAGE",
    "project": "$(basename "$ROOT_DIR")"
  }
EOF
    done
    
    echo "]" >> "$outfile"
}

# ===========================================================================
# Main Execution
# ===========================================================================

TOTAL_FILES=0
TOTAL_CLASSES=0
TOTAL_FUNCTIONS=0

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR/modules"

# Run pipeline
detect_project
discover_modules

for i in "${!MODULES[@]}"; do
    scan_and_parse_module "$i"
done

# Generate outputs
generate_project_structure
generate_module_analyses
generate_metadata
generate_kb_payloads

# Calculate elapsed time
END_TIME=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")
ELAPSED=$(( (END_TIME - START_TIME) / 1000000 ))

log_info "Full index complete — $TOTAL_FILES files, ${#MODULES[@]} modules, $TOTAL_CLASSES classes, $TOTAL_FUNCTIONS functions, ${ELAPSED}ms"

# Output result as JSON
cat << EOF
{
  "totalFiles": $TOTAL_FILES,
  "totalModules": ${#MODULES[@]},
  "totalClasses": $TOTAL_CLASSES,
  "totalFunctions": $TOTAL_FUNCTIONS,
  "parseErrors": 0,
  "elapsedMs": $ELAPSED
}
EOF
