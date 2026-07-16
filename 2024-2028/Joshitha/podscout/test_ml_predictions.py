"""
Test Script for ML Predictions

Tests the ML predictions MCP server and tools.
"""
import asyncio
import sys
sys.path.insert(0, '.')

from backend.app.mcp_host.client import MCPHost


async def test_ml_predictions():
    """Test ML predictions MCP server."""
    
    print("=" * 60)
    print("Testing ML Predictions MCP Server")
    print("=" * 60)
    
    # Create MCP host
    host = MCPHost()
    
    try:
        # Initialize (connects to all servers including ml_predictions)
        print("\n1. Initializing MCP Host...")
        await host.initialize()
        
        print(f"   ✓ Connected to {len(host.sessions)} server(s)")
        print(f"   Servers: {list(host.sessions.keys())}")
        
        # List tools from ML server
        print("\n2. Listing ML Prediction Tools...")
        ml_tools = await host.list_tools("ml_predictions")
        
        if "ml_predictions" in ml_tools:
            tools = ml_tools["ml_predictions"]
            print(f"   ✓ Found {len(tools)} ML tools:")
            for tool in tools:
                print(f"     - {tool['name']}: {tool['description']}")
        
        # Test predict_pollution tool
        print("\n3. Testing predict_pollution tool...")
        try:
            result = await host.call_tool(
                "ml_predictions",
                "predict_pollution",
                {"city": "Delhi", "forecast_hours": 24}
            )
            print(f"   ✓ Prediction result:")
            print(f"     {result}")
        except Exception as e:
            print(f"   ⚠ Prediction error: {e}")
        
        # Test detect_hotspots tool
        print("\n4. Testing detect_hotspots tool...")
        try:
            result = await host.call_tool(
                "ml_predictions",
                "detect_hotspots",
                {"city": "Delhi", "threshold_pm25": 100.0}
            )
            print(f"   ✓ Hotspot detection result:")
            print(f"     {result}")
        except Exception as e:
            print(f"   ⚠ Detection error: {e}")
        
        # Test deployment impact
        print("\n5. Testing evaluate_deployment_impact tool...")
        try:
            result = await host.call_tool(
                "ml_predictions",
                "evaluate_deployment_impact",
                {"site_ids": ["grid_28.69_77.19_L1"], "pod_capacity": 1000}
            )
            print(f"   ✓ Impact evaluation result:")
            print(f"     {result}")
        except Exception as e:
            print(f"   ⚠ Evaluation error: {e}")
        
        # List resources
        print("\n6. Listing ML Resources...")
        ml_resources = await host.list_resources("ml_predictions")
        
        if "ml_predictions" in ml_resources:
            resources = ml_resources["ml_predictions"]
            print(f"   ✓ Found {len(resources)} resources:")
            for resource in resources:
                print(f"     - {resource['uri']}: {resource['name']}")
        
        # Read model status resource
        print("\n7. Reading Model Status Resource...")
        try:
            status = await host.read_resource(
                "ml_predictions",
                "podscout://ml/model/status"
            )
            print(f"   ✓ Model status:")
            print(f"     {status[:500]}...")  # First 500 chars
        except Exception as e:
            print(f"   ⚠ Resource read error: {e}")
        
        print("\n" + "=" * 60)
        print("✅ ML Predictions MCP Server Test Complete!")
        print("=" * 60)
    
    finally:
        # Cleanup
        await host.shutdown()


if __name__ == "__main__":
    asyncio.run(test_ml_predictions())
