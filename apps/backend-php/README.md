PHP backend starter

Run locally with built-in server:

```bash
cd apps/backend-php
php -S 0.0.0.0:8080
```

Or build the Docker image:

```bash
docker build -t avtomation-backend-php .
docker run -p 8080:8080 avtomation-backend-php
```

Endpoints:
- GET /health
- GET /
