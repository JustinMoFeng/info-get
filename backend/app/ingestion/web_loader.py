import requests
from bs4 import BeautifulSoup

class WebLoader:
    def load(self, url: str) -> str:
        response = requests.get(url)
        if response.status_code != 200:
            raise Exception(f"Failed to load URL: {url}")
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # Simple extraction for now
        # Remove scripts and styles
        for script in soup(["script", "style"]):
            script.decompose()
            
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
