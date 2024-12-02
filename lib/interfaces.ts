export type MessageRoles = "user" | "assistant" | "system";

export interface MenuItem {
	label?: string;
	icon: string;
	onClick: () => void;
}

export interface Message {
	message: string;
	role: MessageRoles;
	model?: string | undefined;
}

export interface IconProps {
	iconName: string;
	tooltip?: string;
}
