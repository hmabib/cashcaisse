# PAK RDLA Cash Advance Platform

This application manages the RDLA cash advance workflow for PAKAZURE.

## What The App Does

- Secure login with email and password
- Supplier management
- Invoice capture with automatic net payable calculation
- Verification and approval workflow
- Disbursement tracking
- Accounting journal and trial balance
- Audit review and printable official documents
- User guide page in simple English

## Default Accounts

The username is the email in the format `prenom.nom@pak.cm`.
Default passwords exist in the backend seed, but they are not displayed in the interface.

## Data Architecture

- Frontend: static HTML, CSS, and JavaScript
- Hosting: Vercel
- API: Vercel serverless functions in `/api`
- Database: Heroku PostgreSQL
- PostgreSQL schema: `caisse`

The backend creates and seeds these database objects automatically:

- `caisse.users`
- `caisse.app_state`

## Simple Process Guide

1. Login to the platform.
2. Create or update suppliers.
3. Create the invoice.
4. Verify the checklist.
5. Approve or reject the invoice.
6. Record the payment after approval.
7. Review accounting, audit, and official documents.

## Roles

- Ordonnateur: final approval
- Controleur: verification and compliance check
- Regisseur: cash movement, payment recording, and daily operating follow-up
- Polivone account: full platform access

## Detailed Guide For Polivone

1. Login with the regisseur account and confirm your name in the top bar.
2. Start on Dashboard and read the cash balance, budget, engaged amount, paid amount, and available amount.
3. Select the correct quarter before entering any operation.
4. Create or update suppliers before creating invoices.
5. Record each replenishment with date, quarter, reference, and notes.
6. Create invoices and review the automatic net payable calculation.
7. Open Verification and check every supporting item carefully.
8. Approve correct invoices or reject incomplete ones with a clear reason.
9. Open Disbursement and record each approved payment with the right date and payment mode.
10. Open Accounting and verify the journal after each cash movement.
11. If a doubtful accounting line exists, delete it only after internal confirmation and verify the new balance.
12. Open Audit to review anomalies and the cash count.
13. Open Documents to print official records when needed.
14. Polivone has full rights across the application.

## Important Rule

If there is doubt about an accounting line, the journal entry can be deleted from the accounting page. The running balance is recalculated automatically.

## Environment Variables

- `DATABASE_URL`: Heroku PostgreSQL connection string
- `AUTH_SECRET`: secret used to sign login tokens

## Project Structure

```text
api/
  auth/login.js
  auth/session.js
  bootstrap.js
  health.js
  state.js
css/
  style.css
js/
  app.js
  modules.js
  modules2.js
lib/
  auth.js
  db.js
index.html
vercel.json
package.json
```
