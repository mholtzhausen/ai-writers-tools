import { zodResponseFormat } from "openai/helpers/zod"
import zodToJsonSchema from "zod-to-json-schema"
import z from "zod"
import { EventEmitter } from "events"
import OpenAI from "openai"

export function req(obj, keyList, { errorPrefix }) {
	keyList.forEach((key) => {
		if (!obj[key]) {
			throw new Error(
				`${errorPrefix ? errorPrefix : ""}\`${key}\` is required`
			)
		}
	})
}

export class Agent extends EventEmitter {
	name = null;
	description = null;
	outputSchema = null;
	model = null;
	system = null;
	_messages = [];
	tools = [];
	llm = undefined;

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
		} = {},
		llm
	) {
		super()
		req({ ...arguments[0] }, ["model"], {
			errorPrefix: "[Agent.constructor()] ",
		})

		if (outputSchema) {
			if (!(outputSchema instanceof z.ZodType)) {
				throw new Error(
					"outputSchema must be an instance of z.ZodType"
				)
			}
		}

		this.llm = llm
		this.name = name || null
		this.description = description || null
		this.outputSchema = outputSchema || null
		this.model = model || 'gpt-4o-mini'
		this.system = system || null
		this._messages = messages || []
		this.tools = tools || []

		this.emit("ready", this)
	}

	get conversation() {
		let conversation = this.messages.map((message) => {
			return `${message.role}${message.name ? " (" + message.name + ") " : ""
				}: ${message.content}`
		})
		return conversation.join("\n---\n")
	}

	get messages() {
		let messages = [...this._messages]
		if (this.system) {
			messages.unshift({ role: "system", content: this.system })
		}
		return messages
	}

	get toollist() {
		let tools = Array.isArray(this.tools) ? this.tools : []
		return tools
			.filter((tool) => tool.toolDefinition)
			.map((tool) => {
				let def = tool.toolDefinition
				if (def.function.parameters) {
					def.function.parameters = zodToJsonSchema(
						def.function.parameters
					)
				}
				return def
			})
	}

	async process(prompt) {
		let tools = this.toollist || []
		let simpleExpert = this.createExpert({
			system: this.system || "You are a helpful assistant",
			max_tokens: null,
			tools,
		})
		let response = await simpleExpert(prompt)
		return response
	}

	async ask(prompt, config, schema) {
		config = {
			model: "gpt-4o-mini",
			system: "You are a helpful assistant",
			messages: [],
			...(config || {}),
		}
		let { model, system, messages } = config

		if (schema && schema instanceof z.Schema)
			return await this.structuredAsk(prompt, { schema, config })

		let response = await this.llm.chat.completions.create({
			model: model,
			messages: [
				{
					role: "system",
					content: system,
				},
				...messages,
				{
					role: "user",
					content: prompt,
				},
			],
		})
		return response.choices[0].message.content
	}

	static splitObj(obj, defaults) {
		if (!obj && !defaults) return {}
		if (!defaults) return obj
		if (!obj) return defaults

		let keys = Object.keys(defaults)
		let newObj = {}
		let originalObj = { ...obj }
		keys.forEach((key) => {
			newObj[key] = obj[key] || defaults[key]
			delete originalObj[key]
		})

		return { newObj, originalObj }
	}

	static createExpert(config = { system }, schema) {
		let agent = new Agent(config)
		return agent.createExpert(config, schema)
	}

	createExpert(config = { system }, schema) {
		config = {
			model: process.env.DEFAULT_OPENAI_MODEL,
			token_limit: this.EXPERT_NUM_TOKENS,
			// max_tokens: this.EXPERT_NUM_TOKENS,
			tools: [],
			messages: [],
			...(config || {}),
			schemaName: "answer_the_question",
		}
		if (this.system && !config.system) config.system = this.system

		let { newObj: llmOptions, originalObj: fnOptions } = Agent.splitObj(
			config,
			{
				model: process.env.DEFAULT_OPENAI_MODEL,
				tools: [],
				// max_tokens: EXPERT_NUM_TOKENS, // this is disabled so that the expert can decide how many tokens to use but it is requested that they keep it under the limit
				messages: [],
				temperature: null,
			}
		)

		if (llmOptions.tools.length <= 0) delete llmOptions.tools
		if (llmOptions.messages.length <= 0) delete llmOptions.messages
		if (!llmOptions.system) delete llmOptions.system
		if (!llmOptions.max_tokens) delete llmOptions.max_tokens
		if (!llmOptions.temperature) delete llmOptions.temperature

		let expert = async function (prompt) {
			let tokenConstraint = config.token_limit
				? `Keep your answer under ${config.token_limit
				} tokens (approx ${Math.floor(
					config.token_limit * 0.75
				)} words).`
				: ""
			let systemDate = `Current Date and Time: ${new Date().toLocaleString()}`
			llmOptions.messages = [
				{
					role: "system",
					content: `${systemDate}\n${config.system}\n\n${tokenConstraint}`,
				},
				...(Array.isArray(llmOptions.messages)
					? llmOptions.messages
					: []),
				{ role: "user", content: prompt },
			]
			// die({ llmOptions })
			if (!llmOptions.max_tokens) delete llmOptions.max_tokens
			if (schema)
				llmOptions.response_format = zodResponseFormat(
					schema,
					config.schemaName
				)

			this?.emit &&
				this.emit("expert:start", {
					expert: fnOptions.expert || { role: "expert" },
					prompt,
					config: llmOptions,
				})

			let response, out
			if (llmOptions.tools?.length > 0) {
				const runner =
					this.llm.beta.chat.completions.runTools(llmOptions)
				// die({ llmOptions }, 7)
				response = await runner.finalContent()
				out = response
			} else {
				if (schema) {
					response = await this.llm.beta.chat.completions.parse(
						llmOptions
					)
				} else {
					response = await this.llm.chat.completions.create(
						llmOptions
					)
				}
				out =
					response.choices[0].message[schema ? "parsed" : "content"]
			}

			this?.emit &&
				this.emit("expert:end", {
					expert: fnOptions.expert || { role: "expert" },
					prompt,
					out,
					config: llmOptions,
				})
			return out
		}
		expert.getTool = () => {
			/**TODO**/
		}
		return expert.bind(this)
	}

	async structuredAsk(prompt, { schema, config = { system } }) {
		let expert = this.createExpert(config, schema)
		return await expert(prompt)
	}

	static toolDefinition(fn, { name, description, schema }) {
		let toolDefinition = {
			type: "function",
			function: {
				name: name || fn.name,
				description: description || null,
				function: fn,
				parameters: schema || null,
			},
		}
		fn.toolDefinition = toolDefinition
		return fn
	}
}

export class RouterAgent extends Agent {
	agents = [];

	constructor({
		name,
		description,
		outputSchema,
		model,
		system,
		messages,
		tools,
		agents,
	} = {}) {
		super({
			name,
			description,
			outputSchema,
			model,
			system,
			messages,
			tools,
		})
		this.agents = agents || []
	}

	async process(prompt) {
		let agents = this.agents.map(
			(agent) => `${agent.name || "AGENT"}: ${agent.description}`
		)
		const expert = this.createExpert(
			{
				model: "gpt-4o-mini",
				system: `You are a helpful assistant. You are a router agent. You can help route messages to the appropriate agent. Here are the agents you can route to:\n\n${agents.join(
					"\n\n"
				)}`,
			},
			z.object({ agents: z.array(z.string()) })
		)

		const answer = await expert(prompt)
		return answer
	}
	async route(prompt) {
		let { agents } = await this.process(prompt)
		let responses = await Promise.all(
			agents.map(async (agent) => {
				let subAgent = this.agents.find((a) => a.name === agent)
				return await subAgent.process(prompt)
			})
		)

		if (responses.length === 1) return responses[0]

		let combineExpert = this.createExpert({
			system: "You are a helpful assistant. You are a router agent. You can help combine the responses from multiple agents. Multiple responses will be provided to you. You must combine these responses into a single response.",
		})

		let combinedResponse = await combineExpert(responses)
		return combinedResponse
	}
}

export class StepOrchestrator extends Agent {
	async #getOGExpert(prompt, context) {
		let config = {
			model: this.model,
			system: `Try to understand the intent of the user in asking this question - Are they looking for a quick answer, or a more detailed answer? Create a description of an expert who can take some contextual information and provide the user with the anticipated response. Phrase the description for role play. For example, "You are an expert in the field of robotics technology. You are a robotics engineer." 
      Your answer should be formatted in JSON.
      
      Here is some context to help with your answer:
      ${context}`,
		}
		let schema = z.object({
			steps: z.array(
				z.object({
					userIntent: z.string(),
					expertDescription: z.string(),
					expertRole: z.string(),
					expertName: z
						.string()
						.describe(
							'A fictitious pseudonym for the expert that is related to the expert role. For example, "Dr. Robo"'
						),
				})
			),
		})

		let exp = await this.structuredAsk(prompt, { schema, config })
		let expert = null
		if (exp) {
			expert = this.createExpert({
				expert: { name: exp.expertName, role: exp.expertRole },
				system: exp.expertDescription,
				max_tokens: null,
			})
		}

		return expert
	}

	async #identifySteps(prompt) {
		let config = {
			model: this.model,
			system: `Identify at least 1 and at most ${this.MAX_EXPERTS} steps to comprehensively answer the prompt. For each step, provide a clear and concise description of the step and also a description of an expert who can answer the step. Phrase the description for role play. For example, "You are a helpful assistant. You are an expert in the field of robotics technology. You are a robotics engineer." Your answer should be formatted in JSON.`,
			expert: { role: "Identify Steps" },
		}
		let schema = z.object({
			steps: z.array(
				z.object({
					step: z.string(),
					expert: z.string(),
				})
			),
		})
		let response = await this.structuredAsk(prompt, { schema, config })

		return response
		// identify steps in the prompt
	}

	async process(prompt) {
		let { steps } = await this.#identifySteps(prompt)
		steps = await Promise.allSettled(
			steps.map(async (step) => {
				step.expert = this.createExpert({ system: step.expert })
				step.answer = await step.expert(step.step)
				return step
			})
		)

		// let context = steps.map((step) => `Expert: ${step.answer}`).join('\n\n')
		let context = steps
			.map((step) => `Expert: ${step.value.answer}`)
			.join("\n\n")
		// let ogExpert = await this.#getOGExpert(prompt, context)

		this._messages.push({ role: "user", content: prompt })

		let response = await this.llm.chat.completions.create({
			model: this.model,
			messages: [
				{
					role: "system",
					content: `${this.system}
        
        Here is some context to help with your answer:
        ${context}`,
				},
				...this._messages,
			],
		})
		let output = response.choices[0].message.content
		this._messages.push({ role: "assistant", content: output })

		return output
	}
}
