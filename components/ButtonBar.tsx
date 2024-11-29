import React, { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon";
import "./styles/ButtonBar.css";
import { MenuItem, IconProps } from "../lib/interfaces";

export const ButtonBar: React.FC<{
	left: MenuItem[];
	right: MenuItem[];
}> = ({ left, right }) => {
	const [messages, setMessages] = useState<string[]>([]);
	const [inputValue, setInputValue] = useState<string>("");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const chatDisplayRef = useRef<HTMLDivElement>(null);

	return (
		<div className="ai-writer__button-bar">
			{/* Render left array */}
			<div className="left-item">
				{left.map((item, index) => (
					<div key={index} className="button" onClick={item.onClick}>
						<Icon iconName={item.icon} tooltip={item.label} />
					</div>
				))}
			</div>
			{/* Render right array */}
			<div className="right-item">
				{right.map((item, index) => (
					<div key={index} className="button" onClick={item.onClick}>
						<Icon iconName={item.icon} tooltip={item.label} />
					</div>
				))}
			</div>
		</div>
	);
};
