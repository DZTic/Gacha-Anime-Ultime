import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # Wait for the mocked game to load
        await expect(page.locator("#game-container")).to_be_visible(timeout=10000)

        # Handle the auto-clicker warning modal
        warning_modal = page.locator("#auto-clicker-warning-modal")
        await expect(warning_modal).to_be_visible(timeout=5000)
        await page.locator("#auto-clicker-modal-close-button").click()
        await expect(warning_modal).to_be_hidden()

        # Go to settings and disable animations
        await page.locator("#settings-button").click()
        await expect(page.locator("#settings-modal")).to_be_visible()
        await page.locator("#animations-toggle").uncheck()
        await page.locator("#save-settings").click()
        await expect(page.locator("#settings-modal")).to_be_hidden()

        # Perform a multi-pull to get several characters
        await page.locator("#multi-pull-button").click()

        # Assert that the animation modal does NOT appear
        animation_modal = page.locator("#summon-animation-modal")
        await expect(animation_modal).to_be_hidden()

        # Check that the temporary result toast is displayed
        result_toast = page.locator("#summon-result-toast")
        await expect(result_toast).to_be_visible(timeout=5000)
        await expect(result_toast.get_by_text("Personnages obtenus :")).to_be_visible()

        # Take a screenshot of the text result toast
        await page.screenshot(path="jules-scratch/verification/text-result.png")
        print("Screenshot 'text-result.png' taken.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
