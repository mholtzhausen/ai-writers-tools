import { Modal, Notice } from "obsidian";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { AppContext, ContextualData } from "../context";
import { AiwPluginSettings } from "../lib/Settings";
import "./styles/QuickEdit.css";

export const QuickEdit: React.FC<ContextualData> & {
	mount?: (container: HTMLElement, contextualData: ContextualData) => void;
} = (contextualData: ContextualData) => {
	console.dir({ contextualData });
	console.dir(
		contextualData?.app?.workspace.activeEditor?.editor?.getSelection()
	);
	const settings: AiwPluginSettings = contextualData?.plugin?.settings || {};
	const editor = contextualData?.app?.workspace.activeEditor?.editor;
	const doc = editor?.getDoc();

	const selection =
		contextualData?.app?.workspace.activeEditor?.editor?.getSelection() ||
		"";
	let docContent = doc?.getValue();
	let system = `${settings.systemPrompt}\n\n Instructions:${settings.writeWithAiSystem}`;
	console.log("system", system);
	const [response, setResponse] = React.useState("");
	const [workingText, setWorkingText] = React.useState(
		editor?.getSelection()
	);
	const [loading, setLoading] = React.useState(false);

	async function handleSubmit() {
		if (!contextualData.plugin) return;
		if (!contextualData.app) return;
		const query = document.querySelector(
			'[data-id="query_field_input"]'
		) as HTMLTextAreaElement;
		const queryText = `${query.value}:  ${selection}`;

		// console.log(`System: ${system}`);
		// console.log(`Prompt: ${queryText}`);

		setLoading(true);
		let cel = (chunk: any) => {
			console.log(chunk);
			editor?.replaceSelection(chunk.choices[0]?.delta?.content || "");
			editor?.scrollIntoView({
				from: editor.getCursor("from"),
				to: editor.getCursor(),
			});
		};
		contextualData.plugin.agent.addListener("chunk", cel);
		let response = await contextualData.plugin.agent.ask(queryText, {
			system,
		});
		contextualData.plugin.agent.removeListener("chunk", cel);
		setLoading(false);
		// if (response) {
		// 	const editor = contextualData.app.workspace.activeEditor?.editor;
		// 	if (editor) {
		// 		const doc = editor.getDoc();
		// 		const selection = editor.getSelection();
		// 		const cursor = editor.getCursor();
		// 		doc.replaceSelection(response);
		// 		editor.setCursor(cursor);
		// 		new Notice("Text replaced successfully!");
		// 	}
		// }
		console.log(contextualData.modal);
		if (contextualData.modal) {
			contextualData.modal.close();
		}
	}

	React.useEffect(() => {
		const queryField = document.querySelector(
			'[data-id="query_field_input"]'
		) as HTMLTextAreaElement;
		if (queryField) {
			queryField.focus();
		}
	}, []);
	return (
		<AppContext.Provider value={contextualData}>
			<div className="quickEdit">
				{!loading && (
					<textarea
						data-id="query_field_input"
						className={`query-field`}
						rows={6}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit();
								return;
							}
						}}
					></textarea>
				)}
				{loading && <div>Loading</div>}
			</div>
		</AppContext.Provider>
	);
};

QuickEdit.mount = (container: HTMLElement, contextualData: ContextualData) => {
	const root = createRoot(container);
	root.render(createElement(QuickEdit, contextualData));
};
