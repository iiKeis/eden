# Eden Dev Workflow

## Run Locally

Start the mock backend:

```bash
npm run api
```

Start Expo:

```bash
npm start -- --lan --port 8082
```

Fallback if LAN is not reachable:

```bash
npm start -- --tunnel --port 8082
```

## Check Services

```bash
curl http://localhost:8787/health
curl http://localhost:8082/status
```

## Verify Code

```bash
npx tsc --noEmit
```

## Commit Timeline

```bash
git status
git add .
git commit -m "Describe the Eden milestone"
git push
```

## Product Rule

Final recipe recommendations stay locked until a scan says the crop is:

- identified with high confidence
- edible with high confidence
- fully harvest-ready

Before that, Eden can show care guidance and locked future meal paths.
