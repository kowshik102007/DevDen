"""
Generic MCP API endpoints.

Provides REST API access to MCP servers for the frontend.
Routes tool calls, resource reads, and prompt requests to appropriate MCP servers.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import json

from ...mcp_host.client import mcp_host

router = APIRouter(prefix="/mcp", tags=["mcp"])


class ToolCallRequest(BaseModel):
    """Tool call request"""
    arguments: Dict[str, Any]


class PromptRequest(BaseModel):
    """Prompt request."""
    arguments: Dict[str, Any]


@router.get("/tools")
async def list_all_tools(server: Optional[str] = None):
    """
    List all available tools from MCP servers.
    
    Query param 'server' can filter to specific server.
    """
    try:
        tools = await mcp_host.list_tools(server)
        return {"tools": tools}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tools/{tool_name}")
async def call_tool(tool_name: str, request: ToolCallRequest):
    """
    Call an MCP tool.
    
    Automatically routes to the correct server based on tool name.
    """
    try:
        # Find which server has this tool
        server_name = mcp_host.get_server_for_tool(tool_name)
        
        if not server_name:
            raise HTTPException(
                status_code=404,
                detail=f"Tool '{tool_name}' not found"
            )
        
        # Call the tool
        result = await mcp_host.call_tool(
            server_name,
            tool_name,
            request.arguments
        )
        
        # Extract text content
        if result.content:
            text = result.content[0].text
            try:
                # Try to parse as JSON
                return {"result": json.loads(text)}
            except:
                return {"result": text}
        
        return {"result": None}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resources")
async def list_all_resources(server: Optional[str] = None):
    """
    List all available resources from MCP servers.
    
    Query param 'server' can filter to specific server.
    """
    try:
        resources = await mcp_host.list_resources(server)
        return {"resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resources/read")
async def read_resource(uri: str, server: Optional[str] = None):
    """
    Read a resource from an MCP server.
    
    If server not specified, tries to infer from URI scheme.
    """
    try:
        # Infer server from URI if not provided
        if not server:
            if uri.startswith("podscout://"):
                server = "analysis"
            elif uri.startswith("satellite://"):
                server = "satellite"
            elif uri.startswith("sensors://"):
                server = "sensors"
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot infer server from URI. Please specify 'server' param."
                )
        
        content = await mcp_host.read_resource(server, uri)
        
        try:
            # Try to parse as JSON
            return {"content": json.loads(content)}
        except:
            return {"content": content}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prompts")
async def list_all_prompts(server: Optional[str] = None):
    """
    List all available prompts from MCP servers.
    
    Query param 'server' can filter to specific server.
    """
    try:
        prompts = await mcp_host.list_prompts(server)
        return {"prompts": prompts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prompts/{prompt_name}")
async def get_prompt(prompt_name: str, request: PromptRequest, server: str = "analysis"):
    """
    Get a prompt from an MCP server.
    
    Returns the prompt template filled with provided arguments.
    """
    try:
        result = await mcp_host.get_prompt(
            server,
            prompt_name,
            request.arguments
        )
        
        # Extract messages
        messages = []
        for msg in result.messages:
            messages.append({
                "role": msg.role,
                "content": msg.content.text
            })
        
        return {
            "description": result.description,
            "messages": messages
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/servers")
async def list_servers():
    """List all connected MCP servers."""
    return {
        "servers": list(mcp_host.sessions.keys()),
        "initialized": mcp_host._initialized
    }
