# Project Repository

This monorepo contains the Corporate LMS Web Application.

Quick start for LMSWebApplication:
- Change directory to Learning-management-system/LMSWebApplication
- Copy `.env.example` to `.env` and set either:
  - SUPABASE_URL and SUPABASE_KEY
  - OR REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
- Optional: set REACT_APP_SITE_URL for auth email redirects and invites
- Install and start: `npm install && npm start`