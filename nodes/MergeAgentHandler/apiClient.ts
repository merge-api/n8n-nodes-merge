import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

import type {
	RegisteredUserRequest,
	RegisteredUserResponse,
	ToolPackRequest,
	ToolPackResponse,
	ConnectorResponse,
	LinkTokenResponse,
	AuditLogEvent,
	ToolSearchResult,
} from './types';

const BASE_URL = 'https://ah-api.merge.dev/api/v1';

type Context = IExecuteFunctions | ILoadOptionsFunctions;

async function makeAuthenticatedRequest(
	ctx: Context,
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
	ctx: Context,
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

// ── Registered Users ──

export async function createRegisteredUser(
	ctx: IExecuteFunctions,
	data: RegisteredUserRequest,
): Promise<RegisteredUserResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'POST',
		url: `${BASE_URL}/registered-users`,
		body: data,
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function getRegisteredUser(
	ctx: IExecuteFunctions,
	id: string,
): Promise<RegisteredUserResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'GET',
		url: `${BASE_URL}/registered-users/${id}`,
		json: true,
	});
}

export async function listRegisteredUsers(
	ctx: Context,
	isTest?: boolean,
): Promise<RegisteredUserResponse[]> {
	const qs: Record<string, string> = {};
	if (isTest !== undefined) {
		qs.is_test = String(isTest);
	}
	return await fetchAllPages<RegisteredUserResponse>(ctx, `${BASE_URL}/registered-users`, qs);
}

export async function updateRegisteredUser(
	ctx: IExecuteFunctions,
	id: string,
	data: Partial<RegisteredUserRequest>,
): Promise<RegisteredUserResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'PATCH',
		url: `${BASE_URL}/registered-users/${id}`,
		body: data,
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function deleteRegisteredUser(
	ctx: IExecuteFunctions,
	id: string,
): Promise<void> {
	await makeAuthenticatedRequest(ctx, {
		method: 'DELETE',
		url: `${BASE_URL}/registered-users/${id}`,
	});
}

// ── Tool Packs ──

export async function createToolPack(
	ctx: IExecuteFunctions,
	data: ToolPackRequest,
): Promise<ToolPackResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'POST',
		url: `${BASE_URL}/tool-packs/`,
		body: data,
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function getToolPack(
	ctx: IExecuteFunctions,
	id: string,
): Promise<ToolPackResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'GET',
		url: `${BASE_URL}/tool-packs/${id}/`,
		json: true,
	});
}

export async function listToolPacks(
	ctx: Context,
): Promise<ToolPackResponse[]> {
	return await fetchAllPages<ToolPackResponse>(ctx, `${BASE_URL}/tool-packs/`);
}

export async function updateToolPack(
	ctx: IExecuteFunctions,
	id: string,
	data: Partial<ToolPackRequest>,
): Promise<ToolPackResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'PATCH',
		url: `${BASE_URL}/tool-packs/${id}/`,
		body: data,
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function deleteToolPack(
	ctx: IExecuteFunctions,
	id: string,
): Promise<void> {
	await makeAuthenticatedRequest(ctx, {
		method: 'DELETE',
		url: `${BASE_URL}/tool-packs/${id}/`,
	});
}

// ── Connectors ──

export async function listConnectors(
	ctx: Context,
): Promise<ConnectorResponse[]> {
	return await fetchAllPages<ConnectorResponse>(ctx, `${BASE_URL}/connectors`);
}

export async function getConnector(
	ctx: IExecuteFunctions,
	slug: string,
): Promise<ConnectorResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'GET',
		url: `${BASE_URL}/connectors/${slug}`,
		json: true,
	});
}

// ── Link Tokens ──

export async function createLinkToken(
	ctx: IExecuteFunctions,
	registeredUserId: string,
	connector: string,
): Promise<LinkTokenResponse> {
	return await makeAuthenticatedRequest(ctx, {
		method: 'POST',
		url: `${BASE_URL}/registered-users/${registeredUserId}/link-token`,
		body: { connector },
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
}

// ── Credentials ──

export async function deleteCredential(
	ctx: IExecuteFunctions,
	registeredUserId: string,
	connectorSlug: string,
): Promise<void> {
	await makeAuthenticatedRequest(ctx, {
		method: 'DELETE',
		url: `${BASE_URL}/credentials/registered-users/${registeredUserId}/connectors/${connectorSlug}`,
	});
}

// ── Audit Log ──

export async function listAuditLog(
	ctx: IExecuteFunctions,
	qs: Record<string, string>,
): Promise<AuditLogEvent[]> {
	return await fetchAllPages<AuditLogEvent>(ctx, `${BASE_URL}/audit-log`, qs);
}

// ── Tool Search ──

export async function searchTools(
	ctx: IExecuteFunctions,
	toolPackId: string,
	registeredUserId: string,
	intent: string,
	connectorSlugs?: string[],
	maxResults?: number,
): Promise<{ tools: ToolSearchResult[]; total_results: number; intent: string }> {
	const body: Record<string, unknown> = { intent };
	if (connectorSlugs && connectorSlugs.length > 0) {
		body.connector_slugs = connectorSlugs;
	}
	if (maxResults) {
		body.max_results = maxResults;
	}
	return await makeAuthenticatedRequest(ctx, {
		method: 'POST',
		url: `${BASE_URL}/tool-packs/${toolPackId}/registered-users/${registeredUserId}/search`,
		body,
		json: true,
		headers: { 'Content-Type': 'application/json' },
	});
}
