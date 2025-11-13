# 📁 SecureShare — Encrypted File Sharing Platform

SecureShare is a secure, privacy-focused file-sharing web application that encrypts files **client-side** before they ever leave your device. Users can upload encrypted files and share them through **time-limited**, **password-protected**, and **download-limited** secure links.

Built using **React + TypeScript**, **Vite**, **Supabase**, and the **Web Crypto API**, SecureShare is designed for privacy-conscious individuals who need strong file security with simple user experience.

---

## 🚀 Features

### 🔒 Client-Side Encryption
- AES-256-GCM encryption performed **in the browser**
- Supabase never sees unencrypted files

### ⏰ Smart Expiration
- Share links expire in **1, 24, 48, or 72 hours**

### 📉 Download Limits
- Restrict downloads from **1 to 100** times

### 🔗 Secure Share Links
- Unique, cryptographically random URLs  
- Optional password protection

### 📁 File Management Dashboard
- View uploaded files  
- Track download counts  
- Delete items  
- Regenerate secure share links  

### 🛡️ Security
- **Row-Level Security (RLS)** ensuring isolation  
- Executables blocked (.exe, .bat, .sh, etc.)  
- 20MB max file size  
- IP-based download tracking  
- Email/Magic link authentication

---

---

# 🏗️ Tech Stack

### **Frontend**
- React (TypeScript)
- Vite
- Tailwind CSS + shadcn/ui
- Web Crypto API (AES-256-GCM)

### **Backend**
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase RLS
- Supabase Edge Functions

### **Local Dev**
- Supabase Local (Docker)
- Mailpit (local SMTP testing)

---

# 📦 Local Development Setup

Follow these steps on fresh Linux Mint or Ubuntu.

---

## 1️⃣ Install Docker

```bash
sudo apt update
sudo apt install -y docker.io
sudo usermod -aG docker $USER
newgrp docker
````

Verify:

```bash
docker run hello-world
```

---

## 2️⃣ Install Supabase CLI (via Homebrew)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.bashrc
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install supabase/tap/supabase
```

Verify:

```bash
supabase --version
```

---

# ▶️ Start Supabase Local

```bash
supabase start
```

You’ll get:

| Service  | URL                                                     |
| -------- | ------------------------------------------------------- |
| API      | [http://127.0.0.1:54321](http://127.0.0.1:54321)        |
| Studio   | [http://127.0.0.1:54323](http://127.0.0.1:54323)        |
| Mailpit  | [http://127.0.0.1:54324](http://127.0.0.1:54324)        |
| Database | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

---

# ⚙️ Required Supabase Config (config.toml)

Use this **exact working version**:

```toml
project_id = "mlfclynxysgrnhpezguj"

#######################################
# Auth Configuration
#######################################

[auth]
site_url = "http://localhost:8080"
additional_redirect_urls = ["http://localhost:8080"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = false
max_frequency = "1m"

[auth.sms]
enable_signup = false

# ---- OAuth Providers (Disabled) ----
[auth.external.github]    enabled = false
[auth.external.google]    enabled = false
[auth.external.gitlab]    enabled = false
[auth.external.bitbucket] enabled = false
[auth.external.linkedin]  enabled = false
[auth.external.facebook]  enabled = false
[auth.external.twitter]   enabled = false
[auth.external.discord]   enabled = false
[auth.external.apple]     enabled = false
[auth.external.slack]     enabled = false
[auth.external.spotify]   enabled = false
[auth.external.twitch]    enabled = false
[auth.external.notion]    enabled = false
[auth.external.azure]     enabled = false
[auth.external.keycloak]  enabled = false
[auth.external.zulip]     enabled = false
```

Restart after changes:

```bash
supabase stop
supabase start
```

---

# ▶️ Start Frontend

Install dependencies:

```bash
npm install
```

Run dev:

```bash
npm run dev
```

Open:

```
http://localhost:8080
```

---

# 🔐 Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Get your anon key:

```bash
supabase status
```

---

# 🧹 Resetting Supabase Local

## Delete all users:

Open Studio → SQL → run:

```sql
delete from auth.users;
delete from auth.identities;
```

## Full reset:

```bash
supabase stop
docker volume ls | grep mlfclynxysgrnhpezguj
docker volume rm <volume_name>
supabase start
```

---

# 🛫 Deploying to Production

## 1. Link project

```bash
supabase link --project-ref <PROJECT_ID>
```

## 2. Deploy DB

```bash
supabase db push
```

## 3. Deploy Frontend

Build:

```bash
npm run build
```

Deploy the `dist/` folder to:

* Lovable (recommended)
* Vercel
* Netlify
* Cloudflare Pages

---

# 🤝 Contributing

PRs welcome!
Feature suggestions encouraged.

---

# 📄 License

MIT License © 2025 SecureShare

```
