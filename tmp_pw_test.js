const { chromium } = require("playwright-core");
const EXE = "C:/Users/v_yitcai/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", m => logs.push("PAGE:" + m.text()));
  page.on("framenavigated", f => logs.push("NAV:" + f.url()));
  page.on("pageerror", e => logs.push("ERR:" + e.message));
  await page.goto("http://localhost:8080/home-prototype-v16.html?module=submit", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const frames = page.frames();
  const iframe = frames.find(f => f.url().includes("tab=submit")) || frames.find(f => f !== page.mainFrame());
  if (!iframe) { console.log("NO IFRAME FOUND", frames.map(f => f.url())); await browser.close(); return; }
  console.log("iframe url:", iframe.url());
  const result = await iframe.evaluate(() => {
    try {
      if (typeof tryOpenEnterpriseChat !== "function") return { err: "tryOpenEnterpriseChat not a function in iframe" };
      const before = { top: window.top.location.href, self: window.location.href };
      tryOpenEnterpriseChat(["zhangsan", "alicextlu"], "XX分享-测试讲师群");
      const after = { top: window.top.location.href, self: window.location.href };
      return {
        before, after,
        topNavIsScheme: after.top.indexOf("wxwork://message/username=") === 0,
        selfUnchanged: after.self === before.self,
        blocked: document.body.innerHTML.indexOf("已阻止") > -1
      };
    } catch (e) { return { err: e.message }; }
  });
  console.log("RESULT:", JSON.stringify(result, null, 2));
  console.log("LOGS:", logs.join(" | "));
  await browser.close();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
