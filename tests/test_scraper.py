import unittest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.scraper import fetch_url

class TestWebScraper(unittest.TestCase):
    
    @patch('src.scraper.requests.get')
    def test_fetch_success(self, mock_get):
        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><head><title>Test Page</title></head><body><p>Hello World</p></body></html>"
        mock_response.encoding = 'utf-8'
        mock_response.apparent_encoding = 'utf-8'
        mock_get.return_value = mock_response

        result = fetch_url("http://test.com")
        self.assertIn("Test Page", result)
        self.assertIn("Hello World", result)

    @patch('src.scraper.requests.get')
    def test_fetch_error(self, mock_get):
        mock_get.side_effect = Exception("Connection Error")
        
        result = fetch_url("http://bad-url.com")
        self.assertIn("Error", result)

if __name__ == '__main__':
    unittest.main()
