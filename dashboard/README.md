# Dashboard

## Project Setup

```sh
npm install
cp .env.example .env
```

Edit `.env` to set `QAQC_AWS_S3_BUCKET` to your development bucket. The server will refuse to start without it and `QAQC_AWS_REGION` set.

Archives require a configured S3 bucket. In production, CloudFront serves archive files directly from S3. In development, a server route proxies `/archives/*` requests to S3, so valid AWS credentials and a bucket with archive data are required to view archived plots locally.

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

## Production Deployment

The dashboard runs as a server-rendered Nuxt app on an EC2 instance behind Caddy (reverse proxy with automatic TLS).

### Prerequisites

- EC2 instance running Ubuntu 24.04 with Node.js 24 and Caddy installed.
- DNS A record for the domain pointing at the instance's Elastic IP.
- SSH access to the instance.

### First-Time Server Setup

1. Generate a CI deploy keypair.

```sh
ssh-keygen -t ed25519 -f qaqc-ci-deploy -N ""
```

- Register the public key on the EC2 instance (add to `~ubuntu/.ssh/authorized_keys`)
- Add the private key as the `CI_EC2_DEPLOY_KEY` secret in this GitHub repo.
- Add the Domain or Elastic IP as the `CI_EC2_DEPLOY_HOST` secret in this GitHub repo.

2. Install Node.js 24.

```sh
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs
```

3. Install and configure Caddy as a reverse proxy.

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

sudo tee /etc/caddy/Caddyfile <<'EOF'
ec2.qaqc.ooi-rca.net {
  reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
```

Caddy automatically provisions a Let's Encrypt TLS certificate once DNS is pointing at the instance.

4. Clone the repo and build.

```sh
git clone git@github.com:OOI-CabledArray/QAQC_dashboard.git /home/ubuntu/qaqc-dashboard
cd /home/ubuntu/qaqc-dashboard/dashboard
npm install
npm run build
```

5. Set up the database and systemd service.

```sh
mkdir -p data

sudo cp deploy/qaqc-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable qaqc-dashboard
sudo systemctl start qaqc-dashboard

# Create the first admin user.
npx tsx scripts/create-admin.ts --email you@example.com --name "Your Name"
```

### Verifying the Deployment

```sh
sudo systemctl status qaqc-dashboard   # Check the app is running.
sudo systemctl status caddy            # Check the reverse proxy.
sudo journalctl -u qaqc-dashboard -f   # Follow app logs.
```

### Continuous Deployment

Pushes to `main` trigger the `deploy_prod.yaml` GitHub Actions workflow, which SSHs into the instance, pulls the latest code, rebuilds, and restarts the service. No manual steps are needed after the initial setup.

### Architecture

- **Caddy** listens on ports 80/443, handles TLS via Let's Encrypt, and proxies to Nuxt on port 3000
- **Nuxt** runs as a Node.js process managed by systemd (`qaqc-dashboard.service`)
- **SQLite** stores users, sessions, and archive records at `data/database.sqlite`
- **S3** (`ooi-rca-qaqc-prod`) stores plot images and archive snapshots, proxied to the browser by server middleware
- **Scheduled Jobs** (enabled via `ENABLE_SCHEDULED_JOBS=true` in the service file) handle daily archive snapshots, retention cleanup, database backups, and session expiry
