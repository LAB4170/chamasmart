Get-ChildItem -Path 'C:/Users/Eobord/Desktop/chamasmart/backend/src/main/java' -Recurse -Filter *.java | ForEach-Object {
    $text = Get-Content $_.FullName -Raw
    $text = $text -replace 'import lombok\.extern\.slf4j\.Slf4j;', "import org.slf4j.Logger;`nimport org.slf4j.LoggerFactory;"
    $text = $text -replace '^\s*@Slf4j\s*$', ''
    $text = $text -replace '(public class (\\w+)\s*\{)', "`$1`n    private static final Logger log = LoggerFactory.getLogger(`$2.class);"
    Set-Content -Path $_.FullName -Value $text
}
