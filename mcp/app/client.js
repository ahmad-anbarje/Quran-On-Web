// The MCP Apps client, bundled into player.html so the sandbox loads nothing from outside
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';

window.McpApps = { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts };
