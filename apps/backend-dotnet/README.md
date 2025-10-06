.NET backend starter

Requirements: .NET 8 SDK

Run locally:

```bash
cd apps/backend-dotnet
dotnet run
```

Docker build:

```bash
docker build -t avtomation-backend-dotnet .
docker run -p 80:80 avtomation-backend-dotnet
```

Endpoints:
- GET /health
- GET /
