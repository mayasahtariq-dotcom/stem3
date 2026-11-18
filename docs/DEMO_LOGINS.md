# Aaroh demo logins

These are demo accounts for showing Aaroh. The numbers are not real phones: no SMS is sent to them, and
the code is always **123456**. They only work while the backend has `DEMO_MODE=true` (Render → Environment).
Turn `DEMO_MODE` off after the demo, or anyone who knows 123456 can open these accounts.

Where to log in: your Vercel link (the web app), or http://localhost:3000 locally.
Type the 10-digit number without +91; the app adds it.

## Teacher

| Name | Phone | Code | Class |
|---|---|---|---|
| Demo Teacher | `6000000099` | `123456` | Class 7 Science (`BI07-AARH`) |

The teacher owns the class, its uploaded course, the dashboard, Notes and the call console.

## Class key

| Class | Subject, grade | Class key |
|---|---|---|
| Class 7 Science | Biology, Class 7 | **`BI07-AARH`** (the dash is optional) |

A student with no phone joins with the class key plus their name. Typing the same name again with the
same key opens the same account. Students already in this class by name: `may`, `maya`, `mayasah`, `Riya`.

## Students (phone login)

| Name | Phone | Code | Notes |
|---|---|---|---|
| Meena | `6000000101` | `123456` | In the class, league XP 45, has a parent linked |
| Arjun | `6000000102` | `123456` | In the class, league XP 30, has a parent linked |
| Fatima | `6000000103` | `123456` | In the class, league XP 20 |
| Kiran | `6000000104` | `123456` | In the class, league XP 10 |

## Parent

| Name | Phone | Code | Children |
|---|---|---|---|
| Demo Parent | `6000000201` | `123456` | Meena and Arjun (consent approved) |

A parent can also link another child: the student opens Profile → "Code for your parent", and the parent
types that 6-letter code on the parent home screen.

## Phone-only student (calls)

Ananya is a call-only student in the same class, on the phone number set as `DEMO_PHONE` in `backend/.env`.
Without a Twilio number, show calls with the phone simulator in the demo console: https://stem3.onrender.com/demo
(locally http://127.0.0.1:8000/demo).

## Real people

Anyone else signs in with their own phone number and gets a real SMS code (Twilio Verify). That needs the
Twilio account upgraded and `TWILIO_VERIFY_SID` plus `USE_FAKE_SMS=false` on Render.

## Recreating the demo parent

`ensure_demo_parent()` in `backend/app/demo.py` adds the parent and its links if missing, without deleting
anything. (`seed_demo()` wipes and recreates all demo accounts, which also deletes the demo teacher's
uploaded courses.)
