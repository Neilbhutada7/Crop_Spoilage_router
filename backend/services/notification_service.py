"""
SMS/IVR notification interface, wired for Twilio/Exotel but stubbed for
the MVP (Phase 3 roadmap item -- see README.md). Swapping in a real
provider later is a one-line change: implement _send_via_twilio (or
_send_via_exotel) and point self._transport at it in __init__.

There's no farmer/auth entity in the MVP (Phase 4 roadmap item), so
alerts are addressed by batch_id rather than a real farmer identifier --
see DECISIONS.md.
"""
import datetime
import os

from db import SessionLocal
from models import Notification

LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "notifications.log")


class NotificationService:
    def __init__(self, transport=None):
        # transport=None -> stubbed console/file logger.
        # Pass transport=self._send_via_twilio (once implemented) to go live.
        self._transport = transport or self._send_via_console_log

    def send_alert(self, batch_id, message: str) -> dict:
        result = self._transport(batch_id, message)
        session = SessionLocal()
        try:
            session.add(Notification(batch_id=batch_id, message=message))
            session.commit()
        finally:
            session.close()
        return result

    def _send_via_console_log(self, batch_id, message: str) -> dict:
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        line = f"[{timestamp}] ALERT for batch_id={batch_id}: {message}"
        print(f"[NotificationService:STUB] {line}")
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        return {"status": "logged", "provider": "stub", "batch_id": batch_id}

    def _send_via_twilio(self, batch_id, message: str) -> dict:
        raise NotImplementedError(
            "Twilio integration is a Phase 3 roadmap item. Set TWILIO_* env "
            "vars and implement this method, then pass transport=self._send_via_twilio."
        )
