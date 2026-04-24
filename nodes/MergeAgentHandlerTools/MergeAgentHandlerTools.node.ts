import {
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	listMcpTools,
	callMcpTool,
	getToolPacks,
	getRegisteredUsers,
	searchToolsByIntent,
} from './mcpClient';

import type { McpTool } from './types';

export class MergeAgentHandlerTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Merge Agent Handler MCP',
		name: 'mergeAgentHandlerTools',
		icon: { light: 'file:merge.svg', dark: 'file:merge-dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["toolName"] || $parameter["toolNameAgent"] || "MCP Tool"}}',
		description: 'Connect to a Merge Agent Handler Tool Pack and call MCP tools',
		defaults: {
			name: 'Merge Agent Handler MCP',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mergeAgentHandlerApi',
				required: true,
			},
		],
		properties: [
			// ── Tool Pack Selection ──
			{
				displayName: 'Tool Pack Name or ID',
				name: 'toolPackId',
				type: 'options',
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getToolPacks',
				},
			},
			// ── Environment ──
			{
				displayName: 'Environment',
				name: 'environment',
				type: 'options',
				default: 'production',
				description: 'Use test or production registered users',
				options: [
					{ name: 'Production', value: 'production' },
					{ name: 'Test', value: 'test' },
				],
			},

			// ── Registered User Selection ──
			{
				displayName: 'Registered User Name or ID',
				name: 'registeredUserId',
				type: 'options',
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getRegisteredUsers',
					loadOptionsDependsOn: ['environment'],
				},
			},
			// ── Tool Name (standalone mode — dropdown) ──
			{
				displayName: 'Tool Name or ID',
				name: 'toolName',
				type: 'options',
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getToolNames',
					loadOptionsDependsOn: ['toolPackId', 'registeredUserId'],
				},
				displayOptions: {
					hide: { '@tool': [true] },
				},
			},

			// ── Authentication notice (standalone mode only) ──
			{
				displayName:
					'To authenticate a connector, select the corresponding <strong>authenticate_*</strong> tool above, execute the node, '
					+ 'and open the magic link URL from the output. Then refresh the Tool Name dropdown to see the updated list of tools.',
				name: 'authNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					hide: { '@tool': [true] },
				},
			},

			// ── Arguments (standalone mode) ──
			{
				displayName: 'Arguments (JSON)',
				name: 'toolArguments',
				type: 'json',
				default: '{}',
				description: 'JSON object of arguments to pass to the selected tool',
				displayOptions: {
					hide: { '@tool': [true] },
				},
			},

			// ── Tool Name (agent mode — filled by agent via $fromAI) ──
			// $fromAI marks this as an AI-fillable input. n8n's
			// create-node-as-tool scans parameter values for $fromAI calls
			// and builds the tool schema from those. Params without $fromAI
			// (toolPackId, environment, registeredUserId) stay fixed from UI.
			{
				displayName: 'Tool Name or Intent',
				name: 'toolNameAgent',
				type: 'string',
				default: '={{ $fromAI("toolName", "The MCP tool name to call, or a natural-language description of what you want to do", "string") }}',
				description:
					'The MCP tool name or a natural-language description of what you want to do',
				displayOptions: {
					show: { '@tool': [true] },
				},
			},

			// ── Arguments (agent mode — filled by agent via $fromAI) ──
			{
				displayName: 'Arguments (JSON)',
				name: 'toolArgumentsAgent',
				type: 'string',
				default: '={{ $fromAI("toolArguments", "JSON object of arguments to pass to the selected MCP tool", "string") }}',
				description: 'JSON object of arguments to pass to the tool',
				displayOptions: {
					show: { '@tool': [true] },
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getToolPacks(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				try {
					const toolPacks = await getToolPacks(this);
					return toolPacks.map((tp) => {
						const connectors = tp.connectors
							?.map((c) => c.name)
							.join(', ');
						return {
							name: `${tp.name} (${tp.id.slice(0, 8)})`,
							value: tp.id,
							description: connectors
								? `Connectors: ${connectors}`
								: tp.description,
						};
					});
				} catch {
					return [];
				}
			},

			async getRegisteredUsers(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				let isTest: boolean | undefined;
				try {
					const environment = this.getCurrentNodeParameter(
						'environment',
					) as string;
					isTest = environment === 'test';
				} catch {
					// environment not set yet
				}

				const options: INodePropertyOptions[] = [];

				try {
					const users = await getRegisteredUsers(this, isTest);
					for (const u of users) {
						const connectors =
							u.authenticated_connectors?.join(', ');
						const baseName =
							u.origin_user_name ?? u.origin_user_id ?? u.id;
						options.push({
							name: `${baseName} (${u.id.slice(0, 8)})`,
							value: u.id,
							description: connectors
								? `Connectors: ${connectors}`
								: undefined,
						});
					}
				} catch {
					// return what we have
				}

				return options;
			},

			async getToolNames(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const toolPackId = this.getCurrentNodeParameter('toolPackId') as string;
				const registeredUserId = this.getCurrentNodeParameter('registeredUserId') as string;
				if (!toolPackId || !registeredUserId) return [];

				try {
					const tools = await listMcpTools(this, toolPackId, registeredUserId);
					return tools.map((t) => ({
						name: t.name,
						value: t.name,
					}));
				} catch {
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const toolPackId = this.getNodeParameter('toolPackId', i) as string;
				const registeredUserId = this.getNodeParameter(
					'registeredUserId',
					i,
				) as string;

				if (!toolPackId || !registeredUserId) {
					throw new NodeOperationError(
						this.getNode(),
						'Tool Pack and Registered User must be specified',
						{ itemIndex: i },
					);
				}

				// Track fetched tools to avoid redundant API calls
				let allTools: McpTool[] | undefined;

				// Read tool name — check agent param first, fall back to standalone dropdown
				let agentToolName = '';
				try {
					agentToolName = this.getNodeParameter('toolNameAgent', i, '') as string;
				} catch {
					// hidden in standalone mode
				}
				let toolName = '';
				if (!agentToolName) {
					try {
						toolName = this.getNodeParameter('toolName', i, '') as string;
					} catch {
						// hidden in agent mode
					}
				}

				// Read arguments — check agent param first, fall back to standalone
				let toolArgumentsRaw: unknown = '{}';
				try {
					const agentArgs = this.getNodeParameter('toolArgumentsAgent', i, '') as string;
					if (agentArgs && agentArgs !== '{}') {
						toolArgumentsRaw = agentArgs;
					}
				} catch {
					// hidden in standalone mode
				}
				if (toolArgumentsRaw === '{}') {
					try {
						toolArgumentsRaw = this.getNodeParameter('toolArguments', i, '{}');
					} catch {
						// hidden in agent mode
					}
				}

				// ── Agent mode: resolve tool ──
				if (!toolName && agentToolName) {
					if (!allTools) {
						allTools = await listMcpTools(this, toolPackId, registeredUserId);
					}
					const intentLower = agentToolName.toLowerCase();

					// 1) Exact match: agent sent back an exact tool name from a previous search
					const exactMatch = allTools.find(
						(t) => t.name === agentToolName || t.name.toLowerCase() === intentLower,
					);
					if (exactMatch) {
						toolName = exactMatch.name;
					} else {
						// 2) Search API: return up to 20 candidates for the agent to pick from
						let searchResults: Array<{ name: string; fully_qualified_name: string; description?: string; relevance_score?: number }>;
						try {
							searchResults = await searchToolsByIntent(
								this, toolPackId, registeredUserId, agentToolName,
							);
						} catch (searchError) {
							throw new NodeOperationError(
								this.getNode(),
								`Tool search failed: ${(searchError as Error).message}`,
								{ itemIndex: i },
							);
						}

						if (searchResults.length > 0) {
							const toolList = searchResults
								.map((t) => `- ${t.fully_qualified_name}: ${t.description ?? 'No description'}`)
								.join('\n');
							returnData.push({
								json: {
									result: `Found ${searchResults.length} tools matching "${agentToolName}". Pick the most relevant fully_qualified_name and call this tool again with that exact name as toolNameAgent:\n${toolList}`,
								},
								pairedItem: { item: i },
							});
						} else {
							const available = allTools
								.map((t) => t.name)
								.join(', ');
							returnData.push({
								json: {
									result: `No tools found via search for "${agentToolName}". Available tools: ${available}`,
								},
								pairedItem: { item: i },
							});
						}
						continue;
					}
				}

				// No tool name at all: list available tools for discovery
				if (!toolName) {
					if (!allTools) {
						allTools = await listMcpTools(this, toolPackId, registeredUserId);
					}
					const toolList = allTools
						.map((t) => `- ${t.name}: ${t.description ?? 'No description'}`)
						.join('\n');
					returnData.push({
						json: {
							result: `Available MCP tools in this Tool Pack:\n${toolList}\n\nCall this tool again with toolNameAgent set to one of the above tool names and toolArgumentsAgent set to a JSON object of arguments.`,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				// Parse arguments
				let args: Record<string, unknown>;
				try {
					args =
						typeof toolArgumentsRaw === 'string'
							? JSON.parse(toolArgumentsRaw)
							: (toolArgumentsRaw as Record<string, unknown>);
				} catch {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid JSON in Arguments field',
						{ itemIndex: i },
					);
				}

				// Execute the tool
				const mcpResult = await callMcpTool(
					this,
					toolPackId,
					registeredUserId,
					toolName,
					args,
				);

				const output: { result: string; magic_link_url?: string; requires_auth?: boolean } = {
					result: mcpResult.text,
				};
				if (mcpResult.magicLinkUrl) {
					output.magic_link_url = mcpResult.magicLinkUrl;
					output.requires_auth = true;
				}
				returnData.push({ json: output, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
