from typing import Protocol


class LLMProvider(Protocol):
    async def complete(self, prompt: str) -> str: ...


class FakeLLMProvider:
    async def complete(self, prompt: str) -> str:
        return f"[fake-llm] {prompt[:80]}"
