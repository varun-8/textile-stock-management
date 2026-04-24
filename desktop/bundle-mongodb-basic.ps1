$mongoDir = "$PSScriptRoot\resources\mongo"
if (!(Test-Path $mongoDir)) { New-Item -ItemType Directory -Force -Path $mongoDir }
$zipPath = "$mongoDir\mongodb.zip"
$mongoUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.11.zip"

Write-Host "Downloading MongoDB..."
Invoke-WebRequest -Uri $mongoUrl -OutFile $zipPath -UseBasicParsing

Write-Host "Extracting MongoDB..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "*/bin/*" -and $entry.Name -ne "") {
        $targetPath = Join-Path $mongoDir $entry.Name
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
    }
}
$zip.Dispose()
Remove-Item $zipPath
Write-Host "Done!"
