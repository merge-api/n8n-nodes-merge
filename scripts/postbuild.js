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

// Copy SVG icons and codex .node.json files to dist (tsc only compiles .ts files)
const nodeDirs = ['MergeAgentHandler', 'MergeAgentHandlerTools'];
for (const dir of nodeDirs) {
	const srcDir = path.resolve(__dirname, '..', 'nodes', dir);
	const destDir = path.join(dist, 'nodes', dir);
	const svg = path.join(srcDir, 'merge.svg');
	if (fs.existsSync(svg)) {
		fs.copyFileSync(svg, path.join(destDir, 'merge.svg'));
	}
	const jsonFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.node.json'));
	for (const jsonFile of jsonFiles) {
		fs.copyFileSync(path.join(srcDir, jsonFile), path.join(destDir, jsonFile));
	}
}

// Load compiled classes
const { MergeAgentHandlerTools } = require(path.join(
	dist,
	'nodes/MergeAgentHandlerTools/MergeAgentHandlerTools.node.js',
));
const { MergeAgentHandler } = require(path.join(
	dist,
	'nodes/MergeAgentHandler/MergeAgentHandler.node.js',
));
const { MergeAgentHandlerApi } = require(path.join(
	dist,
	'credentials/MergeAgentHandlerApi.credentials.js',
));

const toolsNode = new MergeAgentHandlerTools();
const apiNode = new MergeAgentHandler();
const cred = new MergeAgentHandlerApi();

// ── dist/types/nodes.json ──
const toolsDesc = { ...toolsNode.description };
delete toolsDesc.icon;
toolsDesc.iconUrl =
	'icons/n8n-nodes-merge/dist/nodes/MergeAgentHandlerTools/merge.svg';

const apiDesc = { ...apiNode.description };
delete apiDesc.icon;
apiDesc.iconUrl =
	'icons/n8n-nodes-merge/dist/nodes/MergeAgentHandler/merge.svg';

fs.writeFileSync(
	path.join(dist, 'types/nodes.json'),
	JSON.stringify([toolsDesc, apiDesc], null, '\t'),
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
				supportedNodes: ['mergeAgentHandlerTools', 'mergeAgentHandler'],
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
			mergeAgentHandlerTools: {
				className: 'MergeAgentHandlerTools',
				sourcePath:
					'dist/nodes/MergeAgentHandlerTools/MergeAgentHandlerTools.node.js',
			},
			mergeAgentHandler: {
				className: 'MergeAgentHandler',
				sourcePath:
					'dist/nodes/MergeAgentHandler/MergeAgentHandler.node.js',
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
				supportedNodes: ['mergeAgentHandlerTools', 'mergeAgentHandler'],
			},
		},
		null,
		'\t',
	),
);

console.log('postbuild: regenerated dist/types/ and dist/known/ metadata');
