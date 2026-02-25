import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MergeAgentHandlerApi implements ICredentialType {
	name = 'mergeAgentHandlerApi';

	displayName = 'Merge Agent Handler API';

	documentationUrl = 'https://docs.ah.merge.dev/Overview/Agent-Handler-intro';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Merge Agent Handler API key (Production or Test Access Key)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://ah-api.merge.dev/api/v1',
			url: '/tool-packs/',
			method: 'GET',
		},
	};
}
