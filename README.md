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

- `mohammed.iya.habib@pak.local` / `mohammed`
- `kange.polivone@pak.local` / `kange`
- `banini.sandrine@pak.local` / `banini`

The username is the email. The default password is the lowercase first name.

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
- Regisseur: cash movement and payment recording

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
