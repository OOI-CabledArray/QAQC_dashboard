# Dashboard

## Project Setup

```sh
npm install
cp .env.example .env
```

Edit `.env` to set `QAQC_AWS_S3_BUCKET` to your development bucket. The server will refuse to start without it and `QAQC_AWS_REGION` set.

The server proxies plot images, discrete data CSVs, and archive files from S3. Valid AWS credentials and a configured bucket are required for the dashboard to display any data.

To create an admin user for local development:

```sh
npx tsx scripts/create-admin.ts --username admin --name "Your Name"
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

5. Create the `.env` file.

```sh
cp .env.example .env
```

Edit `.env` to set `QAQC_AWS_S3_BUCKET=ooi-rca-qaqc-prod`. See the [Environment Variables](#environment-variables) section for all available options.

6. Set up the database and systemd service.

```sh
mkdir -p data

sudo cp deploy/qaqc-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable qaqc-dashboard
sudo systemctl start qaqc-dashboard

# Create the first admin user.
npx tsx scripts/create-admin.ts --username admin --name "Your Name"
```

### Verifying the Deployment

```sh
sudo systemctl status qaqc-dashboard               # Check the app is running.
sudo systemctl status caddy                        # Check the reverse proxy.
journalctl --unit qaqc-dashboard --follow          # Follow app logs.
```

### Continuous Deployment

Pushes to `main` trigger the `deploy_prod.yaml` GitHub Actions workflow, which SSHs into the instance, pulls the latest code, rebuilds, and restarts the service. No manual steps are needed after the initial setup.

### Configuring and Restarting the Server

The `.env` file is read by systemd when the service starts. Changes to `.env` do not take effect until the service is restarted:

```sh
sudo systemctl restart qaqc-dashboard
```

### Archives

The dashboard supports three types of archives, each storing a snapshot of the current plot images from S3:

- **Scheduled** archives are created automatically by a cron job. One per day, keyed by date. If a scheduled archive already exists for the current date, it is replaced.
- **Event** archives are created manually by logged-in users through the UI. Each has a name and is keyed by date and slug. Duplicates for the same name and date are rejected.
- **Internal** archives are created by admin users. Each has a name and is keyed by slug. These are only visible to logged-in users.

To enable automatic daily archiving, set `QAQC_ARCHIVE_SCHEDULE` in `.env` to a cron expression (see [crontab.guru](https://crontab.guru/) for syntax help):

```sh
QAQC_ARCHIVE_SCHEDULE=0 19 * * 1   # Mondays at 12 PM Pacific (7 PM UTC)
```

Restart the service after changing `.env` for the new schedule to take effect.

Archive files are stored in S3 under `archives/<type>/<key>/QAQC_plots/`. The retention policy for scheduled archives thins them over time: all are kept for 30 days, then only Sundays are kept up to 180 days, then only the 1st of each month is kept beyond that. Event and internal archives are never automatically deleted.

### Scheduled Tasks

The following tasks run on a schedule configured in `nuxt.config.ts`:

| Task              | Schedule        | Description                                                                     |
| ----------------- | --------------- | ------------------------------------------------------------------------------- |
| `archive-cleanup` | Sundays at 3 AM | Remove stale pending archives, orphaned records, and apply the retention policy |
| `database-backup` | Daily at 4 AM   | Back up the SQLite database to S3                                               |
| `expire-sessions` | Every hour      | Delete expired login sessions                                                   |

Automatic archive creation is configured separately via the `QAQC_ARCHIVE_SCHEDULE` environment variable (see above).

### Environment Variables

All environment variables are set in the `.env` file. See `.env.example` for a template.

| Variable                | Required | Default                | Description                                                                |
| ----------------------- | -------- | ---------------------- | -------------------------------------------------------------------------- |
| `QAQC_AWS_S3_BUCKET`    | Yes      |                        | S3 bucket containing plot images and archive data                          |
| `QAQC_AWS_REGION`       | Yes      |                        | AWS region for the S3 bucket                                               |
| `QAQC_DATABASE`         | No       | `data/database.sqlite` | Path to the SQLite database file                                           |
| `QAQC_ARCHIVE_SCHEDULE` | No       | Disabled               | Cron expression for automatic archive creation (see [Archives](#archives)) |

AWS credentials are resolved by the AWS SDK default credential chain (environment variables, instance profile, etc.).

### Architecture

- **Caddy** listens on ports 80/443, handles TLS via Let's Encrypt, and proxies to Nuxt on port 3000.
- **Nuxt** runs as a Node.js process managed by systemd (`qaqc-dashboard.service`).
- **SQLite** stores users, sessions, and archive records at `data/database.sqlite`. Migrations run automatically on startup.
- **S3** stores plot images, discrete sample CSVs, and archive snapshots. Server middleware proxies requests matching `QAQC_plots/`, `discrete/`, `HITL_notes/`, `spectrograms/`, `echograms/`, and `archives/` to S3. Internal archives (`archives/internal/`) require authentication.
- **Database backups** are written daily to `s3://<bucket>/backups/database/<date>.sqlite`.

### Authentication

Authentication uses username/password with scrypt-hashed passwords stored in SQLite. Sessions are cookie-based (`session` cookie), expire after 7 days of inactivity, and are extended on each authenticated request.

There are two roles:

- **admin**: can create/delete all archive types and manage users.
- **viewer**: can create event archives and view internal archives.

Unauthenticated users can view the dashboard and all non-internal archives.

To manage users in production, use the admin UI at `/users` or create an admin directly:

```sh
cd /home/ubuntu/qaqc-dashboard/dashboard
npx tsx scripts/create-admin.ts --username <username> --name "<Full Name>" [--email <email>]
```

### S3 Bucket Structure

The S3 bucket is organized as follows:

```
<bucket>/
  QAQC_plots/              # Current plot images and index.json
  discrete/                 # Discrete sample CSV files
  HITL_notes/               # Human-in-the-loop notes
  spectrograms/             # Spectrogram images
  echograms/                # Echogram images
  archives/
    scheduled/<date>/       # Scheduled archive snapshots
    event/<date>-<slug>/    # Event archive snapshots
    internal/<slug>/        # Internal archive snapshots
  backups/
    database/<date>.sqlite  # Daily database backups
```

### Viewing Server Logs

The application logs to systemd's journal. To follow logs in real time:

```sh
journalctl --unit qaqc-dashboard --follow
```

To view recent logs (e.g. the last hour):

```sh
journalctl --unit qaqc-dashboard --since "1 hour ago"
```

To view logs from the most recent service start:

```sh
journalctl --unit qaqc-dashboard --boot
```

### Troubleshooting

Common issues:

- **Server won't start**: check that `.env` has `QAQC_AWS_S3_BUCKET` and `QAQC_AWS_REGION` set. The server logs the specific missing variable.
- **No plots visible**: verify AWS credentials are available to the process and the S3 bucket contains data under `QAQC_plots/`.
- **Archive stuck in "pending"**: the cleanup task removes stale pending archives (older than 1 hour) on its weekly run. To clean up immediately, restart the service.
- **Login not working**: check that the `data/` directory exists and is writable. The database is created automatically on first startup.
