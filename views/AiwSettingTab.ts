import AiwPlugin from "../main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class AiwSettingTab extends PluginSettingTab {
	plugin: AiwPlugin;

	constructor(app: App, plugin: AiwPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("OpenAI Base Url")
			.setDesc("The base url for the openai-compatible API")
			.addText((text) => {
				text.inputEl.style.width = "100%";
				text.setPlaceholder("https://api.openai.com/v1")
					.setValue(this.plugin.settings.openAIBaseURL)
					.onChange(async (value) => {
						this.plugin.settings.openAIBaseURL = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Your OpenAI API key")
			.addText((text) => {
				text.inputEl.style.width = "100%";
				text.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openAIKey)
					.onChange(async (value) => {
						this.plugin.settings.openAIKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("System Prompt")
			.setDesc("The prompt to use for the AI model")
			.addTextArea((text) => {
				text.inputEl.rows = 5;
				text.inputEl.style.width = "100%";
				text.setPlaceholder("You are a helpful AI assistant")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
