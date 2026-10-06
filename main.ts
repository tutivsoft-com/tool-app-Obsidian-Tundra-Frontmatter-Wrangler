import { selectedFiles, markdownFile, registerSelectionAction } from "./selection-scope";
import { diagnostics } from "./diagnostics";
import { App, ButtonComponent, FuzzySuggestModal, Menu, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting, TAbstractFile, TFile, TFolder } from "obsidian";
import { resolveOpenRouterKey } from "./remote-key";
import { Frontmatter, Operation, parseFrontmatter, planOperation, ChangePlan } from "./core";
import { checkUseAvailable, defaultBillingState, ensureBillingState, FREE_LIFETIME_USES, isBillableApply, reserveUse, retryPendingCreditSpends, resumePendingCheckout, syncBalance } from "./billing";
import { type BillingState } from "./billing-model";
import { addLivePacks, resumePendingPriceCheckout } from "./billing-catalog";
import { addBillingAccountSettings } from "./constance-account";
import { PluginSupport } from "./plugin-support";
import { AI_FIELD_TIERS, AI_TIER_LABELS, DEFAULT_AI_TIER, MAX_AI_RESPONSE_TOKENS, buildAiSystemPrompt, sanitizeAiFrontmatter, type AiFieldTier } from "./ai-frontmatter";
import { AiRequestQueue, type QueueReporter } from "./ai-request-queue";

interface TundraSettings { billing: BillingState; settingsMode: "simple" | "advanced";
  debugLogging?: boolean; onboardingShown?: boolean; aiModel: string; aiTier: AiFieldTier; aiConflict: "keep" | "replace"; reviewBeforeApply: boolean; defaultOperation: Operation; lastBatch?: Batch; }
interface Batch { id: string; createdAt: string; operation: Operation; files: Array<{ path: string; original: string; after?: string }>; summary: { changed: number; skipped: number; failed: number; unchanged: number }; }
const DEFAULT_SETTINGS: TundraSettings = { billing: defaultBillingState(), settingsMode: "simple",
  debugLogging: false, aiModel: "~openai/gpt-luna-latest", aiTier: DEFAULT_AI_TIER, aiConflict: "keep", reviewBeforeApply: false, defaultOperation: { kind: "ai-frontmatter", aiTier: DEFAULT_AI_TIER, aiFields: [...AI_FIELD_TIERS[DEFAULT_AI_TIER]], aiConflict: "keep" } };
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
  refreshBillingCredits?: () => void;
  support!: PluginSupport;
  aiQueue!: AiRequestQueue;
  async onload() {
let diagnosticStartupEnd: () => void = () => {};

const diagnosticEnd1 = diagnostics?.start?.("main.onload") ?? (() => {});
try {

    this.support = new PluginSupport(this, { name: "Tundra Frontmatter Wrangler", summary: "Run configured frontmatter changes directly, with optional review and rollback.", quickStart: ["Set a default operation and its values in plugin settings.", "Choose Apply configured operation for the current note or folder.", "Enable review in Settings to preview and confirm changes before applying a batch."], commands: ["Apply configured operation to current note", "Apply configured operation to current folder", "Open frontmatter wrangler", "Open documentation", "Copy diagnostic log"], troubleshooting: ["Use Copy diagnostic log before reporting a problem.", "Reopen the wrangler if a note changes while the operation is running."] });
    this.support.start();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
diagnosticStartupEnd = diagnostics?.start?.("startup.initialize") ?? (() => {});

    this.settings.billing = ensureBillingState(this.settings.billing);
    delete (this.settings as TundraSettings & { aiApiKey?: string }).aiApiKey;
    this.settings.settingsMode = this.settings.settingsMode === "advanced" ? "advanced" : "simple";
    this.settings.aiModel = typeof this.settings.aiModel === "string" && this.settings.aiModel.trim() ? this.settings.aiModel : DEFAULT_SETTINGS.aiModel;
    await this.saveSettings();
    this.aiQueue = new AiRequestQueue(this.app, "Tundra", () => this.support.automaticWindowsEnabled());
    this.support.info("settings.loaded", { operation: this.settings.defaultOperation.kind, reviewEnabled: this.settings.reviewBeforeApply });
    void diagnostics.guard("main.background_1", () => (retryPendingCreditSpends(this)));
    resumePendingCheckout(this);
    resumePendingPriceCheckout(this);
    this.addCommand({ id: "open-wrangle", name: "Open frontmatter wrangler", callback: () => new WranglerModal(this.app, this).open() });
    this.addCommand({ id: "open-wrangle-current-note", name: "Open frontmatter wrangler for current note", checkCallback: (checking) => { const file = this.app.workspace.getActiveFile(); if (checking) return !!file; if (file) new WranglerModal(this.app, this, { file }).open(); return true; } });
    this.addCommand({ id: "open-wrangle-current-folder", name: "Open frontmatter wrangler for current folder", checkCallback: (checking) => { const folder = this.app.workspace.getActiveFile()?.parent; if (checking) return !!folder?.path; if (folder) new WranglerModal(this.app, this, { folder }).open(); return true; } });
    this.addCommand({ id: "apply-configured-current-note", name: "Apply configured operation to current note", checkCallback: (checking) => { const file = this.app.workspace.getActiveFile(); if (checking) return !!file; if (file) this.applyConfigured({ file }); return true; } });
    this.addCommand({ id: "apply-configured-current-folder", name: "Apply configured operation to current folder", checkCallback: (checking) => { const folder = this.app.workspace.getActiveFile()?.parent; if (checking) return !!folder?.path; if (folder) this.applyConfigured({ folder }); return true; } });
    this.addCommand({ id: "show-ai-request-queue", name: "Show AI request queue", callback: () => this.aiQueue.open() });
    this.addRibbonIcon("wrench", "Open frontmatter wrangler", () => diagnostics.guard("main.event_2", () => (new WranglerModal(this.app, this).open())));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => diagnostics.guard("main.event_3", () => (this.addFileMenuItems(menu, file)))));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => diagnostics.guard("main.event_4", () => (this.addFilesMenuItems(menu, files)))));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
return diagnostics.guard("main.event_5", () => { const file = info.file; if (file instanceof TFile && file.extension.toLowerCase() === "md") this.addNoteMenuItem(menu, file);
});
}));
    this.addSettingTab(new TundraSettingTab(this.app, this));
    this.support.showWelcome();
    // The common Help welcome handles first-use setup.

} catch (diagnosticError1) { diagnostics?.failure?.("main.onload", diagnosticError1); throw diagnosticError1; } finally { diagnosticStartupEnd();  diagnostics?.legacy?.("info", "startup.finished"); diagnosticEnd1(); }
}

  private addNoteMenuItem(menu: Menu, file: TFile): void {
    if (file.extension.toLowerCase() !== "md") return;
    menu.addItem(item => item.setTitle("Tundra: Update frontmatter for this note").setIcon("wand-sparkles").onClick(() => {
return diagnostics.guard("main.control_6", () => { const diagnosticAction2 = () => (this.applyConfigured({ file })); return diagnostics?.run ? diagnostics.run("control.6845.onClick", diagnosticAction2) : diagnosticAction2();
});
}));
  }

  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (file instanceof TFile) this.addNoteMenuItem(menu, file);
    else if (file instanceof TFolder) menu.addItem(item => item.setTitle("Tundra: Update frontmatter in this folder").setIcon("folder-cog").onClick(() => {
return diagnostics.guard("main.control_7", () => { const diagnosticAction3 = () => (this.applyConfigured({ files: selectedFiles([file], markdownFile) })); return diagnostics?.run ? diagnostics.run("control.7184.onClick", diagnosticAction3) : diagnosticAction3();
});
}));
  }

  private addFilesMenuItems(menu: Menu, selected: TAbstractFile[]): void {
    const paths = new Set(selectedFiles(selected, markdownFile).map(file => file.path));

    const files = [...paths].map(path => this.app.vault.getAbstractFileByPath(path)).filter((file): file is TFile => file instanceof TFile);
    if (files.length) menu.addItem(item => item.setTitle(`Tundra: Update frontmatter for ${files.length} selected note${files.length === 1 ? "" : "s"}`).setIcon("wand-sparkles").onClick(() => {
return diagnostics.guard("main.control_8", () => { const diagnosticAction4 = () => (this.applyConfigured({ files })); return diagnostics?.run ? diagnostics.run("control.7978.onClick", diagnosticAction4) : diagnosticAction4();
});
}));
  }
  applyConfigured(target: { file?: TFile; folder?: TFolder; files?: TFile[] }) {
    const scope = target.files ? "selection" : target.folder ? "folder" : "note";
    this.support.info("operation.requested", { operation: this.settings.defaultOperation.kind, scope, selectedCount: target.files?.length ?? (target.file ? 1 : 0), reviewEnabled: this.settings.reviewBeforeApply });
    const modal = new WranglerModal(this.app, this, target, true);
    if (this.settings.reviewBeforeApply) modal.open();
    else void diagnostics.guard("main.background_9", () => (modal.runConfiguredDirectly()));
  }
  addAccountGuidance(container: HTMLElement) {
    if (this.settings.billing.billingAccountLinked) return;
    addBillingAccountSettings(container, { state: this.settings.billing, appId: "tundra-frontmatter-wrangler", installationId: this.settings.billing.deviceId, appVersion: this.manifest.version, persist: () => this.saveSettings(), syncBalance: async () => {
const diagnosticEnd5 = diagnostics?.start?.("main.background.8922") ?? (() => {});
try {
 await syncBalance(this);
} catch (diagnosticError5) { diagnostics?.failure?.("main.background.8922", diagnosticError5); throw diagnosticError5; } finally { diagnosticEnd5(); }
}, refresh: () => { container.empty(); this.addAccountGuidance(container); } });
  }
  async saveSettings() {
const diagnosticEnd6 = diagnostics?.start?.("main.saveSettings") ?? (() => {});
try {
 if (!(this.settings.aiTier in AI_FIELD_TIERS)) this.settings.aiTier = DEFAULT_AI_TIER; if (this.settings.aiConflict !== "replace") this.settings.aiConflict = "keep"; await this.saveData(this.settings);
} catch (diagnosticError6) { diagnostics?.failure?.("main.saveSettings", diagnosticError6); throw diagnosticError6; } finally { diagnosticEnd6(); }
}
}

class TundraWelcomeModal extends Modal {
  constructor(app: App, private plugin: TundraPlugin) { super(app); }
  onOpen() {
return diagnostics.guard("main.onOpen_10", () => {
const diagnosticAction7 = () => {

    this.contentEl.createEl("h2", { text: "Welcome to Tundra" });
    this.plugin.addAccountGuidance(this.contentEl.createDiv("tundra-account-guidance"));
    this.contentEl.createEl("p", { text: "Choose a note or folder and a frontmatter action. Enable review in Settings to preview changes. You can restore the latest batch from Settings." });
    new Setting(this.contentEl).addButton(button => button.setButtonText("Get started").setCta().onClick(() => {
return diagnostics.guard("main.control_11", () => {
const diagnosticAction8 = () => {
 this.close(); new WranglerModal(this.app, this.plugin).open();
}; return diagnostics?.run ? diagnostics.run("control.get_started.onClick", diagnosticAction8) : diagnosticAction8();

});
}));

}; return diagnostics?.run ? diagnostics.run("main.onOpen", diagnosticAction7) : diagnosticAction7();

});
}
  onClose() {
return diagnostics.guard("main.onClose_12", () => {
const diagnosticAction9 = () => {
 this.contentEl.empty();
}; return diagnostics?.run ? diagnostics.run("main.onClose", diagnosticAction9) : diagnosticAction9();

});
}
}

class TundraSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TundraPlugin) { super(app, plugin); }
  display() {
return diagnostics.guard("main.display_13", () => {
const diagnosticAction10 = () => {

    const { containerEl } = this;
    const diagnosticStage11 = diagnostics?.start?.("settings.render.clear") ?? (() => {});
containerEl.empty();
diagnosticStage11();

    const diagnosticStage12 = diagnostics?.start?.("settings.render.help") ?? (() => {});
this.plugin.support.addHelpSetting(containerEl);
diagnosticStage12();

this.plugin.support.addDebugSetting?.(containerEl);

    const diagnosticStage13 = diagnostics?.start?.("settings.render.stage_1") ?? (() => {});
containerEl.createEl("h2", { text: "Tundra Frontmatter Wrangler" });
diagnosticStage13();

    const diagnosticStage14 = diagnostics?.start?.("settings.render.stage_2") ?? (() => {});
containerEl.createEl("p", { text: "Update frontmatter locally or generate values with AI. You can restore the latest batch." });
diagnosticStage14();

    const diagnosticStage15 = diagnostics?.start?.("settings.render.open_wrangler") ?? (() => {});
new Setting(containerEl).setName("Open wrangler").setDesc("Review and apply a bulk operation").addButton(b => b.setButtonText("Open").setCta().onClick(() => {
return diagnostics.guard("main.control_14", () => { const diagnosticAction44 = () => (new WranglerModal(this.app, this.plugin).open()); return diagnostics?.run ? diagnostics.run("control.open_wrangler.onClick", diagnosticAction44) : diagnosticAction44();
});
}));
diagnosticStage15();

    const diagnosticStage16 = diagnostics?.start?.("settings.render.settings_mode") ?? (() => {});
new Setting(containerEl).setName("Settings mode").setDesc("Simple shows common settings. Advanced adds customization and troubleshooting.").addDropdown(d => d.addOptions({ simple: "Simple", advanced: "Advanced — optional" }).setValue(this.plugin.settings.settingsMode).onChange(async value => {
return diagnostics.guard("main.control_15", async () => {
const diagnosticEnd45 = diagnostics?.start?.("control.settings_mode.onChange") ?? (() => {});
try {
 this.plugin.settings.settingsMode = value as "simple" | "advanced"; await this.plugin.saveSettings(); this.display();
} catch (diagnosticError45) { diagnostics?.failure?.("control.settings_mode.onChange", diagnosticError45); throw diagnosticError45; } finally { diagnosticEnd45(); }

});
}));
diagnosticStage16();

    const advanced = this.plugin.settings.settingsMode === "advanced";
    const diagnosticStage17 = diagnostics?.start?.("settings.render.stage_3") ?? (() => {});
if (advanced) this.plugin.support.addDiagnosticsSetting(containerEl);
diagnosticStage17();

    const diagnosticStage18 = diagnostics?.start?.("settings.render.ai_request_queue") ?? (() => {});
new Setting(containerEl).setName("AI request queue").setDesc("View the active request and waiting frontmatter runs, or remove waiting runs.").addButton(button => button.setButtonText("Show queue").onClick(() => {
return diagnostics.guard("main.control_16", () => { const diagnosticAction46 = () => (this.plugin.aiQueue.open()); return diagnostics?.run ? diagnostics.run("control.ai_request_queue.onClick", diagnosticAction46) : diagnosticAction46();
});
}));
diagnosticStage18();


    const billing = this.plugin.settings.billing;
    const diagnosticStage19 = diagnostics?.start?.("settings.render.account") ?? (() => {});
addBillingAccountSettings(containerEl, { state: billing, appId: "tundra-frontmatter-wrangler", installationId: billing.deviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: async () => {
const diagnosticEnd47 = diagnostics?.start?.("main.background.11762") ?? (() => {});
try {
 await syncBalance(this.plugin);
} catch (diagnosticError47) { diagnostics?.failure?.("main.background.11762", diagnosticError47); throw diagnosticError47; } finally { diagnosticEnd47(); }
}, refresh: () => this.display() });
diagnosticStage19();

    const creditsSetting = new Setting(containerEl).setName("Credits");
    // Obsidian Setting.then is a fluent builder, so Promise callbacks must return void.
    const showCredits = (): void => { creditsSetting.setDesc(`${billing.freeUsesRemaining} of ${FREE_LIFETIME_USES} free batches remain · ${billing.purchasedCredits} purchased credits (last updated balance).`); };
    const diagnosticStage20 = diagnostics?.start?.("settings.render.stage_4") ?? (() => {});
showCredits();
diagnosticStage20();

    const diagnosticStage21 = diagnostics?.start?.("settings.render.stage_5") ?? (() => {});
this.plugin.refreshBillingCredits = showCredits;
diagnosticStage21();

    const diagnosticStage22 = diagnostics?.start?.("settings.render.stage_6") ?? (() => {});
void diagnostics.guard("main.background_17", () => (syncBalance(this.plugin).then(showCredits).catch((rejectedError1) => {
diagnostics.failure("main.rejected_2", rejectedError1);})));
diagnosticStage22();

    const diagnosticStage23 = diagnostics?.start?.("settings.render.stage_7") ?? (() => {});
creditsSetting.addButton(button => button.setButtonText("Refresh balance").onClick(async () => {
return diagnostics.guard("main.control_18", async () => {
const diagnosticEnd48 = diagnostics?.start?.("control.sync_balance.onClick") ?? (() => {});
try {
 button.setDisabled(true); button.setButtonText("Refreshing…"); try { const result = await syncBalance(this.plugin); new Notice(result.kind === "ok" ? `Tundra: balance refreshed. ${this.plugin.settings.billing.freeUsesRemaining} free + ${result.balance} purchased credits.` : "Tundra: balance could not be refreshed. Check your connection and account, then retry.", result.kind === "ok" ? 3000 : 5000); this.display(); } catch (caughtError19) {
diagnostics.failure("main.caught_20", caughtError19); new Notice("Tundra: balance refresh failed. Check your connection and retry."); } finally { button.setDisabled(false); button.setButtonText("Refresh balance"); }
} catch (diagnosticError48) { diagnostics?.failure?.("control.sync_balance.onClick", diagnosticError48); throw diagnosticError48; } finally { diagnosticEnd48(); }

});
}));
diagnosticStage23();

    const diagnosticStage24 = diagnostics?.start?.("settings.render.stage_8") ?? (() => {});
containerEl.createEl("h3", { text: "AI frontmatter" });
diagnosticStage24();

    const diagnosticStage25 = diagnostics?.start?.("settings.render.stage_9") ?? (() => {});
containerEl.createEl("p", { text: "Note content is sent to OpenRouter only when you choose AI generation. The AI connection is included." });
diagnosticStage25();

    const diagnosticStage26 = diagnostics?.start?.("settings.render.ai_model") ?? (() => {});
if (advanced) new Setting(containerEl).setName("AI model").setDesc("The AI model is selected automatically.");
diagnosticStage26();

    const diagnosticStage27 = diagnostics?.start?.("settings.render.default_ai_field_tier") ?? (() => {});
new Setting(containerEl).setName("AI property set").setDesc("Used automatically when generating frontmatter. Standard is the recommended balance.").addDropdown(dropdown => dropdown.addOptions(AI_TIER_LABELS).setValue(this.plugin.settings.aiTier).onChange(async value => {
return diagnostics.guard("main.control_21", async () => {
const diagnosticEnd49 = diagnostics?.start?.("control.default_ai_field_tier.onChange") ?? (() => {});
try {
 this.plugin.settings.aiTier = value as AiFieldTier; await this.plugin.saveSettings();
} catch (diagnosticError49) { diagnostics?.failure?.("control.default_ai_field_tier.onChange", diagnosticError49); throw diagnosticError49; } finally { diagnosticEnd49(); }

});
}));
diagnosticStage27();

    const diagnosticStage28 = diagnostics?.start?.("settings.render.existing_ai_properties") ?? (() => {});
new Setting(containerEl).setName("Existing AI properties").setDesc("Keep existing values by default, or replace them with suggestions.").addDropdown(dropdown => dropdown.addOptions({ keep: "Keep existing values", replace: "Replace with suggestions" }).setValue(this.plugin.settings.aiConflict).onChange(async value => {
return diagnostics.guard("main.control_22", async () => {
const diagnosticEnd50 = diagnostics?.start?.("control.existing_ai_properties.onChange") ?? (() => {});
try {
 this.plugin.settings.aiConflict = value as "keep" | "replace"; await this.plugin.saveSettings();
} catch (diagnosticError50) { diagnostics?.failure?.("control.existing_ai_properties.onChange", diagnosticError50); throw diagnosticError50; } finally { diagnosticEnd50(); }

});
}));
diagnosticStage28();

    const diagnosticStage29 = diagnostics?.start?.("settings.render.review_before_applying") ?? (() => {});
new Setting(containerEl).setName("Review before applying").setDesc("Off by default: configured operations apply immediately. Turn on to preview changes before applying a batch.").addToggle(toggle => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async value => {
return diagnostics.guard("main.control_23", async () => {
const diagnosticEnd51 = diagnostics?.start?.("control.review_before_applying.onChange") ?? (() => {});
try {
 this.plugin.settings.reviewBeforeApply = value; await this.plugin.saveSettings();
} catch (diagnosticError51) { diagnostics?.failure?.("control.review_before_applying.onChange", diagnosticError51); throw diagnosticError51; } finally { diagnosticEnd51(); }

});
}));
diagnosticStage29();

    const operationNames: Record<Operation["kind"], string> = { "ai-frontmatter": "Generate frontmatter", format: "Clean formatting", "add-tags": "Add tags", "remove-tags": "Remove tags", "replace-tag": "Replace a tag", "normalize-tags": "Normalize tags", rename: "Rename a property", remove: "Remove a property", reorder: "Reorder properties" };
    const diagnosticStage30 = diagnostics?.start?.("settings.render.default_operation") ?? (() => {});
if (advanced) new Setting(containerEl).setName("Default operation").setDesc("Used by the Apply configured operation commands. Configure its values below.").addDropdown(dropdown => dropdown.addOptions(Object.fromEntries(Object.entries(operationNames).map(([key, value]) => [key, value]))).setValue(this.plugin.settings.defaultOperation.kind).onChange(async value => {
return diagnostics.guard("main.control_24", async () => {
const diagnosticEnd52 = diagnostics?.start?.("control.default_operation.onChange") ?? (() => {});
try {
 this.plugin.settings.defaultOperation = defaultOperation(value as Operation["kind"], this.plugin.settings); await this.plugin.saveSettings(); this.display();
} catch (diagnosticError52) { diagnostics?.failure?.("control.default_operation.onChange", diagnosticError52); throw diagnosticError52; } finally { diagnosticEnd52(); }

});
}));
diagnosticStage30();

    const savedOperation = this.plugin.settings.defaultOperation;
    const saveOperationText = (key: "oldKey" | "newKey" | "tags" | "fromTag" | "toTag" | "namespace" | "rules" | "order", value: string) => { if (key === "tags" || key === "order") (savedOperation[key] as string[] | undefined) = value.split(",").map(item => item.trim()).filter(Boolean); else (savedOperation[key] as string | undefined) = value; void diagnostics.guard("main.background_25", () => (this.plugin.saveSettings())); };
    const diagnosticStage31 = diagnostics?.start?.("settings.render.property_key") ?? (() => {});
if (advanced && ["rename", "remove"].includes(savedOperation.kind)) new Setting(containerEl).setName("Property key").setDesc("Existing property name, for example status.").addText(text => text.setValue(savedOperation.oldKey ?? "").onChange(value => {
return diagnostics.guard("main.control_26", () => { const diagnosticAction53 = () => (saveOperationText("oldKey", value)); return diagnostics?.run ? diagnostics.run("control.property_key.onChange", diagnosticAction53) : diagnosticAction53();
});
}));
diagnosticStage31();

    const diagnosticStage32 = diagnostics?.start?.("settings.render.new_property_key") ?? (() => {});
if (advanced && savedOperation.kind === "rename") new Setting(containerEl).setName("New property key").setDesc("Replacement property name, for example workflow_status.").addText(text => text.setValue(savedOperation.newKey ?? "").onChange(value => {
return diagnostics.guard("main.control_27", () => { const diagnosticAction54 = () => (saveOperationText("newKey", value)); return diagnostics?.run ? diagnostics.run("control.new_property_key.onChange", diagnosticAction54) : diagnosticAction54();
});
}));
diagnosticStage32();

    const diagnosticStage33 = diagnostics?.start?.("settings.render.tags") ?? (() => {});
if (advanced && ["add-tags", "remove-tags"].includes(savedOperation.kind)) new Setting(containerEl).setName("Tags").setDesc("Comma-separated tags, for example project, meeting.").addText(text => text.setValue((savedOperation.tags ?? []).join(", ")).onChange(value => {
return diagnostics.guard("main.control_28", () => { const diagnosticAction55 = () => (saveOperationText("tags", value)); return diagnostics?.run ? diagnostics.run("control.tags.onChange", diagnosticAction55) : diagnosticAction55();
});
}));
diagnosticStage33();

    const diagnosticStage34 = diagnostics?.start?.("settings.render.from_tag") ?? (() => {});
if (advanced && savedOperation.kind === "replace-tag") new Setting(containerEl).setName("From tag").setDesc("Exact tag to replace, for example work/old.").addText(text => text.setValue(savedOperation.fromTag ?? "").onChange(value => {
return diagnostics.guard("main.control_29", () => { const diagnosticAction56 = () => (saveOperationText("fromTag", value)); return diagnostics?.run ? diagnostics.run("control.from_tag.onChange", diagnosticAction56) : diagnosticAction56();
});
}));
diagnosticStage34();

    const diagnosticStage35 = diagnostics?.start?.("settings.render.to_tag") ?? (() => {});
if (advanced && savedOperation.kind === "replace-tag") new Setting(containerEl).setName("To tag").setDesc("Replacement tag, for example work/current.").addText(text => text.setValue(savedOperation.toTag ?? "").onChange(value => {
return diagnostics.guard("main.control_30", () => { const diagnosticAction57 = () => (saveOperationText("toTag", value)); return diagnostics?.run ? diagnostics.run("control.to_tag.onChange", diagnosticAction57) : diagnosticAction57();
});
}));
diagnosticStage35();

    const diagnosticStage36 = diagnostics?.start?.("settings.render.tag_namespace") ?? (() => {});
if (advanced && savedOperation.kind === "normalize-tags") new Setting(containerEl).setName("Tag namespace").setDesc("Optional prefix for normalized tags, for example work.").addText(text => text.setValue(savedOperation.namespace ?? "").onChange(value => {
return diagnostics.guard("main.control_31", () => { const diagnosticAction58 = () => (saveOperationText("namespace", value)); return diagnostics?.run ? diagnostics.run("control.tag_namespace.onChange", diagnosticAction58) : diagnosticAction58();
});
}));
diagnosticStage36();

    const diagnosticStage37 = diagnostics?.start?.("settings.render.tag_normalization_rules") ?? (() => {});
if (advanced && savedOperation.kind === "normalize-tags") new Setting(containerEl).setName("Tag normalization rules").setDesc("Choose how existing tags are normalized. All rules converts Work Notes to work-notes and backslashes to slashes.").addDropdown(d => d.addOptions({ [savedOperation.rules ?? "lowercase, spaces to hyphens, slash separators"]: "Current saved rules", "lowercase, spaces to hyphens, slash separators": "All rules (recommended)", "lowercase": "Lowercase only", "spaces to hyphens": "Spaces to hyphens only", "slash separators": "Slash separators only", "lowercase, spaces to hyphens": "Lowercase and hyphens", "lowercase, slash separators": "Lowercase and slashes", "spaces to hyphens, slash separators": "Hyphens and slashes" }).setValue(savedOperation.rules ?? "lowercase, spaces to hyphens, slash separators").onChange(value => {
return diagnostics.guard("main.control_32", () => { const diagnosticAction59 = () => (saveOperationText("rules", value)); return diagnostics?.run ? diagnostics.run("control.tag_normalization_rules.onChange", diagnosticAction59) : diagnosticAction59();
});
}));
diagnosticStage37();

    const diagnosticStage38 = diagnostics?.start?.("settings.render.preferred_property_order") ?? (() => {});
if (advanced && savedOperation.kind === "reorder") new Setting(containerEl).setName("Preferred property order").setDesc("Comma-separated property names, for example title, status, tags.").addText(text => text.setValue((savedOperation.order ?? []).join(", ")).onChange(value => {
return diagnostics.guard("main.control_33", () => { const diagnosticAction60 = () => (saveOperationText("order", value)); return diagnostics?.run ? diagnostics.run("control.preferred_property_order.onChange", diagnosticAction60) : diagnosticAction60();
});
}));
diagnosticStage38();

    const diagnosticStage39 = diagnostics?.start?.("settings.render.property_collision_behavior") ?? (() => {});
if (advanced && savedOperation.kind === "rename") new Setting(containerEl).setName("When a property already exists").setDesc("Skip preserves notes when the destination property already exists.").addDropdown(dropdown => dropdown.addOptions({ skip: "Skip", keep: "Keep existing", replace: "Replace", merge: "Merge" }).setValue(savedOperation.collision ?? "skip").onChange(async value => {
return diagnostics.guard("main.control_34", async () => {
const diagnosticEnd61 = diagnostics?.start?.("control.property_collision_behavior.onChange") ?? (() => {});
try {
 savedOperation.collision = value as Operation["collision"]; await this.plugin.saveSettings();
} catch (diagnosticError61) { diagnostics?.failure?.("control.property_collision_behavior.onChange", diagnosticError61); throw diagnosticError61; } finally { diagnosticEnd61(); }

});
}));
diagnosticStage39();

    const diagnosticStage40 = diagnostics?.start?.("settings.render.unknown_property_placement") ?? (() => {});
if (advanced && savedOperation.kind === "reorder") new Setting(containerEl).setName("Other property placement").setDesc("Where properties absent from your preferred order appear.").addDropdown(dropdown => dropdown.addOptions({ after: "After preferred properties", before: "Before preferred properties" }).setValue(savedOperation.unknownPosition ?? "after").onChange(async value => {
return diagnostics.guard("main.control_35", async () => {
const diagnosticEnd62 = diagnostics?.start?.("control.unknown_property_placement.onChange") ?? (() => {});
try {
 savedOperation.unknownPosition = value as "before" | "after"; await this.plugin.saveSettings();
} catch (diagnosticError62) { diagnostics?.failure?.("control.unknown_property_placement.onChange", diagnosticError62); throw diagnosticError62; } finally { diagnosticEnd62(); }

});
}));
diagnosticStage40();

    const diagnosticStage41 = diagnostics?.start?.("settings.render.stage_10") ?? (() => {});
addLivePacks(containerEl, this.plugin);
diagnosticStage41();

    const diagnosticStage42 = diagnostics?.start?.("settings.render.stage_11") ?? (() => {});
containerEl.createEl("p", { cls: "tundra-note", text: `Account settings are saved for this installation.` });
diagnosticStage42();


    const diagnosticStage43 = diagnostics?.start?.("settings.render.most_recent_batch") ?? (() => {});
if (this.plugin.settings.lastBatch) new Setting(containerEl).setName("Most recent batch").setDesc(`${this.plugin.settings.lastBatch.summary.changed} changed · ${this.plugin.settings.lastBatch.createdAt}`).addButton(b => b.setButtonText("Rollback").onClick(() => {
return diagnostics.guard("main.control_36", () => { const diagnosticAction63 = () => (rollback(this.app, this.plugin)); return diagnostics?.run ? diagnostics.run("control.most_recent_batch.onClick", diagnosticAction63) : diagnosticAction63();
});
}));
diagnosticStage43();


}; return diagnostics?.run ? diagnostics.run("settings.open", diagnosticAction10) : diagnosticAction10();

});
}

  hide(): void { const end = diagnostics?.start?.("settings.close") ?? (() => {}); try { super.hide(); } finally { end(); } }
}

class WranglerModal extends Modal {
  private step = 0;
  private files: TFile[] = [];
  private plans: ChangePlan[] = [];
  private selectedFile: TFile | null = this.app.workspace.getActiveFile();
  private targetScope: "note" | "folder" | "vault" | "selection" = "note";
  private folder = this.selectedFile?.parent?.path ?? "";
  private recursive = true;
  private query = "";
  private filterKey = "";
  private filterValue = "";
  private cancelled = false;
  private opened = false;
  private queueEnqueued = false;
  private queueRunning = false;
  private queueReporter?: QueueReporter;
  private operation: Operation = { ...this.plugin.settings.defaultOperation, tags: [...(this.plugin.settings.defaultOperation.tags ?? [])], order: [...(this.plugin.settings.defaultOperation.order ?? [])], aiFields: [...(this.plugin.settings.defaultOperation.aiFields ?? [])] };

  constructor(app: App, private plugin: TundraPlugin, target?: { file?: TFile; folder?: TFolder; files?: TFile[] }, private autoRun = false) {
    super(app);
    this.modalEl.addClass("tundra-modal");
    if (target?.file) { this.selectedFile = target.file; this.targetScope = "note"; this.folder = target.file.parent?.path ?? ""; }
    if (target?.folder) { this.targetScope = "folder"; this.folder = target.folder.path; }
    if (target?.files?.length) { this.files = target.files; this.targetScope = "selection"; }
  }
  onOpen() {
return diagnostics.guard("main.onOpen_37", () => {
const diagnosticAction64 = () => {
 this.opened = true; if (this.autoRun) void diagnostics.guard("main.background_38", () => (this.preparePreview())); else this.render();
}; return diagnostics?.run ? diagnostics.run("main.onOpen", diagnosticAction64) : diagnosticAction64();

});
}
  onClose() {
return diagnostics.guard("main.onClose_39", () => {
const diagnosticAction65 = () => {
 this.opened = false; this.contentEl.empty();
}; return diagnostics?.run ? diagnostics.run("main.onClose", diagnosticAction65) : diagnosticAction65();

});
}

  async runConfiguredDirectly() {
const diagnosticEnd66 = diagnostics?.start?.("main.runConfiguredDirectly") ?? (() => {});
try {
 await this.preparePreview();
} catch (diagnosticError66) { diagnostics?.failure?.("main.runConfiguredDirectly", diagnosticError66); throw diagnosticError66; } finally { diagnosticEnd66(); }
}

  private render() {
const diagnosticAction67 = () => {

    const c = this.contentEl;
    c.empty();
    c.createEl("div", { cls: "tundra-header", text: "Tundra Frontmatter Wrangler" });
    const account = c.createDiv("tundra-account-guidance");
    this.plugin.addAccountGuidance(account);
    const body = c.createDiv("tundra-body");
    if (this.step === 0) this.renderSetup(body);
    else if (this.step === 1) this.renderPreview(body);
    else if (this.step === 2) this.renderApply(body);
    else this.renderReview(body);

}; return diagnostics?.run ? diagnostics.run("main.render", diagnosticAction67) : diagnosticAction67();
}

  private renderSetup(parent: HTMLElement) {
const diagnosticAction68 = () => {

    parent.createEl("h3", { text: "What should Tundra update?" });
    const target = new Setting(parent).setName("Target").setDesc(this.targetDescription());
    const targetOptions = { note: "Open note", folder: "Choose a folder", vault: "Entire vault", ...(this.targetScope === "selection" ? { selection: "Selected notes" } : {}) };
    target.addDropdown(dropdown => dropdown.addOptions(targetOptions).setValue(this.targetScope).onChange(value => {
return diagnostics.guard("main.control_40", () => {
const diagnosticAction69 = () => {

      this.targetScope = value as "note" | "folder" | "vault" | "selection";
      if (this.targetScope === "folder" && !this.folder) this.folder = this.selectedFile?.parent?.path ?? "";
      this.render();
      if (this.targetScope === "folder") this.chooseFolder();

}; return diagnostics?.run ? diagnostics.run("control.22799.onChange", diagnosticAction69) : diagnosticAction69();

});
}));
    if (this.targetScope === "note") new Setting(parent).setName(this.selectedFile?.basename ?? "No note selected").setDesc(this.selectedFile?.path ?? "Open a note, or choose one here.").addButton(button => button.setButtonText("Choose note").onClick(() => {
return diagnostics.guard("main.control_41", () => { const diagnosticAction70 = () => (this.chooseNote()); return diagnostics?.run ? diagnostics.run("control.choose_note.onClick", diagnosticAction70) : diagnosticAction70();
});
}));
    if (this.targetScope === "folder") new Setting(parent).setName(this.folder || "Choose a folder").setDesc("Includes notes in subfolders.").addButton(button => button.setButtonText("Change folder").onClick(() => {
return diagnostics.guard("main.control_42", () => { const diagnosticAction71 = () => (this.chooseFolder()); return diagnostics?.run ? diagnostics.run("control.change_folder.onClick", diagnosticAction71) : diagnosticAction71();
});
}));
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
return diagnostics.guard("main.control_43", () => {
const diagnosticAction72 = () => {

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

}; return diagnostics?.run ? diagnostics.run("control.24322.onChange", diagnosticAction72) : diagnosticAction72();

});
}));
    this.renderOperationFields(parent);

    const advanced = parent.createEl("details", { cls: "tundra-advanced" });
    advanced.createEl("summary", { text: "Optional filters" });
    new Setting(advanced).setName("Path or text contains").addText(text => text.setPlaceholder("meeting").setValue(this.query).onChange(value => {
return diagnostics.guard("main.control_44", () => { const diagnosticAction73 = () => (this.query = value.trim()); return diagnostics?.run ? diagnostics.run("control.path_or_text_contains.onChange", diagnosticAction73) : diagnosticAction73();
});
}));
    new Setting(advanced).setName("Property equals").addText(text => text.setPlaceholder("status").setValue(this.filterKey).onChange(value => {
return diagnostics.guard("main.control_45", () => { const diagnosticAction74 = () => (this.filterKey = value.trim()); return diagnostics?.run ? diagnostics.run("control.property_equals.onChange", diagnosticAction74) : diagnosticAction74();
});
})).addText(text => text.setPlaceholder("active").setValue(this.filterValue).onChange(value => {
return diagnostics.guard("main.control_46", () => { const diagnosticAction75 = () => (this.filterValue = value); return diagnostics?.run ? diagnostics.run("control.property_equals.onChange", diagnosticAction75) : diagnosticAction75();
});
}));
    if (this.targetScope === "folder") new Setting(advanced).setName("Include subfolders").addToggle(toggle => toggle.setValue(this.recursive).onChange(value => {
return diagnostics.guard("main.control_47", () => { const diagnosticAction76 = () => (this.recursive = value); return diagnostics?.run ? diagnostics.run("control.include_subfolders.onChange", diagnosticAction76) : diagnosticAction76();
});
}));

    if (this.operation.kind === "ai-frontmatter") parent.createEl("p", { cls: "tundra-note", text: `Uses your ${AI_TIER_LABELS[this.plugin.settings.aiTier]} defaults. AI receives note text only for this operation.` });
    if (this.operation.kind === "remove") parent.createEl("p", { cls: "tundra-warning", text: "Remove this property from matching notes. You can restore the latest batch." });
    const footer = parent.createDiv("tundra-footer");
    new ButtonComponent(footer).setButtonText(this.operation.kind === "ai-frontmatter" ? "Generate and apply" : "Apply changes").setCta().onClick(() => {
return diagnostics.guard("main.control_48", () => { const diagnosticAction77 = () => (void diagnostics.guard("main.background_49", () => (this.preparePreview()))); return diagnostics?.run ? diagnostics.run("control.26575.onClick", diagnosticAction77) : diagnosticAction77();
});
});

}; return diagnostics?.run ? diagnostics.run("main.renderSetup", diagnosticAction68) : diagnosticAction68();
}

  private targetDescription() {
    if (this.targetScope === "note") return this.selectedFile ? "Only the open note is selected by default." : "Open a note or choose one below.";
    if (this.targetScope === "folder") return this.folder ? `Folder: ${this.folder}` : "Choose a folder to process.";
    return "Every Markdown note in this vault will be considered.";
  }

  private renderOperationFields(parent: HTMLElement) {
const diagnosticAction78 = () => {

    if (["rename", "remove"].includes(this.operation.kind)) {
      this.textSetting(parent, "Property key", "oldKey", this.operation.oldKey ?? "");
      if (this.operation.kind === "rename") {
        this.textSetting(parent, "New property key", "newKey", this.operation.newKey ?? "");
        new Setting(parent).setName("If the new key already exists").addDropdown(dropdown => dropdown.addOptions({ skip: "Skip that note", keep: "Keep its current value", replace: "Replace its value", merge: "Merge values" }).setValue(this.operation.collision ?? "skip").onChange(value => {
return diagnostics.guard("main.control_50", () => { const diagnosticAction79 = () => (this.operation.collision = value as Operation["collision"]); return diagnostics?.run ? diagnostics.run("control.if_the_new_key_already_exists.onChange", diagnosticAction79) : diagnosticAction79();
});
}));
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
      new Setting(parent).setName("Where unknown properties go").addDropdown(dropdown => dropdown.addOptions({ after: "After preferred properties", before: "Before preferred properties" }).setValue(this.operation.unknownPosition ?? "after").onChange(value => {
return diagnostics.guard("main.control_51", () => { const diagnosticAction80 = () => (this.operation.unknownPosition = value as "before" | "after"); return diagnostics?.run ? diagnostics.run("control.where_unknown_properties_go.onChange", diagnosticAction80) : diagnosticAction80();
});
}));
    }

}; return diagnostics?.run ? diagnostics.run("main.renderOperationFields", diagnosticAction78) : diagnosticAction78();
}

  private textSetting(parent: HTMLElement, name: string, key: keyof Operation, value: string) {
    new Setting(parent).setName(name).addText(text => text.setValue(value).onChange(next => {
return diagnostics.guard("main.control_52", () => {
const diagnosticAction81 = () => {

      if (key === "tags" || key === "order") (this.operation[key] as string[] | undefined) = next.split(",").map(item => item.trim()).filter(Boolean);
      else (this.operation[key] as string | undefined) = next;

}; return diagnostics?.run ? diagnostics.run("control.29120.onChange", diagnosticAction81) : diagnosticAction81();

});
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
const diagnosticEnd82 = diagnostics?.start?.("main.selectFiles") ?? (() => {});
try {

    if (this.targetScope === "selection") return await (this.files);
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
    return await (matches);

} catch (diagnosticError82) { diagnostics?.failure?.("main.selectFiles", diagnosticError82); throw diagnosticError82; } finally { diagnosticEnd82(); }
}

  private async preparePreview() {
const diagnosticEnd83 = diagnostics?.start?.("main.preparePreview") ?? (() => {});
try {

    if (this.operation.kind === "ai-frontmatter" && !this.queueRunning) {
      if (this.queueEnqueued) return;
      this.queueEnqueued = true;
      const targetName = this.targetScope === "note"
        ? this.selectedFile?.name ?? "selected note"
        : this.targetScope === "folder" ? this.folder || "selected folder" : this.targetScope;
      void diagnostics.guard("main.background_53", () => (this.plugin.aiQueue.enqueue(`Frontmatter for ${targetName}`, "", async (report) => {
const diagnosticEnd84 = diagnostics?.start?.("main.background.31755") ?? (() => {});
try {

        this.queueEnqueued = false;
        this.queueRunning = true;
        this.queueReporter = report;
        report({ label: "Selecting and reading target notes" });
        try { await this.preparePreview(); }
        finally { this.queueRunning = false; this.queueReporter = undefined; }

} catch (diagnosticError84) { diagnostics?.failure?.("main.background.31755", diagnosticError84); throw diagnosticError84; } finally { diagnosticEnd84(); }
}).then((result) => {
        if (result.status === "cleared") this.queueEnqueued = false;
      })));
      return;
    }
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
    if (this.operation.kind === "ai-frontmatter" && !(await checkUseAvailable(this.plugin))) {
      this.plugin.support.warn("billing.preflight.rejected", { operation: this.operation.kind, outcome: "unavailable" });
      return;
    }
    if (this.operation.kind === "ai-frontmatter") this.plugin.support.info("billing.preflight.approved", { operation: this.operation.kind });
    await this.buildPlan();
    this.plugin.support.info("operation.plan.completed", {
      operation: this.operation.kind,
      total: this.plans.length,
      changed: this.plans.filter(plan => plan.status === "changed").length,
      skipped: this.plans.filter(plan => plan.status === "skipped").length,
      failed: this.plans.filter(plan => plan.status === "failed").length,
      unchanged: this.plans.filter(plan => plan.status === "unchanged").length,
    });
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

} catch (diagnosticError83) { diagnostics?.failure?.("main.preparePreview", diagnosticError83); throw diagnosticError83; } finally { diagnosticEnd83(); }
}

  private async buildPlan() {
const diagnosticEnd85 = diagnostics?.start?.("main.buildPlan") ?? (() => {});
try {

    const notes: Array<{ path: string; content: string }> = [];
    for (const file of this.files) notes.push({ path: file.path, content: await this.app.vault.read(file) });
    if (this.operation.kind !== "ai-frontmatter") { this.plans = planOperation(notes, this.operation); return; }
    const updates: Record<string, Frontmatter> = {};
    const errors: Record<string, string> = {};
    let aiRequestIndex = 0;
    for (const note of notes) {
      const parsed = parseFrontmatter(note.content);
      if (/^\uFEFF---\r?\n/.test(note.content)) { errors[note.path] = "This note has an unsupported text format before its frontmatter. No changes were made."; continue; }
      if (!parsed.safe) continue;
      const fieldCount = (this.operation.aiFields ?? [...AI_FIELD_TIERS[this.plugin.settings.aiTier]]).length;
      aiRequestIndex++;
      this.queueReporter?.({ label: `Sending ${note.path}`, submittedText: parsed.body.slice(0, MAX_AI_NOTE_CHARS), current: aiRequestIndex, total: notes.length });
      this.plugin.support.info("ai.request.started", { fieldCount, noteChars: parsed.body.length });
      try {
        updates[note.path] = await requestAiFrontmatter(parsed.body, parsed.frontmatter, this.operation.aiFields ?? [...AI_FIELD_TIERS[this.plugin.settings.aiTier]], this.plugin.settings);
        this.plugin.support.info("ai.request.completed", { outcome: "success" });
      } catch (error) {
diagnostics.failure("main.caught_54", error);
        this.plugin.support.warn("ai.request.failed", { errorType: error instanceof Error ? error.name : typeof error });
        errors[note.path] = error instanceof Error ? error.message : String(error);
      }
    }
    this.plans = planOperation(notes, this.operation, updates, errors);

} catch (diagnosticError85) { diagnostics?.failure?.("main.buildPlan", diagnosticError85); throw diagnosticError85; } finally { diagnosticEnd85(); }
}

  private renderPreview(parent: HTMLElement) {
const diagnosticAction86 = () => {

    const changed = this.plans.filter(plan => plan.status === "changed");
    const skipped = this.plans.filter(plan => plan.status === "skipped");
    const failed = this.plans.filter(plan => plan.status === "failed");
    const unchanged = this.plans.filter(plan => plan.status === "unchanged");
    parent.createEl("h3", { text: "Preview" });
    parent.createEl("p", { text: `${changed.length} changes · ${skipped.length} skipped · ${failed.length} failed · ${unchanged.length} unchanged` });
    if (!changed.length) parent.createEl("p", { cls: "tundra-note", text: "No changes are needed. No credits will be used." });
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
      parent.createEl("p", { cls: "tundra-note", text: "Each note is checked against its preview before writing. The latest batch can be rolled back." });
    }
    const footer = parent.createDiv("tundra-footer");
    new ButtonComponent(footer).setButtonText("Back").onClick(() => {
return diagnostics.guard("main.control_55", () => {
const diagnosticAction87 = () => {
 this.step = 0; this.render();
}; return diagnostics?.run ? diagnostics.run("control.back.onClick", diagnosticAction87) : diagnosticAction87();

});
});
    const apply = new ButtonComponent(footer).setButtonText("Apply changes").setCta();
    apply.setDisabled(!isBillableApply(changed.length));
    apply.onClick(() => {
return diagnostics.guard("main.control_56", () => {
const diagnosticAction88 = () => {
 if (!isBillableApply(changed.length)) return; this.cancelled = false; this.step = 2; this.render();
}; return diagnostics?.run ? diagnostics.run("control.38502.onClick", diagnosticAction88) : diagnosticAction88();

});
});

}; return diagnostics?.run ? diagnostics.run("main.renderPreview", diagnosticAction86) : diagnosticAction86();
}

  private renderApply(parent: HTMLElement) {
const diagnosticAction89 = () => {

    parent.createEl("h3", { text: "Applying changes" });
    const progress = parent.createEl("progress", { attr: { max: String(this.plans.length), value: "0" } });
    const status = parent.createEl("p", { text: "Checking credits for this batch…", cls: "tundra-status" });
    const cancel = new ButtonComponent(parent).setButtonText("Cancel after current note").setDisabled(true);
    const back = new ButtonComponent(parent).setButtonText("Back").onClick(() => {
return diagnostics.guard("main.control_57", () => {
const diagnosticAction90 = () => {
 this.step = this.plugin.settings.reviewBeforeApply ? 1 : 0; this.render();
}; return diagnostics?.run ? diagnostics.run("control.back.onClick", diagnosticAction90) : diagnosticAction90();

});
}).setDisabled(true);
    void diagnostics.guard("main.background_58", () => ((async () => {
const diagnosticEnd91 = diagnostics?.start?.("main.background.39229") ?? (() => {});
try {

      const batch = await this.applyPlans((completed, total, path) => {
        progress.value = completed;
        status.setText(`${completed}/${total}: ${path}`);
      }, () => this.cancelled);
      if (!batch) { back.setDisabled(false); return; }
      this.step = 3;
      this.render();

} catch (diagnosticError91) { diagnostics?.failure?.("main.background.39229", diagnosticError91); throw diagnosticError91; } finally { diagnosticEnd91(); }
})()));
    cancel.onClick(() => {
return diagnostics.guard("main.control_59", () => { const diagnosticAction92 = () => (this.cancelled = true); return diagnostics?.run ? diagnostics.run("control.39567.onClick", diagnosticAction92) : diagnosticAction92();
});
});

}; return diagnostics?.run ? diagnostics.run("main.renderApply", diagnosticAction89) : diagnosticAction89();
}

  private async applyPlans(onProgress?: (completed: number, total: number, path: string) => void, isCancelled?: () => boolean): Promise<Batch | null> {
const diagnosticEnd93 = diagnostics?.start?.("main.applyPlans") ?? (() => {});
try {

    let hasCurrentChange = false;
    for (const plan of this.plans) {
      if (plan.status !== "changed" || !plan.after) continue;
      const file = this.app.vault.getAbstractFileByPath(plan.path);
      if (!(file instanceof TFile)) continue;
      try { if (await this.app.vault.read(file) === plan.before) { hasCurrentChange = true; break; } } catch (caughtError60) {
diagnostics.failure("main.caught_61", caughtError60); /* The apply loop reports unreadable notes. */ }
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
        this.plugin.settings.lastBatch = batch;
        await this.plugin.saveSettings();
        await this.app.vault.modify(file, plan.after);
        if (await this.app.vault.read(file) !== plan.after) throw new Error("Write verification failed.");
        batch.summary.changed++;
      } catch (caughtError62) {
diagnostics.failure("main.caught_63", caughtError62); batch.summary.failed++; }
    }
    if (batch.summary.changed > 0) {
      const billingResult = await reservation.commit();
      if (billingResult.kind === "pending") new Notice("Tundra changes applied. Billing is pending and will retry automatically.", 5000);
    } else await reservation.rollback();
    this.plugin.settings.lastBatch = batch;
    await this.plugin.saveSettings();
    this.plugin.support.info("apply.completed", { total: this.plans.length, changed: batch.summary.changed, skipped: batch.summary.skipped, failed: batch.summary.failed, unchanged: batch.summary.unchanged, cancelled: !!isCancelled?.() });
    return await (batch);

} catch (diagnosticError93) { diagnostics?.failure?.("main.applyPlans", diagnosticError93); throw diagnosticError93; } finally { diagnosticEnd93(); }
}

  private renderReview(parent: HTMLElement) {
const diagnosticAction94 = () => {

    const batch = this.plugin.settings.lastBatch;
    parent.createEl("h3", { text: "Run complete" });
    if (!batch) { parent.createEl("p", { text: "No batch was recorded." }); return; }
    parent.createEl("p", { text: `${batch.summary.changed} changed · ${batch.summary.skipped} skipped · ${batch.summary.failed} failed · ${batch.summary.unchanged} unchanged` });
    new ButtonComponent(parent).setButtonText("Rollback this batch").onClick(async () => {
return diagnostics.guard("main.control_64", async () => {
const diagnosticEnd95 = diagnostics?.start?.("control.rollback_this_batch.onClick") ?? (() => {});
try {
 await rollback(this.app, this.plugin); this.render();
} catch (diagnosticError95) { diagnostics?.failure?.("control.rollback_this_batch.onClick", diagnosticError95); throw diagnosticError95; } finally { diagnosticEnd95(); }

});
});
    new ButtonComponent(parent).setButtonText("Open operation log").onClick(() => {
return diagnostics.guard("main.control_65", () => { const diagnosticAction96 = () => (new LogModal(this.app, batch).open()); return diagnostics?.run ? diagnostics.run("control.open_operation_log.onClick", diagnosticAction96) : diagnosticAction96();
});
});
    const footer = parent.createDiv("tundra-footer");
    new ButtonComponent(footer).setButtonText("Done").setCta().onClick(() => {
return diagnostics.guard("main.control_66", () => { const diagnosticAction97 = () => (this.close()); return diagnostics?.run ? diagnostics.run("control.done.onClick", diagnosticAction97) : diagnosticAction97();
});
});

}; return diagnostics?.run ? diagnostics.run("main.renderReview", diagnosticAction94) : diagnosticAction94();
}
}

async function requestAiFrontmatter(body: string, existing: Frontmatter, fields: string[], settings: TundraSettings): Promise<Frontmatter> {
const diagnosticEnd98 = diagnostics?.start?.("main.requestAiFrontmatter") ?? (() => {});
try {

  const model = "~openai/gpt-luna-latest";
  const input = { existingProperties: existing, noteBody: body.slice(0, MAX_AI_NOTE_CHARS), requestedProperties: fields };
  const response = await (diagnostics?.request?.("network.main.requestAiFrontmatter", requestUrl, {
    url: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST",
    headers: { Authorization: `Bearer ${await resolveOpenRouterKey()}`, "Content-Type": "application/json" },
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
  }) ?? requestUrl({
    url: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST",
    headers: { Authorization: `Bearer ${await resolveOpenRouterKey()}`, "Content-Type": "application/json" },
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
  }));
  if (response.status < 200 || response.status >= 300) throw new Error(`The AI request failed. Check your connection and try again.`);
  const message = response.json?.choices?.[0]?.message?.content;
  if (typeof message !== "string") throw new Error("No AI suggestion was returned. Try again.");
  const jsonText = message.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let decoded: unknown;
  try { decoded = JSON.parse(jsonText); } catch (caughtError67) {
diagnostics.failure("main.caught_68", caughtError67); throw new Error("The AI response could not be read. No changes were planned."); }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("The AI response was not in the required format. Try again.");
  return await (sanitizeAiFrontmatter(decoded, fields, body, existing) as Frontmatter);

} catch (diagnosticError98) { diagnostics?.failure?.("main.requestAiFrontmatter", diagnosticError98); throw diagnosticError98; } finally { diagnosticEnd98(); }
}
async function rollback(app: App, plugin: TundraPlugin) {
const diagnosticEnd99 = diagnostics?.start?.("main.rollback") ?? (() => {});
try {
 const batch = plugin.settings.lastBatch; if (!batch) { plugin.support.warn("rollback.unavailable"); new Notice("No saved changes are available to restore."); return; } plugin.support.info("rollback.started", { total: batch.files.length }); let restored = 0; let skipped = 0; for (const entry of batch.files) { const file = app.vault.getAbstractFileByPath(entry.path); if (!(file instanceof TFile)) { skipped++; continue; } try { const current = await app.vault.read(file); if (entry.after !== undefined && current !== entry.after) { skipped++; continue; } await app.vault.modify(file, entry.original); restored++; } catch (caughtError69) {
diagnostics.failure("main.caught_70", caughtError69); skipped++; } } plugin.support.info("rollback.completed", { total: batch.files.length, restored, skipped }); new Notice(`Restored ${restored} of ${batch.files.length} notes${skipped ? `; ${skipped} skipped because they changed or disappeared` : ""}.`);
} catch (diagnosticError99) { diagnostics?.failure?.("main.rollback", diagnosticError99); throw diagnosticError99; } finally { diagnosticEnd99(); }
}
class LogModal extends Modal { constructor(app: App, private batch: Batch) { super(app); } onOpen() {
return diagnostics.guard("main.onOpen_71", () => {
const diagnosticAction100 = () => {
 this.contentEl.createEl("h3", { text: "Tundra operation log" }); this.contentEl.createEl("pre", { text: JSON.stringify(this.batch, null, 2) });
}; return diagnostics?.run ? diagnostics.run("main.onOpen", diagnosticAction100) : diagnosticAction100();

});
} onClose() {
return diagnostics.guard("main.onClose_72", () => {
const diagnosticAction101 = () => {
 this.contentEl.empty();
}; return diagnostics?.run ? diagnostics.run("main.onClose", diagnosticAction101) : diagnosticAction101();

});
} }
