"""LLMProvider: one interface, a fake for tests/dev, and Gemini for real use (P3).

Swap Gemini for an open model later without touching callers (PRD: no vendor lock-in)."""
import base64
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Part:
    """A file sent to the model: a photo of notes or a PDF."""
    mime: str
    data: bytes


class LLMProvider(Protocol):
    def complete(self, prompt: str, system: str | None = None) -> str: ...

    def generate_json(self, prompt: str, schema: dict[str, Any], parts: list[Part] | None = None,
                      system: str | None = None) -> dict[str, Any]: ...


class AIUnavailable(RuntimeError):
    """The model service is busy or down after retries."""


def _fake_q(en: str, hi: str, opts: list[str], ans: int, conf: float) -> dict[str, Any]:
    return {"kind": "mcq", "prompt": {"en": en, "hi": hi, "kn": en},
            "options": [{"en": o, "hi": o, "kn": o} for o in opts], "answer_index": ans,
            "answer_bool": False, "concept": "cell", "source_page": 1, "confidence": conf}


class FakeLLMProvider:
    """Deterministic answers so the pipeline and chatbot run with no key."""

    def complete(self, prompt: str, system: str | None = None) -> str:
        return f"[fake-llm] {prompt[:80]}"

    def generate_json(self, prompt: str, schema: dict[str, Any], parts: list[Part] | None = None,
                      system: str | None = None) -> dict[str, Any]:
        props = schema.get("properties", {})
        if "pages" in props:                                   # OCR
            return {"pages": [{"page_no": i + 1, "confidence": 0.95 if i == 0 else 0.5,
                               "text": "The cell is the smallest unit of life. Mitochondria make "
                                       "energy. The nucleus controls the cell."}
                              for i in range(len(parts or [None]))]}
        if "units" in props:                                   # course outline + first lesson
            q = _fake_q
            return {"title": "The Cell", "subject": "biology", "units": [{"title": "Cells", "lessons": [
                {"title": "What is a cell?", "reading": {"en": "The cell is the smallest unit of life.",
                                                         "hi": "कोशिका जीवन की सबसे छोटी इकाई है।",
                                                         "kn": "ಕೋಶವು ಜೀವದ ಅತ್ಯಂತ ಚಿಕ್ಕ ಘಟಕ."},
                 "questions": [q("What is the smallest unit of life?", "जीवन की सबसे छोटी इकाई?",
                                 ["Cell", "Organ", "Tissue"], 0, 0.9),
                               q("What makes energy in a cell?", "ऊर्जा कौन बनाता है?",
                                 ["Mitochondria", "Nucleus", "Wall"], 0, 0.4)]},
                {"title": "Parts of a cell", "reading": {"en": "", "hi": "", "kn": ""}, "questions": []}]}],
                "terms": [{"regional": "कोशिका", "english": "Cell",
                           "definition": {"en": "Smallest unit of life", "hi": "जीवन की सबसे छोटी इकाई",
                                          "kn": "ಜೀವದ ಚಿಕ್ಕ ಘಟಕ"}}]}
        if "questions" in props:                               # generate more questions
            return {"questions": [{"kind": "true_false", "prompt": {"en": "Plants have cells.",
                                   "hi": "पौधों में कोशिकाएँ होती हैं।", "kn": "Plants have cells."},
                                   "options": [], "answer_index": 0, "answer_bool": True,
                                   "concept": "cell", "source_page": 1, "confidence": 0.9}]}
        if "items" in props:                                   # title translations
            titles = [ln[2:].strip() for ln in prompt.splitlines() if ln.startswith("- ")]
            return {"items": [{"source": t, "en": f"EN {t}", "hi": f"HI {t}", "kn": f"KN {t}"} for t in titles]}
        if "summary" in props:                                 # notes summary
            return {"summary": {"en": "Cells are the smallest units of life.", "hi": "कोशिका जीवन की सबसे छोटी इकाई है।",
                                "kn": "ಕೋಶವು ಜೀವದ ಅತ್ಯಂತ ಚಿಕ್ಕ ಘಟಕ."}}
        if "supported" in props:                               # chatbot fact check
            return {"supported": "not supported" not in prompt}
        if "answer" in props:                                  # doubt chatbot
            found = "(none found)" not in prompt
            return {"answer": "A cell is the smallest unit of life. (from your notes)" if found
                    else "This is not in your notes. Ask your teacher!",
                    "in_notes": found, "used_page": 1 if found else 0}
        return {}


# Busy models fall through to the next one. Google renames models often, so the list is configurable.
DEFAULT_FALLBACKS = ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-3.8-flash",
                     "gemini-flash-latest"]
RETRYABLE = {429, 500, 502, 503, 504}


class GeminiProvider:
    """Google Gemini over REST (generateContent). Reads notes photos and PDFs directly."""

    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, api_key: str, model: str = "", timeout: float = 30.0,
                 deadline: float = 80.0) -> None:
        self.key = api_key
        self.models = list(dict.fromkeys([m for m in [model, *DEFAULT_FALLBACKS] if m]))
        self.timeout = timeout          # one request
        self.deadline = deadline        # all retries and fallbacks together

    def _call(self, body: dict[str, Any]) -> str:
        last = "no model answered"
        end = time.monotonic() + self.deadline
        for model in self.models:
            for attempt in range(2):
                left = end - time.monotonic()
                if left <= 2:
                    raise AIUnavailable(f"The AI service is busy right now ({last}). Please try again.")
                try:
                    r = httpx.post(self.URL.format(model=model), headers={"x-goog-api-key": self.key},
                                   json=body, timeout=min(self.timeout, left))
                except httpx.HTTPError as exc:
                    last = f"{model}: {type(exc).__name__}"
                    continue
                if r.status_code == 200:
                    parts = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
                    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                    if text:
                        return text
                    last = f"{model}: empty answer"
                    break
                last = f"{model}: HTTP {r.status_code}"
                if r.status_code == 404:                 # retired model: try the next one
                    break
                if r.status_code not in RETRYABLE:
                    raise AIUnavailable(f"{last} {r.text[:200]}")
                time.sleep(1.5 * (attempt + 1))
            log.warning("gemini model failed, trying next: %s", last)
        raise AIUnavailable(f"The AI service is busy right now ({last}). Please try again.")

    def _body(self, prompt: str, parts: list[Part] | None, system: str | None) -> dict[str, Any]:
        contents: list[dict[str, Any]] = [
            {"inline_data": {"mime_type": p.mime, "data": base64.b64encode(p.data).decode()}}
            for p in parts or []]
        contents.append({"text": prompt})
        body: dict[str, Any] = {"contents": [{"role": "user", "parts": contents}]}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        return body

    def complete(self, prompt: str, system: str | None = None) -> str:
        return self._call(self._body(prompt, None, system))

    def generate_json(self, prompt: str, schema: dict[str, Any], parts: list[Part] | None = None,
                      system: str | None = None) -> dict[str, Any]:
        body = self._body(prompt, parts, system)
        body["generationConfig"] = {"responseMimeType": "application/json", "responseSchema": schema,
                                    "temperature": 0.3}
        text = self._call(body)
        try:
            out = json.loads(text)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", text, re.DOTALL)        # model wrapped JSON in prose
            if not m:
                raise AIUnavailable("The AI answer could not be read. Please try again.") from None
            out = json.loads(m.group(0))
        return out if isinstance(out, dict) else {}
