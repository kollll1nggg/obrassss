<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NJvgpJj8-FH2HVEIXHTZOiYSFma6zjBR

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Local storage (dados)

- This project includes a lightweight Express server at `server/index.js` that accepts uploads and saves files under the `dados/` folder (organized into `photos/`, `videos/`, and `others/`).
- Upload endpoints used by the frontend (when available):
   - POST /api/upload/media  (field name: files) -> saves multiple files
   - POST /api/upload/story  (field name: file) -> saves a story file
   - POST /api/upload/music  (field name: file) -> saves a music file
- Files are served statically under `/uploads/...`, for example: `http://localhost:4000/uploads/photos/12345.jpg`.
- The frontend `services/api.ts` will attempt to upload to `http://localhost:4000` and fall back to the in-memory mock behavior if the server is not running.

How to run locally

- In one terminal run the backend: `npm run server`
- In another terminal run the frontend: `npm run dev`

