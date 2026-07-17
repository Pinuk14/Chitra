<div align="center">
  <img src="./public/Chitra_logo.png" alt="Chitra Logo" width="120" />
  <h1>Chitra</h1>
  <p><strong>A Real-Time, Secure Collaborative Whiteboard & Chat Application</strong></p>

  <h3>🚀 <a href="https://chitra-draw.vercel.app/">Play with the Live Demo</a></h3>

  <p>
    <img src="https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

<hr />

## 🌟 Overview

**Chitra** is a modern, high-performance collaborative whiteboard built for teams, educators, and creatives. It combines an infinite canvas with real-time cursor tracking, shape rotation, and secure messaging into one beautiful, neo-brutalist interface.

👉 **[Try the Live Demo: chitra-draw.vercel.app](https://chitra-draw.vercel.app/)**

Under the hood, Chitra utilizes a hybrid architecture relying on **Supabase Realtime** for sub-millisecond live broadcasting and **PostgreSQL Row Level Security (RLS)** for strict, scalable data persistence. 

## ✨ Key Features

- 🎨 **Advanced Infinite Canvas**: Draw freehand, create shapes (rectangles, circles, triangles), add text, and seamlessly select, drag, resize, and **rotate** elements.
- ⚡ **Real-Time Sync**: Watch your collaborators draw in real-time with high-frequency WebSocket broadcasting and live cursors.
- 🔒 **End-to-End Security**: Drawings and chat messages are securely encrypted. 
- 🛡️ **Role-Based Access Control (RBAC)**: Fine-grained permissions featuring `owner`, `admin`, `editor`, and `viewer` roles.
- 🚪 **Advanced Room Modes**:
  - **Public**: Anyone with the link can join and draw.
  - **Invite-Only**: Strictly locked down to invited users.
  - **Manual Approval**: Users enter a waiting room and must be approved by an Admin.
- 🔨 **Moderation Tools**: Kick, ban, or mute disruptive users instantly.
- 💬 **Live Chat**: Integrated room-based chat to communicate alongside your canvas.
- 🎭 **Guest Mode**: Quickly onboard testers with a frictionless Anonymous Auth login flow.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Supabase](https://supabase.com/) Account

### 1. Clone the repository

```bash
git clone https://github.com/Pinuk14/Chitra.git
cd chitra
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Supabase Setup

1. Create a new project in your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**, create a new query, and paste the contents of the database schema (provided in the repository docs). Run it to generate all tables, triggers, and RLS policies.
3. Navigate to **Authentication -> Providers** and enable **Email** and **Anonymous Sign-ins** (required for Guest Mode).

### 4. Environment Variables

Create a `.env.local` file in the root directory and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Architecture

- **Frontend**: Next.js App Router, React 19, TypeScript
- **Styling**: Tailwind CSS (v4) with custom neo-brutalist design tokens
- **Backend & Database**: Supabase (PostgreSQL)
- **Real-Time Engine**: Supabase `broadcast` (WebSockets) for live strokes, and `postgres_changes` for chat and room state sync.
- **State Management**: React Hooks & Zustand

## 🔐 Security & Database Cleaning

Chitra's database is strictly protected via Postgres Row Level Security (RLS). Users can only view or modify rooms they have explicit access to. 

Furthermore, the database relies on strict `ON DELETE CASCADE` constraints. When a room is deleted by an owner, all associated strokes, chat messages, permission requests, and moderation logs are immediately completely wiped from the database, preventing storage leaks.

---
<div align="center">
  <p>Built with ❤️ for seamless real-time collaboration.</p>
</div>
