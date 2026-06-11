import { supplyModel } from '@n8n/ai-node-sdk';
import {
	NodeConnectionTypes,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type IParameterBuilderHint,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import type { MergeGatewayCredential, MergeGatewayModelList } from './types';

const modelBuilderHint =
	'Default to a current flagship (e.g. openai/gpt-5.2, anthropic/claude-opus-4.6, google/gemini-3.1-pro). Avoid the openai/gpt-4o default and other pre-2026 models.';

export class MergeGatewayChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Merge Gateway Chat Model',
		name: 'mergeGatewayChatModel',
		icon: { light: 'file:merge.svg', dark: 'file:merge-dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Use chat models from any provider via Merge Gateway',
		defaults: {
			name: 'Merge Gateway Chat Model',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'mergeGatewayApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					"This node must be connected to an AI chain. <a data-action='openSelectiveNodeCreator' data-action-parameter-creatorview='AI'>Insert one</a>",
				name: 'notice',
				type: 'notice',
				default: '',
				typeOptions: {
					containerClass: 'ndv-connection-hint-notice',
				},
			},
			{
				displayName:
					'If using JSON response format, you must include word "json" in the prompt in your chain or agent. Also, make sure to select latest models released post November 2023.',
				name: 'responseFormatNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						'/options.responseFormat': ['json_object'],
					},
				},
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				description:
					'The model which will generate the completion. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: 'openai/gpt-4o',
				// n8n-workflow renamed the hint key from 'message' to
				// 'propertyHint' in 2.21.0; ship both so the AI builder reads
				// it on either side of the rename (unknown keys are ignored)
				builderHint: {
					message: modelBuilderHint,
					propertyHint: modelBuilderHint,
				} as unknown as IParameterBuilderHint,
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. Use -1 for the model default.',
						type: 'number',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						default: 'text',
						type: 'options',
						options: [
							{
								name: 'Text',
								value: 'text',
								description: 'Regular text response',
							},
							{
								name: 'JSON',
								value: 'json_object',
								description:
									'Enables JSON mode, which should guarantee the message the model generates is valid JSON',
							},
						],
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 360000,
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
						type: 'number',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<MergeGatewayCredential>('mergeGatewayApi');
				const baseUrl = credentials.url.replace(/\/$/, '');

				const options: INodePropertyOptions[] = [];
				let cursor: string | undefined;

				// The /models endpoint is cursor-paginated (50 per page by
				// default); the page cap is a safety net against a
				// never-ending cursor
				for (let page = 0; page < 20; page++) {
					const response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'mergeGatewayApi',
						{
							method: 'GET',
							url: `${baseUrl}/models`,
							qs: cursor ? { cursor } : {},
							json: true,
						},
					)) as MergeGatewayModelList;

					for (const model of response.data ?? []) {
						if (model.availability_status && model.availability_status !== 'available') {
							continue;
						}
						// Skip models that cannot produce text (e.g.
						// embedding-only); models with unknown capabilities
						// are kept
						const vendorCapabilities = Object.values(model.vendors ?? {}).flatMap(
							(vendor) => vendor?.capabilities?.output ?? [],
						);
						if (vendorCapabilities.length > 0 && !vendorCapabilities.includes('text')) {
							continue;
						}
						options.push({
							name: model.display_name || model.model,
							value: model.model,
						});
					}

					if (!response.has_more || !response.next_cursor) {
						break;
					}
					cursor = response.next_cursor;
				}

				options.sort((a, b) => a.name.localeCompare(b.name));
				return options;
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials<MergeGatewayCredential>('mergeGatewayApi');

		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			frequencyPenalty?: number;
			maxTokens?: number;
			maxRetries?: number;
			timeout?: number;
			presencePenalty?: number;
			temperature?: number;
			topP?: number;
			responseFormat?: 'text' | 'json_object';
		};

		// Merge Gateway exposes an OpenAI-compatible API under /openai
		return supplyModel(this, {
			type: 'openai',
			baseUrl: `${credentials.url.replace(/\/$/, '')}/openai`,
			apiKey: credentials.apiKey,
			model: modelName,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
			temperature: options.temperature,
			topP: options.topP,
			maxTokens: options.maxTokens === -1 ? undefined : options.maxTokens,
			timeout: options.timeout,
			maxRetries: options.maxRetries ?? 2,
			additionalParams: options.responseFormat
				? { response_format: { type: options.responseFormat } }
				: undefined,
		});
	}
}
