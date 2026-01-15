$json = @'
{
  "timestamp": 1234567890,
  "players": [{
    "uid": "123",
    "name": "TestPlayer",
    "position": {"x": 1000, "y": 2000, "z": 0},
    "health": 1,
    "vehicle": null,
    "weapons": [],
    "currentTask": null
  }],
  "friendlyUnits": [],
  "enemyUnits": [],
  "objectives": [],
  "recentEvents": [],
  "environment": {"timeOfDay": 12, "weather": 0, "fog": 0},
  "missionContext": {"missionName": "Test", "worldName": "Altis", "briefing": "Test", "elapsedTime": 60}
}
'@

Invoke-RestMethod -Uri 'http://localhost:3000/api/state' -Method Post -Body $json -ContentType 'application/json'
