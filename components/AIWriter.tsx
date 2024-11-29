import { setIcon } from "obsidian";
import React, { useState, useRef, useEffect } from "react";
import "./styles/AIWriter.css";
import { ButtonBar } from "./ButtonBar";
import { ChatMessage } from "./ChatMessage";
import { Agent } from "../lib/Agent.mjs";
import OpenAI from "openai";
import { useApp } from "../hooks";

import { MenuItem, Message } from "../lib/interfaces";

let llm = new OpenAI({
	apiKey: "",
	dangerouslyAllowBrowser: true,
});

let agent = new Agent(
	{
		name: "Personal Assistant",
		description:
			"A personal assistant that can help you with your daily tasks.",
		model: "gpt-4o-mini",
		system: "You are a helpful assistant. You area easy-going, engaging, funny and charming. You respond concisely, with wisdom and humor, and in a readable format. If there are references and links to online resources, please include them in a list.",
		// tools: [tools.inetTool(statusEmitter)],
	},
	llm
);

export const AIWriter: React.FC<{
	openSettings: () => void;
}> = ({ openSettings }) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const chatDisplayRef = useRef<HTMLDivElement>(null);
	const sendButtonRef = useRef<HTMLButtonElement>(null);
	const app = useApp();

	const menuItemsLeft: MenuItem[] = [];
	const menuItemsRight = [
		{
			label: "Settings",
			icon: "settings",
			onClick: openSettings,
		},
		{
			label: "Clear conversation",
			icon: "trash-2",
			onClick: openSettings,
		},
	];

	const sendMessage = async () => {
		const inputText = inputValue.trim();
		console.log(`Sending message: ${inputText}`);
		if (inputText !== "") {
			const newMessage: Message = {
				message: inputText,
				role: "user",
			};

			let currentMessages = [...messages];
			currentMessages.push(newMessage);
			setMessages(currentMessages);
			if (inputRef.current) {
				inputRef.current.readOnly = true;
			}
			await agent
				.ask(inputText)
				.then((response) => {
					const responseMessage: Message = {
						message: response,
						role: "assistant",
						model: agent.model,
					};
					currentMessages.push(responseMessage);
					console.dir(currentMessages);
					setMessages(currentMessages);
				})
				.catch((error) => {
					console.error(error);
				});
			setInputValue("");
			if (inputRef.current) {
				inputRef.current.readOnly = false;
			}

			if (inputRef.current) {
				inputRef.current.focus();
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	};

	useEffect(() => {
		if (chatDisplayRef.current) {
			chatDisplayRef.current.scrollTop =
				chatDisplayRef.current.scrollHeight;
		}
	}, [messages.length]);

	useEffect(() => {
		if (sendButtonRef.current) {
			setIcon(sendButtonRef.current, "send");
		}
	}, []);

	return (
		<div className="ai-writer">
			<div className="ai-writer-header">
				<h2>AI Chat</h2>
			</div>
			<div className="ai-writer-chat-display" ref={chatDisplayRef}>
				{messages.map((message, index) => (
					<ChatMessage key={index} message={message} />
				))}
			</div>
			<div className="ai-writer-chat-input">
				<ButtonBar
					left={menuItemsLeft}
					right={menuItemsRight}
				></ButtonBar>
				<div className="input-submit">
					<textarea
						placeholder="Type a message..."
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						ref={inputRef}
						rows={3}
					/>
					<button
						ref={sendButtonRef}
						onClick={sendMessage}
						className="sendButton"
					></button>
				</div>
			</div>
		</div>
	);
};
