# n8n-nodes-merge

This is an n8n community node that connects AI agents to [Merge Agent Handler](https://merge.dev/agent-handler) Tool Packs via [MCP (Model Context Protocol)](https://modelcontextprotocol.io/).

Merge Agent Handler gives your AI agents access to pre-built integrations across HRIS, ATS, CRM, Accounting, Ticketing, File Storage, and more — all through a single API.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) |
[Configuration](#configuration) |
[Compatibility](#compatibility) |
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Configuration

### Prerequisites

1. A [Merge Agent Handler](https://ah.merge.dev/) account
2. An API key (Production or Test Access Key) from the Merge Agent Handler dashboard
3. At least one [Tool Pack](https://ah.merge.dev/tool-packs) created with connectors configured
4. At least one [Registered User](https://ah.merge.dev/registered-users) with connectors pre-authenticated

### Setup

1. In n8n, add the **Merge Agent Handler Tool** node to your workflow
2. Create a new credential with your Merge Agent Handler API key
3. Select a **Tool Pack** from the dropdown
4. Choose an **Environment** (Production or Test)
5. Select a **Registered User** from the dropdown
6. Connect the node's tool output to an AI Agent node

The node exposes all tools from the selected Tool Pack to the connected AI agent. The agent can then call any of the available tools to interact with the integrations configured in the Tool Pack.

## Compatibility

- Requires n8n version 1.50.0 or later
- Tested with n8n v1.76.1

## Resources

- [Merge Agent Handler Documentation](https://docs.ah.merge.dev/Overview/Agent-Handler-intro)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Merge Agent Handler Dashboard](https://ah.merge.dev/)

## License

[MIT](LICENSE)
