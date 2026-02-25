import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ZodTypeAny } from 'zod';

import type { McpJsonSchemaProperty, McpToolInputSchema } from './types';

/**
 * Convert a JSON Schema property to a Zod schema.
 * Handles common types used in MCP tool schemas; falls back to z.any() for unsupported types.
 */
export function jsonSchemaPropertyToZod(schema: McpJsonSchemaProperty): ZodTypeAny {
	switch (schema.type) {
		case 'string': {
			if (schema.enum) {
				return z.enum(schema.enum as [string, ...string[]]);
			}
			let s = z.string();
			if (schema.description) {
				s = s.describe(schema.description);
			}
			return s;
		}
		case 'number':
		case 'integer': {
			let n = schema.type === 'integer' ? z.number().int() : z.number();
			if (schema.description) {
				n = n.describe(schema.description);
			}
			return n;
		}
		case 'boolean': {
			let b = z.boolean();
			if (schema.description) {
				b = b.describe(schema.description);
			}
			return b;
		}
		case 'array': {
			if (schema.items) {
				return z.array(jsonSchemaPropertyToZod(schema.items));
			}
			return z.array(z.any());
		}
		case 'object': {
			if (schema.properties) {
				return jsonSchemaToZodObject({
					type: 'object',
					properties: schema.properties,
					required: schema.required,
				});
			}
			return z.record(z.any());
		}
		default:
			return z.any();
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZodObject = z.ZodObject<any, any, any>;

/**
 * Convert an MCP tool inputSchema (JSON Schema object) to a z.object().
 */
export function jsonSchemaToZodObject(schema: McpToolInputSchema): AnyZodObject {
	const properties = schema.properties ?? {};
	const required = new Set(schema.required ?? []);
	const shape: Record<string, ZodTypeAny> = {};

	for (const [key, propSchema] of Object.entries(properties)) {
		let zodProp = jsonSchemaPropertyToZod(propSchema);
		if (!required.has(key)) {
			zodProp = zodProp.optional();
		}
		shape[key] = zodProp;
	}

	return z.object(shape);
}

/**
 * Create a single DynamicStructuredTool that dispatches to the correct MCP tool.
 * n8n v1.x expects exactly one tool per AiTool connection, so we create a single
 * dispatch tool that can call any of the available MCP tools by name.
 */
export function createMcpDispatchTool(
	toolPackName: string,
	mcpTools: Array<{ name: string; description?: string; inputSchema: McpToolInputSchema }>,
	callFn: (toolName: string, args: Record<string, unknown>) => Promise<string>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
	const toolNames = mcpTools.map((t) => t.name) as [string, ...string[]];
	const toolDescriptions = mcpTools
		.map((t) => `- ${t.name}: ${t.description ?? 'No description'}`)
		.join('\n');

	return new DynamicStructuredTool({
		name: toolPackName,
		description: `Execute tools from this Merge Tool Pack. Available tools:\n${toolDescriptions}\n\nSpecify the tool_name and provide its arguments.`,
		schema: z.object({
			tool_name: z.enum(toolNames).describe('The name of the tool to execute'),
			arguments: z
				.record(z.any())
				.optional()
				.describe('Arguments to pass to the tool as a JSON object'),
		}),
		func: async (input: { tool_name: string; arguments?: Record<string, unknown> }) => {
			return await callFn(input.tool_name, input.arguments ?? {});
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}
