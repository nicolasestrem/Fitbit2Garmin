from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        verify_weight_page(page)
    finally:
        browser.close()

def verify_weight_page(page: Page):
    """
    This test verifies that the quickAnswer text on the weight page is correct.
    """
    # 1. Arrange: Go to the weight page.
    page.goto("http://localhost:3000/measurements/weight")

    # 2. Assert: Confirm the quickAnswer text is correct.
    # The text is inside a `p` tag within a `div` with the class `prose`.
    quick_answer_element = page.locator("p:has-text('This converter transforms Fitbit weight data')")
    expect(quick_answer_element).to_be_visible()
    expect(quick_answer_element).to_have_text('This converter transforms Fitbit weight data from Google Takeout JSON files into Garmin-compatible .FIT files in seconds. Upload up to 3 files, maintain 0.1 lb/kg precision, and import directly to Garmin Connect. No signup required.')

    # 3. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)