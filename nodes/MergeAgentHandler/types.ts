export interface RegisteredUserRequest {
	origin_user_id: string;
	origin_user_name: string;
	shared_credential_group?: {
		origin_company_id?: string;
		origin_company_name?: string;
		custom_groupings?: Record<string, string>;
	};
	user_type?: 'HUMAN' | 'SYSTEM';
}

export interface RegisteredUserResponse {
	id: string;
	origin_user_id: string;
	origin_user_name: string;
	shared_credential_group?: {
		origin_company_id?: string;
		origin_company_name?: string;
		custom_groupings?: Record<string, string>;
	};
	user_type?: string;
	authenticated_connectors?: string[];
	is_test?: boolean;
}

export interface ToolPackConnectorWrite {
	connector_id: string;
	auth_scope?: 'INDIVIDUAL' | 'SHARED' | 'ORGANIZATION';
	tool_names?: string[];
}

export interface ToolPackRequest {
	name: string;
	description: string;
	connectors: ToolPackConnectorWrite[];
}

export interface ToolPackConnectorRead {
	name: string;
	slug: string;
	source_url?: string;
	logo_url?: string;
	categories?: string[];
	tools?: Array<{ name: string; description?: string }>;
}

export interface ToolPackResponse {
	id: string;
	name: string;
	description?: string;
	connectors?: ToolPackConnectorRead[];
}

export interface ConnectorResponse {
	id: string;
	name: string;
	slug: string;
	description?: string;
	logo_url?: string;
	tools?: Array<{ name: string; description?: string }>;
}

export interface LinkTokenResponse {
	link_token: string;
}

export interface AuditLogEvent {
	id: string;
	user_name?: string;
	user_email?: string;
	role?: string;
	ip_address?: string;
	event_type: string;
	event_description?: string;
	created_at: string;
}

export interface ToolSearchResult {
	name: string;
	fully_qualified_name?: string;
	human_name?: string;
	description?: string;
	input_schema?: Record<string, unknown>;
	relevance_score?: number;
	reasoning?: string;
}

export interface PaginatedResponse<T> {
	count?: number;
	next?: string;
	previous?: string;
	results: T[];
}
