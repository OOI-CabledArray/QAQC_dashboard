# Dashboard

## Project Setup

```sh
npm install
cp .env.example .env
```

Edit `.env` to set `QAQC_AWS_S3_BUCKET` to your development bucket. The server will refuse to start without it and `QAQC_AWS_REGION` set.

To create an admin user for local development:

```sh
npx tsx scripts/create-admin.ts --email you@example.com --name "Your Name"
```

### Development

```sh
npm dev # This will run a development server with hot-reload enabled.
```

### Build for Production

```sh
npm run build
```

### Serve Production Build

```sh
npm run serve [--port <port>]
```

### Type-check and Lint Code

```sh
npm run lint
```

### Autofix and Format Code

```sh
npm run fix
```
