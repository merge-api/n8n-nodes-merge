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
	createRegisteredUser,
	getRegisteredUser,
	listRegisteredUsers,
	updateRegisteredUser,
	deleteRegisteredUser,
	createToolPack,
	getToolPack,
	listToolPacks,
	updateToolPack,
	deleteToolPack,
	listConnectors,
	getConnector,
	createLinkToken,
	deleteCredential,
	listAuditLog,
	searchTools,
} from './apiClient';

import type { ToolPackConnectorWrite } from './types';

export class MergeAgentHandler implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Merge Agent Handler',
		name: 'mergeAgentHandler',
		icon: 'file:merge.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage Merge Agent Handler resources — registered users, tool packs, connectors, and more',
		defaults: {
			name: 'Merge Agent Handler',
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
			// ── Resource ──
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'registeredUser',
				options: [
					{ name: 'Audit Log', value: 'auditLog' },
					{ name: 'Connector', value: 'connector' },
					{ name: 'Credential', value: 'credential' },
					{ name: 'Link Token', value: 'linkToken' },
					{ name: 'Registered User', value: 'registeredUser' },
					{ name: 'Tool Pack', value: 'toolPack' },
					{ name: 'Tool Search', value: 'toolSearch' },
				],
			},

			// ── Operations per resource ──

			// Registered User
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'create',
				displayOptions: { show: { resource: ['registeredUser'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create registered user' },
					{ name: 'Delete', value: 'delete', action: 'Delete registered user' },
					{ name: 'Get', value: 'get', action: 'Get registered user' },
					{ name: 'List', value: 'list', action: 'List registered users' },
					{ name: 'Update', value: 'update', action: 'Update registered user' },
				],
			},

			// Tool Pack
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'create',
				displayOptions: { show: { resource: ['toolPack'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create tool pack' },
					{ name: 'Delete', value: 'delete', action: 'Delete tool pack' },
					{ name: 'Get', value: 'get', action: 'Get tool pack' },
					{ name: 'List', value: 'list', action: 'List tool packs' },
					{ name: 'Update', value: 'update', action: 'Update tool pack' },
				],
			},

			// Connector
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'list',
				displayOptions: { show: { resource: ['connector'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get connector' },
					{ name: 'List', value: 'list', action: 'List connectors' },
				],
			},

			// Link Token
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'create',
				displayOptions: { show: { resource: ['linkToken'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Generate link token' },
				],
			},

			// Credential
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'delete',
				displayOptions: { show: { resource: ['credential'] } },
				options: [
					{ name: 'Delete', value: 'delete', action: 'Delete credential' },
				],
			},

			// Audit Log
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'list',
				displayOptions: { show: { resource: ['auditLog'] } },
				options: [
					{ name: 'List', value: 'list', action: 'List audit log events' },
				],
			},

			// Tool Search
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'search',
				displayOptions: { show: { resource: ['toolSearch'] } },
				options: [
					{ name: 'Search', value: 'search', action: 'Search for tools' },
				],
			},

			// ══════════════════════════════════════════
			// Registered User fields
			// ══════════════════════════════════════════

			// Registered User ID (for get, update, delete)
			{
				displayName: 'Registered User Name or ID',
				name: 'registeredUserId',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getRegisteredUsers',
				},
				displayOptions: {
					show: {
						resource: ['registeredUser'],
						operation: ['get', 'update', 'delete'],
					},
				},
			},

			// Create fields
			{
				displayName: 'Origin User ID',
				name: 'originUserId',
				type: 'string',
				required: true,
				default: '',
				description: 'Unique external user identifier in your system',
				displayOptions: {
					show: { resource: ['registeredUser'], operation: ['create'] },
				},
			},
			{
				displayName: 'Origin User Name',
				name: 'originUserName',
				type: 'string',
				required: true,
				default: '',
				description: 'User display name',
				displayOptions: {
					show: { resource: ['registeredUser'], operation: ['create'] },
				},
			},
			{
				displayName: 'User Type',
				name: 'userType',
				type: 'options',
				default: 'HUMAN',
				options: [
					{ name: 'Human', value: 'HUMAN' },
					{ name: 'System', value: 'SYSTEM' },
				],
				displayOptions: {
					show: { resource: ['registeredUser'], operation: ['create'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['registeredUser'], operation: ['create'] },
				},
				options: [
					{
						displayName: 'Company ID',
						name: 'originCompanyId',
						type: 'string',
						default: '',
						description: 'Company identifier for credential sharing',
					},
					{
						displayName: 'Company Name',
						name: 'originCompanyName',
						type: 'string',
						default: '',
						description: 'Company name for credential sharing',
					},
				],
			},

			// Update fields
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['registeredUser'], operation: ['update'] },
				},
				options: [
					{
						displayName: 'Origin User Name',
						name: 'originUserName',
						type: 'string',
						default: '',
						description: 'Updated user display name',
					},
					{
						displayName: 'User Type',
						name: 'userType',
						type: 'options',
						default: 'HUMAN',
						options: [
							{ name: 'Human', value: 'HUMAN' },
							{ name: 'System', value: 'SYSTEM' },
						],
					},
					{
						displayName: 'Company ID',
						name: 'originCompanyId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Company Name',
						name: 'originCompanyName',
						type: 'string',
						default: '',
					},
				],
			},

			// List filters
			{
				displayName: 'Is Test',
				name: 'isTest',
				type: 'boolean',
				default: false,
				description: 'Whether to filter for test users only',
				displayOptions: {
					show: { resource: ['registeredUser'], operation: ['list'] },
				},
			},

			// ══════════════════════════════════════════
			// Tool Pack fields
			// ══════════════════════════════════════════

			// Tool Pack ID (for get, update, delete)
			{
				displayName: 'Tool Pack Name or ID',
				name: 'toolPackId',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getToolPacks',
				},
				displayOptions: {
					show: {
						resource: ['toolPack'],
						operation: ['get', 'update', 'delete'],
					},
				},
			},

			// Create fields
			{
				displayName: 'Name',
				name: 'toolPackName',
				type: 'string',
				required: true,
				default: '',
				description: 'Tool pack display name',
				displayOptions: {
					show: { resource: ['toolPack'], operation: ['create'] },
				},
			},
			{
				displayName: 'Description',
				name: 'toolPackDescription',
				type: 'string',
				required: true,
				default: '',
				description: 'Tool pack description',
				displayOptions: {
					show: { resource: ['toolPack'], operation: ['create'] },
				},
			},
			{
				displayName: 'Connectors (JSON)',
				name: 'toolPackConnectors',
				type: 'json',
				required: true,
				default: '[\n  {\n    "connector_id": "",\n    "auth_scope": "INDIVIDUAL",\n    "tool_names": []\n  }\n]',
				description: 'JSON array of connector configurations. Each object needs: connector_id (required), auth_scope (INDIVIDUAL/SHARED/ORGANIZATION), tool_names (array of tool name strings)',
				displayOptions: {
					show: { resource: ['toolPack'], operation: ['create'] },
				},
			},

			// Update fields
			{
				displayName: 'Update Fields',
				name: 'toolPackUpdateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['toolPack'], operation: ['update'] },
				},
				options: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Connectors (JSON)',
						name: 'connectors',
						type: 'json',
						default: '[]',
						description: 'JSON array of connector configurations',
					},
				],
			},

			// ══════════════════════════════════════════
			// Connector fields
			// ══════════════════════════════════════════
			{
				displayName: 'Connector Slug',
				name: 'connectorSlug',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify a slug using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getConnectors',
				},
				displayOptions: {
					show: { resource: ['connector'], operation: ['get'] },
				},
			},

			// ══════════════════════════════════════════
			// Link Token fields
			// ══════════════════════════════════════════
			{
				displayName: 'Registered User Name or ID',
				name: 'linkTokenRegisteredUserId',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getRegisteredUsers',
				},
				displayOptions: {
					show: { resource: ['linkToken'], operation: ['create'] },
				},
			},
			{
				displayName: 'Connector',
				name: 'linkTokenConnector',
				type: 'options',
				required: true,
				default: '',
				description: 'Connector slug to generate a link token for',
				typeOptions: {
					loadOptionsMethod: 'getConnectors',
				},
				displayOptions: {
					show: { resource: ['linkToken'], operation: ['create'] },
				},
			},

			// ══════════════════════════════════════════
			// Credential fields
			// ══════════════════════════════════════════
			{
				displayName: 'Registered User Name or ID',
				name: 'credentialRegisteredUserId',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getRegisteredUsers',
				},
				displayOptions: {
					show: { resource: ['credential'], operation: ['delete'] },
				},
			},
			{
				displayName: 'Connector Slug',
				name: 'credentialConnectorSlug',
				type: 'options',
				required: true,
				default: '',
				description: 'Connector to delete credentials for',
				typeOptions: {
					loadOptionsMethod: 'getConnectors',
				},
				displayOptions: {
					show: { resource: ['credential'], operation: ['delete'] },
				},
			},

			// ══════════════════════════════════════════
			// Audit Log fields
			// ══════════════════════════════════════════
			{
				displayName: 'Filters',
				name: 'auditLogFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { resource: ['auditLog'], operation: ['list'] },
				},
				options: [
					{
						displayName: 'Created After',
						name: 'createdAfter',
						type: 'dateTime',
						default: '',
						description: 'Filter events on or after this date',
					},
					{
						displayName: 'Created Before',
						name: 'createdBefore',
						type: 'dateTime',
						default: '',
						description: 'Filter events on or before this date',
					},
					{
						displayName: 'Event Type',
						name: 'eventType',
						type: 'options',
						default: '',
						options: [
							{ name: 'Connector Deleted', value: 'CONNECTOR_DELETED' },
							{ name: 'Connector Imported', value: 'CONNECTOR_IMPORTED' },
							{ name: 'Connector Updated', value: 'CONNECTOR_UPDATED' },
							{ name: 'Credential Deleted', value: 'CREDENTIAL_DELETED' },
							{ name: 'Registered User Created', value: 'REGISTERED_USER_CREATED' },
							{ name: 'Registered User Deleted', value: 'REGISTERED_USER_DELETED' },
							{ name: 'Tool Pack Created', value: 'TOOL_PACK_CREATED' },
							{ name: 'Tool Pack Deleted', value: 'TOOL_PACK_DELETED' },
							{ name: 'Tool Pack Updated', value: 'TOOL_PACK_UPDATED' },
							{ name: 'User Created', value: 'USER_CREATED' },
							{ name: 'User Invited', value: 'USER_INVITED' },
						],
					},
					{
						displayName: 'User ID',
						name: 'userId',
						type: 'string',
						default: '',
						description: 'Filter by user ID',
					},
				],
			},


			// ══════════════════════════════════════════
			// Return All / Limit (shared across list operations)
			// ══════════════════════════════════════════
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: {
					show: {
						operation: ['list'],
						resource: ['registeredUser', 'toolPack', 'connector', 'auditLog'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Max number of results to return',
				typeOptions: { minValue: 1 },
				displayOptions: {
					show: {
						operation: ['list'],
						resource: ['registeredUser', 'toolPack', 'connector', 'auditLog'],
						returnAll: [false],
					},
				},
			},

			// ══════════════════════════════════════════
			// Tool Search fields
			// ══════════════════════════════════════════
			{
				displayName: 'Tool Pack Name or ID',
				name: 'searchToolPackId',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getToolPacks',
				},
				displayOptions: {
					show: { resource: ['toolSearch'], operation: ['search'] },
				},
			},
			{
				displayName: 'Registered User Name or ID',
				name: 'searchRegisteredUserId',
				type: 'options',
				required: true,
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getRegisteredUsers',
				},
				displayOptions: {
					show: { resource: ['toolSearch'], operation: ['search'] },
				},
			},
			{
				displayName: 'Intent',
				name: 'searchIntent',
				type: 'string',
				required: true,
				default: '',
				description: "User's objective — what they want to accomplish",
				displayOptions: {
					show: { resource: ['toolSearch'], operation: ['search'] },
				},
			},
			{
				displayName: 'Additional Options',
				name: 'searchOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['toolSearch'], operation: ['search'] },
				},
				options: [
					{
						displayName: 'Connector Slugs',
						name: 'connectorSlugs',
						type: 'string',
						default: '',
						description: 'Comma-separated list of connector slugs to filter by',
					},
					{
						displayName: 'Max Results',
						name: 'maxResults',
						type: 'number',
						default: 10,
						description: 'Maximum number of results (1-50)',
						typeOptions: { minValue: 1, maxValue: 50 },
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getRegisteredUsers(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				try {
					const users = await listRegisteredUsers(this);
					return users.map((u) => {
						const baseName = u.origin_user_name ?? u.origin_user_id ?? u.id;
						return {
							name: `${baseName} (${u.id.slice(0, 8)})`,
							value: u.id,
						};
					});
				} catch {
					return [];
				}
			},

			async getToolPacks(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				try {
					const packs = await listToolPacks(this);
					return packs.map((tp) => ({
						name: `${tp.name} (${tp.id.slice(0, 8)})`,
						value: tp.id,
					}));
				} catch {
					return [];
				}
			},

			async getConnectors(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				try {
					const connectors = await listConnectors(this);
					return connectors.map((c) => ({
						name: c.name,
						value: c.slug,
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
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			try {
				if (resource === 'registeredUser') {
					if (operation === 'create') {
						const originUserId = this.getNodeParameter('originUserId', i) as string;
						const originUserName = this.getNodeParameter('originUserName', i) as string;
						const userType = this.getNodeParameter('userType', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as {
							originCompanyId?: string;
							originCompanyName?: string;
						};

						const body: Record<string, unknown> = {
							origin_user_id: originUserId,
							origin_user_name: originUserName,
							user_type: userType,
						};

						if (additionalFields.originCompanyId || additionalFields.originCompanyName) {
							body.shared_credential_group = {
								origin_company_id: additionalFields.originCompanyId || undefined,
								origin_company_name: additionalFields.originCompanyName || undefined,
							};
						}

						const result = await createRegisteredUser(this, body as any);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const id = this.getNodeParameter('registeredUserId', i) as string;
						const result = await getRegisteredUser(this, id);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const isTest = this.getNodeParameter('isTest', i) as boolean;
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let users = await listRegisteredUsers(this, isTest || undefined);
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							users = users.slice(0, limit);
						}
						for (const u of users) {
							returnData.push({ json: u as any, pairedItem: { item: i } });
						}
					} else if (operation === 'update') {
						const id = this.getNodeParameter('registeredUserId', i) as string;
						const updateFields = this.getNodeParameter('updateFields', i) as {
							originUserName?: string;
							userType?: string;
							originCompanyId?: string;
							originCompanyName?: string;
						};

						const body: Record<string, unknown> = {};
						if (updateFields.originUserName) {
							body.origin_user_name = updateFields.originUserName;
						}
						if (updateFields.userType) {
							body.user_type = updateFields.userType;
						}
						if (updateFields.originCompanyId || updateFields.originCompanyName) {
							body.shared_credential_group = {
								origin_company_id: updateFields.originCompanyId || undefined,
								origin_company_name: updateFields.originCompanyName || undefined,
							};
						}

						const result = await updateRegisteredUser(this, id, body as any);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const id = this.getNodeParameter('registeredUserId', i) as string;
						await deleteRegisteredUser(this, id);
						returnData.push({ json: { deleted: true }, pairedItem: { item: i } });
					}
				} else if (resource === 'toolPack') {
					if (operation === 'create') {
						const name = this.getNodeParameter('toolPackName', i) as string;
						const description = this.getNodeParameter('toolPackDescription', i) as string;
						const connectorsRaw = this.getNodeParameter('toolPackConnectors', i);
						let connectors: ToolPackConnectorWrite[];
						try {
							connectors = typeof connectorsRaw === 'string'
								? JSON.parse(connectorsRaw)
								: connectorsRaw as ToolPackConnectorWrite[];
						} catch {
							throw new NodeOperationError(
								this.getNode(),
								'Invalid JSON in Connectors field',
								{ itemIndex: i },
							);
						}

						const result = await createToolPack(this, { name, description, connectors });
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const id = this.getNodeParameter('toolPackId', i) as string;
						const result = await getToolPack(this, id);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let packs = await listToolPacks(this);
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							packs = packs.slice(0, limit);
						}
						for (const p of packs) {
							returnData.push({ json: p as any, pairedItem: { item: i } });
						}
					} else if (operation === 'update') {
						const id = this.getNodeParameter('toolPackId', i) as string;
						const updateFields = this.getNodeParameter('toolPackUpdateFields', i) as {
							name?: string;
							description?: string;
							connectors?: string;
						};

						const body: Record<string, unknown> = {};
						if (updateFields.name) body.name = updateFields.name;
						if (updateFields.description) body.description = updateFields.description;
						if (updateFields.connectors) {
							try {
								body.connectors = typeof updateFields.connectors === 'string'
									? JSON.parse(updateFields.connectors)
									: updateFields.connectors;
							} catch {
								throw new NodeOperationError(
									this.getNode(),
									'Invalid JSON in Connectors field',
									{ itemIndex: i },
								);
							}
						}

						const result = await updateToolPack(this, id, body as any);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const id = this.getNodeParameter('toolPackId', i) as string;
						await deleteToolPack(this, id);
						returnData.push({ json: { deleted: true }, pairedItem: { item: i } });
					}
				} else if (resource === 'connector') {
					if (operation === 'get') {
						const slug = this.getNodeParameter('connectorSlug', i) as string;
						const result = await getConnector(this, slug);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let connectors = await listConnectors(this);
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							connectors = connectors.slice(0, limit);
						}
						for (const c of connectors) {
							returnData.push({ json: c as any, pairedItem: { item: i } });
						}
					}
				} else if (resource === 'linkToken') {
					if (operation === 'create') {
						const registeredUserId = this.getNodeParameter('linkTokenRegisteredUserId', i) as string;
						const connector = this.getNodeParameter('linkTokenConnector', i) as string;
						const result = await createLinkToken(this, registeredUserId, connector);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					}
				} else if (resource === 'credential') {
					if (operation === 'delete') {
						const registeredUserId = this.getNodeParameter('credentialRegisteredUserId', i) as string;
						const connectorSlug = this.getNodeParameter('credentialConnectorSlug', i) as string;
						await deleteCredential(this, registeredUserId, connectorSlug);
						returnData.push({ json: { deleted: true }, pairedItem: { item: i } });
					}
				} else if (resource === 'auditLog') {
					if (operation === 'list') {
						const filters = this.getNodeParameter('auditLogFilters', i) as {
							createdAfter?: string;
							createdBefore?: string;
							eventType?: string;
							userId?: string;
						};

						const qs: Record<string, string> = {};
						if (filters.createdAfter) qs.created_after = filters.createdAfter;
						if (filters.createdBefore) qs.created_before = filters.createdBefore;
						if (filters.eventType) qs.event_type = filters.eventType;
						if (filters.userId) qs.user_id = filters.userId;

						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let events = await listAuditLog(this, qs);
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							events = events.slice(0, limit);
						}
						for (const e of events) {
							returnData.push({ json: e as any, pairedItem: { item: i } });
						}
					}
				} else if (resource === 'toolSearch') {
					if (operation === 'search') {
						const toolPackId = this.getNodeParameter('searchToolPackId', i) as string;
						const registeredUserId = this.getNodeParameter('searchRegisteredUserId', i) as string;
						const intent = this.getNodeParameter('searchIntent', i) as string;
						const options = this.getNodeParameter('searchOptions', i) as {
							connectorSlugs?: string;
							maxResults?: number;
						};

						const slugs = options.connectorSlugs
							? options.connectorSlugs.split(',').map((s) => s.trim()).filter(Boolean)
							: undefined;

						const result = await searchTools(
							this,
							toolPackId,
							registeredUserId,
							intent,
							slugs,
							options.maxResults,
						);
						returnData.push({ json: result as any, pairedItem: { item: i } });
					}
				}
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
