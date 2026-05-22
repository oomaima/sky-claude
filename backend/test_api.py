import requests

base_url = "http://localhost:8000"

def test():
    # 1. Login
    print("Logging in...")
    res = requests.post(f"{base_url}/api/auth/token", data={
        "username": "admin@genviz.com",
        "password": "password"
    })
    
    if res.status_code != 200:
        print("Login failed:", res.text)
        return
        
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Test Chat Endpoint - FINANCIAL
    print("\n--- Testing FINANCIAL Agent ---")
    res = requests.post(f"{base_url}/api/chat/", headers=headers, json={
        "user_query": "What is the revenue for BA in 2024?",
        "semantic_model": "FINANCIAL"
    })
    if res.status_code == 200:
        data = res.json()
        print("DAX Query Generated:\n", data["dax_query"])
        print("\nData Sample:\n", data["raw_data"][:2] if data["raw_data"] else "No data returned")
        print("\nError:\n", data["error"])
    else:
        print("Error:", res.text)

if __name__ == "__main__":
    test()
