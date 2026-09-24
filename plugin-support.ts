import { App, Modal, Notice, Plugin } from "obsidian";

export interface PluginDocumentation {
  name: string;
  summary: string;
  quickStart: string[];
  commands: string[];
  troubleshooting: string[];
}

interface LogEntry {
  at: string;
  level: "info" | "warn" | "error";
  event: string;
  detail?: string;
}

const SAFE_DETAIL_KEYS = new Set([
  "version", "operation", "scope", "selectedCount", "total", "changed", "skipped",
  "failed", "unchanged", "reviewEnabled", "fieldCount", "noteChars", "httpStatus",
  "errorType", "outcome", "restored", "authorizationSource", "cancelled",
]);

function safeDetail(value: unknown): string {
  if (value instanceof Error) return JSON.stringify({ errorType: value.name || "Error" });
  if (typeof value === "string") return /^[A-Za-z0-9 _=.,:-]{0,300}$/.test(value) ? value : "[text omitted]";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const safe: Record<string, string | number | boolean | null> = {};
    for (const [key, item] of Object.entries(value)) {
      if (!SAFE_DETAIL_KEYS.has(key)) continue;
      if (typeof item === "string") safe[key] = /^[A-Za-z0-9 _=.,:-]{0,120}$/.test(item) ? item : "[omitted]";
      else if (typeof item === "number" || typeof item === "boolean" || item === null) safe[key] = item;
    }
    return JSON.stringify(safe);
  }
  return "[detail omitted]";
}

class DocumentationModal extends Modal {
  constructor(app: App, private readonly docs: PluginDocumentation) { super(app); }

  onOpen(): void {
    this.titleEl.setText(`${this.docs.name} documentation`);
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title: string, items: string[]) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", this.docs.commands);
    addSection("Troubleshooting", this.docs.troubleshooting);
  }

  onClose(): void { this.contentEl.empty(); }
}

/**
 * Keeps a privacy-safe in-memory diagnostic trail, captures uncaught runtime
 * failures, and exposes self-service documentation/debug commands.
 */
export class PluginSupport {
  private readonly entries: LogEntry[] = [];
  private readonly maxEntries = 250;

  constructor(private readonly plugin: Plugin, private readonly docs: PluginDocumentation) {}

  start(): void {
    this.info("plugin.loaded", `version=${this.plugin.manifest.version}`);
    this.plugin.registerDomEvent(window, "error", (event: ErrorEvent) => {
      const error = event.error;
      this.error("runtime.error", { errorType: error instanceof Error ? error.name : "ErrorEvent" });
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.error("runtime.unhandled_rejection", { errorType: reason instanceof Error ? reason.name : typeof reason });
    });
    this.plugin.addCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open(),
    });
    this.plugin.addCommand({
      id: "copy-debug-log",
      name: "Copy debug log",
      callback: () => { void this.copyDiagnostics(); },
    });
    this.plugin.addCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = (this.plugin.app as any).setting;
        setting?.open();
        setting?.openTabById(this.plugin.manifest.id);
      },
    });
  }

  info(event: string, detail?: unknown): void { this.record("info", event, detail); }
  warn(event: string, detail?: unknown): void { this.record("warn", event, detail); }
  error(event: string, detail?: unknown): void { this.record("error", event, detail); }

  private record(level: LogEntry["level"], event: string, detail?: unknown): void {
    const entry: LogEntry = { at: new Date().toISOString(), level, event };
    if (detail !== undefined) entry.detail = safeDetail(detail).slice(0, 4000);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, `[${this.docs.name}] ${event}`, entry.detail ?? "");
  }

  async copyDiagnostics(): Promise<void> {
    const header = [
      `Plugin: ${this.docs.name}`,
      `Plugin ID: ${this.plugin.manifest.id}`,
      `Version: ${this.plugin.manifest.version}`,
      `Captured: ${new Date().toISOString()}`,
      `User agent: ${navigator.userAgent}`,
      "",
    ];
    try {
      await navigator.clipboard.writeText(header.concat(this.entries.map((entry) =>
        `${entry.at} [${entry.level.toUpperCase()}] ${entry.event}${entry.detail ? ` — ${entry.detail}` : ""}`,
      )).join("\n"));
      new Notice(`${this.docs.name}: debug log copied. Secrets and note contents are not included.`);
    } catch (error) {
      this.error("diagnostics.copy_failed", { errorType: error instanceof Error ? error.name : typeof error });
      new Notice(`${this.docs.name}: could not copy the debug log.`);
    }
  }
}
