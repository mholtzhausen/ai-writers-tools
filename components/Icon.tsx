import { setIcon } from "obsidian";
import React, { useState, useRef, useEffect } from "react";
import { IconProps } from "lib/interfaces";

import "./styles/Icon.css";

export const Icon = ({ iconName, tooltip }: IconProps) => {
	const iconRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (iconRef.current) {
			setIcon(iconRef.current, iconName);
		}
	}, [iconName]);

	return (
		<div
			ref={iconRef}
			className="clickable-icon"
			aria-label={tooltip || ""}
			data-tooltip-position="top"
			data-tooltip-delay="300"
		></div>
	);
};
