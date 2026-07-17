"""
MCP Host Client with Multi-Transport Support

Supports both:
- stdio transport (for local servers like Analysis)
- HTTP/SSE transport (for remote servers like Supabase MCP)
"""
import sys
import os
from typing import Dict, Any, Optional
import logging
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client
from pydantic import AnyUrl

from ..config import settings

logger = logging.getLogger(__name__)


class MCPHost:
    """
    MCP Host with multi-transport support.
    
    Manages connections to:
    - Local stdio servers (Analysis)
    - Remote HTTP/SSE servers (Supabase MCP)
    """
    
    def __init__(self):
        self.sessions: Dict[str, ClientSession] = {}
        self.server_configs: Dict[str, Dict[str, Any]] = {}
        self.stdio_contexts: Dict[str, Any] = {}
        self.sse_contexts: Dict[str, Any] = {}
        self._initialized = False
    
    async def initialize(self):
        """Initialize and connect to all configured MCP servers."""
        if self._initialized:
            logger.info("MCP Host already initialized")
            return
        
        logger.info("Initializing MCP Host...")
        
        # Configure servers
        self.server_configs = {
            # Local stdio server - Analysis
            "analysis": {
                "transport": "stdio",
                "command": sys.executable,
                "args": ["-u", "-m", "backend.app.mcp_servers.analysis"],
                "env": {}
            },
            # Local stdio server - ML Predictions
            "ml_predictions": {
                "transport": "stdio",
                "command": sys.executable,
                "args": ["-u", "-m", "backend.app.mcp_servers.ml_predictions"],
                "env": {}
            }
        }
        
        # Supabase MCP server - Disabled to prevent websocket/asyncio conflicts
        # We use local 'analysis' MCP server with direct Supabase client instead
        # if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        #     project_ref = settings.SUPABASE_URL.split("//")[1].split(".")[0]
        #     self.server_configs["supabase_mcp"] = {
        #         "transport": "sse",
        #         "url": f"https://mcp.supabase.com/mcp?project_ref={project_ref}",
        #         "headers": {
        #             "Authorization": f"Bearer {settings.SUPABASE_KEY}"
        #         }
        #     }
        #     logger.info(f"  Supabase MCP configured for project: {project_ref}")
        
        # Connect to each server
        for name, config in self.server_configs.items():
            try:
                if config["transport"] == "stdio":
                    await self._connect_stdio_server(name, config)
                elif config["transport"] == "sse":
                    await self._connect_sse_server(name, config)
                
                logger.info(f"✓ Connected to MCP server: {name}")
            except Exception as e:
                logger.error(f"✗ Failed to connect to {name}: {e}")
        
        self._initialized = True
        logger.info(f"MCP Host initialized with {len(self.sessions)} server(s)")
    
    async def _connect_stdio_server(self, name: str, config: Dict[str, Any]):
        """Connect to a stdio MCP server (local)."""
        # Merge with current environment to ensure PYTHONPATH and system paths are preserved
        env = os.environ.copy()
        env.update(config.get("env", {}))
        
        server_params = StdioServerParameters(
            command=config["command"],
            args=config["args"],
            env=env
        )
        
        # Create stdio client context
        stdio_ctx = stdio_client(server_params)
        read_stream, write_stream = await stdio_ctx.__aenter__()
        
        # Store context for cleanup
        self.stdio_contexts[name] = stdio_ctx
        
        # Create ClientSession
        session = ClientSession(read_stream, write_stream)
        await session.initialize()
        
        self.sessions[name] = session
        logger.info(f"  stdio server '{name}' initialized")
    
    async def _connect_sse_server(self, name: str, config: Dict[str, Any]):
        """Connect to a SSE/HTTP MCP server (remote like Supabase)."""
        url = config["url"]
        headers = config.get("headers", {})
        
        try:
            # Create SSE client context
            sse_ctx = sse_client(url, headers=headers)
            read_stream, write_stream = await sse_ctx.__aenter__()
            
            # Store context for cleanup
            self.sse_contexts[name] = sse_ctx
            
            # Create ClientSession
            session = ClientSession(read_stream, write_stream)
            await session.initialize()
            
            self.sessions[name] = session
            logger.info(f"  SSE server '{name}' initialized")
        
        except Exception as e:
            logger.error(f"  Failed to connect to SSE server {name}: {e}")
            raise
    
    async def list_tools(self, server_name: Optional[str] = None) -> Dict[str, list]:
        """List all available tools from specified server or all servers."""
        if server_name:
            if server_name not in self.sessions:
                raise ValueError(f"Server '{server_name}' not found")
            
            session = self.sessions[server_name]
            result = await session.list_tools()
            
            # Convert to dict for JSON serialization
            tools = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.inputSchema
                }
                for tool in result.tools
            ]
            
            return {server_name: tools}
        
        # List from all servers
        all_tools = {}
        for name, session in self.sessions.items():
            try:
                result = await session.list_tools()
                all_tools[name] = [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.inputSchema
                    }
                    for tool in result.tools
                ]
            except Exception as e:
                logger.error(f"Error listing tools from {name}: {e}")
                all_tools[name] = []
        
        return all_tools
    
    async def call_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> Any:
        """Call a tool on a specific MCP server."""
        if server_name not in self.sessions:
            raise ValueError(f"Server '{server_name}' not found")
        
        session = self.sessions[server_name]
        
        try:
            result = await session.call_tool(tool_name, arguments)
            
            # Extract structured content if available
            if hasattr(result, 'structuredContent') and result.structuredContent:
                return result.structuredContent
            
            # Otherwise extract text content
            if result.content:
                content_item = result.content[0]
                if hasattr(content_item, 'text'):
                    return content_item.text
            
            return result
        except Exception as e:
            logger.error(f"Error calling tool {tool_name} on {server_name}: {e}")
            raise
    
    async def list_resources(self, server_name: Optional[str] = None) -> Dict[str, list]:
        """List all available resources from specified server or all servers."""
        if server_name:
            if server_name not in self.sessions:
                raise ValueError(f"Server '{server_name}' not found")
            
            session = self.sessions[server_name]
            result = await session.list_resources()
            
            resources = [
                {
                    "uri": str(resource.uri),
                    "name": resource.name,
                    "description": resource.description,
                    "mimeType": resource.mimeType
                }
                for resource in result.resources
            ]
            
            return {server_name: resources}
        
        # List from all servers
        all_resources = {}
        for name, session in self.sessions.items():
            try:
                result = await session.list_resources()
                all_resources[name] = [
                    {
                        "uri": str(resource.uri),
                        "name": resource.name,
                        "description": resource.description,
                        "mimeType": resource.mimeType
                    }
                    for resource in result.resources
                ]
            except Exception as e:
                logger.error(f"Error listing resources from {name}: {e}")
                all_resources[name] = []
        
        return all_resources
    
    async def read_resource(self, server_name: str, uri: str) -> str:
        """Read a resource from a specific MCP server."""
        if server_name not in self.sessions:
            raise ValueError(f"Server '{server_name}' not found")
        
        session = self.sessions[server_name]
        
        try:
            # Convert string URI to AnyUrl
            resource_uri = AnyUrl(uri)
            result = await session.read_resource(resource_uri)
            
            # Extract text content
            if result.contents:
                content_item = result.contents[0]
                if hasattr(content_item, 'text'):
                    return content_item.text
            
            return ""
        except Exception as e:
            logger.error(f"Error reading resource {uri} from {server_name}: {e}")
            raise
    
    async def list_prompts(self, server_name: Optional[str] = None) -> Dict[str, list]:
        """List all available prompts from specified server or all servers."""
        if server_name:
            if server_name not in self.sessions:
                raise ValueError(f"Server '{server_name}' not found")
            
            session = self.sessions[server_name]
            result = await session.list_prompts()
            
            prompts = [
                {
                    "name": prompt.name,
                    "description": prompt.description,
                    "arguments": prompt.arguments
                }
                for prompt in result.prompts
            ]
            
            return {server_name: prompts}
        
        # List from all servers
        all_prompts = {}
        for name, session in self.sessions.items():
            try:
                result = await session.list_prompts()
                all_prompts[name] = [
                    {
                        "name": prompt.name,
                        "description": prompt.description,
                        "arguments": prompt.arguments
                    }
                    for prompt in result.prompts
                ]
            except Exception as e:
                logger.error(f"Error listing prompts from {name}: {e}")
                all_prompts[name] = []
        
        return all_prompts
    
    async def get_prompt(
        self,
        server_name: str,
        prompt_name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get a prompt from a specific MCP server."""
        if server_name not in self.sessions:
            raise ValueError(f"Server '{server_name}' not found")
        
        session = self.sessions[server_name]
        
        try:
            result = await session.get_prompt(prompt_name, arguments)
            
            # Convert to dict for JSON serialization
            messages = []
            for msg in result.messages:
                if hasattr(msg.content, 'text'):
                    messages.append({
                        "role": msg.role,
                        "content": msg.content.text
                    })
            
            return {
                "description": result.description,
                "messages": messages
            }
        except Exception as e:
            logger.error(f"Error getting prompt {prompt_name} from {server_name}: {e}")
            raise
    
    def get_server_for_tool(self, tool_name: str) -> Optional[str]:
        """Find which server provides a given tool."""
        # Tool to server mapping
        tool_map = {
            # Analysis server tools
            "analyze_pollution_site": "analysis",
            "generate_deployment_strategy": "analysis",
            "query_hotspots": "analysis",
            # Supabase MCP tools (will be discovered dynamically)
            "execute_sql": "supabase_mcp",
            "query_table": "supabase_mcp"
        }
        return tool_map.get(tool_name)
    
    async def shutdown(self):
        """Close all server connections."""
        logger.info("Shutting down MCP Host...")
        
        # Close all stdio contexts
        for name, stdio_ctx in self.stdio_contexts.items():
            try:
                await stdio_ctx.__aexit__(None, None, None)
                logger.info(f"✓ Closed stdio connection to {name}")
            except Exception as e:
                logger.error(f"✗ Error closing stdio {name}: {e}")
        
        # Close all SSE contexts
        for name, sse_ctx in self.sse_contexts.items():
            try:
                await sse_ctx.__aexit__(None, None, None)
                logger.info(f"✓ Closed SSE connection to {name}")
            except Exception as e:
                logger.error(f"✗ Error closing SSE {name}: {e}")
        
        self.sessions.clear()
        self.stdio_contexts.clear()
        self.sse_contexts.clear()
        self._initialized = False
        logger.info("MCP Host shutdown complete")


# Global MCP host instance
mcp_host = MCPHost()
