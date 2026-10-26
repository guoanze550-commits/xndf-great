import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
test("mouse completes the entire offline world, even after camera denial", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE|GLSL|shader/i.test(m.text()))
      errors.push(m.text());
  });
  await context.route("**/*", (route) => {
    if (
      !route
        .request()
        .url()
        .startsWith(test.info().project.use.baseURL as string)
    ) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("./");
  await expect(page.locator("#fatal")).toBeHidden();
  await page.screenshot({ path: "test-results/01-title.png" });
  await page.getByRole("button", { name: "进入界限" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "A");
  await expect(page.locator("#confirm")).toBeDisabled();
  const music = async () => JSON.parse((await page.locator("#app").getAttribute("data-music")) ?? "{}");
  await expect.poll(async () => (await music()).state, {timeout:20000}).toBe("playing");

  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(
          new DOMException("Camera permission denied", "NotAllowedError"),
        ),
    });
  });
  await page.locator("#camera-toggle").click();
  await expect(page.locator("#camera-status")).toContainText(
    "摄像头权限未获准",
  );
  await page.locator("#camera-stop").click();
  // Actual canvas drags; no injected rules, travel state, clocks or topology.
  const route = [
    { from:"A", to:"L", mechanism:"axis", angle:-56, edge:"AL" },
    { from:"L", to:"B", mechanism:"stairs", angle:34, edge:"LB" },
    { from:"B", to:"U", mechanism:"axis", angle:52, edge:"BU" },
    { from:"U", to:"B2", mechanism:"crown", angle:-38, edge:"UB2" },
    { from:"B2", to:"C", mechanism:"axis", angle:-22, edge:"B2C" },
  ];
  async function dragTo(angle:number,mechanism:string) {
    const config=JSON.parse((await page.locator("#app").getAttribute("data-configuration"))!);
    const delta=(angle-config[mechanism])/.3;
    await page.mouse.move(850,620);await page.mouse.down();
    await page.mouse.move(850+delta,620,{steps:8});await page.mouse.up();
  }
  for(const [i,step] of route.entries()) {
    await expect(page.locator("#app")).toHaveAttribute("data-mechanism",step.mechanism);
    const falseAngle=step.from==="L"?-34:step.from==="B"?18:null;
    if(falseAngle!==null) {
      await dragTo(falseAngle,step.mechanism);
      await expect(page.locator("#confirm")).toBeDisabled();
      await expect.poll(async()=>{
        const a=JSON.parse((await page.locator("#app").getAttribute("data-alignment"))!);
        return a.find((x:{id:string})=>x.id===(step.from==="L"?"fold":"echo"))?.reason;
      }).toBe(step.from==="L"?"direction":"unreachable");
      await page.locator("#world").focus();await page.keyboard.press("Enter");
      await expect(page.locator("#app")).toHaveAttribute("data-platform",step.from);
    }
    await dragTo(step.angle,step.mechanism);
    await expect(page.locator("#confirm")).toBeEnabled({timeout:25000});
    await expect(page.locator("#app")).toHaveAttribute("data-route",step.edge);
    expect((await music()).starts).toBe(1);
    expect((await music()).activeSources).toBe(1);
    await expect(page.locator("#app")).toHaveAttribute("data-camera-mode","CONNECTION_HOLD");
    await expect.poll(async()=>Number(await page.locator("#app").getAttribute("data-camera-zoom"))).toBeGreaterThan(1.3);
    const focusedZoom=Number(await page.locator("#app").getAttribute("data-camera-zoom"));
    await page.screenshot({path:`test-results/v22-${i+1}-${step.edge}-focus.png`});
    // Observe the real short-lived DOM phase before clicking. A remote browser
    // may finish a one-second hold before the next assertion reaches it.
    const monitor=await page.evaluateHandle(()=>{
      const app=document.getElementById("app")!;
      const seen={phases:[app.dataset.phase],modes:[app.dataset.cameraMode]};
      const observer=new MutationObserver(()=>{
        if(seen.phases.at(-1)!==app.dataset.phase) seen.phases.push(app.dataset.phase);
        if(seen.modes.at(-1)!==app.dataset.cameraMode) seen.modes.push(app.dataset.cameraMode);
      });
      observer.observe(app,{attributes:true,attributeFilter:["data-phase","data-camera-mode"]});
      return {seen,observer};
    });
    await page.locator("#confirm").click();
    await expect(page.locator("#rotation")).toBeDisabled();
    await expect.poll(()=>monitor.evaluate(m=>m.seen.phases)).toContain("connecting");
    await expect(page.locator("#app")).toHaveAttribute("data-camera-mode","TRAVERSAL_PULLBACK",{timeout:6000});
    await expect.poll(async()=>Number(await page.locator("#app").getAttribute("data-camera-zoom")),{timeout:10000}).toBeLessThan(focusedZoom-.15);
    await page.mouse.move(800,600);await page.mouse.down();await page.mouse.move(1100,600);await page.mouse.up();
    await expect(page.locator("#app")).toHaveAttribute("data-platform",step.to,{timeout:40000});
    await expect(page.locator("#app")).toHaveAttribute("data-crossings",String(i+1));
    if(i<4) await expect(page.locator("#app")).toHaveAttribute("data-camera-mode",/OVERVIEW/);
    expect(await monitor.evaluate(m=>m.seen.modes)).toContain("TRAVERSAL_PULLBACK");
    await monitor.evaluate(m=>m.observer.disconnect());await monitor.dispose();
  }
  await expect(page.locator("#app")).toHaveAttribute("data-chapter","2",{timeout:30000});
  await expect(page.locator("#ending")).toBeHidden();
  expect((await music()).starts).toBe(1);
  await page.locator("#restart").click();
  await expect.poll(async () => (await music()).starts).toBe(2);
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "A");
  await expect(page.locator("#app")).toHaveAttribute("data-route", "none");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("packaged vision files stay under the deployment path with correct bytes and MIME types", async ({
  request,
}) => {
  const expected =
    "94cae88157602cec45e48fe0c572b418a9641a9aae977ffd71dddbce167201a1";
  const model = await request.get("vision/hand_landmarker.task");
  expect(model.status()).toBe(200);
  expect(
    createHash("sha256")
      .update(await model.body())
      .digest("hex"),
  ).toBe(expected);
  for (const variant of ["internal", "module_internal", "nosimd_internal"]) {
    for (const ext of ["js", "wasm"]) {
      const response = await request.get(
        `vision/wasm/vision_wasm_${variant}.${ext}`,
      );
      expect(response.status()).toBe(200);
      expect((await response.body()).length).toBeGreaterThan(10000);
      expect(response.headers()["content-type"]).toContain(
        ext === "wasm" ? "application/wasm" : "javascript",
      );
    }
  }
});
test("real local MediaPipe initializes and infers on a synthetic camera stream", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.locator("#begin").click();
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 640, 480);
    const stream = c.captureStream(10);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => stream,
    });
  });
  await page.locator("#camera-toggle").click();
  await expect(page.locator("#camera-status")).toHaveText(
    "未检测到手 · 输入已冻结",
    { timeout: 40000 },
  );
  await expect(page.locator("#camera")).toHaveJSProperty("readyState", 4);
  await page.locator("#camera-stop").click();
  expect(errors).toEqual([]);
});


test("reduced-motion close-up is real, remains playable and restores standard framing",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});await page.goto("./");await page.locator("#begin").click();
 await expect(page.locator("#motion")).toHaveAttribute("aria-pressed","true");
 const slider=page.locator("#rotation"),b=await slider.boundingBox();if(!b) throw new Error("Missing dial");
 await page.mouse.click(b.x+4.5+(b.width-9)*24/160,b.y+b.height/2);
 await expect(page.locator("#confirm")).toBeEnabled({timeout:20000});
 await expect.poll(async()=>Number(await page.locator("#app").getAttribute("data-camera-zoom"))).toBeGreaterThan(1.03);
 expect(Number(await page.locator("#app").getAttribute("data-camera-zoom"))).toBeLessThan(1.16);
 await page.locator("#motion").click();await expect(page.locator("#motion")).toHaveAttribute("aria-pressed","false");
 await expect.poll(async()=>Number(await page.locator("#app").getAttribute("data-camera-zoom"))).toBeGreaterThan(1.32);
 await expect(page.locator("#confirm")).toBeEnabled();
 await page.locator("#confirm").click();await expect(page.locator("#app")).toHaveAttribute("data-platform","L",{timeout:30000});
 await expect(page.locator("#app")).toHaveAttribute("data-camera-mode",/OVERVIEW/);
});
