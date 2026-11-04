# Vijay Portal

This React app uses a small Express server to handle Google OpenID Connect sign-in. The server validates the OAuth response and keeps the signed-in user's profile in an encrypted, `HttpOnly` cookie. OAuth state, nonce, and PKCE protect the sign-in flow; the Google client secret and session key are only read by the server.

## Configure Google sign-in

1. In Google Cloud Console, create an OAuth client ID with application type **Web application**.
2. Add this authorized redirect URI for local development:

   ```text
   http://localhost:5173/auth/google/callback
   ```

3. Copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the OAuth client you created.
4. Generate a random session key:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Put the output in `SESSION_SECRET`. Keep `.env` private; it is ignored by Git.
5. Start the app:

   ```text
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`.

For deployment, set the same environment variables on the server, set `APP_ORIGIN` to the app's public origin, set `PORT` to the server's listening port, register `${APP_ORIGIN}/auth/google/callback` in Google Cloud Console, then run `npm run build` and `npm start` with `NODE_ENV=production`. Use HTTPS in production so the session cookie is marked `Secure`.

## Scripts

- `npm run dev` starts the Express server and Vite development middleware on the same origin.
- `npm run build` creates the production frontend in `dist`.
- `npm start` serves the production build and authentication routes.
- `npm run lint` runs ESLint.

## Dashboard

After Google sign-in, the app opens `/dashboard` with your Google profile,
account details, and a sign-out button. Refreshing checks the server session
again before showing the dashboard. Signed-out users return to `/`.
Signing out clears the session and returns to the login page.

The dashboard currently contains profile information only; saved rituals and
other member features are not implemented. Future private API endpoints must
validate the server session as `/api/me` does, not rely on the React view.
