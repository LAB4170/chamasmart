$files = Get-ChildItem -Path 'C:/Users/Eobord/Desktop/chamasmart/backend/src/main/java' -Recurse -Filter *.java
foreach ($file in $files) {
    $text = Get-Content $file.FullName -Raw
    # Replace Lombok import with SLF4J imports
    $text = $text -replace 'import lombok\.extern\.slf4j\.Slf4j;', "import org.slf4j.Logger;`nimport org.slf4j.LoggerFactory;"
    # Remove @Slf4j annotation
    $text = $text -replace '^\s*@Slf4j\s*$', ''
    # Insert logger field after class declaration
    $text = $text -replace '(public class (\w+)\s*\{)', "`$1`n    private static final Logger log = LoggerFactory.getLogger(`$2.class);"
    Set-Content -Path $file.FullName -Value $text -Encoding UTF8
}
