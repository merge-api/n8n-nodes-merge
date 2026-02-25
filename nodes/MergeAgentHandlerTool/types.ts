export interface MergeToolPack {
	id: string;
	name: string;
	description?: string;
	connectors?: Array<{ name: string; slug: string }>;
}

export interface MergeRegisteredUser {
	id: string;
	origin_user_id?: string;
	origin_user_name?: string;
	shared_credential_group?: {
		origin_company_id?: string;
		origin_company_name?: string;
	};
	user_type?: string;
	authenticated_connectors?: string[];
	is_test?: boolean;
}

export interface McpToolInputSchema {
	type: 'object';
	properties?: Record<string, McpJsonSchemaProperty>;
	required?: string[];
}

export interface McpJsonSchemaProperty {
	type?: string;
	description?: string;
	enum?: string[];
	items?: McpJsonSchemaProperty;
	properties?: Record<string, McpJsonSchemaProperty>;
	required?: string[];
}

export interface McpTool {
	name: string;
	description?: string;
	inputSchema: McpToolInputSchema;
}

export interface McpJsonRpcRequest {
	jsonrpc: '2.0';
	id: number;
	method: string;
	params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
	jsonrpc: '2.0';
	id: number;
	result?: {
		tools?: McpTool[];
		content?: Array<{ type: string; text: string }>;
		isError?: boolean;
		[key: string]: unknown;
	};
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}
