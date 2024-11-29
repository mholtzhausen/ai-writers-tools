export class AiWPrompt {
	template: string;
	constructor(template: string) {
		this.template = template;
	}
	getPrompt(interpolationObject: any): string {
		return this.template.replace(/\${(.*?)}/g, (match, g1) => {
			return interpolationObject[g1];
		});
	}
}

export interface AiwMessage {
	message: string;
	role: "user" | "assistant";
	model?: string;
	temp?: number;
}

export interface AiwConversation {
	date?: string;
	title?: string;
	messages: AiwMessage[];
}

export interface AiwPluginSettings {
	openAIKey: string;
	openAIBaseURL: string;
	openAIModel: string;
	systemPrompt: AiWPrompt;
	conversations: AiwConversation[];
}

export const DEFAULT_SETTINGS: Partial<AiwPluginSettings> = {
	openAIKey: "",
	openAIBaseURL: "https://api.openai.com/v1",
	openAIModel: "",
	systemPrompt: new AiWPrompt("You are a helpful AI assistant"),
	conversations: [],
};

export class AiwSettings {
	plugin: Plugin;
	settings: AiwPluginSettings;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, plugin.getData());
		registerClass("AiWPrompt", AiWPrompt);
		// registerClass("AiwMessage", AiwMessage);
		// registerClass("AiwConversation", AiwConversation);
		// registerClass("AiwPluginSettings", AiwPluginSettings);
		registerClass("AiwSettings", AiwSettings);
	}

	async save() {
		await this.plugin.saveData(this.settings);
	}

	async load() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			this.plugin.getData()
		);
		return this.settings;
	}

	[key: string]: any;

	serialize(): string {
		return JSON.stringify(this, (_, value) => {
			if (
				value &&
				value.constructor &&
				classRegistry[value.constructor.name]
			) {
				return {
					...value,
					__$Serializer_Type__: value.constructor.name,
				};
			}
			return value;
		});
	}

	static deserialize(serializedData: string): any {
		return JSON.parse(serializedData, (_, value) => {
			if (
				value &&
				value.__$Serializer_Type__ &&
				classRegistry[value.__$Serializer_Type__]
			) {
				const classConstructor =
					classRegistry[value.__$Serializer_Type__];
				return Object.assign(new classConstructor(), value);
			}
			return value;
		});
	}
}

abstract class Serializable {
	private static classRegistry: { [key: string]: any } = {};
	private static serializerTypeKey: string = "__$Serializer_Type__";

	static registerClass(className: string, classConstructor: any) {
		Serializable.classRegistry[className] = classConstructor;
	}

	static setSerializerTypeKey(key: string) {
		Serializable.serializerTypeKey = key;
	}

	serialize(): string {
		const serializedData = {
			...this,
			[Serializable.serializerTypeKey]: this.constructor.name,
		};
		Serializable.registerClass(this.constructor.name, this.constructor);
		return JSON.stringify(serializedData, (_, value) => {
			if (value instanceof Serializable) {
				Serializable.registerClass(
					value.constructor.name,
					value.constructor
				);
				return JSON.parse(value.serialize());
			}
			return value;
		});
	}

	static deserialize<T extends Serializable>(
		this: new () => T,
		serializedData: string
	): T {
		const instance = new this();
		const parsedData = JSON.parse(serializedData);
		for (const key in parsedData) {
			if (key === Serializable.serializerTypeKey) continue;
			if (
				parsedData[key] &&
				parsedData[key][Serializable.serializerTypeKey] &&
				Serializable.classRegistry[
					parsedData[key][Serializable.serializerTypeKey]
				]
			) {
				const classConstructor =
					Serializable.classRegistry[
						parsedData[key][Serializable.serializerTypeKey]
					];
				instance[key] = Object.assign(
					new classConstructor(),
					parsedData[key]
				);
			} else {
				instance[key] = parsedData[key];
			}
		}
		return instance;
	}
}

class ExampleSerializable extends Serializable {
	property1: string;
	property2: number;

	constructor() {
		super();
	}
}
