# Public Deployment (Vercel)

This project is configured as a static Vite app for Vercel.

## 1) Push the repository

Push this project to GitHub (or GitLab/Bitbucket).

## 2) Create a Vercel project

1. Open Vercel dashboard.
2. Click **Add New Project**.
3. Import this repository.
4. Confirm settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**.

`vercel.json` is included in the repo with these values.

## 3) Validate the live URL

After deploy, validate:

1. Open the production URL in browser.
2. Upload a plan CSV and Garmin CSV.
3. Enter some weekly actuals and set race date.
4. Refresh page and confirm data remains.
5. Open from a different browser/device and confirm it starts independently.

## Notes

- Persistence uses browser `localStorage`, so saved data is per-browser/per-device.
- Cross-device sync requires backend storage and authentication (out of scope here).
