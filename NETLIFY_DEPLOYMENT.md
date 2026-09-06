# Netlify deployment

This repository is ready to deploy as a single-restaurant demo. It is not deployed yet. Production gateway and Gemini credentials have not been supplied or tested against their live services.

## Deploy the application

1. Put this source folder in a private Git repository, excluding `.env`, `data`, `node_modules` and `artifacts`. This workspace does not currently have a Git repository. Import that repository into Netlify. Use the included `netlify.toml`: build `npm run build`, publish `public`, functions `netlify/functions`.
2. Use Node 24. Set function runtime `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` in Netlify environment settings. Configure unique strong `MANAGER_PASSWORD` and `KITCHEN_PASSWORD`, and set `APP_ORIGIN` to the final HTTPS site URL with no trailing slash. Do not use localhost on the hosted site.
3. Enable Netlify Database for this project. The installed `@netlify/database` package and `netlify/database/migrations/001_state.sql` support its automatic provisioning/migrations. Netlify supplies `NETLIFY_DB_URL`. An external Postgres database can instead use private `DATABASE_URL`, with the SQL migration applied first. Never put either connection string in frontend files.
4. Initially set `PAYMENT_MODE=test`. Deploy through Netlify's Git build so functions and database migrations are included. Uploading just the `public` folder with drag-and-drop will not deploy the backend.
5. Open `/`, `/restaurant`, `/manager`, `/kitchen`, and `/manager/floor-editor`. Open a table as manager, download its QR and scan it from a second browser. The menu must load immediately, and the current visit must accept orders without a PIN.

Netlify Database availability and billing depend on the account plan. See [Netlify Database setup](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/) and [function configuration](https://docs.netlify.com/build/functions/configuration/).

## Existing local data

Local development still uses `data/resuto.sqlite`. Hosted requests use Postgres with a row-locked transaction for each mutation, preserving idempotency, stock and balances across function instances. No function writes a temporary SQLite database.

To transfer this restaurant, stop local writes and back up the SQLite database. Before the hosted application is first opened (which seeds its demo), privately set `DATABASE_URL` and run:

```powershell
node scripts/migrate-to-postgres.mjs data/resuto.sqlite
```

The tool preserves IDs, QR identifiers, visits, reservations, orders, floor and balances; it clears staff sessions and refuses to overwrite any existing hosted restaurant. Guest tokens remain valid as part of transferring ongoing visits. Treat the source database as a secret. If you already opened the hosted demo, use a new empty database or have an operator review a migration; this tool never erases the destination.

Old QR identifiers remain valid, but already printed QR images containing `localhost` still point to localhost. Regenerate and print QR codes after setting the public HTTPS origin. A URL embedded in an old physical print cannot be remotely changed.

## Menu data and AI

The manager's **Import & export** tab accepts CSV with a preview, field editing, validation and an explicit import. CSV exports cover menu, orders, reservations and payments; JSON exports exclude authentication credentials. Existing menu imports require the exported version so stale stock cannot overwrite sales. New rows omit id/version. Allergens are separated with `|`.

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` for text/PDF/photo menu extraction and natural-language guest recommendations. Files are sent to Gemini only on the manager's explicit extraction action. PDF/photos are limited to 3 MB. Extracted items start unavailable with zero portions, and require review for prices/allergens/stock. Without a key, CSV works and guest recommendations use clearly labeled menu rules; PDF/photo extraction reports its missing configuration.

## Stripe and Paymob

Both hosted checkout adapters are implemented. In test mode, simulated payments remain available; configured provider test keys can also be used for gateway sandbox acceptance testing. Never enter card details into Resuto: the guest is redirected to the provider-hosted checkout.

Stripe: configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and register `https://YOUR-SITE/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`. Checkout accepts card payments in EGP. Use a merchant account eligible for your country and currency.

Paymob: configure `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_ID_CARD` and optionally `PAYMOB_BASE_URL` (default `https://accept.paymob.com`). Configure the processed transaction callback as `https://YOUR-SITE/api/webhooks/paymob`; the intention also submits this notification URL. Use a matching EGP integration and real guest name/email/phone at checkout.

The server reserves one pending checkout per unsplit visit or per assigned share, pauses ordering and validates signed callbacks, stored provider order/session ID, exact amount and EGP currency before recording a payment. Browser return URLs never settle a balance. Retries do not duplicate ledger payments. Resume an existing checkout from the bill. Stripe session-expiry callbacks release its pending attempt. An uncertain Paymob creation or abandoned/failed Paymob checkout stays reserved for operator reconciliation; do not manually start a second charge. Automatic refunds, chargebacks and Paymob abandonment reconciliation are not implemented. Provider-dashboard reconciliation and full sandbox acceptance must be completed before real service.

After provider acceptance, `PAYMENT_MODE=live` disables simulated bill/deposit endpoints. Online reservation deposits are not implemented in this version: keep test mode for the full demo. Do not advertise live deposits. Live-mode reservations with a deposit cannot currently be confirmed, so a real-money launch needs that follow-up or a separately approved deposit-free reservation policy.

Reference: [Stripe Checkout Session](https://docs.stripe.com/api/checkout/sessions/object), [Paymob checkout experiences](https://developers.paymob.com/paymob-docs/developers/checkout-experiences).

## Verification and operational boundaries

`npm test` includes Netlify's local Postgres emulator, migration repeatability, two application instances, concurrent stock protection, rollback and the Lambda HTTP adapter. `npm run package:netlify` builds the function artifact. The unpacked ESM artifact was also executed against the emulator, catching and fixing bundler compatibility issues. No cloud deployment has been performed.

This remains one restaurant stored as a transactionally protected JSON document. It is not a multi-tenant SaaS, fiscal receipt system or high-volume normalized database. Staff sessions use strong opaque cookies; login throttling is per function instance, not a distributed security service. QR codes deliberately grant shared access to the current table visit. Do not publish table QR print sheets outside their intended guest audience. Configure backups and validate target-account function/database limits before accepting real customers. Real phone-device tests, live Gemini, gateway sandbox/live acceptance and deployment remain external verification steps.
