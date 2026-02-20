import os
import pytest
from unittest.mock import MagicMock, patch
from backend.app.ingestion.web_loader import WebLoader
from backend.app.ingestion.file_loader import FileLoader

def test_web_loader():
    with patch('requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.text = "<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>"
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        loader = WebLoader()
        content = loader.load("http://example.com")
        
        assert "Hello World" in content
        assert "This is a test" in content

def test_markdown_loader(tmp_path):
    d = tmp_path / "subdir"
    d.mkdir()
    p = d / "test.md"
    p.write_text("# Title\n\nContent here.")
    
    loader = FileLoader()
    content = loader.load_markdown(str(p))
    
    assert "Title" in content
    assert "Content here" in content

def test_pdf_loader():
    with patch('backend.app.ingestion.file_loader.PdfReader') as mock_reader_class:
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PDF Content Page 1"
        
        mock_reader_instance = MagicMock()
        mock_reader_instance.pages = [mock_page]
        mock_reader_class.return_value = mock_reader_instance
        
        loader = FileLoader()
        content = loader.load_pdf("dummy.pdf")
        
        assert "PDF Content Page 1" in content
