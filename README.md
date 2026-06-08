# Variety Solar CRM - Standalone Edition

A complete, self-hosted CRM system for solar sales teams. This is a standalone version that replaces the previous Manus Forge-based system with direct integrations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│                     localhost:5173 (Vite)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Express/Node)                      │
│                       localhost:3000                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Auth    │  │   AI     │  │  Leads   │  │    Sheets        │ │
│  │  (JWT)   │  │ (OpenAI) │  │   API    │  │   Integration    │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                  │           │
│  ┌────▼─────────────▼─────────────▼──────────────────▼─────────┐ │
│  │                        Services                            │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐ │ │
│  │  │   DB    │  │   S3     │  │  SMS    │  │    Email      │ │ │
│  │  │ (MySQL) │  │ (AWS)   │  │(Broadcast)│  │    (Zoho)    │ │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └───────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Replacements from Manus

| Component | Previous (Manus) | New (Standalone) |
|-----------|------------------|------------------|
| Authentication | Manus OAuth | JWT + Google OAuth |
| LLM/AI | Manus Forge API | OpenAI API |
| Storage | Manus Storage | AWS S3 |
| Database | Manus DB | MySQL / SQLite |
| Sheets | Manus Google API | googleapis package |

## Features

### Core CRM
- Lead management with status tracking
- Call logging and recording
- Activity timeline
- Search and filtering

### AI Assistant
- Chat interface powered by GPT-4
- Call script generation
- Lead analysis
- Email drafting

### Integrations
- **Google Sheets**: Import/export leads
- **SMS Broadcast**: Send SMS notifications
- **Zoho Email**: Send templated emails
- **AWS S3**: Store call recordings

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- (Optional) MySQL/TiDB for production

### Installation

1. **Clone and setup**
```bash
cd crm-standalone
```

2. **Install server dependencies**
```bash
cd server
npm install
```

3. **Install client dependencies**
```bash
cd ../client
npm install
```

4. **Configure environment**
```bash
# In server directory
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server
NODE_ENV=development
PORT=3000

# Authentication
JWT_SECRET=your-super-secret-key-change-in-production

# Database (optional - uses SQLite by default)
DATABASE_URL=mysql://user:password@host:port/database

# OpenAI (required for AI features)
OPENAI_API_KEY=sk-your-openai-key
LLM_MODEL=gpt-4o-mini

# AWS S3 (optional - for call recordings)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-southeast-2
S3_BUCKET=your-bucket-name

# Google OAuth (optional - for Google Sheets)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_SHEETS_ID=your-spreadsheet-id

# SMS Broadcast
SMS_BROADCAST_USERNAME=your-username
SMS_BROADCAST_PASSWORD=your-password

# Email (Zoho)
SMTP_HOST=smtppro.zoho.com
SMTP_PORT=465
SMTP_USER=your@email.com
SMTP_PASS=your-password
```

### Running

**Development mode (recommended):**
```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

**Production mode:**
```bash
# Build client
cd client && npm run build

# Start server
cd server && npm run build && npm start
```

## API Endpoints

### Authentication
- `GET /auth/login` - Login page
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Create account
- `POST /auth/logout` - Logout
- `GET /auth/google` - Google OAuth
- `GET /auth/me` - Current user

### Leads
- `GET /api/leads` - List leads
- `GET /api/leads/:id` - Get lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `GET /api/leads/search?q=` - Search leads

### Calls
- `GET /api/calls` - List calls
- `POST /api/calls` - Log call
- `PUT /api/calls/:id` - Update call

### AI
- `POST /api/ai/chat` - Chat with AI
- `POST /api/ai/call-script` - Generate call script
- `POST /api/ai/analyze-lead` - Analyze lead
- `POST /api/ai/speak` - Text to speech

### Sheets
- `POST /api/sheets/import` - Import from Google Sheets
- `POST /api/sheets/export` - Export to Google Sheets

## Database Schema

### Users
- id, open_id, email, name, role
- password_hash, password_salt
- google_id, avatar
- login_method, created_at

### Leads
- id, owner_id, first_name, last_name
- email, phone, address, suburb, state, postcode
- status, source, notes
- created_at, updated_at

### Calls
- id, lead_id, user_id, direction
- duration, status, notes
- recording_url, transcription

### Conversations
- id, lead_id, user_id, channel
- direction, message, raw_payload

### Activities
- id, lead_id, user_id, type
- description, metadata

## Deployment

### Docker (recommended for production)

```dockerfile
# server/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### VPS Deployment

1. Clone repository
2. Install dependencies
3. Configure .env
4. Set up MySQL database
5. Build and run with PM2:
```bash
pm2 start npm -- name "crm-server" -- start
```

## Troubleshooting

### AI features not working
- Verify `OPENAI_API_KEY` is set
- Check API key has credits
- Ensure network can reach OpenAI

### Google Sheets import fails
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Check spreadsheet ID is correct
- Ensure OAuth consent was granted

### Call recordings not uploading
- Verify AWS credentials
- Check S3 bucket exists
- Ensure IAM permissions allow PutObject

## License

Proprietary - Variety Solar Pty Ltd