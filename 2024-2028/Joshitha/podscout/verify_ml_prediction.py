
import asyncio
import sys
import os
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.getcwd())

def verify():
    print("Verifying ML Prediction Tool...")
    try:
        from backend.app.mcp_servers.ml_predictions import predict_pollution
        
        city = "Greater Noida"
        print(f"Calling predict_pollution for {city}...")
        
        # Tool handles its own async loop internally
        result = predict_pollution(city)
        
        if "error" in result:
            print(f"❌ Error: {result['error']}")
        else:
            print("✅ Prediction Success!")
            print(f"Model: {result['predictions'].get('model')}")
            print(f"Type: {result['predictions'].get('type')}")
            
            vals = result['predictions'].get('values')
            print(f"First 3 Predictions (Real Units):")
            for v in vals[:3]:
                # Print real range and Z-score
                print(f"  Node {v['node_id']}: {v.get('range_real', 'N/A')} (Z: {v.get('z_score', 'N/A')})")
            
    except ImportError as e:
        print(f"❌ Import Error: {e}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Verification Failed: {e}")

if __name__ == "__main__":
    verify()
