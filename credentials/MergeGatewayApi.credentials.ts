import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MergeGatewayApi implements ICredentialType {
	name = 'mergeGatewayApi';

	displayName = 'Merge Gateway API';

	icon: ICredentialType['icon'] = {
		light: 'file:merge.svg',
		dark: 'file:merge-dark.svg',
	};

	documentationUrl = 'https://docs.merge.dev/merge-gateway/get-started';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Merge Gateway API key. Create one in the Merge Gateway dashboard under Settings &gt; API Keys.',
		},
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'hidden',
			default: 'https://api-gateway.merge.dev/v1',
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
			baseURL: '={{ $credentials.url }}',
			url: '/models',
			method: 'GET',
		},
	};
}
