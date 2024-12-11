import { zodResponseFormat } from "openai/helpers/zod";
import zodToJsonSchema from "zod-to-json-schema";
import z, { ZodType } from "zod";
import { EventEmitter } from "events";
import OpenAI from "openai";

interface ReqOptions {
	errorPrefix?: string;
}

export function req(
	obj: Record<string, any>,
	keyList: string[],
	{ errorPrefix }: ReqOptions
) {
	keyList.forEach((key) => {
		if (!obj[key]) {
			throw new Error(
				`${errorPrefix ? errorPrefix : ""}\`${key}\` is required`
			);
		}
	});
}

interface AgentConfig {
	name?: string | null;
	description?: string | null;
	outputSchema?: ZodType | null;
	model?: string;
	system?: string | null;
	messages?: any[];
	tools?: any[];
}

interface ExpertConfig {
	model?: string;
	system?: string;
	token_limit?: number;
	tools?: any[];
	messages?: any[];
	schemaName?: string;
	max_tokens?: number | null;
}

interface StructuredAskConfig {
	schema: ZodType;
	config?: ExpertConfig;
}

interface ToolDefinitionOptions {
	name?: string;
	description?: string;
	schema?: ZodType;
}

interface ToolDefinition {
	type: "function";
	function: {
		name: string;
		description: string | null;
		function: Function;
		parameters: ZodType | null;
	};
}

interface ToolFunction extends Function {
	toolDefinition?: ToolDefinition;
}

export class Agent extends EventEmitter {
	name: string | null = null;
	description: string | null = null;
	outputSchema: ZodType | null = null;
	model: string | null = null;
	system: string | null = null;
	_messages: any[] = [];
	tools: any[] = [];
	llm: OpenAI | undefined;

	MAX_EXPERTS = 5;
	EXPERT_NUM_TOKENS = 150;

	constructor(
		{
			name,
			description,
			outputSchema,
			model,
			system,
			messages,
			tools,
		}: AgentConfig = {},
		llm?: OpenAI
	) {
		super();
		req({ ...arguments[0] }, ["model"], {
			errorPrefix: "[Agent.constructor()] ",
		});

		if (outputSchema) {
			if (!(outputSchema instanceof z.ZodType)) {
				throw new Error(
					"outputSchema must be an instance of z.ZodType"
				);
			}
		}

		this.llm = llm;
		this.name = name || null;
		this.description = description || null;
		this.outputSchema = outputSchema || null;
		this.model = model || "gpt-4o-mini";
		this.system = system || null;
		this._messages = messages || [];
		this.tools = tools || [];

		this.emit("ready", this);
	}

	get conversation(): string {
		let conversation = this.messages.map((message) => {
			return `${message.role}${
				message.name ? " (" + message.name + ") " : ""
			}: ${message.content}`;
		});
		return conversation.join("\n---\n");
	}

	get messages(): any[] {
		let messages = [...this._messages];
		if (this.system) {
			messages.unshift({ role: "system", content: this.system });
		}
		return messages;
	}

	get toollist(): any[] {
		let tools = Array.isArray(this.tools) ? this.tools : [];
		return tools
			.filter((tool) => tool.toolDefinition)
			.map((tool) => {
				let def = tool.toolDefinition;
				if (def.function.parameters) {
					def.function.parameters = zodToJsonSchema(
						def.function.parameters
					);
				}
				return def;
			});
	}

	async process(prompt: string): Promise<any> {
		let tools = this.toollist || [];
		let simpleExpert = this.createExpert({
			system: this.system || "You are a helpful assistant",
			max_tokens: null,
			tools,
		});
		let response = await simpleExpert(prompt);
		return response;
	}

	async ask(
		prompt: string,
		config?: Partial<ExpertConfig>,
		schema?: ZodType
	): Promise<any> {
		config = {
			model: "gpt-4o-mini",
			system: "You are a helpful assistant",
			messages: [],
			...(config || {}),
		};
		let { model, system, messages } = config;

		if (schema && schema instanceof z.Schema) {
			return await this.structuredAsk(prompt, { schema, config });
		}

		let iMessages = [
			...(messages || []),
			{ role: "user", content: prompt },
		];

		let stream = await this.llm!.chat.completions.create({
			model: model!,
			messages: [
				{
					role: "system",
					content: system!,
				},
				...iMessages,
			],
			stream: true,
		});

		let response = "";

		for await (const chunk of stream) {
			let chunkContent = chunk.choices[0]?.delta?.content || "";
			response += chunkContent;
			this.emit("chunk", chunk);
			this.emit("udatedResponse", response);
		}

		this._messages = [
			...iMessages,
			{ role: "assistant", content: response },
		];

		return response;
	}

	static splitObj(
		obj: Record<string, any>,
		defaults: Record<string, any>
	): { newObj: Record<string, any>; originalObj: Record<string, any> } {
		if (!obj && !defaults) return { newObj: {}, originalObj: {} };
		if (!defaults) return { newObj: obj, originalObj: {} };
		if (!obj) return { newObj: defaults, originalObj: {} };

		let keys = Object.keys(defaults);
		let newObj: Record<string, any> = {};
		let originalObj = { ...obj };
		keys.forEach((key) => {
			newObj[key] = obj[key] || defaults[key];
			delete originalObj[key];
		});

		return { newObj, originalObj };
	}

	static createExpert(
		config: ExpertConfig = { system: "" },
		schema?: ZodType
	): (prompt: string) => Promise<any> {
		let agent = new Agent(config);
		return agent.createExpert(config, schema);
	}

	createExpert(
		config: ExpertConfig = { system: "" },
		schema?: ZodType
	): (prompt: string) => Promise<any> {
		config = {
			model: process.env.DEFAULT_OPENAI_MODEL,
			token_limit: this.EXPERT_NUM_TOKENS,
			tools: [],
			messages: [],
			...(config || {}),
			schemaName: "answer_the_question",
		};
		if (this.system && !config.system) config.system = this.system;

		let { newObj: llmOptions, originalObj: fnOptions } = Agent.splitObj(
			config,
			{
				model: process.env.DEFAULT_OPENAI_MODEL,
				tools: [],
				messages: [],
				temperature: null,
			}
		);

		if (llmOptions.tools.length <= 0) delete llmOptions.tools;
		if (llmOptions.messages.length <= 0) delete llmOptions.messages;
		if (!llmOptions.system) delete llmOptions.system;
		if (!llmOptions.max_tokens) delete llmOptions.max_tokens;
		if (!llmOptions.temperature) delete llmOptions.temperature;

		let expert = async (prompt: string) => {
			let tokenConstraint = config.token_limit
				? `Keep your answer under ${
						config.token_limit
				  } tokens (approx ${Math.floor(
						config.token_limit * 0.75
				  )} words).`
				: "";
			let systemDate = `Current Date and Time: ${new Date().toLocaleString()}`;
			llmOptions.messages = [
				{
					role: "system",
					content: `${systemDate}\n${config.system}\n\n${tokenConstraint}`,
				},
				...(Array.isArray(llmOptions.messages)
					? llmOptions.messages
					: []),
				{ role: "user", content: prompt },
			];
			if (!llmOptions.max_tokens) delete llmOptions.max_tokens;
			if (schema)
				llmOptions.response_format = zodResponseFormat(
					schema,
					config.schemaName || "defaultSchemaName"
				);

			this?.emit &&
				this.emit("expert:start", {
					expert: fnOptions.expert || { role: "expert" },
					prompt,
					config: llmOptions,
				});

			let response, out;
			if (llmOptions.tools?.length > 0) {
				const runner = this.llm!.beta.chat.completions.runTools({
					model: llmOptions.model,
					messages: llmOptions.messages,
					tools: llmOptions.tools,
				});
				response = await runner.finalContent();
				out = response;
			} else {
				if (schema) {
					response = await this.llm!.beta.chat.completions.parse(
						llmOptions as OpenAI.ChatCompletionCreateParamsNonStreaming
					);
				} else {
					response = await this.llm!.chat.completions.create(
						llmOptions as OpenAI.ChatCompletionCreateParamsNonStreaming
					);
				}
				out = schema
					? (response.choices[0].message as any).parsed
					: response.choices[0].message.content;
			}

			this?.emit &&
				this.emit("expert:end", {
					expert: fnOptions.expert || { role: "expert" },
					prompt,
					out,
					config: llmOptions,
				});
			return out;
		};
		// expert.getTool = () => {
		// 	/**TODO**/
		// };
		return expert.bind(this);
	}

	async structuredAsk(
		prompt: string,
		{ schema, config = { system: "" } }: StructuredAskConfig
	): Promise<any> {
		let expert = this.createExpert(config, schema);
		return await expert(prompt);
	}

	static toolDefinition(
		fn: ToolFunction,
		{ name, description, schema }: ToolDefinitionOptions
	): ToolFunction {
		let toolDefinition = {
			type: "function",
			function: {
				name: name || fn.name,
				description: description || null,
				function: fn,
				parameters: schema || null,
			},
		};
		fn.toolDefinition = toolDefinition as ToolDefinition;
		return fn;
	}
}

interface RouterAgentConfig extends AgentConfig {
	agents?: Agent[];
}

// export class RouterAgent extends Agent {
// 	agents: Agent[] = [];

// 	constructor({
// 		name,
// 		description,
// 		outputSchema,
// 		model,
// 		system,
// 		messages,
// 		tools,
// 		agents,
// 	}: RouterAgentConfig = {}) {
// 		super({
// 			name,
// 			description,
// 			outputSchema,
// 			model,
// 			system,
// 			messages,
// 			tools,
// 		});
// 		this.agents = agents || [];
// 	}

// 	async process(prompt: string): Promise<any> {
// 		let agents = this.agents.map(
// 			(agent) => `${agent.name || "AGENT"}: ${agent.description}`
// 		);
// 		const expert = this.createExpert(
// 			{
// 				model: "gpt-4o-mini",
// 				system: `You are a helpful assistant. You are a router agent. You can help route messages to the appropriate agent. Here are the agents you can route to:\n\n${agents.join(
// 					"\n\n"
// 				)}`,
// 			},
// 			z.object({ agents: z.array(z.string()) })
// 		);

// 		const answer = await expert(prompt);
// 		return answer;
// 	}

// 	async route(prompt: string): Promise<any> {
// 		let { agents } = await this.process(prompt);
// 		let responses = await Promise.all(
// 			agents.map(async (agent: string) => {
// 				let subAgent = this.agents.find((a) => a.name === agent);
// 				return await subAgent!.process(prompt);
// 			})
// 		);

// 		if (responses.length === 1) return responses[0];

// 		let combineExpert = this.createExpert({
// 			system: "You are a helpful assistant. You are a router agent. You can help combine the responses from multiple agents. Multiple responses will be provided to you. You must combine these responses into a single response.",
// 		});

// 		let combinedResponse = await combineExpert(responses);
// 		return combinedResponse;
// 	}
// }

// export class StepOrchestrator extends Agent {
// 	async #getOGExpert(prompt: string, context: string): Promise<any> {
// 		let config = {
// 			model: this.model,
// 			system: `Try to understand the intent of the user in asking this question - Are they looking for a quick answer, or a more detailed answer? Create a description of an expert who can take some contextual information and provide the user with the anticipated response. Phrase the description for role play. For example, "You are an expert in the field of robotics technology. You are a robotics engineer."
//       Your answer should be formatted in JSON.

//       Here is some context to help with your answer:
//       ${context}`,
// 		};
// 		let schema = z.object({
// 			steps: z.array(
// 				z.object({
// 					userIntent: z.string(),
// 					expertDescription: z.string(),
// 					expertRole: z.string(),
// 					expertName: z
// 						.string()
// 						.describe(
// 							'A fictitious pseudonym for the expert that is related to the expert role. For example, "Dr. Robo"'
// 						),
// 				})
// 			),
// 		});

// 		let exp = await this.structuredAsk(prompt, { schema, config });
// 		let expert = null;
// 		if (exp) {
// 			expert = this.createExpert({
// 				expert: { name: exp.expertName, role: exp.expertRole },
// 				system: exp.expertDescription,
// 				max_tokens: null,
// 			});
// 		}

// 		return expert;
// 	}

// 	async #identifySteps(prompt: string): Promise<any> {
// 		let config = {
// 			model: this.model,
// 			system: `Identify at least 1 and at most ${this.MAX_EXPERTS} steps to comprehensively answer the prompt. For each step, provide a clear and concise description of the step and also a description of an expert who can answer the step. Phrase the description for role play. For example, "You are a helpful assistant. You are an expert in the field of robotics technology. You are a robotics engineer." Your answer should be formatted in JSON.`,
// 			expert: { role: "Identify Steps" },
// 		};
// 		let schema = z.object({
// 			steps: z.array(
// 				z.object({
// 					step: z.string(),
// 					expert: z.string(),
// 				})
// 			),
// 		});
// 		let response = await this.structuredAsk(prompt, { schema, config });

// 		return response;
// 	}

// 	async process(prompt: string): Promise<any> {
// 		let { steps } = await this.#identifySteps(prompt);
// 		steps = await Promise.allSettled(
// 			steps.map(async (step: any) => {
// 				step.expert = this.createExpert({ system: step.expert });
// 				step.answer = await step.expert(step.step);
// 				return step;
// 			})
// 		);

// 		let context = steps
// 			.map((step: any) => `Expert: ${step.value.answer}`)
// 			.join("\n\n");

// 		this._messages.push({ role: "user", content: prompt });

// 		let response = await this.llm!.chat.completions.create({
// 			model: this.model!,
// 			messages: [
// 				{
// 					role: "system",
// 					content: `${this.system}

//         Here is some context to help with your answer:
//         ${context}`,
// 				},
// 				...this._messages,
// 			],
// 		});
// 		let output = response.choices[0].message.content;
// 		this._messages.push({ role: "assistant", content: output });

// 		return output;
// 	}
// }
