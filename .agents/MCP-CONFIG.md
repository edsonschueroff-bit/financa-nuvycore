# MCP Configuration Handling

The live VPS keeps `.agents/mcp_config.json` as a local-only configuration file because it
contains operational credentials. Do not commit the real file.

Use `.agents/mcp_config.example.json` as the tracked shape reference and inject real values
through the approved local secret store or operator-managed environment. This preserves the
configuration contract without exposing secrets in GitHub, logs or Notion.
