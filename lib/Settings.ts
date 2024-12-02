// export class AiWPrompt {
// 	template: string;
// 	constructor(template: string) {
// 		this.template = template;
// 	}
// 	getPrompt(interpolationObject: any): string {
// 		return this.template.replace(/\${(.*?)}/g, (match, g1) => {
// 			return interpolationObject[g1];
// 		});
// 	}
// }

export interface AiwMessage {
	message: string;
	role: "user" | "assistant";
	model?: string;
	temp?: number;
}

// export interface AiwConversation {
// 	date?: string;
// 	title?: string;
// 	messages: AiwMessage[];
// }

export interface AiwPluginSettings {
	openAIKey: string;
	openAIBaseURL: string;
	model: string;
	// systemPrompt: AiWPrompt;
	systemPrompt: string;
	// conversations: AiwConversation[];
	messages: AiwMessage[];
}

export const DEFAULT_SETTINGS: Partial<AiwPluginSettings> = {
	systemPrompt: "You are a helpful AI assistant",
	messages: [],
};
