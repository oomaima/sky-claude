import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.agent_workflow import process_chat

async def test_agent():
    print("Testing FINANCIAL agent...")
    res1 = await process_chat("Show me IAG margin for 2024", "FINANCIAL")
    print("DAX QUERY:\n", res1.get("dax_query"))
    print("\nERROR:\n", res1.get("error"))
    
    print("\n" + "="*50 + "\n")
    
    print("Testing OPERATIONS agent...")
    res2 = await process_chat("Show me punctuality for BA", "OPERATIONS")
    print("DAX QUERY:\n", res2.get("dax_query"))
    print("\nERROR:\n", res2.get("error"))
    
    print("\n" + "="*50 + "\n")
    
    print("Testing COMPETITORS agent...")
    res3 = await process_chat("Compare total revenue of IAG and AF-KLM in 2024", "COMPETITORS")
    print("DAX QUERY:\n", res3.get("dax_query"))
    print("\nERROR:\n", res3.get("error"))

if __name__ == "__main__":
    asyncio.run(test_agent())
