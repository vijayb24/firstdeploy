import 'dotenv/config'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import cookie from 'cookie'
import express from 'express'
import { OAuth2Client } from 'google-auth-library'
import { EncryptJWT, jwtDecrypt } from 'jose'

const port = Number(process.env.PORT || 5173)
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${port}`
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const sessionSecret = process.env.SESSION_SECRET
const sessionCookieName = 'vijay_portal_session'
const oauthCookieName = 'vijay_portal_oauth'
const sessionMaxAge = 60 * 60 * 24 * 7
const oauthMaxAge = 60 * 10
const app = express()
const google = new OAuth2Client(googleClientId)
const appDirectory = path.dirname(fileURLToPath(import.meta.url))

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.')
}

if (!googleClientId || !googleClientSecret) {
  throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your local .env file.')
}

if (!sessionSecret) {
  throw new Error('Set SESSION_SECRET in your local .env file.')
}

const sessionKey = Buffer.from(sessionSecret, 'base64')
if (sessionKey.length !== 32) {
  throw new Error('SESSION_SECRET must be a base64-encoded 32-byte value.')
}

const parsedOrigin = new URL(appOrigin)
if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== appOrigin) {
  throw new Error('APP_ORIGIN must be an origin such as https://portal.example.com.')
}

const secureCookies = parsedOrigin.protocol === 'https:'
const redirectUri = new URL('/auth/google/callback', appOrigin).toString()
const sessionCookieOptions = {
  httpOnly: true,
  maxAge: sessionMaxAge,
  path: '/',
  sameSite: 'lax',
  secure: secureCookies,
}
const oauthCookieOptions = {
  ...sessionCookieOptions,
  maxAge: oauthMaxAge,
}

function setEncryptedCookie(response, name, payload, options, expiry) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .encrypt(sessionKey)
    .then((value) => response.append('Set-Cookie', cookie.serialize(name, value, options)))
}

async function readEncryptedCookie(request, name) {
  const cookies = cookie.parse(request.headers.cookie || '')
  const value = cookies[name]
  if (!value) return null

  const { payload } = await jwtDecrypt(value, sessionKey)
  return payload
}

function clearCookie(response, name) {
  response.append('Set-Cookie', cookie.serialize(name, '', {
    ...sessionCookieOptions,
    maxAge: 0,
  }))
}

function secureCompare(left, right) {
  const leftBuffer = Buffer.from(left || '')
  const rightBuffer = Buffer.from(right || '')
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function redirectWithAuthError(response, code) {
  const target = new URL('/', appOrigin)
  target.searchParams.set('authError', code)
  response.redirect(target.toString())
}

app.get('/auth/google', async (_request, response, next) => {
  try {
    const state = crypto.randomBytes(32).toString('base64url')
    const nonce = crypto.randomBytes(32).toString('base64url')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    await setEncryptedCookie(response, oauthCookieName, { state, nonce, codeVerifier }, oauthCookieOptions, `${oauthMaxAge}s`)

    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorizationUrl.search = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString()

    response.redirect(authorizationUrl.toString())
  } catch (error) {
    next(error)
  }
})

app.get('/auth/google/callback', async (request, response) => {
  let oauth
  try {
    oauth = await readEncryptedCookie(request, oauthCookieName)
  } catch (error) {
    console.error('Unable to validate Google sign-in state:', error)
  }
  clearCookie(response, oauthCookieName)

  const { code, state, error: providerError } = request.query
  if (providerError || typeof code !== 'string' || typeof state !== 'string' || !oauth) {
    redirectWithAuthError(response, providerError === 'access_denied' ? 'cancelled' : 'sign_in_failed')
    return
  }

  if (!secureCompare(state, oauth.state)) {
    redirectWithAuthError(response, 'invalid_state')
    return
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: oauth.codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed with HTTP ${tokenResponse.status}.`)
    }

    const tokens = await tokenResponse.json()
    if (typeof tokens.id_token !== 'string') {
      throw new Error('Google did not return an ID token.')
    }

    const ticket = await google.verifyIdToken({
      idToken: tokens.id_token,
      audience: googleClientId,
    })
    const identity = ticket.getPayload()

    if (
      !identity?.sub ||
      !identity.email ||
      !identity.email_verified ||
      !secureCompare(identity.nonce, oauth.nonce)
    ) {
      throw new Error('Google returned an invalid or unverified account.')
    }

    await setEncryptedCookie(response, sessionCookieName, {
      sub: identity.sub,
      email: identity.email,
      name: identity.name || identity.email,
      picture: identity.picture || null,
    }, sessionCookieOptions, `${sessionMaxAge}s`)

    response.redirect(new URL('/dashboard', appOrigin).toString())
  } catch (error) {
    console.error('Google sign-in failed:', error)
    redirectWithAuthError(response, 'sign_in_failed')
  }
})

app.get('/api/me', async (request, response) => {
  response.set('Cache-Control', 'no-store')
  try {
    const session = await readEncryptedCookie(request, sessionCookieName)
    if (!session?.sub || !session.email) {
      clearCookie(response, sessionCookieName)
      response.status(401).json({ error: 'not_authenticated' })
      return
    }

    response.json({
      user: {
        email: session.email,
        name: session.name,
        picture: session.picture,
      },
    })
  } catch (error) {
    console.error('Unable to read the sign-in session:', error)
    clearCookie(response, sessionCookieName)
    response.status(401).json({ error: 'not_authenticated' })
  }
})

app.post('/api/logout', (request, response) => {
  if (request.get('origin') !== appOrigin) {
    response.status(403).json({ error: 'invalid_origin' })
    return
  }

  clearCookie(response, sessionCookieName)
  response.status(204).end()
})

const isProduction = process.env.NODE_ENV === 'production'
if (isProduction) {
  const buildDirectory = path.join(appDirectory, 'dist')
  app.use(express.static(buildDirectory))
  app.use((request, response, next) => {
    if (request.method !== 'GET') return next()
    response.sendFile(path.join(buildDirectory, 'index.html'))
  })
} else {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    configFile: path.join(appDirectory, 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

app.listen(port, () => {
  console.log(`Vijay Portal listening at ${appOrigin}`)
})
