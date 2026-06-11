export interface MergeGatewayCredential {
	apiKey: string;
	url: string;
}

export interface MergeGatewayVendorInfo {
	capabilities?: {
		input?: string[];
		output?: string[];
	};
}

export interface MergeGatewayModel {
	/** Canonical model ID in provider/model format, e.g. "openai/gpt-4o" */
	model: string;
	provider?: string;
	display_name?: string;
	availability_status?: string;
	vendors?: Record<string, MergeGatewayVendorInfo>;
}

export interface MergeGatewayModelList {
	object?: string;
	data?: MergeGatewayModel[];
	has_more?: boolean;
	next_cursor?: string | null;
}
