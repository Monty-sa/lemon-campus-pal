[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("status", "run", "enable", "disable", "uninstall")]
    [string]$Action
)

$TaskName = "LEMON - KFU Hourly Refresh"

switch ($Action) {
    "status" {
        Write-Host "=== LEMON - KFU Hourly Refresh Task Status ===" -ForegroundColor Cyan
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($null -eq $task) {
            Write-Host "Task is NOT installed." -ForegroundColor Red
            return
        }
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "State:              $($task.State)"
        Write-Host "Last Run Time:      $($info.LastRunTime)"
        Write-Host "Last Task Result:   $($info.LastTaskResult) (0 = SUCCESS)"
        Write-Host "Next Run Time:      $($info.NextRunTime)"
        Write-Host "Missed Runs:        $($info.NumberOfMissedRuns)"

        $logPath = Join-Path $PSScriptRoot "..\logs\kfu-worker.log"
        if (Test-Path $logPath) {
            Write-Host "`nRecent Log Entries:" -ForegroundColor Yellow
            Get-Content $logPath -Tail 8
        }
    }
    "run" {
        Write-Host "Starting task: $TaskName..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 5
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "Triggered at $($info.LastRunTime). Current state: $( (Get-ScheduledTask -TaskName $TaskName).State )"
    }
    "enable" {
        Write-Host "Enabling task: $TaskName..." -ForegroundColor Green
        Enable-ScheduledTask -TaskName $TaskName
    }
    "disable" {
        Write-Host "Disabling task: $TaskName..." -ForegroundColor Yellow
        Disable-ScheduledTask -TaskName $TaskName
    }
    "uninstall" {
        Write-Host "Unregistering task: $TaskName..." -ForegroundColor Red
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Task uninstalled successfully."
    }
}
