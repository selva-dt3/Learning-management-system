# LMS Web Application (React + Supabase)

This app is a frontend-driven Corporate LMS using React and Supabase JavaScript APIs. It supports roles (Admin, HR, Employee), lessons with storage (PDF/video), quizzes, onboarding, analytics, and real-time updates.

## Setup

1) Install dependencies:
```
npm install
```

2) Configure environment:
- Copy `.env.example` to `.env` and set:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
  - Optional: `REACT_APP_SITE_URL` (defaults to `http://localhost:3000`)

Note: Other env vars are already present in the environment for this container.

3) Start the app:
```
npm start
```

## Supabase Notes

- Tables referenced by the UI:
  - profiles(user_id uuid, role text ['Admin','HR','Employee'], full_name text, ...)
  - lessons(id uuid, title text, description text, status text ['draft','published'], storage_path text, updated_at timestamp, ...)
  - lesson_progress, lesson_assignments, quizzes, quiz_questions, quiz_answers, quiz_submissions, onboarding_status
- Storage bucket example: `lesson-files` to store PDFs/videos. Save storage_path like `lesson-files/path/to/file.pdf`.
- RLS policies must allow:
  - profiles: users can select their own row (user_id = auth.uid()).
  - lessons: Admins see all; others see published and/or assigned via policies.
  - onboarding_status: upsert by owner or HR/Admin as per requirements.

## Features in this scaffold

- Supabase client configured via env and used across the app
- Auth pages and session persistence via AuthContext
- Role-based dashboards and guarded routes
- Lessons list, editor (Admin/HR), and viewer with signed URLs (PDF/video)
- Onboarding acknowledgment saved to onboarding_status
- Basic analytics sample computing completion rates from lesson_progress
- Real-time updates on lessons list through Supabase channel

Next steps: extend quizzes (builder and taker), HR assignments management, richer analytics, and file uploader to Supabase Storage.

Troubleshooting:
- If routing fails, ensure `react-router-dom@^6` is installed (already added in package.json). Re-run `npm install`.
- Ensure Supabase env vars are correctly set in `.env`. The app will log a console error if not configured.


## Features

- **Lightweight**: No heavy UI frameworks - uses only vanilla CSS and React
- **Modern UI**: Clean, responsive design with KAVIA brand styling
- **Fast**: Minimal dependencies for quick loading times
- **Simple**: Easy to understand and modify

## Getting Started

In the project directory, you can run:

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## Customization

### Colors

The main brand colors are defined as CSS variables in `src/App.css`:

```css
:root {
  --kavia-orange: #E87A41;
  --kavia-dark: #1A1A1A;
  --text-color: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
}
```

### Components

This template uses pure HTML/CSS components instead of a UI framework. You can find component styles in `src/App.css`. 

Common components include:
- Buttons (`.btn`, `.btn-large`)
- Container (`.container`)
- Navigation (`.navbar`)
- Typography (`.title`, `.subtitle`, `.description`)

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
