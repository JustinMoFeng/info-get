import os
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from backend.app.core.config import get_settings

class VectorStore:
    def __init__(self, persist_directory: str = "./chroma_db", embedding_function: Embeddings = None):
        settings = get_settings()
        
        if embedding_function is None:
            # Default to OpenAI if not provided
            try:
                from langchain_openai import OpenAIEmbeddings
                embedding_function = OpenAIEmbeddings(
                    api_key=settings.openai_api_key,
                    base_url=settings.openai_base_url,
                    model=settings.embedding_model or "text-embedding-ada-002"
                )
            except ImportError:
                # Fallback or raise error
                raise ImportError("Please install langchain-openai to use default embeddings, or provide an embedding function.")
            
        self.embeddings = embedding_function
        self.persist_directory = persist_directory
        self.db = Chroma(
            persist_directory=persist_directory, 
            embedding_function=self.embeddings
        )

    def add_documents(self, documents: list[Document]):
        self.db.add_documents(documents)

    def query(self, query: str, k: int = 4) -> list[Document]:
        return self.db.similarity_search(query, k=k)

    def similarity_search(self, query: str, k: int = 4) -> list[Document]:
        return self.db.similarity_search(query, k=k)
