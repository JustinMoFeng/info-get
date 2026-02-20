import requests
from bs4 import BeautifulSoup
import sys

def fetch_url(url):
    """
    Fetches and parses the main content from a URL.
    Returns a string containing the title and cleaned text, or an error message.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        response.encoding = response.apparent_encoding 
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Title
        title = soup.title.string.strip() if soup.title else "No Title"
        
        # Remove junk
        for script in soup(["script", "style", "nav", "footer", "iframe"]):
            script.extract()
            
        # Get text
        text = soup.get_text(separator='\n')
        
        # Clean whitespace
        clean_text = '\n'.join(line.strip() for line in text.splitlines() if line.strip())
        
        result = f"--- START: {title} ---\n"
        result += clean_text[:3000] + ("\n...[Truncated]" if len(clean_text) > 3000 else "")
        result += "\n--- END ---"
        return result
        
    except Exception as e:
        return f"Error fetching {url}: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(fetch_url(sys.argv[1]))
    else:
        print("Please provide a URL.")
