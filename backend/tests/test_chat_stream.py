from fastapi.testclient import TestClient
from backend.app.main import app
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_chat_streaming():
    # Mock the LLM service to return a generator
    with patch('backend.app.chat.llm.LLMService.stream_chat') as mock_stream:
        # Define a generator that yields chunks
        def mock_generator(messages):
            yield "Hello"
            yield " "
            yield "World"
            
        mock_stream.side_effect = mock_generator
        
        response = client.post(
            "/api/chat",
            json={"message": "Hi", "history": []}
        )
        
        assert response.status_code == 200
        # Verify it's a streaming response
        assert response.headers["content-type"] == "text/event-stream"
        
        # Read the content
        content = b"".join(response.iter_content())
        assert content.decode("utf-8") == "Hello World"
