import pytest
from backend.app.rag.store import VectorStore
from langchain_core.documents import Document
from langchain_community.embeddings import FakeEmbeddings

def test_vector_store(tmp_path):
    # Use FakeEmbeddings for speed
    embeddings = FakeEmbeddings(size=10)
    
    store = VectorStore(persist_directory=str(tmp_path), embedding_function=embeddings)
    
    docs = [
        Document(page_content="Apple is a fruit.", metadata={"source": "doc1"}),
        Document(page_content="Carrot is a vegetable.", metadata={"source": "doc2"}),
    ]
    
    store.add_documents(docs)
    
    results = store.query("fruit", k=1)
    assert len(results) == 1
    # Note: FakeEmbeddings might not return semantic matches, it just returns something.
    # But since we added docs, query should return something if index works.
    # Actually FakeEmbeddings returns random vectors or deterministic?
    # Usually deterministic based on text if size is small?
    # Wait, FakeEmbeddings in langchain usually just returns fixed size vector.
    # It won't find "Apple" for "fruit" unless by chance.
    # So I just check if it returns *something* from the store.
    assert results[0].page_content in ["Apple is a fruit.", "Carrot is a vegetable."]

    # Test similarity_search as well
    results2 = store.similarity_search("vegetable", k=1)
    assert len(results2) == 1
    assert results2[0].page_content in ["Apple is a fruit.", "Carrot is a vegetable."]
