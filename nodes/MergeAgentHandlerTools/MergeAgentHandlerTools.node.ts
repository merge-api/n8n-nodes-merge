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
} from './mcpClient';

import type { McpTool } from './types';

/**
 * Find the best matching MCP tool for the agent's requested name.
 * Tries exact match, case-insensitive, then keyword overlap scoring.
 */
export function findBestToolMatch(query: string, tools: McpTool[]): McpTool | undefined {
	if (!query || tools.length === 0) return undefined;

	// Exact match
	const exact = tools.find((t) => t.name === query);
	if (exact) return exact;

	// Case-insensitive exact match
	const lower = query.toLowerCase();
	const ci = tools.find((t) => t.name.toLowerCase() === lower);
	if (ci) return ci;

	// Normalize: replace underscores/hyphens with spaces, lowercase
	const normalize = (s: string) => s.toLowerCase().replace(/[_\-]+/g, ' ');
	const queryNorm = normalize(query);
	const queryWords = queryNorm.split(/\s+/).filter((w) => w.length > 1);

	let bestScore = 0;
	let bestTool: McpTool | undefined;

	for (const tool of tools) {
		const nameNorm = normalize(tool.name);
		const descNorm = normalize(tool.description ?? '');
		const combined = `${nameNorm} ${descNorm}`;

		let score = 0;
		for (const word of queryWords) {
			if (combined.includes(word)) score++;
		}

		// Bonus for substring match in the tool name
		if (nameNorm.includes(queryNorm)) score += queryWords.length * 2;

		if (score > bestScore) {
			bestScore = score;
			bestTool = tool;
		}
	}

	return bestScore > 0 ? bestTool : undefined;
}

export class MergeAgentHandlerTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Merge Agent Handler MCP',
		name: 'mergeAgentHandlerTools',
		icon: 'file:merge.svg',
		group: ['transform'],
		version: 1,
		description: 'Connect to a Merge Agent Handler Tool Pack and call MCP tools',
		defaults: {
			name: 'Merge Agent Handler MCP',
		},
		usableAsTool: true,
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
				Tools: ['Other Tools'],
			},
			alias: ['merge', 'agent handler', 'tool pack', 'mcp'],
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.ah.merge.dev/Overview/Agent-Handler-intro',
					},
				],
			},
		},
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
					'The Merge Tool Pack to connect to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
				description: 'Whether to use test or production registered users',
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
					'The registered user to run tools as. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
					'The MCP tool to execute. Choose from the list, or specify a name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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

			// ── Tool Name (agent mode — free text, filled by agent) ──
			{
				displayName: 'Tool Name',
				name: 'toolNameAgent',
				type: 'string',
				default: '',
				description:
					'The MCP tool name to call. Leave empty to auto-discover available tools.',
				displayOptions: {
					show: { '@tool': [true] },
				},
			},

			// ── Arguments (agent mode — free text, filled by agent) ──
			{
				displayName: 'Arguments (JSON)',
				name: 'toolArgumentsAgent',
				type: 'string',
				default: '{}',
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

			// Read tool name — check agent param first (freshest value),
			// fall back to standalone dropdown
			let agentToolName = '';
			try {
				agentToolName = this.getNodeParameter(
					'toolNameAgent',
					i,
					'',
				) as string;
			} catch {
				// hidden in standalone mode
			}
			let toolName = '';
			if (!agentToolName) {
				try {
					toolName = this.getNodeParameter(
						'toolName',
						i,
						'',
					) as string;
				} catch {
					// hidden in agent mode
				}
			}

			// Read arguments — check agent param first, fall back to standalone
			let toolArgumentsRaw: unknown = '{}';
			try {
				const agentArgs = this.getNodeParameter(
					'toolArgumentsAgent',
					i,
					'',
				) as string;
				if (agentArgs && agentArgs !== '{}') {
					toolArgumentsRaw = agentArgs;
				}
			} catch {
				// hidden in standalone mode
			}
			if (toolArgumentsRaw === '{}') {
				try {
					toolArgumentsRaw = this.getNodeParameter(
						'toolArguments',
						i,
						'{}',
					);
				} catch {
					// hidden in agent mode
				}
			}

			// Agent mode: fuzzy-match the agent's tool name against actual MCP tools
			if (!toolName && agentToolName) {
				const tools = await listMcpTools(
					this,
					toolPackId,
					registeredUserId,
				);
				const matched = findBestToolMatch(agentToolName, tools);
				if (matched) {
					toolName = matched.name;
				} else {
					const available = tools
						.map((t) => t.name)
						.join(', ');
					returnData.push({
						json: {
							result: `No tool matching "${agentToolName}" found. Available tools: ${available}`,
						},
					});
					continue;
				}
			}

			// No tool name at all: list available tools for discovery
			if (!toolName) {
				const tools = await listMcpTools(
					this,
					toolPackId,
					registeredUserId,
				);
				const toolList = tools
					.map(
						(t) =>
							`- ${t.name}: ${t.description ?? 'No description'}`,
					)
					.join('\n');
				returnData.push({
					json: {
						result: `Available MCP tools in this Tool Pack:\n${toolList}\n\nCall this tool again with toolNameAgent set to one of the above tool names and toolArgumentsAgent set to a JSON object of arguments.`,
					},
				});
				continue;
			}

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
			returnData.push({ json: output });
		}

		return [returnData];
	}
}
