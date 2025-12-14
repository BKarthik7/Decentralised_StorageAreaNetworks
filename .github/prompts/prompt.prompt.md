---
agent: agent
---
Define the task to achieve, including specific requirements, constraints, and success criteria.


---

# `prompt.promts.md`

```markdown
# prompt.promts.md
> Paste these prompts directly into GitHub Copilot / Antigravity. Request one file at a time. Do not ask the tool to produce the entire project in one shot.

---

## 1) Docker Compose & quickstart README
Prompt:
Generate a docker-compose.yml for local dev with services: postgres:15, redis:7 (optional), pgadmin, and optional ipfs/go-ipfs. Expose standard ports and mount a persistent volume for Postgres. Also produce a short 'Dev: Quickstart' README snippet describing docker-compose up -d, running migrations with psql $DATABASE_URL -f backend/src/services/db/migrations.sql, and starting backend and frontend.


---

## 2) DB migrations SQL
Prompt:
Generate backend/src/services/db/migrations.sql with idempotent SQL for tables: users, files, replicas, access_logs, key_shards. Include DROP TABLE IF EXISTS at top, create indexes on files(cid) and access_logs(access_time), and sample INSERT of an admin user (with placeholder password hash).


---

## 3) Postgres client helper
Prompt:
Generate backend/src/services/db/client.js:

Initialize a pg Pool using process.env.DATABASE_URL.

Export query(text, params) wrapper which returns rows and logs errors.

Include a small retry/backoff for connection errors.

Include example usage comments.


---

## 4) Auth service & JWT middleware
Prompt:
Generate backend/src/services/authService.js with functions:

registerUser({email,password,displayName}) -> bcrypt-hash password, insert into users, return user.

loginUser({email,password}) -> verify password, return JWT signed with process.env.JWT_SECRET.

verifyToken(token) -> verify and return payload.
Then generate backend/src/middleware/jwtAuth.js Express middleware that reads Authorization header, calls verifyToken and attaches req.user.


---

## 5) Pinata service wrapper
Prompt:
Generate backend/src/services/pinataService.js:

Functions: pinFileToIPFS(fileStream, filename), pinByHash(cid), listPins(query).

Use axios and form-data for multipart uploads.

Read PINATA_API_KEY and PINATA_API_SECRET (or PINATA_JWT) from env.

Return standardized responses { success, cid, raw } and throw informative errors.


---

## 6) Upload route (Express)
Prompt:
Generate backend/src/routes/upload.js (Express router) implementing:

POST /api/upload with jwtAuth middleware

Accepts multipart file field 'file' and optional flag 'encrypted'

Uses pinataService.pinFileToIPFS and inserts into files table via db.query

Inserts initial replicas record for 'Pinata'

If shard metadata provided, inserts into key_shards table

Calls contract registerFile via ethers.js and returns { success, cid, fileId, txHash }

Include validation and error handling


---

## 7) Pinning monitor (scheduler)
Prompt:
Generate backend/src/services/pinningMonitor.js:

Expose evaluateAndReplicate() that:

queries access_logs grouped by file_id for last 7 days

for files where count > threshold, checks replicas count

pins to additional providers by calling pinataService.pinByHash or provider APIs

inserts replica rows into replicas table

Expose startScheduler() using node-cron to run every X minutes

Use db.query helper for DB operations and include logging


---

## 8) Encryption helpers (AES-GCM + Shamir)
Prompt:
Generate backend/src/services/encryptionService.js:

Functions:

generateSymKey() -> returns base64 AES-GCM key (Node or Web Crypto compatible)

encryptBuffer(buffer, base64Key) -> { ciphertextBase64, ivBase64, tagBase64 }

decryptBuffer(ciphertextBase64, ivBase64, tagBase64, base64Key) -> Buffer

splitKeyToShards(base64Key, n, t) -> array of shards using secrets.js-grempe

combineShards(shardsArray) -> base64Key

Provide example usage in comments.


---

## 9) Frontend upload component (React)
Prompt:
Generate frontend/src/components/UploadFile.jsx:

Uses JWT from localStorage in Authorization header.

Allows toggling 'Enable threshold encryption'.

If enabled: generate AES key with Web Crypto API, encrypt file, split key with secrets.js in browser.

POST encrypted file to backend /api/upload as multipart/form-data; include shard metadata JSON field.

Show upload progress, final CID and fileId.

Use functional components and hooks, simple styling.


---

## 10) DB tests & unit tests prompts
Prompt:
Generate Jest test skeletons in backend/tests/:

authService.test.js using pg-mem to simulate Postgres; test register and login flows.

encryptionService.test.js test encrypt/decrypt roundtrip and that combineShards(splitKey(...)) returns original key.

pinataService.test.js mocking axios to ensure functions call correct endpoints and handle errors.


---

## 11) GitHub Actions CI
Prompt:
Generate .github/workflows/ci.yml:

On pull_request: set up Node 18, install dependencies for backend & frontend, run unit tests, and compile contracts using Hardhat or Truffle.

On push to main: run builds, run integration tests optionally using docker-compose services, and optionally deploy contract to testnet using secrets.

Use matrix strategy for node versions if desired.


---

## Usage tips (how to feed prompts)
- Generate one file at a time.
- If output is long, follow-up with: "Continue generating the rest of file `<path>` starting from line X".
- Use small iterative prompts to get high-quality files from Copilot/Antigravity.
- When generating security-sensitive code (auth, key handling), ask Copilot to "explain security considerations" for that file.

---

## Short checklist to complete after generation
1. Apply DB migrations.
2. Set environment variables.
3. Run backend and create an admin user via `POST /api/auth/register`.
4. Deploy contract to testnet and set `CONTRACT_ADDRESS` in env.
5. Test upload flow with local Pinata test account or local IPFS node.
6. Verify Adaptive Pinning by simulating repeated accesses.

