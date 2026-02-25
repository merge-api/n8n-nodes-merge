import { NodeOperationError } from 'n8n-workflow';
import type {
	ISupplyDataFunctions,
	ILoadOptionsFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

import type {
	MergeToolPack,
	MergeRegisteredUser,
	McpTool,
	McpJsonRpcRequest,
	McpJsonRpcResponse,
} from './types';

const BASE_URL = 'https://ah-api.merge.dev/api/v1';

async function makeAuthenticatedRequest(
	ctx: ISupplyDataFunctions | ILoadOptionsFunctions,
	options: IHttpRequestOptions,
) {
	const credentials = await ctx.getCredentials('mergeAgentHandlerApi');
	const apiKey = credentials.apiKey as string;

	return await ctx.helpers.httpRequest({
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${apiKey}`,
		},
	});
}

async function fetchAllPages<T>(
	ctx: ISupplyDataFunctions | ILoadOptionsFunctions,
	url: string,
	qs?: Record<string, string>,
): Promise<T[]> {
	const all: T[] = [];
	let page = 1;
	while (true) {
		const response = await makeAuthenticatedRequest(ctx, {
			method: 'GET',
			url,
			qs: { ...qs, page: String(page) },
			json: true,
		});
		if (Array.isArray(response)) {
			return response;
		}
		const results = (response.results as T[]) ?? [];
		all.push(...results);
		if (!response.next) {
			break;
		}
		page++;
	}
	return all;
}

export async function getToolPacks(
	ctx: ISupplyDataFunctions | ILoadOptionsFunctions,
): Promise<MergeToolPack[]> {
	return await fetchAllPages<MergeToolPack>(ctx, `${BASE_URL}/tool-packs/`);
}

export async function getRegisteredUsers(
	ctx: ISupplyDataFunctions | ILoadOptionsFunctions,
	isTest?: boolean,
): Promise<MergeRegisteredUser[]> {
	const qs: Record<string, string> = {};
	if (isTest !== undefined) {
		qs.is_test = String(isTest);
	}
	return await fetchAllPages<MergeRegisteredUser>(ctx, `${BASE_URL}/registered-users`, qs);
}

export async function listMcpTools(
	ctx: ISupplyDataFunctions,
	toolPackId: string,
	registeredUserId: string,
): Promise<McpTool[]> {
	const mcpUrl = `${BASE_URL}/tool-packs/${toolPackId}/registered-users/${registeredUserId}/mcp`;

	const rpcRequest: McpJsonRpcRequest = {
		jsonrpc: '2.0',
		id: 1,
		method: 'tools/list',
		params: {},
	};

	const response: McpJsonRpcResponse = await makeAuthenticatedRequest(ctx, {
		method: 'POST',
		url: mcpUrl,
		body: rpcRequest,
		json: true,
		headers: {
			'Content-Type': 'application/json',
			'X-Source': 'n8n-community-node',
		},
	});

	if (response.error) {
		throw new NodeOperationError(
			ctx.getNode(),
			`MCP tools/list failed: ${response.error.message}`,
			{ description: `Error code: ${response.error.code}` },
		);
	}

	return response.result?.tools ?? [];
}

export async function callMcpTool(
	ctx: ISupplyDataFunctions,
	toolPackId: string,
	registeredUserId: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<string> {
	const mcpUrl = `${BASE_URL}/tool-packs/${toolPackId}/registered-users/${registeredUserId}/mcp`;

	const rpcRequest: McpJsonRpcRequest = {
		jsonrpc: '2.0',
		id: 1,
		method: 'tools/call',
		params: {
			name: toolName,
			arguments: { input: args },
		},
	};

	let response: McpJsonRpcResponse;
	try {
		response = await makeAuthenticatedRequest(ctx, {
			method: 'POST',
			url: mcpUrl,
			body: rpcRequest,
			json: true,
			headers: {
				'Content-Type': 'application/json',
				'X-Source': 'n8n-community-node',
			},
		});
	} catch (error) {
		return `Error calling tool "${toolName}": ${(error as Error).message}`;
	}

	if (response.error) {
		return `Tool "${toolName}" returned error: ${response.error.message}`;
	}

	if (response.result?.isError) {
		const errorText =
			response.result.content?.map((c) => c.text).join('\n') ?? 'Unknown error';
		return `Tool "${toolName}" failed: ${errorText}`;
	}

	const content = response.result?.content;
	if (Array.isArray(content)) {
		return content
			.filter((c) => c.type === 'text')
			.map((c) => c.text)
			.join('\n');
	}

	return JSON.stringify(response.result);
}
