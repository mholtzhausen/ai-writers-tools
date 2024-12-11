import { Notice } from "obsidian";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { AppContext, ContextualData } from "../context";
import "./styles/SystemSelect.css";

const options = [
	{
		title: "Generic",
		system: "You are a AI Writer's Assistant.",
		template: "\n---\n{selected}\n---",
		action: () => new Notice("Summarize selected!"),
	},
	{
		title: "Summarize",
		system: "You are a AI Writer's Assistant. You specialize in comprehensively summarizing content, with a focus on clarity and conciseness.",
		template: "Summarize the following:\n---\n{selected}\n---",
		action: () => new Notice("Summarize selected!"),
	},
	{
		title: "Extend",
		system: "You are a AI Writer's Assistant. You specialize in extending content, with a focus on depth and detail.",
		template:
			"Extend the following by adding another paragraph: \n---\n{selected}\n---",
		action: () => new Notice("Extend selected!"),
	},
	{
		title: "Rephrase",
		system: "You are a AI Writer's Assistant. You specialize in rephrasing content, with a focus on clarity and conciseness.",
		template: "Rephrase the following: \n---\n{selected}\n---",
		action: () => new Notice("Rephrase selected!"),
	},
];

export const SystemSelect: React.FC<ContextualData> & {
	mount?: (container: HTMLElement, contextualData: ContextualData) => void;
} = (contextualData: ContextualData) => {
	console.dir({ contextualData });
	console.dir(
		contextualData?.app?.workspace.activeEditor?.editor?.getSelection()
	);

	const [system, setSystem] = React.useState(options[0].system);
	const [response, setResponse] = React.useState("");
	const [workingText, setWorkingText] = React.useState(
		contextualData?.app?.workspace.activeEditor?.editor?.getSelection()
	);
	const [promptText, setPromptText] = React.useState("");

	async function systemChangeHandler(
		e: React.ChangeEvent<HTMLSelectElement> | undefined
	) {
		const selectedOption = options.find(
			(option) => option.title === e?.target.value || options[0].title
		);
		if (selectedOption) {
			setSystem(selectedOption.system);
			setPromptText(
				selectedOption.template.replace("{selected}", workingText || "")
			);
			selectedOption.action();
		}
	}

	async function handleSubmit() {
		if (!contextualData.plugin) return;
		if (!contextualData.app) return;
		const query = document.querySelector(
			'[data-id="query_field_input"]'
		) as HTMLTextAreaElement;
		const queryText = query.value;
		const seletedText = workingText;

		const prompt = [];
		prompt.push(queryText);
		if (seletedText) {
			prompt.push(`---`);
			prompt.push(seletedText);
			prompt.push("---");
		}

		const promptText = prompt.join("\n");

		console.log(`Query: ${queryText}`);
		console.log(`System: ${system}`);
		console.log(`Prompt: ${promptText}`);
		let response = await contextualData.plugin.agent.ask(promptText, {
			system,
		});
		console.log(response);
		setResponse(response);
	}

	React.useEffect(() => {
		systemChangeHandler(undefined);
	}, []);

	return (
		<AppContext.Provider value={contextualData}>
			<div className="systemSelect">
				<label data-id="agent_preset_label">
					Agent Preset
					<select
						data-id="agent_preset"
						onChange={systemChangeHandler}
					>
						{options.map((option) => (
							<option key={option.title} value={option.title}>
								{option.title}
							</option>
						))}
					</select>
				</label>
				<div data-id="query_field">
					<label>Query</label>
					<textarea
						data-id="query_field_input"
						rows={6}
						value={promptText}
						onChange={(e) => setPromptText(e.target.value)}
						onKeyDown={(e) => {
							if (e.shiftKey && e.key === "Enter") {
								e.preventDefault();
								handleSubmit();
								return;
							}
						}}
					></textarea>
				</div>
				<div data-id="button_bar">
					<button data-id="submit_button" onClick={handleSubmit}>
						Submit
					</button>
				</div>
				{response && (
					<div data-id="response_field">
						<label>Response</label>
						<textarea
							readOnly={true}
							value={response}
							data-id="response_content"
						></textarea>
					</div>
				)}
			</div>
		</AppContext.Provider>
	);
};

SystemSelect.mount = (
	container: HTMLElement,
	contextualData: ContextualData
) => {
	const root = createRoot(container);
	root.render(createElement(SystemSelect, contextualData));
};
