import msal
import httpx
from typing import Dict, Any
from app.core.config import settings

class PowerBIClient:
    def __init__(self):
        self.tenant_id = settings.POWERBI_TENANT_ID
        self.client_id = settings.POWERBI_CLIENT_ID
        self.client_secret = settings.POWERBI_CLIENT_SECRET
        self.workspace_id = settings.POWERBI_WORKSPACE_ID
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.scope = ["https://analysis.windows.net/powerbi/api/.default"]

        self.app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=self.authority,
            client_credential=self.client_secret,
        )

    async def _get_access_token(self) -> str:
        result = self.app.acquire_token_silent(self.scope, account=None)
        if not result:
            result = self.app.acquire_token_for_client(scopes=self.scope)
        if "access_token" in result:
            return result["access_token"]
        else:
            raise Exception(f"Failed to acquire token: {result.get('error_description', 'Unknown error')}")

    async def execute_dax_query(self, dataset_id: str, query: str) -> Dict[str, Any]:
        token = await self._get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        url = f"https://api.powerbi.com/v1.0/myorg/groups/{self.workspace_id}/datasets/{dataset_id}/executeQueries"
        payload = {
            "queries": [{"query": query}],
            "serializerSettings": {"incudeNulls": True}
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=60.0)
            
            if response.status_code == 200:
                data = response.json()
                # Parse out the actual rows from the PBI executeQueries response
                try:
                    return data["results"][0]["tables"][0]["rows"]
                except (KeyError, IndexError):
                    return []
            else:
                raise Exception(f"Power BI API error ({response.status_code}): {response.text}")

pbi_client = PowerBIClient()
