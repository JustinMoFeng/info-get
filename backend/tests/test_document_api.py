from fastapi.testclient import TestClient
from backend.app.main import app
import pytest

client = TestClient(app)

def test_document_lifecycle_file():
    # Create a dummy file
    content = b"This is a test file content for unit testing."
    files = {"file": ("test_unit.txt", content, "text/plain")}
    
    response = client.post("/api/ingest/file", files=files)
    if response.status_code != 200:
        print(f"Ingest failed: {response.text}")
    assert response.status_code == 200
    
    data = response.json()
    assert "doc_id" in data
    doc_id = data["doc_id"]
    
    # List Documents
    response = client.get("/api/documents")
    assert response.status_code == 200
    docs = response.json()
    found = False
    for doc in docs:
        if doc["id"] == doc_id:
            found = True
            break
    assert found
    
    # Chat with RAG
    chat_payload = {
        "message": "What is in the test file?",
        "history": [],
        "rag_config": {
            "enabled": True,
            "selected_doc_ids": [doc_id]
        }
    }
    response = client.post("/api/chat", json=chat_payload)
    assert response.status_code == 200
    
    # Delete Document
    response = client.delete(f"/api/documents/{doc_id}")
    assert response.status_code == 200
    
    # Verify Deletion
    response = client.get("/api/documents")
    docs = response.json()
    found = False
    for doc in docs:
        if doc["id"] == doc_id:
            found = True
            break
    assert not found
