import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 100 });
const page = await browser.newPage();

// Log console errors from the page
page.on('console', msg => {
  if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
});

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
console.log('Page loaded');

// Submit purple-themed component request
const input = await page.locator('textarea').first();
await input.fill('Create a dashboard card component with a purple color theme');
await page.screenshot({ path: 'screenshot-01-before-submit.png' });
await page.keyboard.press('Enter');
console.log('Request submitted, waiting for AI response...');

// Wait for the assistant reply text to appear in the chat
try {
  await page.waitForSelector('[data-role="assistant"], .assistant-message, [class*="assistant"]', {
    timeout: 60000,
  });
  console.log('AI response appeared');
} catch (e) {
  // Fallback: just wait for something new in the chat list
  console.log('Selector not found, waiting for chat to have >1 message...');
  try {
    await page.waitForFunction(() => {
      const msgs = document.querySelectorAll('[class*="message"], [class*="Message"]');
      return msgs.length > 1;
    }, { timeout: 60000 });
    console.log('New message appeared');
  } catch (e2) {
    console.log('Timed out waiting for response');
  }
}

// Give the preview iframe time to compile and render
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshot-02-result.png', fullPage: true });
console.log('Screenshot saved: screenshot-02-result.png');

// Also screenshot just the preview pane
const previewPane = await page.locator('iframe').first().catch(() => null);
if (previewPane) {
  await previewPane.screenshot({ path: 'screenshot-03-preview.png' });
  console.log('Preview screenshot saved: screenshot-03-preview.png');
}

await browser.close();
