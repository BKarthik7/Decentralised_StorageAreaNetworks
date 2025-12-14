# Decentralized Cloud Storage

## Dev: Quickstart

### Prerequisites
- Docker & Docker Compose
- Node.js >= 18

### Start Infrastructure
```bash
docker-compose up -d
```

### Database Migrations
Once Postgres is up, run the migrations:
```bash
# Ensure you have psql installed or run via docker exec
export DATABASE_URL=postgresql://sa_user:sa_password@localhost:5432/storage_db
psql $DATABASE_URL -f backend/src/services/db/migrations.sql
```

### Start Backend
```bash
cd backend
npm install
npm start
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev
```
