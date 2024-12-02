import { App, ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { AI_WRITER_TOOLS_VIEW_TYPE } from "../config";
import React, { useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { AIWriter } from "../components/AIWriter";
import { AppContext, ContextualData } from "../context";
import AiWriterPlugin from "main";

export default class AIWriterView extends ItemView {
	root: Root;
	plugin: AiWriterPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: AiWriterPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return AI_WRITER_TOOLS_VIEW_TYPE;
	}

	getDisplayText() {
		return "Example View";
	}

	openSettings = () => {
		console.log(`Opening Settings`);
		console.dir(this);
		(this.app as any)?.setting.open("obsidian-nem-ai-writing-tools");
	};

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.style.setProperty("padding", "0");
		container.empty();
		this.root = createRoot(container, {
			identifierPrefix: "aiw",
		});
		let contextualData: ContextualData = {
			app: this.app,
			plugin: this.plugin,
		};
		this.root.render(
			<AppContext.Provider value={contextualData}>
				<AIWriter openSettings={this.openSettings} />
			</AppContext.Provider>
		);
	}

	async onClose() {
		this.root.unmount();
	}
}
