import sys
import os

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.rag.store import VectorStore
from langchain_core.documents import Document

def test_rag():
    print("Initializing VectorStore...")
    try:
        vs = VectorStore(collection_name="test_collection", persist_directory="./test_chroma_db")
        print("VectorStore initialized.")
    except Exception as e:
        print(f"Failed to initialize VectorStore: {e}")
        return

    print("Adding document...")
    doc = Document(page_content="This is a test document about GSPO and ASPO.", metadata={"source": "test.pdf", "doc_id": "123"})
    try:
        vs.add_documents([doc])
        print("Document added.")
    except Exception as e:
        print(f"Failed to add document: {e}")
        return

    print("Searching document...")
    try:
        results = vs.similarity_search("GSPO", k=1)
        print(f"Search results: {len(results)}")
        for r in results:
            print(f"Content: {r.page_content}")
    except Exception as e:
        print(f"Failed to search: {e}")

if __name__ == "__main__":
    test_rag()
