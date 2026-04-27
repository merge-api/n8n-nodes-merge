import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';

import type {
	MergeToolPack,
	MergeRegisteredUser,
	McpTool,
	McpToolResult,
	McpJsonRpcRequest,
	McpJsonRpcResponse,
} from './types';

const BASE_URL = 'https://ah-api.merge.dev/api/v1';

async function makeAuthenticatedRequest(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
	options: IHttpRequestOptions,
) {
	const credentials = await ctx.getCredentials('mergeAgentHandlerApi');
	const apiKey = credentials.apiKey as string;

	try {
		return await ctx.helpers.httpRequest({
			...options,
			headers: {
				...options.headers,
				Authorization: `Bearer ${apiKey}`,
			},
		});
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject);
	}
}

async function fetchAllPages<T>(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
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
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<MergeToolPack[]> {
	return await fetchAllPages<MergeToolPack>(ctx, `${BASE_URL}/tool-packs/`);
}

export async function getRegisteredUsers(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
	isTest?: boolean,
): Promise<MergeRegisteredUser[]> {
	const qs: Record<string, string> = {};
	if (isTest !== undefined) {
		qs.is_test = String(isTest);
	}
	return await fetchAllPages<MergeRegisteredUser>(ctx, `${BASE_URL}/registered-users`, qs);
}

export async function listMcpTools(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
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
	ctx: IExecuteFunctions,
	toolPackId: string,
	registeredUserId: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<McpToolResult> {
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
		return { text: `Error calling tool "${toolName}": ${(error as Error).message}`, isError: true };
	}

	if (response.error) {
		return { text: `Tool "${toolName}" returned error: ${response.error.message}`, isError: true };
	}

	if (response.result?.isError) {
		const errorText =
			response.result.content?.map((c) => c.text).join('\n') ?? 'Unknown error';
		return { text: `Tool "${toolName}" failed: ${errorText}`, isError: true };
	}

	const content = response.result?.content;
	let text: string;
	if (Array.isArray(content)) {
		text = content
			.filter((c) => c.type === 'text')
			.map((c) => c.text)
			.join('\n');
	} else {
		text = JSON.stringify(response.result);
	}

	// Detect magic link authentication responses
	try {
		const parsed = JSON.parse(text);
		if (parsed && typeof parsed === 'object' && parsed.magic_link_url) {
			return {
				text: parsed.message ?? text,
				magicLinkUrl: parsed.magic_link_url as string,
				requiresAuth: true,
			};
		}
	} catch {
		// Not JSON — normal tool response
	}

	return { text };
}

export async function searchToolsByIntent(
	ctx: IExecuteFunctions,
	toolPackId: string,
	registeredUserId: string,
	intent: string,
): Promise<Array<{ name: string; fully_qualified_name: string; description?: string; relevance_score?: number }>> {
	const response = await makeAuthenticatedRequest(ctx, {
		method: 'POST',
		url: `${BASE_URL}/tool-packs/${toolPackId}/registered-users/${registeredUserId}/search`,
		body: { intent, max_results: 20 },
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
	return (response.tools ?? []) as Array<{ name: string; fully_qualified_name: string; description?: string; relevance_score?: number }>;
}
