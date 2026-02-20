import os
from typing import List, Dict, Any, AsyncGenerator
from openai import AsyncOpenAI
from backend.app.core.config import get_settings

class LLMService:
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        settings = get_settings()
        
        # Priority: explicit arg > settings > env (settings falls back to env already)
        self.api_key = api_key or settings.openai_api_key or os.getenv("OPENAI_API_KEY") or "dummy"
        self.base_url = base_url or settings.openai_base_url or os.getenv("OPENAI_BASE_URL")
        self.model = model or settings.openai_model or "gpt-3.5-turbo"

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    async def chat(self, messages: List[Dict[str, str]], stream: bool = False) -> Any:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=stream
            )
            return response
        except Exception as e:
            print(f"Error calling LLM: {e}")
            raise e

    async def stream_chat(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        try:
            response = await self.chat(messages, stream=True)
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            print(f"Error streaming LLM: {e}")
            yield f"Error: {str(e)}"

    async def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await self.chat(messages)
        return response.choices[0].message.content
