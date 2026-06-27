import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching puppeteer...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request =>
        console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText)
    );

    console.log("Navigating to Sprint Board...");
    await page.goto('http://localhost:5179/#/pro/planning/sprint-planning/board', { waitUntil: 'networkidle0' });

    console.log("Done.");
    await browser.close();
})();
