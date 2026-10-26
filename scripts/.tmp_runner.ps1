
$ErrorActionPreference = 'Stop'
$connString = "Server=192.168.1.2\SQL2017;Database=SMS;User Id=sa;Password=plexoc123;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
$conn.Open()
try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 300
    $cmd.CommandText = [System.IO.File]::ReadAllText("F:\\Projects\\SMS\\SEMS-Frontend\\scripts\\.tmp_seed.sql")
    $result = $cmd.ExecuteScalar()
    Write-Output $result
} finally {
    $conn.Close()
}
