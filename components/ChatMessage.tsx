import { setIcon } from "obsidian";
import React, { useState, useRef, useEffect } from "react";
import "./styles/ChatMessage.css";
import { Message } from "lib/interfaces";
import { Icon } from "./Icon";

type MessageAlign = "left" | "right";

export const ChatMessage = ({ message }: { message: Message }) => {
	const iconRef = useRef<HTMLDivElement>(null);
	const align = message.role === "user" ? "left" : "right";

	return (
		<div className={`chat-message ${align}`}>
			<div className="markdown">{message.message}</div>
			<div className={`infoBar ${message.role}`}>
				<div className="info">{message.model}</div>
				<div className="actions">
					<Icon iconName="copy" tooltip="Copy to Clipboard" />
					<Icon
						iconName="between-horizontal-end"
						tooltip="Insert into Document"
					/>
				</div>
			</div>
		</div>
	);
};
