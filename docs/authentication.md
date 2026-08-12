# Authentication

Auth.js (NextAuth v5).

## Methods

1. Google OAuth when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set
2. Phone OTP via Credentials provider
   - `OTP_PROVIDER=mock` accepts code `000000` in local/dev
   - Twilio-shaped interface ready for production wiring

## Sessions

JWT sessions with role claims loaded from `user_roles`.

## Routes

- `/login`
- `/api/auth/[...nextauth]`
- `/api/auth/otp/request`
- `/api/auth/otp/verify`
