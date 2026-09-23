const { chromium } = require("playwright-core");
const EXE = "C:/Users/v_yitcai/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let topNavCount = 0;
  let topNavSchemes = [];
  page.on("framenavigated", f => { if (f.url().startsWith("wxwork://") || f.url().startsWith("chrome-error")) { topNavCount++; topNavSchemes.push(f.url()); } });
  await page.goto("http://localhost:8080/home-prototype-v16.html?module=submit", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const frames = page.frames();
  const iframe = frames.find(f => f.url().includes("tab=submit")) || frames.find(f => f !== page.mainFrame());

  // A) OLD approach: programmatic <a>.click() inside iframe (what the code did before fix)
  const oldRes = await iframe.evaluate(() => {
    const scheme = "wxwork://message/username=" + ["zhangsan","alicextlu"].map(encodeURIComponent).join(",");
    const a = document.createElement("a");
    a.href = scheme; a.style.display = "none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return { blocked: document.body.innerHTML.indexOf("已阻止") > -1, topHref: window.top.location.href };
  });
  await page.waitForTimeout(300);

  // B) NEW approach: call the real fixed tryOpenEnterpriseChat
  const newRes = await iframe.evaluate(() => {
    try {
      tryOpenEnterpriseChat(["zhangsan","alicextlu"], "XX分享-测试讲师群");
      return { ran: true, blocked: document.body.innerHTML.indexOf("已阻止") > -1, topHref: window.top.location.href };
    } catch (e) { return { err: e.message }; }
  });
  await page.waitForTimeout(300);

  console.log("OLD <a>.click() in iframe ->", JSON.stringify(oldRes));
  console.log("NEW tryOpenEnterpriseChat ->", JSON.stringify(newRes));
  console.log("top-frame scheme/error navigations observed:", topNavCount, JSON.stringify(topNavSchemes));
  await browser.close();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
