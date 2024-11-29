import { Plugin } from "obsidian";
import AIWriterView from "./AIWriterView";
import { AiwSettingTab } from "views/AiwSettingTab";
import { AI_WRITER_TOOLS_VIEW_TYPE } from "./config";
import { AiwPluginSettings, DEFAULT_SETTINGS } from "./lib/Settings";
import { OpenAI } from "openai";
import { Agent } from "lib/Agent.mjs";

export default class AiWriterPlugin extends Plugin {
	statusBarElement: HTMLSpanElement;
	settings: AiwPluginSettings;

	llm: OpenAI;

	agent: Agent;

	async onload() {
		// Register a custom view
		await this.loadSettings();

		this.llm = new OpenAI({
			apiKey: this.settings.openAIKey,
			dangerouslyAllowBrowser: true,
		});

		this.agent = new Agent(
			{
				name: "Personal Assistant",
				description:
					"A personal assistant that can help you with your daily tasks.",
				model: "gpt-4o-mini",
				system: "You are a helpful assistant. You area easy-going, engaging, funny and charming. You respond concisely, with wisdom and humor, and in a readable format. If there are references and links to online resources, please include them in a list.",
				// tools: [tools.inetTool(statusEmitter)],
			},
			this.llm
		);

		this.addSettingTab(new AiwSettingTab(this.app, this));
		this.registerView(
			AI_WRITER_TOOLS_VIEW_TYPE,
			(leaf) => new AIWriterView(leaf)
		);

		// Add a ribbon icon to toggle the view
		this.addRibbonIcon("brain-circuit", "AI Chat", () => this.toggleView());
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		return this.settings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async toggleView() {
		const { workspace } = this.app;

		// Check if view is already open
		let leaf = workspace.getLeavesOfType(AI_WRITER_TOOLS_VIEW_TYPE)[0];

		if (leaf) {
			// If the view is open, detach the leaf to close it
			leaf.detach();
		} else {
			// Create new leaf in the right sidebar
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({
				type: AI_WRITER_TOOLS_VIEW_TYPE,
				active: true,
			});

			// Reveal the leaf
			workspace.revealLeaf(leaf);
		}
	}

	async onunload() {
		this.statusBarElement.remove();
	}
}
