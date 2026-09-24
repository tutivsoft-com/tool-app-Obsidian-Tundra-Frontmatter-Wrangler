import { App, ButtonComponent, FuzzySuggestModal, Menu, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting, TAbstractFile, TFile, TFolder } from "obsidian";
import { resolveOpenRouterKey } from "./remote-key";
import { Frontmatter, Operation, parseFrontmatter, planOperation, ChangePlan } from "./core";
import { defaultBillingState, ensureBillingState, FREE_USES_PER_DAY, isBillableApply, openCheckout, reserveUse, retryPendingCreditSpends, resumePendingCheckout, syncBalance } from "./billing";
import { TUNDRA_CREDIT_PACKS, type BillingState } from "./billing-model";
import { addBillingAccountSettings } from "./constance-account";
import { PluginSupport } from "./plugin-support";
import { AI_FIELD_TIERS, AI_TIER_LABELS, DEFAULT_AI_TIER, MAX_AI_RESPONSE_TOKENS, buildAiSystemPrompt, sanitizeAiFrontmatter, type AiFieldTier } from "./ai-frontmatter";

interface TundraSettings { billing: BillingState; aiApiKey: string; aiModel: string; aiTier: AiFieldTier; aiConflict: "keep" | "replace"; reviewBeforeApply: boolean; defaultOperation: Operation; lastBatch?: Batch; }
interface Batch { id: string; createdAt: string; operation: Operation; files: Array<{ path: string; original: string; after?: string }>; summary: { changed: number; skipped: number; failed: number; unchanged: number }; }
const DEFAULT_SETTINGS: TundraSettings = { billing: defaultBillingState(), aiApiKey: "", aiModel: "openai/gpt-5-mini", aiTier: DEFAULT_AI_TIER, aiConflict: "keep", reviewBeforeApply: false, defaultOperation: { kind: "ai-frontmatter", aiTier: DEFAULT_AI_TIER, aiFields: [...AI_FIELD_TIERS[DEFAULT_AI_TIER]], aiConflict: "keep" } };
function defaultOperation(kind: Operation["kind"], settings: TundraSettings): Operation {
  if (kind === "ai-frontmatter") return { kind, aiTier: settings.aiTier, aiFields: [...AI_FIELD_TIERS[settings.aiTier]], aiConflict: settings.aiConflict };
  if (kind === "rename") return { kind, oldKey: "", newKey: "", collision: "skip" };
  if (kind === "remove") return { kind, oldKey: "" };
  if (kind === "add-tags" || kind === "remove-tags") return { kind, tags: [] };
  if (kind === "replace-tag") return { kind, fromTag: "", toTag: "" };
  if (kind === "normalize-tags") return { kind, rules: "lowercase, spaces to hyphens, slash separators" };
  if (kind === "reorder") return { kind, order: [], unknownPosition: "after" };
  return { kind };
}
const MAX_AI_NOTE_CHARS = 12000;

export default class TundraPlugin extends Plugin {
  settings: TundraSettings = { ...DEFAULT_SETTINGS };
  support!: PluginSupport;
  async onload() {
    this.support = new PluginSupport(this, { name: "Tundra Frontmatter Wrangler", summary: "Run configured frontmatter changes directly, with optional review and rollback.", quickStart: ["Set a default operation and its values in plugin settings.", "Choose Apply configured operation for the current note or folder.", "Enable review in settings only if you want a before/after window."], commands: ["Apply configured operation to current note", "Apply configured operation to current folder", "Open frontmatter wrangler", "Open documentation", "Copy debug log"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Reopen the wrangler if a note changes while the operation is running."] });
    this.support.start();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.billing = ensureBillingState(this.settings.billing);
    this.settings.aiApiKey = typeof this.settings.aiApiKey === "string" ? this.settings.aiApiKey : "";
    this.settings.aiModel = typeof this.settings.aiModel === "string" && this.settings.aiModel.trim() ? this.settings.aiModel : DEFAULT_SETTINGS.aiModel;
    await this.saveSettings();
    this.support.info("settings.loaded", { operation: this.settings.defaultOperation.kind, reviewEnabled: this.settings.reviewBeforeApply });
    void retryPendingCreditSpends(this);
    resumePendingCheckout(this);
    this.addCommand({ id: "open-wrangle", name: "Open frontmatter wrangler", callback: () => new WranglerModal(this.app, this).open() });
    this.addCommand({ id: "open-wrangle-current-note", name: "Open frontmatter wrangler for current note", checkCallback: (checking) => { const file = this.app.workspace.getActiveFile(); if (checking) return !!file; if (file) new WranglerModal(this.app, this, { file }).open(); return true; } });
    this.addCommand({ id: "open-wrangle-current-folder", name: "Open frontmatter wrangler for current folder", checkCallback: (checking) => { const folder = this.app.workspace.getActiveFile()?.parent; if (checking) return !!folder?.path; if (folder) new WranglerModal(this.app, this, { folder }).open(); return true; } });
    this.addCommand({ id: "apply-configured-current-note", name: "Apply configured operation to current note", checkCallback: (checking) => { const file = this.app.workspace.getActiveFile(); if (checking) return !!file; if (file) this.applyConfigured({ file }); return true; } });
    this.addCommand({ id: "apply-configured-current-folder", name: "Apply configured operation to current folder", checkCallback: (checking) => { const folder = this.app.workspace.getActiveFile()?.parent; if (checking) return !!folder?.path; if (folder) this.applyConfigured({ folder }); return true; } });
    this.addRibbonIcon("wrench", "Open frontmatter wrangler", () => new WranglerModal(this.app, this).open());
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => this.addFileMenuItems(menu, file)));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => this.addFilesMenuItems(menu, files)));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => { const file = info.file; if (file instanceof TFile && file.extension.toLowerCase() === "md") this.addNoteMenuItem(menu, file); }));
    this.addSettingTab(new TundraSettingTab(this.app, this));
  }

  private addNoteMenuItem(menu: Menu, file: TFile): void {
    if (file.extension.toLowerCase() !== "md") return;
    menu.addItem(item => item.setTitle("Tundra: Update frontmatter for this note").setIcon("wand-sparkles").onClick(() => this.applyConfigured({ file })));
  }

  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (file instanceof TFile) this.addNoteMenuItem(menu, file);
    else if (file instanceof TFolder && file.path) menu.addItem(item => item.setTitle("Tundra: Update frontmatter in this folder").setIcon("folder-cog").onClick(() => this.applyConfigured({ folder: file })));
  }

  private addFilesMenuItems(menu: Menu, selected: TAbstractFile[]): void {
    const paths = new Set<string>();
    for (const entry of selected) {
      if (entry instanceof TFile && entry.extension.toLowerCase() === "md") paths.add(entry.path);
      else if (entry instanceof TFolder) for (const file of this.app.vault.getMarkdownFiles()) if (file.path.startsWith(`${entry.path}/`)) paths.add(file.path);
    }
    const files = [...paths].map(path => this.app.vault.getAbstractFileByPath(path)).filter((file): file is TFile => file instanceof TFile);
    if (files.length) menu.addItem(item => item.setTitle(`Tundra: Update frontmatter for ${files.length} selected note${files.length === 1 ? "" : "s"}`).setIcon("wand-sparkles").onClick(() => this.applyConfigured({ files })));
  }
  applyConfigured(target: { file?: TFile; folder?: TFolder; files?: TFile[] }) {
    const scope = target.files ? "selection" : target.folder ? "folder" : "note";
    this.support.info("operation.requested", { operation: this.settings.defaultOperation.kind, scope, selectedCount: target.files?.length ?? (target.file ? 1 : 0), reviewEnabled: this.settings.reviewBeforeApply });
    const modal = new WranglerModal(this.app, this, target, true);
    if (this.settings.reviewBeforeApply) modal.open();
    else void modal.runConfiguredDirectly();
  }
  async saveSettings() { if (!(this.settings.aiTier in AI_FIELD_TIERS)) this.settings.aiTier = DEFAULT_AI_TIER; if (this.settings.aiConflict !== "replace") this.settings.aiConflict = "keep"; await this.saveData(this.settings); }
}

class TundraSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TundraPlugin) { super(app, plugin); }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Tundra Frontmatter Wrangler" });
    containerEl.createEl("p", { text: "Review deterministic or AI-assisted metadata proposals. Every write is journaled for rollback." });
    new Setting(containerEl).setName("Open wrangler").setDesc("Review and apply a bulk operation").addButton(b => b.setButtonText("Open").setCta().onClick(() => new WranglerModal(this.app, this.plugin).open()));
    new Setting(containerEl).setName("Diagnostics").setDesc("A short in-memory log of workflow events and errors. It excludes note paths, note contents, and credentials.").addButton(button => button.setButtonText("Copy debug log").onClick(() => void this.plugin.support.copyDiagnostics()));

    const billing = this.plugin.settings.billing;
    addBillingAccountSettings(containerEl, { state: billing, appId: "tundra-frontmatter-wrangler", installationId: billing.deviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: async () => { await syncBalance(this.plugin); }, refresh: () => this.display() });
    new Setting(containerEl).setName("Credits").setDesc(`${billing.freeUsesRemaining} of ${FREE_USES_PER_DAY} free apply batches remain today · ${billing.purchasedCredits} purchased credits in the local mirror.`).addButton(button => button.setButtonText("Sync balance").onClick(async () => { button.setDisabled(true); const result = await syncBalance(this.plugin); new Notice(result.kind === "ok" ? `Tundra: synced ${result.balance} purchased credits.` : "Tundra: could not sync the purchased-credit balance.", result.kind === "ok" ? 3000 : 5000); this.display(); }));
    containerEl.createEl("h3", { text: "AI frontmatter" });
    containerEl.createEl("p", { text: "AI suggestions use OpenRouter. Note content and current frontmatter are sent only when you choose the AI operation and confirm the request. OpenRouter may charge your account." });
    new Setting(containerEl).setName("OpenRouter API key").setDesc("Optional personal key. When blank, Tundra loads its own capped key from an encrypted remote manifest.").addText(input => { input.setPlaceholder("sk-or-…").setValue(this.plugin.settings.aiApiKey).onChange(async value => { this.plugin.settings.aiApiKey = value.trim(); await this.plugin.saveSettings(); }); input.inputEl.type = "password"; });
    new Setting(containerEl).setName("OpenRouter model").setDesc("Model ID used for AI-generated frontmatter suggestions.").addText(input => input.setPlaceholder("openai/gpt-5-mini").setValue(this.plugin.settings.aiModel).onChange(async value => { this.plugin.settings.aiModel = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Default AI field tier").setDesc("Used automatically when generating frontmatter. Standard is the recommended balance.").addDropdown(dropdown => dropdown.addOptions(AI_TIER_LABELS).setValue(this.plugin.settings.aiTier).onChange(async value => { this.plugin.settings.aiTier = value as AiFieldTier; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Existing AI properties").setDesc("Keep existing values by default, or replace them with suggestions.").addDropdown(dropdown => dropdown.addOptions({ keep: "Keep existing values", replace: "Replace with suggestions" }).setValue(this.plugin.settings.aiConflict).onChange(async value => { this.plugin.settings.aiConflict = value as "keep" | "replace"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Review before applying").setDesc("Off by default: generate the plan and apply it in one run. Turn on to inspect before/after changes and confirm each batch.").addToggle(toggle => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async value => { this.plugin.settings.reviewBeforeApply = value; await this.plugin.saveSettings(); }));
    const operationNames: Record<Operation["kind"], string> = { "ai-frontmatter": "Generate frontmatter", format: "Clean formatting", "add-tags": "Add tags", "remove-tags": "Remove tags", "replace-tag": "Replace a tag", "normalize-tags": "Normalize tags", rename: "Rename a property", remove: "Remove a property", reorder: "Reorder properties" };
    new Setting(containerEl).setName("Default operation").setDesc("Used by the Apply configured operation commands. Configure its values below.").addDropdown(dropdown => dropdown.addOptions(Object.fromEntries(Object.entries(operationNames).map(([key, value]) => [key, value]))).setValue(this.plugin.settings.defaultOperation.kind).onChange(async value => { this.plugin.settings.defaultOperation = defaultOperation(value as Operation["kind"], this.plugin.settings); await this.plugin.saveSettings(); this.display(); }));
    const savedOperation = this.plugin.settings.defaultOperation;
    const saveOperationText = (key: "oldKey" | "newKey" | "tags" | "fromTag" | "toTag" | "namespace" | "rules" | "order", value: string) => { if (key === "tags" || key === "order") (savedOperation[key] as string[] | undefined) = value.split(",").map(item => item.trim()).filter(Boolean); else (savedOperation[key] as string | undefined) = value; void this.plugin.saveSettings(); };
    new Setting(containerEl).setName("Property key").addText(text => text.setValue(savedOperation.oldKey ?? "").onChange(value => saveOperationText("oldKey", value)));
    new Setting(containerEl).setName("New property key").addText(text => text.setValue(savedOperation.newKey ?? "").onChange(value => saveOperationText("newKey", value)));
    new Setting(containerEl).setName("Tags").addText(text => text.setValue((savedOperation.tags ?? []).join(", ")).onChange(value => saveOperationText("tags", value)));
    new Setting(containerEl).setName("From tag").addText(text => text.setValue(savedOperation.fromTag ?? "").onChange(value => saveOperationText("fromTag", value)));
    new Setting(containerEl).setName("To tag").addText(text => text.setValue(savedOperation.toTag ?? "").onChange(value => saveOperationText("toTag", value)));
    new Setting(containerEl).setName("Tag namespace").addText(text => text.setValue(savedOperation.namespace ?? "").onChange(value => saveOperationText("namespace", value)));
    new Setting(containerEl).setName("Tag normalization rules").setDesc("Supported values: lowercase, spaces to hyphens, slash separators.").addText(text => text.setValue(savedOperation.rules ?? "lowercase, spaces to hyphens, slash separators").onChange(value => saveOperationText("rules", value)));
    new Setting(containerEl).setName("Preferred property order").addText(text => text.setValue((savedOperation.order ?? []).join(", ")).onChange(value => saveOperationText("order", value)));
    new Setting(containerEl).setName("Property collision behavior").addDropdown(dropdown => dropdown.addOptions({ skip: "Skip", keep: "Keep existing", replace: "Replace", merge: "Merge" }).setValue(savedOperation.collision ?? "skip").onChange(async value => { savedOperation.collision = value as Operation["collision"]; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Unknown property placement").addDropdown(dropdown => dropdown.addOptions({ after: "After preferred properties", before: "Before preferred properties" }).setValue(savedOperation.unknownPosition ?? "after").onChange(async value => { savedOperation.unknownPosition = value as "before" | "after"; await this.plugin.saveSettings(); }));
    const packs = new Setting(containerEl).setName("Buy credits").setDesc("One-time packs. Credits are used for one non-empty apply batch after the daily free allowance.");
    TUNDRA_CREDIT_PACKS.forEach((pack, index) => packs.addButton(button => {
      button.setButtonText(`Buy $${pack.priceUsd} (${pack.credits.toLocaleString()} credits)`);
      if (index === TUNDRA_CREDIT_PACKS.length - 1) button.setCta();
      button.onClick(() => openCheckout(this.plugin, index === 0 ? "usd001" : "usd010"));
    }));
    containerEl.createEl("p", { cls: "tundra-note", text: `This install's billing device ID is saved locally and is not editable: ${billing.deviceId.slice(0, 18)}…` });

    if (this.plugin.settings.lastBatch) new Setting(containerEl).setName("Most recent batch").setDesc(`${this.plugin.settings.lastBatch.summary.changed} changed · ${this.plugin.settings.lastBatch.createdAt}`).addButton(b => b.setButtonText("Rollback").onClick(() => rollback(this.app, this.plugin)));
  }
}

class WranglerModal extends Modal {
  private step = 0;
  private files: TFile[] = [];
  private plans: ChangePlan[] = [];
  private reviewedAll = false;
  private selectedFile: TFile | null = this.app.workspace.getActiveFile();
  private targetScope: "note" | "folder" | "vault" | "selection" = "note";
  private folder = this.selectedFile?.parent?.path ?? "";
  private recursive = true;
  private query = "";
  private filterKey = "";
  private filterValue = "";
  private cancelled = false;
  private opened = false;
  private operation: Operation = { ...this.plugin.settings.defaultOperation, tags: [...(this.plugin.settings.defaultOperation.tags ?? [])], order: [...(this.plugin.settings.defaultOperation.order ?? [])], aiFields: [...(this.plugin.settings.defaultOperation.aiFields ?? [])] };

  constructor(app: App, private plugin: TundraPlugin, target?: { file?: TFile; folder?: TFolder; files?: TFile[] }, private autoRun = false) {
    super(app);
    this.modalEl.addClass("tundra-modal");
    if (target?.file) { this.selectedFile = target.file; this.targetScope = "note"; this.folder = target.file.parent?.path ?? ""; }
    if (target?.folder) { this.targetScope = "folder"; this.folder = target.folder.path; }
    if (target?.files?.length) { this.files = target.files; this.targetScope = "selection"; }
  }
  onOpen() { this.opened = true; if (this.autoRun) void this.preparePreview(); else this.render(); }
  onClose() { this.opened = false; this.contentEl.empty(); }

  async runConfiguredDirectly() { await this.preparePreview(); }

  private render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("div", { cls: "tundra-header", text: "Tundra Frontmatter Wrangler" });
    const body = c.createDiv("tundra-body");
    if (this.step === 0) this.renderSetup(body);
    else if (this.step === 1) this.renderPreview(body);
    else if (this.step === 2) this.renderApply(body);
    else this.renderReview(body);
  }

  private renderSetup(parent: HTMLElement) {
    parent.createEl("h3", { text: "What should Tundra update?" });
    const target = new Setting(parent).setName("Target").setDesc(this.targetDescription());
    const targetOptions = { note: "Open note", folder: "Choose a folder", vault: "Entire vault", ...(this.targetScope === "selection" ? { selection: "Selected notes" } : {}) };
    target.addDropdown(dropdown => dropdown.addOptions(targetOptions).setValue(this.targetScope).onChange(value => {
      this.targetScope = value as "note" | "folder" | "vault" | "selection";
      if (this.targetScope === "folder" && !this.folder) this.folder = this.selectedFile?.parent?.path ?? "";
      this.render();
      if (this.targetScope === "folder") this.chooseFolder();
    }));
    if (this.targetScope === "note") new Setting(parent).setName(this.selectedFile?.basename ?? "No note selected").setDesc(this.selectedFile?.path ?? "Open a note, or choose one here.").addButton(button => button.setButtonText("Choose note").onClick(() => this.chooseNote()));
    if (this.targetScope === "folder") new Setting(parent).setName(this.folder || "Choose a folder").setDesc("Includes notes in subfolders.").addButton(button => button.setButtonText("Change folder").onClick(() => this.chooseFolder()));
    if (this.targetScope === "selection") new Setting(parent).setName(`${this.files.length} selected note${this.files.length === 1 ? "" : "s"}`).setDesc("The current File Explorer selection will be processed.");

    const operation = new Setting(parent).setName("Operation");
    operation.addDropdown(dropdown => dropdown.addOptions({
      "ai-frontmatter": "Generate frontmatter",
      format: "Clean formatting",
      "add-tags": "Add tags",
      "remove-tags": "Remove tags",
      "replace-tag": "Replace a tag",
      "normalize-tags": "Normalize tags",
      rename: "Rename a property",
      remove: "Remove a property",
      reorder: "Reorder properties",
    }).setValue(this.operation.kind).onChange(value => {
      const kind = value as Operation["kind"];
      this.operation = kind === "ai-frontmatter"
        ? { kind, aiTier: this.plugin.settings.aiTier, aiFields: [...AI_FIELD_TIERS[this.plugin.settings.aiTier]], aiConflict: this.plugin.settings.aiConflict }
        : kind === "rename" ? { kind, oldKey: "", newKey: "", collision: "skip" }
          : kind === "remove" ? { kind, oldKey: "" }
            : kind === "add-tags" || kind === "remove-tags" ? { kind, tags: [] }
              : kind === "replace-tag" ? { kind, fromTag: "", toTag: "" }
                : kind === "normalize-tags" ? { kind, rules: "lowercase, spaces to hyphens, slash separators" }
                  : kind === "reorder" ? { kind, order: [], unknownPosition: "after" }
                    : { kind };
      this.render();
    }));
    this.renderOperationFields(parent);

    const advanced = parent.createEl("details", { cls: "tundra-advanced" });
    advanced.createEl("summary", { text: "Optional filters" });
    new Setting(advanced).setName("Path or text contains").addText(text => text.setPlaceholder("meeting").setValue(this.query).onChange(value => this.query = value.trim()));
    new Setting(advanced).setName("Property equals").addText(text => text.setPlaceholder("status").setValue(this.filterKey).onChange(value => this.filterKey = value.trim())).addText(text => text.setPlaceholder("active").setValue(this.filterValue).onChange(value => this.filterValue = value));
    if (this.targetScope === "folder") new Setting(advanced).setName("Include subfolders").addToggle(toggle => toggle.setValue(this.recursive).onChange(value => this.recursive = value));

    if (this.operation.kind === "ai-frontmatter") parent.createEl("p", { cls: "tundra-note", text: `Uses your ${AI_TIER_LABELS[this.plugin.settings.aiTier]} defaults. AI receives note text only for this operation.` });
    if (this.operation.kind === "remove") parent.createEl("p", { cls: "tundra-warning", text: "This removes a property from matching notes. Tundra keeps a recovery journal." });
    const footer = parent.createDiv("tundra-footer");
    new ButtonComponent(footer).setButtonText(this.operation.kind === "ai-frontmatter" ? "Generate and apply" : "Apply changes").setCta().onClick(() => void this.preparePreview());
  }

  private targetDescription() {
    if (this.targetScope === "note") return this.selectedFile ? "Only the open note is selected by default." : "Open a note or choose one below.";
    if (this.targetScope === "folder") return this.folder ? `Folder: ${this.folder}` : "Choose a folder to process.";
    return "Every Markdown note in this vault will be considered.";
  }

  private renderOperationFields(parent: HTMLElement) {
    if (["rename", "remove"].includes(this.operation.kind)) {
      this.textSetting(parent, "Property key", "oldKey", this.operation.oldKey ?? "");
      if (this.operation.kind === "rename") {
        this.textSetting(parent, "New property key", "newKey", this.operation.newKey ?? "");
        new Setting(parent).setName("If the new key already exists").addDropdown(dropdown => dropdown.addOptions({ skip: "Skip that note", keep: "Keep its current value", replace: "Replace its value", merge: "Merge values" }).setValue(this.operation.collision ?? "skip").onChange(value => this.operation.collision = value as Operation["collision"]));
      }
    } else if (["add-tags", "remove-tags"].includes(this.operation.kind)) this.textSetting(parent, "Tags", "tags", (this.operation.tags ?? []).join(", "));
    else if (this.operation.kind === "replace-tag") {
      this.textSetting(parent, "From tag", "fromTag", this.operation.fromTag ?? "");
      this.textSetting(parent, "To tag", "toTag", this.operation.toTag ?? "");
      this.textSetting(parent, "Optional namespace", "namespace", this.operation.namespace ?? "");
    } else if (this.operation.kind === "normalize-tags") {
      this.textSetting(parent, "Exact rules", "rules", this.operation.rules ?? "lowercase, spaces to hyphens, slash separators");
      this.textSetting(parent, "Optional namespace", "namespace", this.operation.namespace ?? "");
    } else if (this.operation.kind === "reorder") {
      this.textSetting(parent, "Preferred properties", "order", (this.operation.order ?? []).join(", "));
      new Setting(parent).setName("Where unknown properties go").addDropdown(dropdown => dropdown.addOptions({ after: "After preferred properties", before: "Before preferred properties" }).setValue(this.operation.unknownPosition ?? "after").onChange(value => this.operation.unknownPosition = value as "before" | "after"));
    }
  }

  private textSetting(parent: HTMLElement, name: string, key: keyof Operation, value: string) {
    new Setting(parent).setName(name).addText(text => text.setValue(value).onChange(next => {
      if (key === "tags" || key === "order") (this.operation[key] as string[] | undefined) = next.split(",").map(item => item.trim()).filter(Boolean);
      else (this.operation[key] as string | undefined) = next;
    }));
  }

  private chooseNote() {
    const wrangler = this;
    class NotePicker extends FuzzySuggestModal<TFile> {
      getItems() { return wrangler.app.vault.getMarkdownFiles(); }
      getItemText(file: TFile) { return file.path; }
      onChooseItem(file: TFile) { wrangler.selectedFile = file; wrangler.targetScope = "note"; wrangler.render(); }
    }
    new NotePicker(this.app).open();
  }

  private chooseFolder() {
    const wrangler = this;
    class FolderPicker extends FuzzySuggestModal<TFolder> {
      getItems() { return wrangler.app.vault.getAllFolders().filter(folder => folder.path); }
      getItemText(folder: TFolder) { return folder.path; }
      onChooseItem(folder: TFolder) { wrangler.folder = folder.path; wrangler.targetScope = "folder"; wrangler.render(); }
    }
    new FolderPicker(this.app).open();
  }

  private async selectFiles() {
    if (this.targetScope === "selection") return this.files;
    if (this.targetScope === "note") {
      if (!this.selectedFile) return [];
      return [this.selectedFile];
    }
    const matches: TFile[] = [];
    const folderPrefix = `${this.folder.replace(/\\/g, "/").replace(/\/$/, "")}/`;
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.targetScope === "folder") {
        if (!this.folder) continue;
        const path = file.path.replace(/\\/g, "/");
        if (!path.startsWith(folderPrefix)) continue;
        if (!this.recursive && path.slice(0, -file.name.length - 1) !== this.folder) continue;
      }
      const content = await this.app.vault.cachedRead(file);
      const parsed = parseFrontmatter(content);
      if (this.query && !file.path.toLowerCase().includes(this.query.toLowerCase()) && !content.toLowerCase().includes(this.query.toLowerCase())) continue;
      if (this.filterKey && String(parsed.frontmatter[this.filterKey] ?? "") !== this.filterValue) continue;
      matches.push(file);
    }
    return matches;
  }

  private async preparePreview() {
    this.plugin.support.info("operation.plan.started", { operation: this.operation.kind, scope: this.targetScope, reviewEnabled: this.plugin.settings.reviewBeforeApply });
    if (this.operation.kind === "ai-frontmatter") {
      const fields = this.operation.aiFields ?? [...AI_FIELD_TIERS[this.plugin.settings.aiTier]];
      if (!fields.length || fields.some(key => !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key))) {
        this.plugin.support.warn("operation.rejected", { operation: this.operation.kind, outcome: "invalid_fields" });
        new Notice("The configured AI property list is invalid.", 5000);
        return;
      }
    }
    if (this.targetScope === "note" && !this.selectedFile) { new Notice("Choose a note or switch the target to a folder or the vault.", 5000); return; }
    if (this.targetScope === "folder" && !this.folder) { new Notice("Choose a folder first.", 5000); return; }
    this.files = await this.selectFiles();
    if (!this.files.length) { this.plugin.support.info("operation.plan.empty", { operation: this.operation.kind, scope: this.targetScope }); new Notice("No Markdown notes match this target and its filters.", 5000); return; }
    this.plugin.support.info("operation.targets.selected", { operation: this.operation.kind, scope: this.targetScope, total: this.files.length });
    await this.buildPlan();
    this.plugin.support.info("operation.plan.completed", {
      operation: this.operation.kind,
      total: this.plans.length,
      changed: this.plans.filter(plan => plan.status === "changed").length,
      skipped: this.plans.filter(plan => plan.status === "skipped").length,
      failed: this.plans.filter(plan => plan.status === "failed").length,
      unchanged: this.plans.filter(plan => plan.status === "unchanged").length,
    });
    this.reviewedAll = false;
    if (this.plugin.settings.reviewBeforeApply) {
      this.step = 1;
      this.render();
      return;
    }
    const batch = await this.applyPlans();
    if (batch) {
      const { changed, skipped, failed, unchanged } = batch.summary;
      new Notice(`Tundra: ${changed} changed · ${skipped} skipped · ${failed} failed · ${unchanged} unchanged. Rollback is available in Settings.`, 5000);
    }
    if (this.opened) this.close();
  }

  private async buildPlan() {
    const notes: Array<{ path: string; content: string }> = [];
    for (const file of this.files) notes.push({ path: file.path, content: await this.app.vault.read(file) });
    if (this.operation.kind !== "ai-frontmatter") { this.plans = planOperation(notes, this.operation); return; }
    const updates: Record<string, Frontmatter> = {};
    const errors: Record<string, string> = {};
    for (const note of notes) {
      const parsed = parseFrontmatter(note.content);
      if (/^\uFEFF---\r?\n/.test(note.content)) { errors[note.path] = "A UTF-8 BOM before frontmatter is not supported safely."; continue; }
      if (!parsed.safe) continue;
      const fieldCount = (this.operation.aiFields ?? [...AI_FIELD_TIERS[this.plugin.settings.aiTier]]).length;
      this.plugin.support.info("ai.request.started", { fieldCount, noteChars: parsed.body.length });
      try {
        updates[note.path] = await requestAiFrontmatter(parsed.body, parsed.frontmatter, this.operation.aiFields ?? [...AI_FIELD_TIERS[this.plugin.settings.aiTier]], this.plugin.settings);
        this.plugin.support.info("ai.request.completed", { outcome: "success" });
      } catch (error) {
        this.plugin.support.warn("ai.request.failed", { errorType: error instanceof Error ? error.name : typeof error });
        errors[note.path] = error instanceof Error ? error.message : String(error);
      }
    }
    this.plans = planOperation(notes, this.operation, updates, errors);
  }

  private renderPreview(parent: HTMLElement) {
    const changed = this.plans.filter(plan => plan.status === "changed");
    const skipped = this.plans.filter(plan => plan.status === "skipped");
    const failed = this.plans.filter(plan => plan.status === "failed");
    const unchanged = this.plans.filter(plan => plan.status === "unchanged");
    parent.createEl("h3", { text: "Preview" });
    parent.createEl("p", { text: `${changed.length} changes · ${skipped.length} skipped · ${failed.length} failed · ${unchanged.length} unchanged` });
    if (!changed.length) parent.createEl("p", { cls: "tundra-note", text: "Nothing will be written. A no-op does not use credits." });
    const diffs = parent.createDiv("tundra-diffs");
    let firstChanged = true;
    for (const plan of this.plans) {
      if (!["changed", "skipped", "failed"].includes(plan.status)) continue;
      const detail = diffs.createEl("details");
      detail.open = plan.status === "changed" && (changed.length <= 4 || firstChanged);
      if (plan.status === "changed") firstChanged = false;
      detail.createEl("summary", { text: `${plan.status === "changed" ? "Change" : plan.status === "failed" ? "Failed" : "Skip"}: ${plan.path}${plan.reason ? ` — ${plan.reason}` : ""}` });
      if (plan.status === "changed") detail.createEl("pre", { text: `- before: ${plan.before.slice(0, 700)}\n+ after: ${(plan.after ?? "").slice(0, 700)}` });
    }
    if (changed.length) {
      const review = parent.createEl("label", { cls: "tundra-review-all" });
      const checkbox = review.createEl("input", { type: "checkbox" });
      checkbox.checked = this.reviewedAll;
      checkbox.onchange = () => { this.reviewedAll = checkbox.checked; this.render(); };
      review.createSpan({ text: " I reviewed the proposed changes" });
      parent.createEl("p", { cls: "tundra-note", text: "Each note is checked against its preview before writing. The latest batch can be rolled back." });
    }
    const footer = parent.createDiv("tundra-footer");
    new ButtonComponent(footer).setButtonText("Back").onClick(() => { this.step = 0; this.render(); });
    const apply = new ButtonComponent(footer).setButtonText("Confirm and apply").setCta();
    apply.setDisabled(!isBillableApply(changed.length) || !this.reviewedAll);
    apply.onClick(() => { if (!isBillableApply(changed.length) || !this.reviewedAll) return; this.cancelled = false; this.step = 2; this.render(); });
  }

  private renderApply(parent: HTMLElement) {
    parent.createEl("h3", { text: "Applying changes" });
    const progress = parent.createEl("progress", { attr: { max: String(this.plans.length), value: "0" } });
    const status = parent.createEl("p", { text: "Authorizing write batch…", cls: "tundra-status" });
    const cancel = new ButtonComponent(parent).setButtonText("Cancel after current note").setDisabled(true);
    const back = new ButtonComponent(parent).setButtonText("Back").onClick(() => { this.step = this.plugin.settings.reviewBeforeApply ? 1 : 0; this.render(); }).setDisabled(true);
    void (async () => {
      const batch = await this.applyPlans((completed, total, path) => {
        progress.value = completed;
        status.setText(`${completed}/${total}: ${path}`);
      }, () => this.cancelled);
      if (!batch) { back.setDisabled(false); return; }
      this.step = 3;
      this.render();
    })();
    cancel.onClick(() => this.cancelled = true);
  }

  private async applyPlans(onProgress?: (completed: number, total: number, path: string) => void, isCancelled?: () => boolean): Promise<Batch | null> {
    let hasCurrentChange = false;
    for (const plan of this.plans) {
      if (plan.status !== "changed" || !plan.after) continue;
      const file = this.app.vault.getAbstractFileByPath(plan.path);
      if (!(file instanceof TFile)) continue;
      try { if (await this.app.vault.read(file) === plan.before) { hasCurrentChange = true; break; } } catch { /* The apply loop reports unreadable notes. */ }
    }
    if (!hasCurrentChange) { this.plugin.support.warn("apply.skipped", { outcome: "stale_or_no_changes" }); new Notice("No planned changes are still applicable. No credit was used.", 5000); return null; }
    const reservation = await reserveUse(this.plugin);
    if (!reservation) { this.plugin.support.warn("apply.authorization_failed", { outcome: "unavailable" }); new Notice("Tundra billing authorization failed. No notes were changed.", 5000); return null; }
    this.plugin.support.info("apply.authorized", { authorizationSource: reservation.source, total: this.plans.length });
    const batch: Batch = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), operation: this.operation, files: [], summary: { changed: 0, skipped: 0, failed: 0, unchanged: 0 } };
    for (let i = 0; i < this.plans.length; i++) {
      if (isCancelled?.()) break;
      const plan = this.plans[i];
      onProgress?.(i + 1, this.plans.length, plan.path);
      if (plan.status !== "changed" || !plan.after) { batch.summary[plan.status]++; continue; }
      const file = this.app.vault.getAbstractFileByPath(plan.path);
      if (!(file instanceof TFile)) { batch.summary.failed++; continue; }
      try {
        if (await this.app.vault.read(file) !== plan.before) { batch.summary.skipped++; continue; }
        batch.files.push({ path: plan.path, original: plan.before, after: plan.after });
        await this.app.vault.modify(file, plan.after);
        batch.summary.changed++;
      } catch { batch.summary.failed++; }
    }
    if (batch.summary.changed > 0) {
      const billingResult = await reservation.commit();
      if (billingResult.kind === "pending") new Notice("Tundra changes applied. Billing is pending and will retry automatically.", 5000);
    } else await reservation.rollback();
    this.plugin.settings.lastBatch = batch;
    await this.plugin.saveSettings();
    this.plugin.support.info("apply.completed", { total: this.plans.length, changed: batch.summary.changed, skipped: batch.summary.skipped, failed: batch.summary.failed, unchanged: batch.summary.unchanged, cancelled: !!isCancelled?.() });
    return batch;
  }

  private renderReview(parent: HTMLElement) {
    const batch = this.plugin.settings.lastBatch;
    parent.createEl("h3", { text: "Run complete" });
    if (!batch) { parent.createEl("p", { text: "No batch was recorded." }); return; }
    parent.createEl("p", { text: `${batch.summary.changed} changed · ${batch.summary.skipped} skipped · ${batch.summary.failed} failed · ${batch.summary.unchanged} unchanged` });
    new ButtonComponent(parent).setButtonText("Rollback this batch").onClick(async () => { await rollback(this.app, this.plugin); this.render(); });
    new ButtonComponent(parent).setButtonText("Open operation log").onClick(() => new LogModal(this.app, batch).open());
    const footer = parent.createDiv("tundra-footer");
    new ButtonComponent(footer).setButtonText("Done").setCta().onClick(() => this.close());
  }
}

async function requestAiFrontmatter(body: string, existing: Frontmatter, fields: string[], settings: TundraSettings): Promise<Frontmatter> {
  const model = settings.aiModel.trim() || "openai/gpt-5-mini";
  const input = { existingProperties: existing, noteBody: body.slice(0, MAX_AI_NOTE_CHARS), requestedProperties: fields };
  const response = await requestUrl({
    url: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST",
    headers: { Authorization: `Bearer ${await resolveOpenRouterKey(settings.aiApiKey)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: MAX_AI_RESPONSE_TOKENS,
      messages: [
        { role: "system", content: buildAiSystemPrompt(fields) },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
    throw: false,
  });
  if (response.status < 200 || response.status >= 300) throw new Error(`OpenRouter request failed (HTTP ${response.status}).`);
  const message = response.json?.choices?.[0]?.message?.content;
  if (typeof message !== "string") throw new Error("OpenRouter returned no text suggestion.");
  const jsonText = message.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let decoded: unknown;
  try { decoded = JSON.parse(jsonText); } catch { throw new Error("OpenRouter returned invalid JSON; no changes were planned."); }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("OpenRouter returned a value that is not a JSON object.");
  return sanitizeAiFrontmatter(decoded, fields, body, existing) as Frontmatter;
}
async function rollback(app: App, plugin: TundraPlugin) { const batch = plugin.settings.lastBatch; if (!batch) { plugin.support.warn("rollback.unavailable"); new Notice("No recovery journal is available."); return; } plugin.support.info("rollback.started", { total: batch.files.length }); let restored = 0; let skipped = 0; for (const entry of batch.files) { const file = app.vault.getAbstractFileByPath(entry.path); if (!(file instanceof TFile)) { skipped++; continue; } try { const current = await app.vault.read(file); if (entry.after !== undefined && current !== entry.after) { skipped++; continue; } await app.vault.modify(file, entry.original); restored++; } catch { skipped++; } } plugin.support.info("rollback.completed", { total: batch.files.length, restored, skipped }); new Notice(`Restored ${restored} of ${batch.files.length} notes${skipped ? `; ${skipped} skipped because they changed or disappeared` : ""}.`); }
class LogModal extends Modal { constructor(app: App, private batch: Batch) { super(app); } onOpen() { this.contentEl.createEl("h3", { text: "Tundra operation log" }); this.contentEl.createEl("pre", { text: JSON.stringify(this.batch, null, 2) }); } onClose() { this.contentEl.empty(); } }
