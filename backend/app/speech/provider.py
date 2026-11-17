from typing import Protocol


class SpeechProvider(Protocol):
    async def synthesize(self, text: str, language: str) -> bytes: ...


class FakeSpeechProvider:
    async def synthesize(self, text: str, language: str) -> bytes:
        return f"fake-audio:{language}:{text}".encode()
