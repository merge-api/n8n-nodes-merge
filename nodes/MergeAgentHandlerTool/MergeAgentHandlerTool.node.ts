import {
	NodeConnectionTypes,
	NodeOperationError,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import {
	listMcpTools,
	callMcpTool,
	getToolPacks,
	getRegisteredUsers,
} from './mcpClient';
import { createMcpDispatchTool } from './utils';

export class MergeAgentHandlerTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Merge Agent Handler Tool',
		name: 'mergeAgentHandlerTool',
		icon: 'file:merge.svg',
		group: ['transform'],
		version: 1,
		description: 'Connect an AI Agent to a Merge Agent Handler Tool Pack',
		defaults: {
			name: 'Merge Agent Handler',
		},
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
		inputs: [],
		outputs: [{ type: NodeConnectionTypes.AiTool, displayName: 'Tools' }],
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
			{
				displayName:
					'Create or edit <a href="https://ah.merge.dev/tool-packs" target="_blank">Tool Packs</a> in the Merge dashboard',
				name: 'toolPackNotice',
				type: 'notice',
				default: '',
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
			{
				displayName:
					'Create or edit <a href="https://ah.merge.dev/registered-users/test" target="_blank">Registered Users</a> in the Merge dashboard. All connectors must be pre-authenticated in Agent Handler.',
				name: 'testUserNotice',
				type: 'notice',
				default: '',
				displayOptions: { show: { environment: ['test'] } },
			},
			{
				displayName:
					'Create or edit <a href="https://ah.merge.dev/registered-users" target="_blank">Registered Users</a> in the Merge dashboard. All connectors must be pre-authenticated in Agent Handler.',
				name: 'prodUserNotice',
				type: 'notice',
				default: '',
				displayOptions: { show: { environment: ['production'] } },
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
		},
	};

	async supplyData(
		this: ISupplyDataFunctions,
		itemIndex: number,
	): Promise<SupplyData> {
		const node = this.getNode();
		const toolPackId = this.getNodeParameter(
			'toolPackId',
			itemIndex,
		) as string;
		const registeredUserId = this.getNodeParameter(
			'registeredUserId',
			itemIndex,
		) as string;

		// ── Validation ──
		if (!toolPackId || !registeredUserId) {
			throw new NodeOperationError(
				node,
				'Tool Pack and Registered User must be selected',
				{ itemIndex },
			);
		}

		// ── Connect to MCP tools ──
		const mcpTools = await listMcpTools(
			this,
			toolPackId,
			registeredUserId,
		);

		if (!mcpTools.length) {
			throw new NodeOperationError(
				node,
				'No tools found in the selected Tool Pack',
				{
					itemIndex,
					description:
						'Connected successfully but the Tool Pack returned no tools. ' +
						'Verify the Tool Pack has connectors configured in Merge.',
				},
			);
		}

		const supplyDataCtx = this;

		const toolPackName =
			toolPackId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60) ||
			'merge_tool_pack';

		const dispatchTool = createMcpDispatchTool(
			toolPackName,
			mcpTools,
			async (toolName: string, args: Record<string, unknown>) => {
				return await callMcpTool(
					supplyDataCtx,
					toolPackId,
					registeredUserId,
					toolName,
					args,
				);
			},
		);

		return {
			response: dispatchTool,
		};
	}
}
