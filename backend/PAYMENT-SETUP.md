# Midtrans sandbox setup — testing only

**Not production-ready. Do not use real payments or real card, bank or wallet details.** Use an isolated sandbox merchant account, disposable test users and database, and only Midtrans's official sandbox test data and simulator. The backend sends requests to Midtrans sandbox hosts; this is not a production payment integration. Do not point a public production app or real users at this environment.

## Configure the backend

1. From `backend/`, create a Python environment and install `requirements.txt` as described in [README.md](README.md). Provision a **separate test PostgreSQL database**. Back up any database containing data before migrations and check that `DATABASE_URL` identifies the intended test database. Never run migrations against an unknown database.
2. If needed, copy `.env.example` to `.env` (do not overwrite an existing file), restrict its permissions (`chmod 600 .env`), and configure `DATABASE_URL` and a unique strong `JWT_SECRET_KEY`. Keep `.env` out of Git, logs, screenshots and chat. Configure `CORS_ORIGINS` for the exact test web origin where applicable.
3. In the Midtrans **sandbox** dashboard, obtain the sandbox Server Key and the separate Signature Secret Key. Privately add `MIDTRANS_SERVER_KEY` (Server Key for API requests) and `MIDTRANS_SIGNATURE_KEY` (Signature Secret Key for verifying notifications) to the backend environment using your secret manager or a private editor on `backend/.env`. These are distinct keys; the latter is not the notification's `signature_key` hash and not the Client Key. Do not put either value in the Expo app, `EXPO_PUBLIC_*`, source control, command history, logs, or messages. Restart the backend after changing environment values. Missing values cause payment requests to fail closed. See [Midtrans Access Keys](https://docs.midtrans.com/docs/access-keys).
4. From `backend/`, with its environment active and the intended `DATABASE_URL` set, inspect migration state, then apply reviewed migrations:

   ```sh
   alembic current
   alembic heads
   alembic upgrade head
   alembic current
   ```

   Confirm current matches head. The payment migrations include `0004_payments` and `0005_payment_grants`; preserve existing entitlement data and review [PAYMENTS-BLOCKERS.md](PAYMENTS-BLOCKERS.md) before upgrading an existing database. Do not run a downgrade as a test.
5. Start the API from `backend/` using `uvicorn app.main:app --host 0.0.0.0 --port 8000` when testing with a physical phone on a trusted LAN, and restrict access with the host firewall. Configure a reachable API URL for the frontend; on a physical phone localhost points to the phone, not the server. For web, use an allowed origin. Use TLS for shared networks and do not expose development services indiscriminately.

## Webhook

Expose the test API via a controlled public HTTPS endpoint with a valid trusted certificate (a secured tunnel or test deployment), forwarding POST requests unchanged to `/v1/payments/webhook` (adjust if `API_V1_PREFIX` was changed). In the **sandbox** Midtrans dashboard, under Settings > Configuration, set Payment Notification URL to `https://<your-test-host>/v1/payments/webhook`. This is not the finish redirect URL. Midtrans must reach it without login, VPN or a password interstitial; do not expose other endpoints unnecessarily. Never use localhost or a self-signed certificate. Remove the tunnel/dashboard URL when finished.

The server verifies the SHA-512 notification signature and fetches status from Midtrans before updating entitlement; an HTTP 2xx delivery alone does not establish that the user's intended access is correct. Inspect sandbox dashboard notification history and sanitized backend logs; do not log keys, authorization headers, or payment details. See [Midtrans notifications](https://docs.midtrans.com/reference/handle-notifications) and [webhook configuration](https://docs.midtrans.com/docs/https-notification-webhooks).

## Sandbox verification

Sign in as a test user, open the sandbox payment page, create a transaction, open its sandbox checkout and use only official simulator/test data. Return to the app and explicitly check status; closing checkout is not payment confirmation. Verify notification delivery in the sandbox dashboard and compare the app's refreshed status and profile with the test account. Test pending and unsuccessful outcomes too; check repeated status checks do not add another entitlement. Never mark a transaction successful from a browser redirect alone.

If checkout creation times out or reports `checkout_uncertain`, do **not** create a replacement: retain the order/client IDs, inspect the sandbox dashboard and ask an operator to investigate. Automatic recovery of an uncertain checkout is not implemented. Do not share keys or transaction details in public reports.

## Known gaps

Real sandbox transactions, webhook delivery and mobile/browser behavior have not been verified with actual sandbox credentials in this setup. There is no scheduled missed-notification reconciliation, automated uncertain-checkout recovery, or complete operator tooling. Refund/chargeback and historical grant limitations, stale provider responses, and database-lock/network risks are documented in [PAYMENTS-BLOCKERS.md](PAYMENTS-BLOCKERS.md). Current access is the user profile's entitlement, not the payment record's original `granted_until`. This documentation is not a production-readiness claim.
