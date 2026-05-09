<#
.SYNOPSIS
    Code Intelligence System — Full Indexer (PowerShell Edition)
    
.DESCRIPTION
    Zero external dependencies — uses only PowerShell 5.1+ (built-in on Windows).
    Produces the same output as the Node.js and Python versions:
      - .analysis/code-intelligence/project-structure.md
      - .analysis/code-intelligence/modules/{module}.md
      - .analysis/code-intelligence/index-metadata.json
      - .analysis/code-intelligence/kb-payloads.json

.PARAMETER RootDir
    Path to the project root. Defaults to current directory.

.EXAMPLE
    .\full-indexer.ps1 -RootDir "C:\projects\my-app"
    .\full-indexer.ps1
#>

param(
    [string]$RootDir = (Get-Location).Path
)

$ErrorActionPreference = "Continue"
$RootDir = (Resolve-Path $RootDir).Path

# ===========================================================================
# Configuration
# ===========================================================================

$DefaultConfig = @{
    includedExtensions = @(
        ".kt", ".java", ".ts", ".tsx", ".js", ".jsx", ".py", ".go",
        ".rs", ".cs", ".gradle.kts", ".gradle", ".yml", ".yaml",
        ".properties", ".xml", ".json", ".sql", ".toml", ".cfg", ".ini"
    )
    excludedDirectories = @(
        "build", "dist", "out", "target", ".gradle", ".git", ".analysis",
        "node_modules", ".idea", ".kiro", ".vscode", "__pycache__",
        ".mypy_cache", "vendor", "bin", "obj"
    )
    excludedFilePatterns = @(
        "*.generated.*", "*.min.*", "*.map", "*.lock", "*.sum"
    )
}

$ExtensionMap = @{
    ".kt"="kotlin"; ".java"="java"; ".ts"="typescript"; ".tsx"="typescript"
    ".js"="javascript"; ".jsx"="javascript"; ".py"="python"; ".go"="go"
    ".rs"="rust"; ".cs"="csharp"; ".gradle"="gradle"; ".yml"="yaml"
    ".yaml"="yaml"; ".xml"="xml"; ".sql"="sql"; ".json"="json"
    ".properties"="properties"; ".toml"="config"; ".cfg"="config"; ".ini"="config"
}

$SourceExtensions = @{
    ".kt"="kotlin"; ".java"="java"; ".ts"="typescript"; ".tsx"="typescript"
    ".js"="javascript"; ".jsx"="javascript"; ".py"="python"; ".go"="go"
    ".rs"="rust"; ".cs"="csharp"
}

# ===========================================================================
# Config Loader
# ===========================================================================

function Load-Config {
    param([string]$ConfigPath)
    if (Test-Path $ConfigPath) {
        try {
            return Get-Content $ConfigPath -Raw | ConvertFrom-Json
        } catch {
            return $DefaultConfig
        }
    }
    return $DefaultConfig
}

# ===========================================================================
# Project Detector
# ===========================================================================

$BuildFilePriority = @(
    @{file="build.gradle.kts"; type="gradle-kotlin"},
    @{file="build.gradle"; type="gradle-java"},
    @{file="pom.xml"; type="maven-java"},
    @{file="package.json"; type="npm"},
    @{file="Cargo.toml"; type="cargo-rust"},
    @{file="go.mod"; type="go-module"},
    @{file="pyproject.toml"; type="python"},
    @{file="setup.py"; type="python"}
)

$ProjectTypeLang = @{
    "gradle-kotlin"="kotlin"; "gradle-java"="java"; "maven-java"="java"
    "npm-typescript"="typescript"; "npm-javascript"="javascript"
    "cargo-rust"="rust"; "go-module"="go"; "python"="python"
    "dotnet"="csharp"; "generic"="unknown"
}

function Detect-ProjectType {
    param([string]$Root)
    
    $projectType = "generic"
    $buildFile = "none"
    
    foreach ($entry in $BuildFilePriority) {
        if (Test-Path (Join-Path $Root $entry.file)) {
            $projectType = $entry.type
            $buildFile = $entry.file
            break
        }
    }
    
    # Check .sln / .csproj
    if ($projectType -eq "generic") {
        $sln = Get-ChildItem $Root -Filter "*.sln" -File | Select-Object -First 1
        if ($sln) { $projectType = "dotnet"; $buildFile = $sln.Name }
        else {
            $csproj = Get-ChildItem $Root -Filter "*.csproj" -File | Select-Object -First 1
            if ($csproj) { $projectType = "dotnet"; $buildFile = $csproj.Name }
        }
    }
    
    # Refine npm
    if ($projectType -eq "npm") {
        $projectType = if (Test-Path (Join-Path $Root "tsconfig.json")) { "npm-typescript" } else { "npm-javascript" }
    }
    
    # Count source files
    $langCounts = @{}
    Get-ChildItem $Root -Recurse -File -Depth 3 -ErrorAction SilentlyContinue |
        Where-Object { $_.DirectoryName -notmatch "node_modules|\.git|build|dist|target|\.gradle|vendor" } |
        ForEach-Object {
            $ext = $_.Extension.ToLower()
            if ($SourceExtensions.ContainsKey($ext)) {
                $lang = $SourceExtensions[$ext]
                if ($langCounts.ContainsKey($lang)) { $langCounts[$lang]++ } else { $langCounts[$lang] = 1 }
            }
        }
    
    $impliedLang = $ProjectTypeLang[$projectType]
    if ($impliedLang -and $impliedLang -ne "unknown" -and $langCounts.ContainsKey($impliedLang)) {
        $primaryLanguage = $impliedLang
    } elseif ($langCounts.Count -gt 0) {
        $primaryLanguage = ($langCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
    } else {
        $primaryLanguage = if ($impliedLang) { $impliedLang } else { "unknown" }
    }
    
    # Framework detection
    $framework = $null
    $buildPath = Join-Path $Root $buildFile
    if ($buildFile -ne "none" -and (Test-Path $buildPath)) {
        $content = Get-Content $buildPath -Raw -ErrorAction SilentlyContinue
        if ($content) {
            $frameworkPatterns = switch -Wildcard ($projectType) {
                "gradle-*" { @(@("spring-boot-starter","Spring Boot"),@("io.ktor","Ktor"),@("ktor-","Ktor")) }
                "maven-java" { @(@("spring-boot-starter","Spring Boot"),@("io.quarkus","Quarkus")) }
                "npm-*" { @(@('"react"',"React"),@('"next"',"Next.js"),@('"@angular/core"',"Angular"),@('"vue"',"Vue.js"),@('"express"',"Express.js"),@('"@nestjs/core"',"NestJS")) }
                "python" { @(@("django","Django"),@("flask","Flask"),@("fastapi","FastAPI")) }
                "cargo-rust" { @(@("actix-web","Actix Web"),@("axum","Axum")) }
                "go-module" { @(@("github.com/gin-gonic/gin","Gin"),@("github.com/gofiber/fiber","Fiber")) }
                default { @() }
            }
            foreach ($p in $frameworkPatterns) {
                if ($content -match [regex]::Escape($p[0])) {
                    $framework = $p[1]
                    break
                }
            }
        }
    }
    
    Write-Host "[Code-Index] INFO: Project detected - type=$projectType, language=$primaryLanguage, framework=$framework, buildFile=$buildFile"
    return @{ projectType=$projectType; primaryLanguage=$primaryLanguage; framework=$framework; buildFile=$buildFile }
}

# ===========================================================================
# Module Discovery
# ===========================================================================

function Discover-Modules {
    param([string]$Root, [hashtable]$Detection)
    
    $modules = @()
    $projectType = $Detection.projectType
    
    switch -Wildcard ($projectType) {
        "gradle-*" {
            foreach ($sf in @("settings.gradle.kts", "settings.gradle")) {
                $sfPath = Join-Path $Root $sf
                if (Test-Path $sfPath) {
                    $content = Get-Content $sfPath -Raw
                    $seen = @{}
                    [regex]::Matches($content, '["\u0027]([^"\u0027]+)["\u0027]') | ForEach-Object {
                        $name = $_.Groups[1].Value.TrimStart(":").Replace(":", "/")
                        if (-not $seen.ContainsKey($name)) {
                            $seen[$name] = $true
                            $modDir = Join-Path $Root $name
                            if (Test-Path $modDir -PathType Container) {
                                $srcDirs = @()
                                foreach ($sd in @("$name/src/main/kotlin","$name/src/main/java","$name/src/test/kotlin","$name/src/test/java")) {
                                    if (Test-Path (Join-Path $Root $sd) -PathType Container) { $srcDirs += $sd }
                                }
                                if ($srcDirs.Count -eq 0) { $srcDirs = @($name) }
                                $modules += @{ name=$name.Replace("/","-"); path=$name; sourceDirectories=$srcDirs; buildFile=$null; language=$null }
                            }
                        }
                    }
                    break
                }
            }
        }
        "maven-java" {
            $pomPath = Join-Path $Root "pom.xml"
            if (Test-Path $pomPath) {
                $content = Get-Content $pomPath -Raw
                [regex]::Matches($content, '<module>\s*([^<]+?)\s*</module>') | ForEach-Object {
                    $name = $_.Groups[1].Value.Trim()
                    $modDir = Join-Path $Root $name
                    if (Test-Path $modDir -PathType Container) {
                        $srcDirs = @()
                        foreach ($sd in @("$name/src/main/kotlin","$name/src/main/java")) {
                            if (Test-Path (Join-Path $Root $sd) -PathType Container) { $srcDirs += $sd }
                        }
                        if ($srcDirs.Count -eq 0) { $srcDirs = @($name) }
                        $modules += @{ name=$name; path=$name; sourceDirectories=$srcDirs; buildFile="$name/pom.xml"; language=$null }
                    }
                }
            }
        }
        "npm-*" {
            $pkgPath = Join-Path $Root "package.json"
            if (Test-Path $pkgPath) {
                try {
                    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
                    $workspaces = if ($pkg.workspaces -is [array]) { $pkg.workspaces } 
                                  elseif ($pkg.workspaces.packages) { $pkg.workspaces.packages } 
                                  else { @() }
                    foreach ($pattern in $workspaces) {
                        if ($pattern -match '\*') {
                            $parent = $pattern -replace '/\*\*?$','' -replace '/\*$',''
                            $parentDir = Join-Path $Root $parent
                            if (Test-Path $parentDir -PathType Container) {
                                Get-ChildItem $parentDir -Directory | ForEach-Object {
                                    $modPath = "$parent/$($_.Name)"
                                    if (Test-Path (Join-Path $_.FullName "package.json")) {
                                        $srcDirs = @()
                                        foreach ($sd in @("$modPath/src","$modPath/lib")) {
                                            if (Test-Path (Join-Path $Root $sd) -PathType Container) { $srcDirs += $sd }
                                        }
                                        if ($srcDirs.Count -eq 0) { $srcDirs = @($modPath) }
                                        $modules += @{ name=$_.Name; path=$modPath; sourceDirectories=$srcDirs; buildFile="$modPath/package.json"; language=$null }
                                    }
                                }
                            }
                        } else {
                            if (Test-Path (Join-Path $Root $pattern) -PathType Container) {
                                $srcDirs = @()
                                foreach ($sd in @("$pattern/src","$pattern/lib")) {
                                    if (Test-Path (Join-Path $Root $sd) -PathType Container) { $srcDirs += $sd }
                                }
                                if ($srcDirs.Count -eq 0) { $srcDirs = @($pattern) }
                                $modules += @{ name=(Split-Path $pattern -Leaf); path=$pattern; sourceDirectories=$srcDirs; buildFile="$pattern/package.json"; language=$null }
                            }
                        }
                    }
                } catch {}
            }
        }
    }
    
    # Fallback: single root module
    if ($modules.Count -eq 0) {
        $srcDirs = @(".")
        foreach ($sd in @("src", "lib")) {
            if (Test-Path (Join-Path $Root $sd) -PathType Container) { $srcDirs = @($sd); break }
        }
        $modules = @(@{ name="root"; path="."; sourceDirectories=$srcDirs; buildFile=$Detection.buildFile; language=$null })
    }
    
    Write-Host "[Code-Index] INFO: Module discovery - found $($modules.Count) module(s) for $projectType"
    return $modules
}

# ===========================================================================
# File Scanner
# ===========================================================================

function Scan-Files {
    param([object]$Config, [string[]]$SourceDirs, [string]$Root)
    
    $results = @()
    $excludedDirs = if ($Config.excludedDirectories) { $Config.excludedDirectories } else { $DefaultConfig.excludedDirectories }
    $includedExts = if ($Config.includedExtensions) { $Config.includedExtensions } else { $DefaultConfig.includedExtensions }
    $excludedPatterns = if ($Config.excludedFilePatterns) { $Config.excludedFilePatterns } else { $DefaultConfig.excludedFilePatterns }
    
    foreach ($srcDir in $SourceDirs) {
        $absDir = Join-Path $Root $srcDir
        if (-not (Test-Path $absDir -PathType Container)) { continue }
        
        Get-ChildItem $absDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
            $file = $_
            $relPath = $file.FullName.Substring($Root.Length + 1).Replace("\", "/")
            
            # Check extension
            $hasExt = $false
            foreach ($ext in $includedExts) {
                if ($file.Name.EndsWith($ext)) { $hasExt = $true; break }
            }
            if (-not $hasExt) { return }
            
            # Check excluded dirs
            $segments = $relPath.Split("/")
            $excluded = $false
            foreach ($seg in $segments) {
                if ($excludedDirs -contains $seg) { $excluded = $true; break }
            }
            if ($excluded) { return }
            
            # Check excluded patterns
            foreach ($pattern in $excludedPatterns) {
                if ($file.Name -like $pattern) { return }
            }
            
            # Compute hash
            try {
                $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower()
                $lang = Get-Language $file.Name
                $results += @{ filePath=$relPath; contentHash="sha256:$hash"; language=$lang }
            } catch {}
        }
    }
    return $results
}

function Get-Language {
    param([string]$FileName)
    $lower = $FileName.ToLower()
    if ($lower.EndsWith(".gradle.kts")) { return "gradle" }
    $ext = [System.IO.Path]::GetExtension($lower)
    if ($ExtensionMap.ContainsKey($ext)) { return $ExtensionMap[$ext] }
    return "unknown"
}

# ===========================================================================
# File Parser (regex-based)
# ===========================================================================

function Parse-SourceFile {
    param([string]$FilePath, [string]$Language, [string]$ModuleName)
    
    $result = @{ filePath=$FilePath; language=$Language; moduleName=$ModuleName; packageName=""; classes=@(); functions=@(); imports=@(); indexingStatus="success"; errorMessage=$null }
    
    try {
        $content = Get-Content $FilePath -Raw -Encoding UTF8 -ErrorAction Stop
    } catch {
        $result.indexingStatus = "read_error"
        $result.errorMessage = $_.Exception.Message
        return $result
    }
    
    if (-not $content) { return $result }
    
    switch ($Language) {
        "kotlin" {
            foreach ($line in $content.Split("`n")) {
                $t = $line.Trim()
                if ($t -match '^package\s+([\w.]+)') { $result.packageName = $Matches[1] }
                elseif ($t -match '^import\s+([\w.*]+)') { $result.imports += $Matches[1] }
                elseif ($t -match '(class|object|interface)\s+(\w+)') { $result.classes += @{name=$Matches[2]; visibility="public"} }
                elseif ($t -match 'fun\s+(\w+)\s*\(') { $result.functions += @{name=$Matches[1]; visibility="public"; parameters=@(); returnType="Unit"} }
            }
        }
        "java" {
            foreach ($line in $content.Split("`n")) {
                $t = $line.Trim()
                if ($t -match '^package\s+([\w.]+);') { $result.packageName = $Matches[1] }
                elseif ($t -match '^import\s+([\w.*]+);') { $result.imports += $Matches[1] }
                elseif ($t -match '(class|interface|enum)\s+(\w+)') { $result.classes += @{name=$Matches[2]; visibility="public"} }
                elseif ($t -match '(public|private|protected)?\s*([\w<>\[\]]+)\s+(\w+)\s*\(') {
                    if ($Matches[2] -notin @("class","interface","enum")) {
                        $vis = if ($Matches[1]) { $Matches[1] } else { "package-private" }
                        $result.functions += @{name=$Matches[3]; visibility=$vis; parameters=@(); returnType=$Matches[2]}
                    }
                }
            }
        }
        "python" {
            foreach ($line in $content.Split("`n")) {
                $t = $line.Trim()
                if ($t -match '^import\s+(\S+)') { $result.imports += $Matches[1] }
                elseif ($t -match '^from\s+(\S+)\s+import') { $result.imports += $Matches[1] }
                elseif ($t -match '^class\s+(\w+)') { $result.classes += @{name=$Matches[1]; visibility="public"} }
                elseif ($t -match '^def\s+(\w+)') {
                    $vis = if ($Matches[1].StartsWith("_")) { "private" } else { "public" }
                    $result.functions += @{name=$Matches[1]; visibility=$vis; parameters=@(); returnType="None"}
                }
            }
        }
        "typescript" {
            if ($content -match 'export\s+class\s+(\w+)') { $result.classes += @{name=$Matches[1]; visibility="exported"} }
            [regex]::Matches($content, 'class\s+(\w+)') | ForEach-Object { 
                $n = $_.Groups[1].Value
                if (-not ($result.classes | Where-Object { $_.name -eq $n })) {
                    $result.classes += @{name=$n; visibility="private"}
                }
            }
            [regex]::Matches($content, '(?:from|require\()\s*[''"]([^''"]+)[''"]') | ForEach-Object {
                $result.imports += $_.Groups[1].Value
            }
            [regex]::Matches($content, '(?:export\s+)?(?:async\s+)?function\s+(\w+)') | ForEach-Object {
                $result.functions += @{name=$_.Groups[1].Value; visibility="public"; parameters=@(); returnType="void"}
            }
        }
        "javascript" {
            [regex]::Matches($content, '(?:from|require\()\s*[''"]([^''"]+)[''"]') | ForEach-Object {
                $result.imports += $_.Groups[1].Value
            }
            [regex]::Matches($content, 'class\s+(\w+)') | ForEach-Object {
                $result.classes += @{name=$_.Groups[1].Value; visibility="public"}
            }
            [regex]::Matches($content, '(?:export\s+)?(?:async\s+)?function\s+(\w+)') | ForEach-Object {
                $result.functions += @{name=$_.Groups[1].Value; visibility="public"; parameters=@(); returnType="void"}
            }
        }
        "go" {
            if ($content -match 'package\s+(\w+)') { $result.packageName = $Matches[1] }
            [regex]::Matches($content, '"([\w./]+)"') | ForEach-Object { $result.imports += $_.Groups[1].Value }
            [regex]::Matches($content, 'type\s+(\w+)\s+struct') | ForEach-Object {
                $n = $_.Groups[1].Value
                $vis = if ($n[0] -cmatch '[A-Z]') { "exported" } else { "unexported" }
                $result.classes += @{name=$n; visibility=$vis}
            }
            [regex]::Matches($content, 'func\s+(\w+)\s*\(') | ForEach-Object {
                $n = $_.Groups[1].Value
                $vis = if ($n[0] -cmatch '[A-Z]') { "exported" } else { "unexported" }
                $result.functions += @{name=$n; visibility=$vis; parameters=@(); returnType=""}
            }
        }
        "rust" {
            [regex]::Matches($content, '^use\s+([\w:*]+);', 'Multiline') | ForEach-Object { $result.imports += $_.Groups[1].Value }
            [regex]::Matches($content, '(pub\s+)?(?:struct|enum)\s+(\w+)') | ForEach-Object {
                $vis = if ($_.Groups[1].Value) { "pub" } else { "private" }
                $result.classes += @{name=$_.Groups[2].Value; visibility=$vis}
            }
            [regex]::Matches($content, '(pub\s+)?fn\s+(\w+)') | ForEach-Object {
                $vis = if ($_.Groups[1].Value) { "pub" } else { "private" }
                $result.functions += @{name=$_.Groups[2].Value; visibility=$vis; parameters=@(); returnType=""}
            }
        }
        "csharp" {
            [regex]::Matches($content, '^using\s+([\w.]+);', 'Multiline') | ForEach-Object { $result.imports += $_.Groups[1].Value }
            if ($content -match 'namespace\s+([\w.]+)') { $result.packageName = $Matches[1] }
            [regex]::Matches($content, '(?:public|private|internal)?\s*(?:class|interface)\s+(\w+)') | ForEach-Object {
                $result.classes += @{name=$_.Groups[1].Value; visibility="public"}
            }
        }
    }
    
    return $result
}

# ===========================================================================
# Pattern Detection
# ===========================================================================

function Detect-Patterns {
    param($Classes, $Functions, $Imports)
    
    $allText = ($Imports -join " ")
    $classNames = ($Classes | ForEach-Object { $_.name }) -join " "
    
    # DI
    $di = "none"
    if ($allText -match "@Inject|@Autowired") { $di = "field injection" }
    elseif ($Functions | Where-Object { $_.name -in @("constructor","__init__") }) { $di = "constructor injection" }
    
    # Error handling
    $err = "unknown"
    if ("$allText $classNames" -match "Result|Either") { $err = "Result type" }
    elseif ("$allText $classNames" -match "ExceptionHandler|ControllerAdvice") { $err = "exception handler" }
    elseif ("$allText $classNames" -match "Exception") { $err = "try-catch" }
    
    # Naming
    $suffixes = @("Controller","Service","Repository")
    $found = $suffixes | Where-Object { $Classes | Where-Object { $_.name.EndsWith($_) } }
    $naming = if ($found) { ($found | ForEach-Object { "*$_" }) -join ", " } else { "unknown" }
    
    # Logging
    $logging = "unknown"
    if ($allText -match "slf4j|SLF4J") { $logging = "SLF4J" }
    elseif ($allText -match "log4j") { $logging = "Log4j" }
    elseif ($allText -match "logging") { $logging = "logging" }
    
    # Testing
    $testing = "unknown"
    if ($allText -match "junit|org\.junit") { $testing = "JUnit" }
    elseif ($allText -match "pytest|unittest") { $testing = "pytest" }
    elseif ($allText -match "jest") { $testing = "Jest" }
    elseif ($allText -match "kotest") { $testing = "kotest" }
    
    return @{ diStyle=$di; errorHandling=$err; naming=$naming; logging=$logging; testing=$testing }
}

function Infer-ModulePurpose {
    param([string]$Name, $Classes, $Packages)
    $all = ("$Name " + (($Classes | ForEach-Object { $_.name }) -join " ") + " " + ($Packages -join " ")).ToLower()
    if ($all -match "api|controller") { return "API layer" }
    if ($all -match "service|business") { return "Business logic" }
    if ($all -match "repository|dao") { return "Data access" }
    if ($all -match "config") { return "Configuration" }
    if ($all -match "common|shared") { return "Shared utilities" }
    if ($all -match "test") { return "Testing" }
    if ($all -match "model|domain") { return "Domain model" }
    return "Application module"
}

# ===========================================================================
# Analysis Generator
# ===========================================================================

function Generate-ProjectStructure {
    param($ModulesData, $ProjectInfo, [string]$OutputDir)
    
    $timestamp = (Get-Date).ToUniversalTime().ToString("o")
    $lines = @(
        "# Project Structure - $($ProjectInfo.projectName)"
        ""
        "**Last Updated:** $timestamp"
        "**Project Type:** $($ProjectInfo.projectType)"
        ""
        "## Modules"
        ""
        "| Module | Purpose | Language | Framework | Dependencies | Source Files |"
        "|--------|---------|----------|-----------|-------------|-------------|"
    )
    foreach ($mod in $ModulesData) {
        $fw = if ($mod.framework) { $mod.framework } else { "-" }
        $deps = if ($mod.dependencies.Count -gt 0) { ($mod.dependencies[0..4] -join ", ") } else { "-" }
        $lines += "| $($mod.name) | $($mod.purpose) | $($mod.language) | $fw | $deps | $($mod.sourceFileCount) |"
    }
    $lines += @("", "## Inter-Module Dependencies", "", "| Module | Depends On |", "|--------|-----------|")
    foreach ($mod in $ModulesData) {
        $deps = if ($mod.dependencies.Count -gt 0) { $mod.dependencies -join ", " } else { "-" }
        $lines += "| $($mod.name) | $deps |"
    }
    
    $outPath = Join-Path $OutputDir "project-structure.md"
    $lines -join "`n" | Set-Content $outPath -Encoding UTF8 -Force
}

function Generate-ModuleAnalysis {
    param($ModuleData, [string]$OutputDir)
    
    $modulesDir = Join-Path $OutputDir "modules"
    if (-not (Test-Path $modulesDir)) { New-Item -ItemType Directory -Path $modulesDir -Force | Out-Null }
    
    $timestamp = (Get-Date).ToUniversalTime().ToString("o")
    $fw = if ($ModuleData.framework) { $ModuleData.framework } else { "-" }
    
    $lines = @(
        "# Module Analysis - $($ModuleData.name)"
        ""
        "**Last Updated:** $timestamp"
        "**Language:** $($ModuleData.language) | **Framework:** $fw"
        ""
        "## Key Classes"
        ""
        "| Class | Visibility |"
        "|-------|------------|"
    )
    foreach ($cls in $ModuleData.classes | Select-Object -First 30) {
        $lines += "| $($cls.name) | $($cls.visibility) |"
    }
    
    $lines += @("", "## Public Functions", "")
    $pubFns = $ModuleData.functions | Where-Object { $_.visibility -in @("public","exported") } | Select-Object -First 20
    if ($pubFns) {
        foreach ($fn in $pubFns) { $lines += "- ``$($fn.name)()``" }
    } else { $lines += "_No public functions detected._" }
    
    $lines += @("", "## Detected Patterns", "")
    foreach ($key in @("diStyle","errorHandling","naming","logging","testing")) {
        $lines += "- **${key}**: $($ModuleData.patterns[$key])"
    }
    
    $outPath = Join-Path $modulesDir "$($ModuleData.name).md"
    $lines -join "`n" | Set-Content $outPath -Encoding UTF8 -Force
}

# ===========================================================================
# Main Orchestration
# ===========================================================================

$startTime = Get-Date
$outputDir = Join-Path (Join-Path $RootDir ".analysis") "code-intelligence"

# Step 1: Load config
$configPath = Join-Path $outputDir "index-config.json"
$config = Load-Config $configPath

# Step 2: Detect project
$detection = Detect-ProjectType $RootDir

# Step 3: Discover modules
$modules = Discover-Modules $RootDir $detection

# Step 4: Scan and parse
$allFileEntries = @{}
$modulesData = @()
$totalClasses = 0; $totalFunctions = 0; $parseErrors = 0; $totalFiles = 0

foreach ($mod in $modules) {
    $scanned = Scan-Files $config $mod.sourceDirectories $RootDir
    $modClasses = @(); $modFunctions = @(); $modImports = @()
    $pkgSet = @{}; $depSet = @{}
    
    foreach ($fileInfo in $scanned) {
        $totalFiles++
        Write-Host "`r[Code-Index] INFO: Indexing - $totalFiles files ($($mod.name))" -NoNewline
        
        $absPath = Join-Path $RootDir $fileInfo.filePath
        $parseResult = Parse-SourceFile $absPath $fileInfo.language $mod.name
        
        if ($parseResult.indexingStatus -eq "parse_error") { $parseErrors++ }
        
        $modClasses += $parseResult.classes
        $modFunctions += $parseResult.functions
        $modImports += $parseResult.imports
        $totalClasses += $parseResult.classes.Count
        $totalFunctions += $parseResult.functions.Count
        
        if ($parseResult.packageName) { $pkgSet[$parseResult.packageName] = $true }
        
        foreach ($imp in $parseResult.imports) {
            foreach ($otherMod in $modules) {
                if ($otherMod.name -ne $mod.name -and $imp -match [regex]::Escape($otherMod.name)) {
                    $depSet[$otherMod.name] = $true
                }
            }
        }
        
        $allFileEntries[$fileInfo.filePath] = @{
            contentHash=$fileInfo.contentHash
            lastIndexedTimestamp=(Get-Date).ToUniversalTime().ToString("o")
            language=$fileInfo.language
            moduleName=$mod.name
            indexingStatus=$parseResult.indexingStatus
        }
    }
    
    $patterns = Detect-Patterns $modClasses $modFunctions $modImports
    $purpose = Infer-ModulePurpose $mod.name $modClasses @($pkgSet.Keys)
    
    $modulesData += @{
        name=$mod.name; path=$mod.path
        language=if ($mod.language) { $mod.language } else { $detection.primaryLanguage }
        framework=$detection.framework
        dependencies=@($depSet.Keys)
        sourceFileCount=$scanned.Count
        classes=$modClasses; functions=$modFunctions
        patterns=$patterns; purpose=$purpose
    }
}

Write-Host ""

# Step 5: Write metadata
$metadata = @{
    version="1.0"
    lastFullIndexTimestamp=(Get-Date).ToUniversalTime().ToString("o")
    projectName=(Split-Path $RootDir -Leaf)
    projectType=$detection.projectType
    totalFiles=$totalFiles
    files=$allFileEntries
}
$metadataPath = Join-Path $outputDir "index-metadata.json"
$metadata | ConvertTo-Json -Depth 5 | Set-Content $metadataPath -Encoding UTF8 -Force

# Step 6: Generate analysis
$projectInfo = @{
    projectName=(Split-Path $RootDir -Leaf)
    projectType=$detection.projectType
    primaryLanguage=$detection.primaryLanguage
    framework=$detection.framework
}
Generate-ProjectStructure $modulesData $projectInfo $outputDir
foreach ($modData in $modulesData) { Generate-ModuleAnalysis $modData $outputDir }

# Step 7: KB payloads
$kbPayloads = @()
foreach ($modData in $modulesData) {
    $summary = "Module: $($modData.name)`nLanguage: $($modData.language)`nPurpose: $($modData.purpose)`nFiles: $($modData.sourceFileCount)`nClasses: $($modData.classes.Count)`nFunctions: $($modData.functions.Count)"
    $kbPayloads += @{ title="Code Index - $($modData.name)"; content=$summary; tags="code-index, $($modData.name), $($modData.language)"; project=$projectInfo.projectName }
}
$kbPath = Join-Path $outputDir "kb-payloads.json"
$kbPayloads | ConvertTo-Json -Depth 3 | Set-Content $kbPath -Encoding UTF8 -Force

# Step 8: Summary
$elapsed = [int]((Get-Date) - $startTime).TotalMilliseconds
$result = @{ totalFiles=$totalFiles; totalModules=$modulesData.Count; totalClasses=$totalClasses; totalFunctions=$totalFunctions; parseErrors=$parseErrors; elapsedMs=$elapsed }
Write-Host "[Code-Index] INFO: Full index complete - $totalFiles files, $($modulesData.Count) modules, $totalClasses classes, $totalFunctions functions, $parseErrors errors, ${elapsed}ms"
$result | ConvertTo-Json
