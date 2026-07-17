# Supabase MCP Server Integration

## What You Have

Your Supabase project has an **official MCP server** at:
```
https://mcp.supabase.com/mcp?project_ref=vxoxitherkbtlsbbbxlj
```

This is **Supabase's own MCP server** that provides:
- ✅ Database operations via MCP
- ✅ Storage operations
- ✅ Functions
- ✅ Branching
- ✅ Real-time subscriptions

## How It Works

### Current Setup (Direct Supabase SDK)
```python
# We're currently using:
from supabase import create_client
supabase = create_client(url, key)
supabase.table("monitoring_sites").select("*")
```

### MCP Server Approach (Alternative)
```python
# Using Supabase's MCP server:
mcp_client.call_tool("supabase_query", {
    "table": "monitoring_sites",
    "operation": "select"
})
```

## Integration Options

### Option 1: Add to MCP Host (Recommended)

Add Supabase's MCP server as an additional server in our host:

**Update** `backend/app/mcp_host/client.py`:

```python
self.server_configs = {
    "analysis": {
        "command": "python",
        "args": ["-m", "backend.app.mcp_servers.analysis"],
        "env": {}
    },
    # Add Supabase MCP server (HTTP transport)
    "supabase_mcp": {
        "transport": "http",
        "url": "https://mcp.supabase.com/mcp",
        "params": {
            "project_ref": "vxoxitherkbtlsbbbxlj",
            "features": "database,storage,functions"
        },
        "headers": {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}"
        }
    }
}
```

### Option 2: Hybrid (Best of Both)

- **Use Supabase SDK** for our ingestion & storage (current)
- **Use Supabase MCP** for exposing database via MCP tools (frontend can call)

This way:
- Internal operations → Fast Supabase SDK
- External/Frontend operations → Standardized MCP interface

## What You Need

To connect to Supabase MCP server, you need:

1. **Project Reference**: `vxoxitherkbtlsbbbxlj` ✅ (you have it)
2. **Supabase API Key**: Your anon or service role key
3. **MCP URL**: `https://mcp.supabase.com/mcp` ✅ (you have it)

## Recommendation

I suggest **Option 2 (Hybrid)**:

### Keep Current Setup
- ✅ Ingestion scheduler uses Supabase SDK directly
- ✅ Feature aggregator uses Supabase SDK
- ✅ Fast, typed, direct database access

### Add Supabase MCP Server
- ✅ Expose database operations via MCP
- ✅ Frontend can use MCP to query database
- ✅ Unified MCP interface for all operations

## Want Me to Implement?

I can:
1. ✅ Add HTTP transport support to MCP host
2. ✅ Connect to your Supabase MCP server
3. ✅ Create endpoints to query via MCP
4. ✅ Keep existing fast Supabase SDK for internal operations

Just provide your **Supabase API key** and I'll integrate it!

**Note**: The Supabase MCP server is a nice-to-have, not required. Our current setup with the Supabase SDK is actually **faster and more direct** for our backend operations. The MCP server would be useful if you want to expose database queries through the standardized MCP protocol.
