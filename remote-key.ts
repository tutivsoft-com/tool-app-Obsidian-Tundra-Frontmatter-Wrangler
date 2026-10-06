import { diagnostics } from "./diagnostics";
import { requestUrl } from "obsidian";

// Compatible with Antero's AES-256-GCM/PBKDF2 remote manifest format.
const PASSPHRASE = "Kivu.RemoteKeyManifest.v1.2026D";
const MANIFEST_URL = "https://raw.githubusercontent.com/tutivsoft-com/Resources/main/tool-app-Obsidian-Tundra-Frontmatter-Wrangler.txt";

interface Envelope { x: string; w: string; n: number; a: string; b: string; c: string; d: string; }
interface Slot { ii?: string; s: string; v: Envelope; }
interface Manifest { n?: string; r: Slot[]; }

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function decrypt(envelope: Envelope): Promise<string> {
const diagnosticEnd1 = diagnostics?.start?.("remote-key.decrypt") ?? (() => {});
try {

  if (envelope.x !== "AES-256-GCM" || envelope.w !== "PBKDF2-HMAC-SHA256" || envelope.n !== 210000) {
    throw new Error("The AI connection could not be initialized. Update the plugin or contact support.");
  }
  const material = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(PASSPHRASE), "PBKDF2", false, ["deriveKey"]);
  const key = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromBase64(envelope.a), iterations: envelope.n, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const ciphertext = fromBase64(envelope.c);
  const tag = fromBase64(envelope.d);
  const combined = new Uint8Array(new ArrayBuffer(ciphertext.length + tag.length));
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  const plain = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.b) }, key, combined);
  return await (new TextDecoder().decode(plain).trim());

} catch (diagnosticError1) { diagnostics?.failure?.("remote-key.decrypt", diagnosticError1); throw diagnosticError1; } finally { diagnosticEnd1(); }
}

async function fetchManifest(url: string): Promise<Manifest> {
const diagnosticEnd2 = diagnostics?.start?.("remote-key.fetchManifest") ?? (() => {});
try {

  const response = await (diagnostics?.request?.("network.remote-key.fetchManifest", requestUrl, { url, method: "GET", throw: false }) ?? requestUrl({ url, method: "GET", throw: false }));
  if (response.status < 200 || response.status >= 300) throw new Error(`The AI connection is unavailable. Check your connection and try again.`);
  const manifest = response.json as Manifest;
  if (!manifest || !Array.isArray(manifest.r)) throw new Error("The AI connection could not be initialized. Update the plugin or contact support.");
  return await (manifest);

} catch (diagnosticError2) { diagnostics?.failure?.("remote-key.fetchManifest", diagnosticError2); throw diagnosticError2; } finally { diagnosticEnd2(); }
}

async function decryptManifest(manifest: Manifest): Promise<string> {
const diagnosticEnd3 = diagnostics?.start?.("remote-key.decryptManifest") ?? (() => {});
try {

  for (const state of ["active", "next"] as const) {
    const slot = manifest.r.find(item => item.ii === state) ?? manifest.r.find(item => item.s === (state === "active" ? "0" : "1"));
    if (!slot) continue;
    try {
      const value = await decrypt(slot.v);
      if (value) return await (value);
    } catch (caughtError1) {
diagnostics.failure("remote-key.caught_2", caughtError1); /* Try the next rotation slot without exposing secret material. */ }
  }
  throw new Error("The AI connection could not be initialized. Update the plugin or contact support.");

} catch (diagnosticError3) { diagnostics?.failure?.("remote-key.decryptManifest", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}

async function loadBuiltInKey(): Promise<string> {
const diagnosticEnd4 = diagnostics?.start?.("remote-key.loadBuiltInKey") ?? (() => {});
try {

  let manifest: Manifest;
  try {
    manifest = await fetchManifest(MANIFEST_URL);
    return await decryptManifest(manifest);
  } catch (caughtError3) {
diagnostics.failure("remote-key.caught_4", caughtError3);
    // Rotation URL is read only from the app's own manifest.
    manifest = await fetchManifest(MANIFEST_URL).catch((rejectedError1) => {
diagnostics.failure("remote-key.rejected_2", rejectedError1); throw new Error("The AI connection is unavailable. Check your connection and try again."); });
    if (manifest.n && manifest.n !== MANIFEST_URL && manifest.n.startsWith("https://raw.githubusercontent.com/tutivsoft-com/Resources/main/")) {
      return await (decryptManifest(await fetchManifest(manifest.n)));
    }
    throw new Error("The AI connection is unavailable. Check your connection and try again.");
  }

} catch (diagnosticError4) { diagnostics?.failure?.("remote-key.loadBuiltInKey", diagnosticError4); throw diagnosticError4; } finally { diagnosticEnd4(); }
}

let cachedBuiltInKey: Promise<string> | null = null;

export async function resolveOpenRouterKey(): Promise<string> {
const diagnosticEnd5 = diagnostics?.start?.("remote-key.resolveOpenRouterKey") ?? (() => {});
try {

  if (!cachedBuiltInKey) {
    cachedBuiltInKey = loadBuiltInKey().catch(error => {
diagnostics.failure("remote-key.rejected_3", error);
      cachedBuiltInKey = null;
      throw error;
    });
  }
  return await (cachedBuiltInKey);

} catch (diagnosticError5) { diagnostics?.failure?.("remote-key.resolveOpenRouterKey", diagnosticError5); throw diagnosticError5; } finally { diagnosticEnd5(); }
}
