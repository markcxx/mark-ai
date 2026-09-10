import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
const abort = new AbortController();
let server;
let serverFailure;
function stop() {
  abort.abort();
  // Never stop a backend started by the user or another development command.
  if (server?.pid && server.exitCode === null) {
    try { process.kill(-server.pid, "SIGTERM"); }
    catch { server.kill("SIGTERM"); }
  }
}
const args = process.argv.slice(2);
const deviceIndex = args.findIndex((arg) => arg === "-d" || arg === "--device-id");
const requested = deviceIndex >= 0
  ? args[deviceIndex + 1]
  : args.find((arg) => arg.startsWith("--device-id="))?.split("=")[1];
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function probeBackend() {
  try {
    const response = await fetch("http://127.0.0.1:3000/api/public/mobile-config", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(3000)]),
      redirect: "manual",
    });
    if (response.status >= 500) return "waiting";
    const data = await response.json().catch(() => null);
    return response.ok && data?.protocolVersion === 1 && typeof data.cloudMode === "boolean"
      ? "ready" : "other";
  } catch (error) {
    if (abort.signal.aborted) throw error;
    return error.cause?.code === "ECONNREFUSED" ? "absent" : "waiting";
  }
}

async function backend() {
  if (process.env.MARKAI_API_URL && process.env.MARKAI_API_URL !== "http://10.0.2.2:3000") {
    console.log("使用 MARKAI_API_URL 指定的后端。");
    return;
  }
  let state = await probeBackend();
  if (state === "other") throw new Error("3000 端口上的服务不是兼容的 MarkAI 后端，请检查端口占用。");
  if (state === "ready") {
    console.log("复用已运行的 MarkAI 后端（3000）。");
    return;
  }
  if (state === "absent") {
    console.log("正在启动本地 MarkAI 后端（3000）…");
    server = spawn(process.execPath, [
      fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)),
      "dev", "--port", "3000",
    ], { cwd: root, detached: true, stdio: ["ignore", "inherit", "inherit"] });
    server.once("error", (error) => { serverFailure = error; });
  } else {
    console.log("等待本地 MarkAI 后端就绪…");
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverFailure || (server && server.exitCode !== null)) {
      throw new Error("本地后端启动失败，请查看上方日志。");
    }
    state = await probeBackend();
    if (state === "ready") {
      console.log("本地 MarkAI 后端已就绪。");
      return;
    }
    if (state === "other") throw new Error("3000 端口被其他服务占用，无法启动 MarkAI 后端。");
    await delay(1000, undefined, { signal: abort.signal });
  }
  throw new Error("本地后端未能就绪，请检查上方日志及 .env.local 配置。");
}

function flutter(parameters, interactive = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("flutter", parameters, {
      cwd, signal: abort.signal, stdio: interactive ? "inherit" : "pipe",
    });
    let output = "", errors = "";
    child.stdout?.on("data", (data) => { output += data; });
    child.stderr?.on("data", (data) => { errors += data; });
    child.once("error", (error) => reject(new Error(
      error.code === "ENOENT" ? "找不到 Flutter，请确认 Flutter 已加入 PATH。" : error.message,
    )));
    child.once("close", (code) => {
      if (interactive) resolve(code ?? 1);
      else if (code === 0) resolve(output);
      else reject(new Error(errors || output || "Flutter 命令执行失败。"));
    });
  });
}

async function devices() {
  const list = JSON.parse(await flutter(["devices", "--machine"]));
  return list.filter((device) => device.isSupported && device.targetPlatform?.startsWith("android"));
}

async function androidDevice() {
  let list = await devices();
  if (deviceIndex >= 0 && (!requested || requested.startsWith("-"))) {
    throw new Error("请在 -d 后填写设备 ID。");
  }
  if (requested) {
    const device = list.find((item) => item.id === requested);
    if (!device) throw new Error(`未找到安卓设备 ${requested}，请连接设备后重试。`);
    return device.id;
  }
  const connected = list.find((device) => device.emulator)
    ?? (process.env.MARKAI_API_URL ? list[0] : undefined);
  if (connected) return connected.id;

  const inventory = await flutter(["emulators"]);
  const ids = inventory.split("\n").map((line) => line.split("•").map((part) => part.trim()))
    .filter((parts) => parts.length >= 4 && parts.at(-1) === "android")
    .map((parts) => parts[0]);
  const emulator = ids.includes("Pixel_7_API_36") ? "Pixel_7_API_36" : ids[0];
  if (!emulator) {
    throw new Error("尚未创建安卓模拟器，请先在 Android Studio 的 Device Manager 中创建一个。");
  }
  console.log(`正在启动安卓模拟器：${emulator}`);
  await flutter(["emulators", "--launch", emulator]);
  console.log("等待安卓设备就绪…");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    list = await devices();
    const ready = list.find((device) => device.emulator);
    if (ready) return ready.id;
    await delay(2000, undefined, { signal: abort.signal });
  }
  throw new Error("模拟器启动超时，请检查模拟器窗口后重试。");
}

try {
  await backend();
  const device = await androidDevice();
  console.log(`启动 MarkAI（${device}），按 r 热重载、R 热重启、q 退出。`);
  process.exitCode = await flutter([
    "run", "-t", "lib/main.dart",
    `--dart-define=MARKAI_API_URL=${process.env.MARKAI_API_URL || "http://10.0.2.2:3000"}`,
    ...(requested ? [] : ["-d", device]), ...args,
  ], true);
} catch (error) {
  if (!abort.signal.aborted) console.error(error.message);
  process.exitCode = abort.signal.aborted ? 130 : 1;
} finally {
  stop();
}
