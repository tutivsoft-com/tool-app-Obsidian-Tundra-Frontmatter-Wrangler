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
  if (envelope.x !== "AES-256-GCM" || envelope.w !== "PBKDF2-HMAC-SHA256" || envelope.n !== 210000) {
    throw new Error("Unsupported OpenRouter manifest format.");
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
  return new TextDecoder().decode(plain).trim();
}

async function fetchManifest(url: string): Promise<Manifest> {
  const response = await requestUrl({ url, method: "GET", throw: false });
  if (response.status < 200 || response.status >= 300) throw new Error(`OpenRouter manifest HTTP ${response.status}.`);
  const manifest = response.json as Manifest;
  if (!manifest || !Array.isArray(manifest.r)) throw new Error("Invalid OpenRouter manifest.");
  return manifest;
}

async function decryptManifest(manifest: Manifest): Promise<string> {
  for (const state of ["active", "next"] as const) {
    const slot = manifest.r.find(item => item.ii === state) ?? manifest.r.find(item => item.s === (state === "active" ? "0" : "1"));
    if (!slot) continue;
    try {
      const value = await decrypt(slot.v);
      if (value) return value;
    } catch { /* Try the next rotation slot without exposing secret material. */ }
  }
  throw new Error("OpenRouter manifest could not be decrypted.");
}

async function loadBuiltInKey(): Promise<string> {
  let manifest: Manifest;
  try {
    manifest = await fetchManifest(MANIFEST_URL);
    return await decryptManifest(manifest);
  } catch {
    // Rotation URL is read only from the app's own manifest.
    manifest = await fetchManifest(MANIFEST_URL).catch(() => { throw new Error("Tundra AI key is unavailable. Check your connection or add your own key in settings."); });
    if (manifest.n && manifest.n !== MANIFEST_URL && manifest.n.startsWith("https://raw.githubusercontent.com/tutivsoft-com/Resources/main/")) {
      return decryptManifest(await fetchManifest(manifest.n));
    }
    throw new Error("Tundra AI key is unavailable. Check your connection or add your own key in settings.");
  }
}

let cachedBuiltInKey: Promise<string> | null = null;

export async function resolveOpenRouterKey(manualKey: string): Promise<string> {
  if (manualKey.trim()) return manualKey.trim();
  if (!cachedBuiltInKey) {
    cachedBuiltInKey = loadBuiltInKey().catch(error => {
      cachedBuiltInKey = null;
      throw error;
    });
  }
  return cachedBuiltInKey;
}
