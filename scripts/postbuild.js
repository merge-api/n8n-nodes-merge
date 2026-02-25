#!/usr/bin/env node

/**
 * Regenerate dist/types/ and dist/known/ metadata files after build.
 *
 * n8n's LazyPackageDirectoryLoader requires these files to discover
 * community nodes and credentials. The n8n-node build tool wipes them
 * on each build, so this script must run afterwards.
 */

const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');

// Ensure directories exist
fs.mkdirSync(path.join(dist, 'types'), { recursive: true });
fs.mkdirSync(path.join(dist, 'known'), { recursive: true });

// Load compiled classes
const { MergeAgentHandlerTool } = require(path.join(
	dist,
	'nodes/MergeAgentHandlerTool/MergeAgentHandlerTool.node.js',
));
const { MergeAgentHandlerApi } = require(path.join(
	dist,
	'credentials/MergeAgentHandlerApi.credentials.js',
));

const node = new MergeAgentHandlerTool();
const cred = new MergeAgentHandlerApi();

// ── dist/types/nodes.json ──
const nodeDesc = { ...node.description };
delete nodeDesc.icon;
nodeDesc.iconUrl =
	'icons/n8n-nodes-merge/dist/nodes/MergeAgentHandlerTool/merge.svg';
fs.writeFileSync(
	path.join(dist, 'types/nodes.json'),
	JSON.stringify([nodeDesc], null, '\t'),
);

// ── dist/types/credentials.json ──
fs.writeFileSync(
	path.join(dist, 'types/credentials.json'),
	JSON.stringify(
		[
			{
				name: cred.name,
				displayName: cred.displayName,
				documentationUrl: cred.documentationUrl,
				properties: cred.properties,
				authenticate: cred.authenticate,
				test: cred.test,
				supportedNodes: ['mergeAgentHandlerTool'],
			},
		],
		null,
		'\t',
	),
);

// ── dist/known/nodes.json ──
fs.writeFileSync(
	path.join(dist, 'known/nodes.json'),
	JSON.stringify(
		{
			mergeAgentHandlerTool: {
				className: 'MergeAgentHandlerTool',
				sourcePath:
					'dist/nodes/MergeAgentHandlerTool/MergeAgentHandlerTool.node.js',
			},
		},
		null,
		'\t',
	),
);

// ── dist/known/credentials.json ──
fs.writeFileSync(
	path.join(dist, 'known/credentials.json'),
	JSON.stringify(
		{
			mergeAgentHandlerApi: {
				className: 'MergeAgentHandlerApi',
				sourcePath: 'dist/credentials/MergeAgentHandlerApi.credentials.js',
				supportedNodes: ['mergeAgentHandlerTool'],
			},
		},
		null,
		'\t',
	),
);

console.log('postbuild: regenerated dist/types/ and dist/known/ metadata');
