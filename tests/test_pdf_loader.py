import sys
import os

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.ingestion.file_loader import FileLoader

def test_pdf_loading():
    loader = FileLoader()
    files = [
        "tests/2510.06062v1.pdf",
        "tests/2507.18071v2.pdf"
    ]
    
    for f in files:
        path = os.path.abspath(f)
        print(f"Loading {path}...")
        if not os.path.exists(path):
            print(f"File not found: {path}")
            continue
            
        try:
            content = loader.load_pdf(path)
            print(f"Loaded {len(content)} characters.")
            if len(content) < 100:
                print(f"Warning: Content is very short: {content}")
            else:
                print(f"First 100 chars: {content[:100]}")
                
            if "GSPO" in content:
                print("Found 'GSPO' in content.")
            else:
                print("'GSPO' NOT found in content.")
                
            if "ASPO" in content:
                print("Found 'ASPO' in content.")
            else:
                print("'ASPO' NOT found in content.")

        except Exception as e:
            print(f"Failed to load PDF: {e}")

if __name__ == "__main__":
    test_pdf_loading()
