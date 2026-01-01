# Prompt Optimizer - Web Platform

This is a web version of the Prompt Optimizer, built with Next.js and FastAPI, designed for Vercel deployment.

## Structure

- `src/`: Next.js frontend using Tailwind CSS.
- `api/`: Python backend using FastAPI (Serverless Functions).
- `requirements.txt`: Python dependencies.

## Local Development

### 1. Prerequisites
- Node.js & pnpm
- Python 3.9+
- `.env` file with `OPENAI_API_KEY` and `GEMINI_API_KEY` in the `web-platform` directory.

### 2. Setup

```bash
cd web-platform
pnpm install
```

### 3. Running

To run locally, you need to run both the Python backend and the Next.js frontend. We've provided a helper script to make this easy.

**Option A (Recommended):**
```bash
./run_dev.sh
```
This will:
1. Create a Python virtual environment and install requirements (if needed).
2. Start the FastAPI backend on port 8000.
3. Start the Next.js frontend on port 3000.

**Option B (Vercel CLI):**
```bash
vercel dev
```

**Option C (Manual):**
1. Start Python Backend:
   ```bash
   pip install -r requirements.txt
   uvicorn api.index:app --reload --port 8000
   ```
2. Start Frontend:
   ```bash
   pnpm dev
   ```
   *Note: `next.config.ts` is configured to rewrite `/api` calls to `localhost:8000` when in development mode.*

## Deployment

Deploy to Vercel:
1. Push this repository (or just the `web-platform` folder).
2. Set **Root Directory** to `web-platform` in Vercel Project Settings.
3. Set Environment Variables (`OPENAI_API_KEY`, `GEMINI_API_KEY`).
4. Vercel automatically detects Next.js and the Python API.
