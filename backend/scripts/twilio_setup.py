"""Point your Twilio number at this API (incoming calls + status). Run: python scripts/twilio_setup.py

Uses TWILIO_* and PUBLIC_BASE_URL from backend/.env. Re-run whenever the tunnel URL changes.
"""
import httpx

from app.config import get_settings

s = get_settings()
base = s.public_base_url.rstrip("/")
api = f"https://api.twilio.com/2010-04-01/Accounts/{s.twilio_account_sid}"
auth = (s.twilio_account_sid, s.twilio_auth_token)
found = httpx.get(f"{api}/IncomingPhoneNumbers.json", auth=auth, timeout=15,
                  params={"PhoneNumber": s.twilio_number}).json()["incoming_phone_numbers"]
if not found:
    raise SystemExit("TWILIO_NUMBER was not found in this Twilio account")
r = httpx.post(f"{api}/IncomingPhoneNumbers/{found[0]['sid']}.json", auth=auth, timeout=15,
               data={"VoiceUrl": f"{base}/v1/webhooks/twilio/incoming", "VoiceMethod": "POST",
                     "StatusCallback": f"{base}/v1/webhooks/twilio/status",
                     "StatusCallbackMethod": "POST"})
r.raise_for_status()
print("Twilio number now sends incoming calls to", f"{base}/v1/webhooks/twilio/incoming")
