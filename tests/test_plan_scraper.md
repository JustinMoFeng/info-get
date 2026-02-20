# Test Plan: Web Scraper Skill

## 1. Unit Tests
- **test_fetch_valid_url**:
    - Input: A known, stable URL (e.g., example.com)
    - Expectation: Returns status 200, extracts title "Example Domain".
- **test_fetch_invalid_url**:
    - Input: A non-existent URL.
    - Expectation: Returns error message, handles exception gracefully.
- **test_content_cleaning**:
    - Input: HTML with script/style tags.
    - Expectation: Output text contains no JS/CSS code.

## 2. Integration Test (Manual)
- Run the scraper against a real WeChat article link provided by the user.
